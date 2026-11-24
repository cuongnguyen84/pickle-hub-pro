// create-post: authenticated users create a photo post (UGC v1).
// Image processing happens on the client (the web composer normalizes
// to WebP <=1600px via canvas, which also strips EXIF; the iOS app uses
// its ImagePipeline). This function validates and stores: it sniffs the
// real format from magic bytes (the browser-declared MIME type is not
// trusted), checks the container is complete, caps dimensions parsed
// from the header, then stores the bytes in the post-images bucket and
// inserts the social_posts row. The row's initial status (pending vs
// approved) is decided by the social_posts_set_initial_status trigger -
// this function inserts with the service role and returns the stored
// row so the client can tell the author whether the post is live or
// queued.
//
// History: v1 re-encoded server-side with imagescript, but its decoder
// throws on every input in this runtime (verified 2026-11-24: valid
// JPEG/PNG/WebP all came back image_undecodable, which is why the first
// real admin post failed with a generic client toast). Do not
// reintroduce a server-side decode step without an end-to-end probe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getAuthUser } from "../_shared/auth.ts";
import { supabaseClientPostCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BODY_CHARS = 2000;
const MAX_DIMENSION = 12000;
const TOPICS = new Set([
  "tim-ban-danh",
  "hoi-ky-thuat",
  "khoe-vot",
  "ket-qua",
  "open-play",
]);
const BUCKET = "post-images";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SniffedImage {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
}

/** Identify the real image format from magic bytes. */
function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  ) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 &&
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * Cheap completeness check per container (no decode): a truncated or
 * corrupt upload is rejected instead of stored as a broken image.
 */
function containerComplete(bytes: Uint8Array, mime: SniffedImage["mime"]): boolean {
  if (mime === "image/jpeg") {
    // Must end with the EOI marker FF D9 (small trailing padding allowed).
    const floor = Math.max(0, bytes.length - 64);
    for (let i = bytes.length - 2; i >= floor; i--) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true;
    }
    return false;
  }
  if (mime === "image/png") {
    // Final chunk must be IEND: 00 00 00 00 49 45 4E 44 AE 42 60 82.
    const iend = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    if (bytes.length < iend.length) return false;
    const start = bytes.length - iend.length;
    return iend.every((b, i) => bytes[start + i] === b);
  }
  // WebP: the RIFF size field must account for (nearly) the whole file.
  const declared = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) |
    (bytes[7] << 24);
  return Math.abs(declared + 8 - bytes.length) <= 1;
}

/** Parse pixel dimensions from the header; null when not parseable. */
function imageDimensions(
  bytes: Uint8Array,
  mime: SniffedImage["mime"],
): { width: number; height: number } | null {
  try {
    if (mime === "image/png") {
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) |
        bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) |
        (bytes[22] << 8) | bytes[23];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (mime === "image/webp") {
      // Only the VP8X header carries plain dimensions; lossy/lossless
      // bitstreams pack them - those are accepted without a reading.
      const isVp8x = bytes[12] === 0x56 && bytes[13] === 0x50 &&
        bytes[14] === 0x38 && bytes[15] === 0x58;
      if (!isVp8x) return null;
      const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
      const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      return { width, height };
    }
    // JPEG: walk segments to the first SOF marker.
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (
        marker === 0xd8 || marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        i += 2;
        continue;
      }
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2) return null;
      if (
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 &&
        marker !== 0xc8 && marker !== 0xcc
      ) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return width > 0 && height > 0 ? { width, height } : null;
      }
      i += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "not_configured" }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await getAuthUser(req, authClient);
  if (!user) return json({ error: "unauthorized" }, 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "invalid_form" }, 400);
  }

  const image = form.get("image");
  if (!(image instanceof File)) return json({ error: "image_required" }, 400);
  if (image.size > MAX_IMAGE_BYTES) {
    return json({ error: "image_too_large" }, 413);
  }

  const rawBody = form.get("body");
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (body.length > MAX_BODY_CHARS) {
    return json({ error: "body_too_long" }, 400);
  }

  const rawTopic = form.get("topic");
  const topic = typeof rawTopic === "string" && rawTopic ? rawTopic : null;
  if (topic !== null && !TOPICS.has(topic)) {
    return json({ error: "topic_not_allowed" }, 400);
  }

  // Validate from the bytes themselves. The declared MIME type is only
  // advisory: browsers and phones report it inconsistently (and the
  // first version of this function rejected good uploads on it).
  const bytes = new Uint8Array(await image.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) return json({ error: "image_type_not_allowed" }, 415);
  if (!containerComplete(bytes, sniffed.mime)) {
    return json({ error: "image_undecodable" }, 415);
  }
  const dims = imageDimensions(bytes, sniffed.mime);
  if (dims && (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION)) {
    return json({ error: "image_dimensions_too_large" }, 413);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const path = `${user.id}/${crypto.randomUUID()}.${sniffed.ext}`;
  const upload = await service.storage.from(BUCKET).upload(path, bytes, {
    contentType: sniffed.mime,
    upsert: false,
  });
  if (upload.error) return json({ error: "upload_failed" }, 502);

  const imageUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
  const { data: post, error: insertError } = await service
    .from("social_posts")
    .insert({
      author_id: user.id,
      kind: "post",
      body: body || null,
      image_url: imageUrl,
      topic,
    })
    .select("id, author_id, kind, body, image_url, topic, status, created_at")
    .single();
  if (insertError || !post) {
    await service.storage.from(BUCKET).remove([path]);
    return json({ error: "insert_failed" }, 502);
  }

  return json({ post }, 201);
});

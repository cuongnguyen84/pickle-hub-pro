// create-post: authenticated users create a photo post (UGC v1).
// The uploaded image is re-encoded to WebP here, which strips EXIF and
// caps the long edge; the original upload is never stored. The row's
// initial status (pending vs approved) is decided by the
// social_posts_set_initial_status trigger on the database side - this
// function inserts with the service role and returns the stored row so
// the client can tell the author whether the post is live or queued.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { supabaseClientPostCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_BODY_CHARS = 2000;
const MAX_LONG_EDGE = 1600;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
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
  if (!ALLOWED_MIME.has(image.type)) {
    return json({ error: "image_type_not_allowed" }, 415);
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

  // Re-encode to WebP: strips EXIF and normalizes what the public bucket
  // serves. A decode failure means the upload is not a real image in an
  // allowed format - reject it instead of storing the original bytes.
  let webp: Uint8Array;
  try {
    const decoded = await Image.decode(
      new Uint8Array(await image.arrayBuffer()),
    );
    const longEdge = Math.max(decoded.width, decoded.height);
    if (longEdge > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / longEdge;
      decoded.resize(
        Math.round(decoded.width * scale),
        Math.round(decoded.height * scale),
      );
    }
    webp = await decoded.encodeWEBP(82);
  } catch {
    return json({ error: "image_undecodable" }, 415);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const upload = await service.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { simpleCorsHeaders as corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // First verify the user with their token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log(`Processing account deletion for user: ${userId}`);

    // Use service role client for deletion operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Shop owners are offboarded by hand, in the closed pilot (B12) ───────
    // This runs BEFORE anything is deleted, and that ordering is the whole
    // point. Below, the cleanup walks a list of tables and only calls
    // deleteUser at the very end, with no transaction around any of it — so a
    // refusal that arrives from Postgres at the last step arrives after the
    // account has already been taken apart.
    //
    // Today that does not happen, and only by luck: service_role holds no
    // DELETE on those tables, so every step fails harmlessly (B14). Grant them
    // without moving this check first and the loop becomes a real partial
    // deletion. The check is here so that fix stays safe whenever it lands.
    //
    // The FK (shops.owner_user_id ON DELETE RESTRICT) still backs this up, but
    // it is not the contract: GoTrue flattens it into "Database error deleting
    // user", which tells a seller nothing and tells an operator less.
    //
    // Ownership, not membership. A manager or support account attached through
    // shop_members is not blocked — they own nothing, so nothing is orphaned
    // when they leave.
    const { count: ownedShops, error: ownershipError } = await supabaseAdmin
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId);

    if (ownershipError) {
      // Fail closed. Not knowing whether this account owns a shop is not a
      // reason to start deleting it.
      console.error("Ownership check failed:", ownershipError);
      return new Response(JSON.stringify({
        error: "ownership_check_failed",
        code: "ownership_check_failed",
        message: "Không kiểm tra được tài khoản này có shop hay không. Chưa xoá gì cả — vui lòng thử lại.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((ownedShops ?? 0) > 0) {
      // A stable code the UI can branch on. Replaying this request returns the
      // identical response and changes nothing, because nothing has run yet.
      return new Response(JSON.stringify({
        error: "shop_owner_offboarding_required",
        code: "shop_owner_offboarding_required",
        shop_count: ownedShops,
        contact_email: "tapickleballvn@gmail.com",
        message:
          "Tài khoản này đang sở hữu một shop. Để đóng shop và tài khoản an toàn, " +
          "vui lòng gửi yêu cầu tới tapickleballvn@gmail.com.",
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete user data from all relevant tables (order matters due to foreign keys)
    const tablesToClean = [
      // Notifications
      { table: "notifications", column: "user_id" },
      // Comments & Likes
      { table: "comments", column: "user_id" },
      { table: "likes", column: "user_id" },
      // Follow relationships
      { table: "follows", column: "follower_user_id" },
      // Quick Tables created by user
      { table: "quick_tables", column: "creator_user_id" },
      // Team match roster entries
      { table: "team_match_roster", column: "user_id" },
      // Team match tournaments created by user
      { table: "team_match_tournaments", column: "created_by" },
      // Doubles elimination tournaments
      { table: "doubles_elimination_tournaments", column: "creator_user_id" },
      // Partner invitations
      { table: "partner_invitations", column: "inviter_user_id" },
      { table: "partner_invitations", column: "invitee_user_id" },
      // User roles
      { table: "user_roles", column: "user_id" },
      // Creator profiles (organization members)
      { table: "organization_members", column: "user_id" },
      // Profile (last, before auth deletion)
      { table: "profiles", column: "id" },
    ];

    const errors: string[] = [];

    for (const { table, column } of tablesToClean) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, userId);
      
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
        errors.push(`${table}: ${error.message}`);
      } else {
        console.log(`Deleted user data from ${table}`);
      }
    }

    // Delete user's avatar from storage if exists
    const { data: avatarFiles } = await supabaseAdmin.storage
      .from("avatars")
      .list(userId);

    if (avatarFiles && avatarFiles.length > 0) {
      const filePaths = avatarFiles.map(f => `${userId}/${f.name}`);
      await supabaseAdmin.storage.from("avatars").remove(filePaths);
      console.log(`Deleted ${filePaths.length} avatar files`);
    }

    // Finally, delete the auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      return new Response(JSON.stringify({ 
        error: "Failed to delete account",
        details: deleteAuthError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Account deleted successfully",
      warnings: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

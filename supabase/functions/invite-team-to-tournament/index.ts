import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Pickle Hub <no-reply@mail.thepicklehub.net>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  return response.json();
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  captainEmail: string;
  tournamentId: string;
  tournamentName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { captainEmail, tournamentId, tournamentName }: InviteRequest = await req.json();

    // Verify caller is the tournament creator
    const { data: tournament, error: tournamentError } = await supabase
      .from('team_match_tournaments')
      .select('created_by')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return new Response(
        JSON.stringify({ success: false, error: 'Giải đấu không tồn tại' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tournament.created_by !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không có quyền mời đội vào giải này' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email via profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .eq('email', captainEmail.toLowerCase().trim())
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email này chưa đăng ký tài khoản trong hệ thống' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find master team where this user is captain
    const { data: masterTeam, error: masterTeamError } = await supabase
      .from('master_teams')
      .select('id, team_name')
      .eq('captain_user_id', profile.id)
      .single();

    if (masterTeamError || !masterTeam) {
    return new Response(
      JSON.stringify({ success: false, error: 'Người dùng này chưa có đội (Master Team). Họ cần tạo đội trước.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

    // Check if team is already registered for this tournament
    const { data: existingTeam, error: existingError } = await supabase
      .from('team_match_teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('master_team_id', masterTeam.id)
      .maybeSingle();

    if (existingTeam) {
      return new Response(
        JSON.stringify({ success: false, error: 'Đội này đã đăng ký giải đấu rồi' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create team entry with auto-approved status
    const { data: newTeam, error: createError } = await supabase
      .from('team_match_teams')
      .insert({
        tournament_id: tournamentId,
        team_name: masterTeam.team_name,
        captain_user_id: profile.id,
        master_team_id: masterTeam.id,
        status: 'approved', // Auto approve
        invite_code: crypto.randomUUID().slice(0, 8).toUpperCase(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Create team error:', createError);
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể tạo đội: ' + createError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Copy roster from master team
    const { data: masterRoster, error: rosterFetchError } = await supabase
      .from('master_team_roster')
      .select('*')
      .eq('master_team_id', masterTeam.id);

    if (!rosterFetchError && masterRoster && masterRoster.length > 0) {
      const rosterInserts = masterRoster.map(member => ({
        team_id: newTeam.id,
        player_name: member.player_name,
        gender: member.gender,
        skill_level: member.skill_level,
        is_captain: member.is_captain,
        user_id: member.user_id,
        status: 'confirmed',
      }));

      await supabase
        .from('team_match_roster')
        .insert(rosterInserts);
    }

    // Send notification email
    try {
      await sendEmail(
        captainEmail,
        `🏆 Đội của bạn đã được mời tham gia ${tournamentName}`,
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #16a34a;">🎉 Chúc mừng!</h1>
            <p>Đội <strong>${masterTeam.team_name}</strong> của bạn đã được BTC mời tham gia giải đấu:</p>
            <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h2 style="margin: 0 0 8px 0; color: #333;">${tournamentName}</h2>
              <p style="margin: 0; color: #666;">Trạng thái: <span style="color: #16a34a; font-weight: bold;">Đã được duyệt ✓</span></p>
            </div>
            <p>Bạn có thể truy cập trang giải đấu để:</p>
            <ul>
              <li>Xem lịch thi đấu</li>
              <li>Quản lý đội hình</li>
              <li>Đăng ký Line up cho các trận đấu</li>
            </ul>
            <p style="color: #666; font-size: 14px;">— The Pickle Hub Team</p>
          </div>
        `
      );
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Don't fail the whole operation if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        team: newTeam,
        message: `Đã mời đội "${masterTeam.team_name}" thành công` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in invite-team-to-tournament:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);

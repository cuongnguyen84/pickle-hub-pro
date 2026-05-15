export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          actor_type: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          event_category: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          severity: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          event_category: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      blog_post_seed_views: {
        Row: {
          created_at: string
          lang: Database["public"]["Enums"]["blog_lang"]
          seed_count: number
          slug: string
        }
        Insert: {
          created_at?: string
          lang: Database["public"]["Enums"]["blog_lang"]
          seed_count: number
          slug: string
        }
        Update: {
          created_at?: string
          lang?: Database["public"]["Enums"]["blog_lang"]
          seed_count?: number
          slug?: string
        }
        Relationships: []
      }
      blog_post_views: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          lang: Database["public"]["Enums"]["blog_lang"]
          referrer_source: string | null
          session_hash: string | null
          slug: string
          viewer_user_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          lang: Database["public"]["Enums"]["blog_lang"]
          referrer_source?: string | null
          session_hash?: string | null
          slug: string
          viewer_user_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          lang?: Database["public"]["Enums"]["blog_lang"]
          referrer_source?: string | null
          session_hash?: string | null
          slug?: string
          viewer_user_id?: string | null
        }
        Relationships: []
      }
      chat_highlighted_users: {
        Row: {
          created_at: string
          created_by: string
          highlight_type: Database["public"]["Enums"]["chat_highlight_type"]
          id: string
          livestream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          highlight_type?: Database["public"]["Enums"]["chat_highlight_type"]
          id?: string
          livestream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          highlight_type?: Database["public"]["Enums"]["chat_highlight_type"]
          id?: string
          livestream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_highlighted_users_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_highlighted_users_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "public_livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_likes: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_likes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          avatar_url: string | null
          client_message_id: string | null
          created_at: string
          display_name: string
          id: string
          livestream_id: string
          message: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          client_message_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          livestream_id: string
          message: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          client_message_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          livestream_id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "public_livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mutes: {
        Row: {
          created_at: string
          id: string
          livestream_id: string
          muted_until: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          livestream_id: string
          muted_until: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          livestream_id?: string
          muted_until?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mutes_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mutes_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "public_livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_pinned_messages: {
        Row: {
          id: string
          livestream_id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          id?: string
          livestream_id: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          id?: string
          livestream_id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_pinned_messages_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: true
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_pinned_messages_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: true
            referencedRelation: "public_livestreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_settings: {
        Row: {
          is_chat_enabled: boolean
          livestream_id: string
          slow_mode_seconds: number
          updated_at: string
        }
        Insert: {
          is_chat_enabled?: boolean
          livestream_id: string
          slow_mode_seconds?: number
          updated_at?: string
        }
        Update: {
          is_chat_enabled?: boolean
          livestream_id?: string
          slow_mode_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_settings_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: true
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_settings_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: true
            referencedRelation: "public_livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          ai_highlights_json: Json | null
          ai_processed: boolean | null
          caption: string | null
          caption_vi: string | null
          created_at: string | null
          duration_seconds: number | null
          height: number | null
          id: string
          is_public: boolean | null
          match_id: string | null
          storage_path: string
          thumbnail_path: string | null
          uploaded_by: string
          view_count: number | null
          width: number | null
        }
        Insert: {
          ai_highlights_json?: Json | null
          ai_processed?: boolean | null
          caption?: string | null
          caption_vi?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          is_public?: boolean | null
          match_id?: string | null
          storage_path: string
          thumbnail_path?: string | null
          uploaded_by: string
          view_count?: number | null
          width?: number | null
        }
        Update: {
          ai_highlights_json?: Json | null
          ai_processed?: boolean | null
          caption?: string | null
          caption_vi?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          is_public?: boolean | null
          match_id?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          uploaded_by?: string
          view_count?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
          user_id?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          admin_notes: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          reason: string
          reporter_user_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          reason: string
          reporter_user_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      doubles_elimination_matches: {
        Row: {
          best_of: number | null
          bracket_type: string
          court_number: number | null
          created_at: string | null
          dest_loser: Json | null
          dest_winner: Json | null
          display_order: number
          games: Json | null
          games_won_a: number | null
          games_won_b: number | null
          id: string
          is_bye: boolean | null
          live_referee_id: string | null
          match_number: number
          round_number: number
          round_type: string
          score_a: number | null
          score_b: number | null
          source_a: Json | null
          source_b: Json | null
          start_time: string | null
          status: string | null
          team_a_id: string | null
          team_b_id: string | null
          tournament_id: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          best_of?: number | null
          bracket_type: string
          court_number?: number | null
          created_at?: string | null
          dest_loser?: Json | null
          dest_winner?: Json | null
          display_order: number
          games?: Json | null
          games_won_a?: number | null
          games_won_b?: number | null
          id?: string
          is_bye?: boolean | null
          live_referee_id?: string | null
          match_number: number
          round_number: number
          round_type: string
          score_a?: number | null
          score_b?: number | null
          source_a?: Json | null
          source_b?: Json | null
          start_time?: string | null
          status?: string | null
          team_a_id?: string | null
          team_b_id?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          best_of?: number | null
          bracket_type?: string
          court_number?: number | null
          created_at?: string | null
          dest_loser?: Json | null
          dest_winner?: Json | null
          display_order?: number
          games?: Json | null
          games_won_a?: number | null
          games_won_b?: number | null
          id?: string
          is_bye?: boolean | null
          live_referee_id?: string | null
          match_number?: number
          round_number?: number
          round_type?: string
          score_a?: number | null
          score_b?: number | null
          source_a?: Json | null
          source_b?: Json | null
          start_time?: string | null
          status?: string | null
          team_a_id?: string | null
          team_b_id?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doubles_elimination_matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "doubles_elimination_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_elimination_matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "doubles_elimination_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_elimination_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "doubles_elimination_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_elimination_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "doubles_elimination_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      doubles_elimination_referees: {
        Row: {
          created_at: string | null
          id: string
          tournament_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          tournament_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          tournament_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doubles_elimination_referees_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "doubles_elimination_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      doubles_elimination_teams: {
        Row: {
          created_at: string | null
          eliminated_at_round: number | null
          final_placement: number | null
          id: string
          player1_name: string
          player2_name: string | null
          point_diff: number | null
          seed: number | null
          status: string | null
          team_name: string
          total_points_against: number | null
          total_points_for: number | null
          tournament_id: string | null
        }
        Insert: {
          created_at?: string | null
          eliminated_at_round?: number | null
          final_placement?: number | null
          id?: string
          player1_name: string
          player2_name?: string | null
          point_diff?: number | null
          seed?: number | null
          status?: string | null
          team_name: string
          total_points_against?: number | null
          total_points_for?: number | null
          tournament_id?: string | null
        }
        Update: {
          created_at?: string | null
          eliminated_at_round?: number | null
          final_placement?: number | null
          id?: string
          player1_name?: string
          player2_name?: string | null
          point_diff?: number | null
          seed?: number | null
          status?: string | null
          team_name?: string
          total_points_against?: number | null
          total_points_for?: number | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doubles_elimination_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "doubles_elimination_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      doubles_elimination_tournaments: {
        Row: {
          court_count: number | null
          created_at: string | null
          creator_user_id: string | null
          current_round: number | null
          early_rounds_format: string | null
          finals_format: string | null
          has_third_place_match: boolean | null
          id: string
          name: string
          semifinals_format: string | null
          share_id: string
          start_time: string | null
          status: string
          team_count: number
          updated_at: string | null
        }
        Insert: {
          court_count?: number | null
          created_at?: string | null
          creator_user_id?: string | null
          current_round?: number | null
          early_rounds_format?: string | null
          finals_format?: string | null
          has_third_place_match?: boolean | null
          id?: string
          name: string
          semifinals_format?: string | null
          share_id: string
          start_time?: string | null
          status?: string
          team_count: number
          updated_at?: string | null
        }
        Update: {
          court_count?: number | null
          created_at?: string | null
          creator_user_id?: string | null
          current_round?: number | null
          early_rounds_format?: string | null
          finals_format?: string | null
          has_third_place_match?: boolean | null
          id?: string
          name?: string
          semifinals_format?: string | null
          share_id?: string
          start_time?: string | null
          status?: string
          team_count?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      dupr_rating_history: {
        Row: {
          dupr_doubles: number | null
          dupr_singles: number | null
          id: string
          profile_id: string
          recorded_at: string | null
          source: string
        }
        Insert: {
          dupr_doubles?: number | null
          dupr_singles?: number | null
          id?: string
          profile_id: string
          recorded_at?: string | null
          source?: string
        }
        Update: {
          dupr_doubles?: number | null
          dupr_singles?: number | null
          id?: string
          profile_id?: string
          recorded_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "dupr_rating_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dupr_rating_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dupr_sync_runs: {
        Row: {
          duration_ms: number | null
          error_summary: string | null
          finished_at: string | null
          id: string
          profiles_failed: number
          profiles_ok: number
          profiles_total: number
          started_at: string
        }
        Insert: {
          duration_ms?: number | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          profiles_failed?: number
          profiles_ok?: number
          profiles_total?: number
          started_at?: string
        }
        Update: {
          duration_ms?: number | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          profiles_failed?: number
          profiles_ok?: number
          profiles_total?: number
          started_at?: string
        }
        Relationships: []
      }
      flex_group_items: {
        Row: {
          created_at: string
          display_order: number
          group_id: string
          id: string
          item_type: string
          player_id: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          group_id: string
          id?: string
          item_type: string
          player_id?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          group_id?: string
          id?: string
          item_type?: string
          player_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flex_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "flex_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_group_items_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_group_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "flex_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_groups: {
        Row: {
          created_at: string
          display_order: number
          id: string
          include_doubles_in_singles: boolean
          name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          include_doubles_in_singles?: boolean
          name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          include_doubles_in_singles?: boolean
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "flex_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_matches: {
        Row: {
          counts_for_standings: boolean
          created_at: string
          display_order: number
          group_id: string | null
          id: string
          match_type: string
          name: string
          parent_match_id: string | null
          score_a: number | null
          score_b: number | null
          slot_a_team_id: string | null
          slot_a1_player_id: string | null
          slot_a2_player_id: string | null
          slot_b_team_id: string | null
          slot_b1_player_id: string | null
          slot_b2_player_id: string | null
          tournament_id: string
          updated_at: string
          winner_side: string | null
        }
        Insert: {
          counts_for_standings?: boolean
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          match_type?: string
          name: string
          parent_match_id?: string | null
          score_a?: number | null
          score_b?: number | null
          slot_a_team_id?: string | null
          slot_a1_player_id?: string | null
          slot_a2_player_id?: string | null
          slot_b_team_id?: string | null
          slot_b1_player_id?: string | null
          slot_b2_player_id?: string | null
          tournament_id: string
          updated_at?: string
          winner_side?: string | null
        }
        Update: {
          counts_for_standings?: boolean
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          match_type?: string
          name?: string
          parent_match_id?: string | null
          score_a?: number | null
          score_b?: number | null
          slot_a_team_id?: string | null
          slot_a1_player_id?: string | null
          slot_a2_player_id?: string | null
          slot_b_team_id?: string | null
          slot_b1_player_id?: string | null
          slot_b2_player_id?: string | null
          tournament_id?: string
          updated_at?: string
          winner_side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flex_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "flex_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_parent_match_id_fkey"
            columns: ["parent_match_id"]
            isOneToOne: false
            referencedRelation: "flex_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_slot_a_team_id_fkey"
            columns: ["slot_a_team_id"]
            isOneToOne: false
            referencedRelation: "flex_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_slot_a1_player_id_fkey"
            columns: ["slot_a1_player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_slot_a2_player_id_fkey"
            columns: ["slot_a2_player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_slot_b_team_id_fkey"
            columns: ["slot_b_team_id"]
            isOneToOne: false
            referencedRelation: "flex_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_slot_b1_player_id_fkey"
            columns: ["slot_b1_player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_slot_b2_player_id_fkey"
            columns: ["slot_b2_player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "flex_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_pair_stats: {
        Row: {
          group_id: string
          id: string
          losses: number
          player1_id: string
          player2_id: string
          point_diff: number
          updated_at: string
          wins: number
        }
        Insert: {
          group_id: string
          id?: string
          losses?: number
          player1_id: string
          player2_id: string
          point_diff?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          group_id?: string
          id?: string
          losses?: number
          player1_id?: string
          player2_id?: string
          point_diff?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "flex_pair_stats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "flex_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_pair_stats_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_pair_stats_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_player_stats: {
        Row: {
          group_id: string
          id: string
          losses: number
          player_id: string
          point_diff: number
          updated_at: string
          wins: number
        }
        Insert: {
          group_id: string
          id?: string
          losses?: number
          player_id: string
          point_diff?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          group_id?: string
          id?: string
          losses?: number
          player_id?: string
          point_diff?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "flex_player_stats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "flex_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_players: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "flex_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_team_members: {
        Row: {
          created_at: string
          id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "flex_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flex_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "flex_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_teams: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "flex_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      flex_tournaments: {
        Row: {
          created_at: string
          creator_user_id: string
          id: string
          is_public: boolean
          name: string
          share_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_user_id: string
          id?: string
          is_public?: boolean
          name: string
          share_id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_user_id?: string
          id?: string
          is_public?: boolean
          name?: string
          share_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["follow_target_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["follow_target_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["follow_target_type"]
          user_id?: string
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          name_en: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          name_en?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          name_en?: string | null
          slug?: string
        }
        Relationships: []
      }
      forum_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_urls: string[] | null
          is_best_answer: boolean
          like_count: number
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          is_best_answer?: boolean
          like_count?: number
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          is_best_answer?: boolean
          like_count?: number
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_likes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["forum_like_target"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["forum_like_target"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["forum_like_target"]
          user_id?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          category_id: string | null
          comment_count: number
          content: string
          created_at: string
          id: string
          image_urls: string[] | null
          is_hidden: boolean
          is_pinned: boolean
          is_qa: boolean
          like_count: number
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          comment_count?: number
          content: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          is_hidden?: boolean
          is_pinned?: boolean
          is_qa?: boolean
          like_count?: number
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          comment_count?: number
          content?: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          is_hidden?: boolean
          is_pinned?: boolean
          is_qa?: boolean
          like_count?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kudos: {
        Row: {
          created_at: string | null
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kudos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          generated_at: string | null
          id: string
          period: string
          period_start: string | null
          rankings: Json
          scope_id: string
          scope_type: string
        }
        Insert: {
          generated_at?: string | null
          id?: string
          period: string
          period_start?: string | null
          rankings: Json
          scope_id: string
          scope_type: string
        }
        Update: {
          generated_at?: string | null
          id?: string
          period?: string
          period_start?: string | null
          rankings?: Json
          scope_id?: string
          scope_type?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
          user_id?: string
        }
        Relationships: []
      }
      livestreams: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          hls_url: string | null
          id: string
          mux_asset_id: string | null
          mux_asset_playback_id: string | null
          mux_live_stream_id: string | null
          mux_playback_id: string | null
          mux_stream_key: string | null
          organization_id: string
          red5_server_url: string | null
          red5_stream_name: string | null
          scheduled_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["livestream_status"]
          streaming_provider: string | null
          thumbnail_url: string | null
          title: string
          tournament_id: string | null
          vod_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          hls_url?: string | null
          id?: string
          mux_asset_id?: string | null
          mux_asset_playback_id?: string | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          mux_stream_key?: string | null
          organization_id: string
          red5_server_url?: string | null
          red5_stream_name?: string | null
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"]
          streaming_provider?: string | null
          thumbnail_url?: string | null
          title: string
          tournament_id?: string | null
          vod_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          hls_url?: string | null
          id?: string
          mux_asset_id?: string | null
          mux_asset_playback_id?: string | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          mux_stream_key?: string | null
          organization_id?: string
          red5_server_url?: string | null
          red5_stream_name?: string | null
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"]
          streaming_provider?: string | null
          thumbnail_url?: string | null
          title?: string
          tournament_id?: string | null
          vod_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestreams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      master_team_roster: {
        Row: {
          created_at: string | null
          gender: Database["public"]["Enums"]["player_gender"]
          id: string
          is_captain: boolean | null
          master_team_id: string
          player_name: string
          skill_level: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          gender: Database["public"]["Enums"]["player_gender"]
          id?: string
          is_captain?: boolean | null
          master_team_id: string
          player_name: string
          skill_level?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gender?: Database["public"]["Enums"]["player_gender"]
          id?: string
          is_captain?: boolean | null
          master_team_id?: string
          player_name?: string
          skill_level?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_team_roster_master_team_id_fkey"
            columns: ["master_team_id"]
            isOneToOne: false
            referencedRelation: "master_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      master_teams: {
        Row: {
          captain_user_id: string
          created_at: string | null
          id: string
          team_name: string
          updated_at: string | null
        }
        Insert: {
          captain_user_id: string
          created_at?: string | null
          id?: string
          team_name: string
          updated_at?: string | null
        }
        Update: {
          captain_user_id?: string
          created_at?: string | null
          id?: string
          team_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      match_participants: {
        Row: {
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          dispute_reason: string | null
          disputed: boolean | null
          dupr_rating_after: number | null
          dupr_rating_before: number | null
          id: string
          match_id: string
          performance_self_rating: number | null
          player_id: string
          position: number | null
          team: string
        }
        Insert: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          dispute_reason?: string | null
          disputed?: boolean | null
          dupr_rating_after?: number | null
          dupr_rating_before?: number | null
          id?: string
          match_id: string
          performance_self_rating?: number | null
          player_id: string
          position?: number | null
          team: string
        }
        Update: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          dispute_reason?: string | null
          disputed?: boolean | null
          dupr_rating_after?: number | null
          dupr_rating_before?: number | null
          id?: string
          match_id?: string
          performance_self_rating?: number | null
          player_id?: string
          position?: number | null
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court_number: string | null
          created_at: string | null
          created_meta: Json | null
          dupr_match_id: string | null
          dupr_submitted_at: string | null
          duration_minutes: number | null
          format: string
          id: string
          is_public: boolean | null
          match_type: string
          notes: string | null
          played_at: string
          recorded_by: string
          scoring_format: string | null
          slug: string
          submitted_to_dupr: boolean | null
          team_a_score: number[]
          team_b_score: number[]
          tournament_id: string | null
          tournament_round: string | null
          updated_at: string | null
          venue_id: string | null
          venue_name_override: string | null
          verification_status: string
          verified_at: string | null
          weather: string | null
          winning_team: string | null
        }
        Insert: {
          court_number?: string | null
          created_at?: string | null
          created_meta?: Json | null
          dupr_match_id?: string | null
          dupr_submitted_at?: string | null
          duration_minutes?: number | null
          format: string
          id?: string
          is_public?: boolean | null
          match_type: string
          notes?: string | null
          played_at: string
          recorded_by: string
          scoring_format?: string | null
          slug: string
          submitted_to_dupr?: boolean | null
          team_a_score: number[]
          team_b_score: number[]
          tournament_id?: string | null
          tournament_round?: string | null
          updated_at?: string | null
          venue_id?: string | null
          venue_name_override?: string | null
          verification_status?: string
          verified_at?: string | null
          weather?: string | null
          winning_team?: string | null
        }
        Update: {
          court_number?: string | null
          created_at?: string | null
          created_meta?: Json | null
          dupr_match_id?: string | null
          dupr_submitted_at?: string | null
          duration_minutes?: number | null
          format?: string
          id?: string
          is_public?: boolean | null
          match_type?: string
          notes?: string | null
          played_at?: string
          recorded_by?: string
          scoring_format?: string | null
          slug?: string
          submitted_to_dupr?: boolean | null
          team_a_score?: number[]
          team_b_score?: number[]
          tournament_id?: string | null
          tournament_round?: string | null
          updated_at?: string | null
          venue_id?: string | null
          venue_name_override?: string | null
          verification_status?: string
          verified_at?: string | null
          weather?: string | null
          winning_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          created_at: string
          id: string
          published_at: string
          show_on_home: boolean
          source: string
          source_url: string
          status: Database["public"]["Enums"]["news_status"]
          summary: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          published_at: string
          show_on_home?: boolean
          source: string
          source_url: string
          status?: Database["public"]["Enums"]["news_status"]
          summary: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string
          show_on_home?: boolean
          source?: string
          source_url?: string
          status?: Database["public"]["Enums"]["news_status"]
          summary?: string
          title?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          email: string
          id: string
          language: string | null
          source: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          language?: string | null
          source?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          language?: string | null
          source?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["follow_target_type"]
          id: string
          is_read: boolean
          message: string | null
          related_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["follow_target_type"]
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["follow_target_type"]
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      open_play_sessions: {
        Row: {
          created_at: string | null
          created_by: string
          current_players: number
          format: string
          id: string
          max_players: number
          max_rating: number | null
          min_rating: number | null
          notes: string | null
          scheduled_end: string
          scheduled_start: string
          status: string
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          current_players?: number
          format: string
          id?: string
          max_players?: number
          max_rating?: number | null
          min_rating?: number | null
          notes?: string | null
          scheduled_end: string
          scheduled_start: string
          status?: string
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          current_players?: number
          format?: string
          id?: string
          max_players?: number
          max_rating?: number | null
          min_rating?: number | null
          notes?: string | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_play_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_play_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_play_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      parent_tournaments: {
        Row: {
          banner_url: string | null
          created_at: string
          creator_user_id: string
          description: string | null
          event_date: string | null
          id: string
          is_featured: boolean
          location: string | null
          name: string
          share_id: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          creator_user_id: string
          description?: string | null
          event_date?: string | null
          id?: string
          is_featured?: boolean
          location?: string | null
          name: string
          share_id?: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          creator_user_id?: string
          description?: string | null
          event_date?: string | null
          id?: string
          is_featured?: boolean
          location?: string | null
          name?: string
          share_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts_blasts: {
        Row: {
          created_at: string | null
          id: string
          mailchimp_campaign_id: string
          mailchimp_campaign_url: string | null
          post_id: string
          post_language: string
          post_slug: string
          scheduled_for: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mailchimp_campaign_id: string
          mailchimp_campaign_url?: string | null
          post_id: string
          post_language: string
          post_slug: string
          scheduled_for: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mailchimp_campaign_id?: string
          mailchimp_campaign_url?: string | null
          post_id?: string
          post_language?: string
          post_slug?: string
          scheduled_for?: string
        }
        Relationships: []
      }
      presence_heartbeats: {
        Row: {
          last_seen_at: string
          page_path: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          last_seen_at?: string
          page_path?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          last_seen_at?: string
          page_path?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          display_name_updated_at: string | null
          dominant_hand: string | null
          dupr_doubles: number | null
          dupr_id: string | null
          dupr_last_attempt_at: string | null
          dupr_last_error: string | null
          dupr_profile_url: string | null
          dupr_singles: number | null
          dupr_synced_at: string | null
          email: string
          favorite_venue_id: string | null
          id: string
          is_ghost: boolean | null
          is_pro: boolean | null
          is_verified: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          organization_id: string | null
          phone: string | null
          preferred_language: string | null
          preferred_paddle: string | null
          self_rating: number | null
          skill_level: string | null
          tournament_create_quota: number
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          display_name_updated_at?: string | null
          dominant_hand?: string | null
          dupr_doubles?: number | null
          dupr_id?: string | null
          dupr_last_attempt_at?: string | null
          dupr_last_error?: string | null
          dupr_profile_url?: string | null
          dupr_singles?: number | null
          dupr_synced_at?: string | null
          email: string
          favorite_venue_id?: string | null
          id: string
          is_ghost?: boolean | null
          is_pro?: boolean | null
          is_verified?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          organization_id?: string | null
          phone?: string | null
          preferred_language?: string | null
          preferred_paddle?: string | null
          self_rating?: number | null
          skill_level?: string | null
          tournament_create_quota?: number
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          display_name_updated_at?: string | null
          dominant_hand?: string | null
          dupr_doubles?: number | null
          dupr_id?: string | null
          dupr_last_attempt_at?: string | null
          dupr_last_error?: string | null
          dupr_profile_url?: string | null
          dupr_singles?: number | null
          dupr_synced_at?: string | null
          email?: string
          favorite_venue_id?: string | null
          id?: string
          is_ghost?: boolean | null
          is_pro?: boolean | null
          is_verified?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          organization_id?: string | null
          phone?: string | null
          preferred_language?: string | null
          preferred_paddle?: string | null
          self_rating?: number | null
          skill_level?: string | null
          tournament_create_quota?: number
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_favorite_venue_id_fkey"
            columns: ["favorite_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_table_groups: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          table_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          table_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_groups_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_matches: {
        Row: {
          bracket_position: string | null
          court_id: number | null
          court_name: string | null
          created_at: string
          current_set: number | null
          display_order: number
          group_id: string | null
          id: string
          is_playoff: boolean
          large_playoff_round: number | null
          live_referee_id: string | null
          match_timer_elapsed_seconds: number | null
          match_timer_started_at: string | null
          next_match_id: string | null
          next_match_slot: number | null
          player1_id: string | null
          player2_id: string | null
          playoff_match_number: number | null
          playoff_round: number | null
          rr_match_index: number | null
          rr_round_number: number | null
          score_history: Json | null
          score1: number | null
          score2: number | null
          serving_side: number | null
          set_scores: Json | null
          sides_swapped: boolean | null
          start_at: string | null
          status: Database["public"]["Enums"]["quick_match_status"]
          table_id: string
          total_sets: number | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          bracket_position?: string | null
          court_id?: number | null
          court_name?: string | null
          created_at?: string
          current_set?: number | null
          display_order?: number
          group_id?: string | null
          id?: string
          is_playoff?: boolean
          large_playoff_round?: number | null
          live_referee_id?: string | null
          match_timer_elapsed_seconds?: number | null
          match_timer_started_at?: string | null
          next_match_id?: string | null
          next_match_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          playoff_match_number?: number | null
          playoff_round?: number | null
          rr_match_index?: number | null
          rr_round_number?: number | null
          score_history?: Json | null
          score1?: number | null
          score2?: number | null
          serving_side?: number | null
          set_scores?: Json | null
          sides_swapped?: boolean | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["quick_match_status"]
          table_id: string
          total_sets?: number | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          bracket_position?: string | null
          court_id?: number | null
          court_name?: string | null
          created_at?: string
          current_set?: number | null
          display_order?: number
          group_id?: string | null
          id?: string
          is_playoff?: boolean
          large_playoff_round?: number | null
          live_referee_id?: string | null
          match_timer_elapsed_seconds?: number | null
          match_timer_started_at?: string | null
          next_match_id?: string | null
          next_match_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          playoff_match_number?: number | null
          playoff_round?: number | null
          rr_match_index?: number | null
          rr_round_number?: number | null
          score_history?: Json | null
          score1?: number | null
          score2?: number | null
          serving_side?: number | null
          set_scores?: Json | null
          sides_swapped?: boolean | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["quick_match_status"]
          table_id?: string
          total_sets?: number | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "quick_table_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "quick_table_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "quick_table_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "quick_table_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_matches_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "quick_table_players"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_pair_requests: {
        Row: {
          created_at: string
          from_team_id: string
          from_user_id: string
          id: string
          responded_at: string | null
          status: string
          table_id: string
          to_team_id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_team_id: string
          from_user_id: string
          id?: string
          responded_at?: string | null
          status?: string
          table_id: string
          to_team_id: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_team_id?: string
          from_user_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          table_id?: string
          to_team_id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_pair_requests_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "quick_table_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_pair_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_pair_requests_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "quick_table_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_partner_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invite_code: string
          invited_by_user_id: string
          invited_user_id: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          table_id: string
          team_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by_user_id: string
          invited_user_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          table_id: string
          team_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by_user_id?: string
          invited_user_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          table_id?: string
          team_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_partner_invitations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_partner_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "quick_table_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_players: {
        Row: {
          created_at: string
          display_order: number
          group_id: string | null
          id: string
          is_bye: boolean | null
          is_qualified: boolean | null
          is_wildcard: boolean | null
          matches_played: number
          matches_won: number
          name: string
          playoff_seed: number | null
          point_diff: number | null
          points_against: number
          points_for: number
          round1_point_diff: number | null
          round1_result: string | null
          round2_result: string | null
          seed: number | null
          table_id: string
          team: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          is_bye?: boolean | null
          is_qualified?: boolean | null
          is_wildcard?: boolean | null
          matches_played?: number
          matches_won?: number
          name: string
          playoff_seed?: number | null
          point_diff?: number | null
          points_against?: number
          points_for?: number
          round1_point_diff?: number | null
          round1_result?: string | null
          round2_result?: string | null
          seed?: number | null
          table_id: string
          team?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          is_bye?: boolean | null
          is_qualified?: boolean | null
          is_wildcard?: boolean | null
          matches_played?: number
          matches_won?: number
          name?: string
          playoff_seed?: number | null
          point_diff?: number | null
          points_against?: number
          points_for?: number
          round1_point_diff?: number | null
          round1_result?: string | null
          round2_result?: string | null
          seed?: number | null
          table_id?: string
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_players_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "quick_table_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_table_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_referees: {
        Row: {
          created_at: string
          id: string
          table_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          table_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_referees_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_registrations: {
        Row: {
          btc_notes: string | null
          btc_override_skill: number | null
          created_at: string
          display_name: string
          id: string
          profile_link: string | null
          rating_system: Database["public"]["Enums"]["skill_rating_system"]
          skill_description: string | null
          skill_level: number | null
          skill_system_name: string | null
          status: Database["public"]["Enums"]["registration_status"]
          table_id: string
          team: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          btc_notes?: string | null
          btc_override_skill?: number | null
          created_at?: string
          display_name: string
          id?: string
          profile_link?: string | null
          rating_system?: Database["public"]["Enums"]["skill_rating_system"]
          skill_description?: string | null
          skill_level?: number | null
          skill_system_name?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          table_id: string
          team?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          btc_notes?: string | null
          btc_override_skill?: number | null
          created_at?: string
          display_name?: string
          id?: string
          profile_link?: string | null
          rating_system?: Database["public"]["Enums"]["skill_rating_system"]
          skill_description?: string | null
          skill_level?: number | null
          skill_system_name?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          table_id?: string
          team?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_registrations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_table_teams: {
        Row: {
          btc_approved: boolean | null
          btc_approved_at: string | null
          btc_notes: string | null
          created_at: string
          id: string
          is_locked: boolean | null
          player1_display_name: string
          player1_profile_link: string | null
          player1_rating_system:
            | Database["public"]["Enums"]["skill_rating_system"]
            | null
          player1_skill_level: number | null
          player1_team: string | null
          player1_user_id: string
          player2_display_name: string | null
          player2_profile_link: string | null
          player2_rating_system:
            | Database["public"]["Enums"]["skill_rating_system"]
            | null
          player2_skill_level: number | null
          player2_team: string | null
          player2_user_id: string | null
          table_id: string
          team_status: Database["public"]["Enums"]["team_status"]
          updated_at: string
        }
        Insert: {
          btc_approved?: boolean | null
          btc_approved_at?: string | null
          btc_notes?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean | null
          player1_display_name: string
          player1_profile_link?: string | null
          player1_rating_system?:
            | Database["public"]["Enums"]["skill_rating_system"]
            | null
          player1_skill_level?: number | null
          player1_team?: string | null
          player1_user_id: string
          player2_display_name?: string | null
          player2_profile_link?: string | null
          player2_rating_system?:
            | Database["public"]["Enums"]["skill_rating_system"]
            | null
          player2_skill_level?: number | null
          player2_team?: string | null
          player2_user_id?: string | null
          table_id: string
          team_status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
        }
        Update: {
          btc_approved?: boolean | null
          btc_approved_at?: string | null
          btc_notes?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean | null
          player1_display_name?: string
          player1_profile_link?: string | null
          player1_rating_system?:
            | Database["public"]["Enums"]["skill_rating_system"]
            | null
          player1_skill_level?: number | null
          player1_team?: string | null
          player1_user_id?: string
          player2_display_name?: string | null
          player2_profile_link?: string | null
          player2_rating_system?:
            | Database["public"]["Enums"]["skill_rating_system"]
            | null
          player2_skill_level?: number | null
          player2_team?: string | null
          player2_user_id?: string | null
          table_id?: string
          team_status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_table_teams_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "quick_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_tables: {
        Row: {
          auto_approve_registrations: boolean | null
          courts: string[] | null
          created_at: string
          creator_user_id: string | null
          default_sets: number | null
          format: Database["public"]["Enums"]["quick_table_format"]
          group_count: number | null
          id: string
          is_doubles: boolean
          is_public: boolean
          max_skill_level: number | null
          min_skill_level: number | null
          name: string
          parent_tournament_id: string | null
          player_count: number
          registration_message: string | null
          requires_registration: boolean | null
          requires_skill_level: boolean | null
          share_id: string
          skill_rating_system: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["quick_table_status"]
          top_per_group: number | null
          updated_at: string
          use_wildcard: boolean | null
          wildcard_count: number | null
        }
        Insert: {
          auto_approve_registrations?: boolean | null
          courts?: string[] | null
          created_at?: string
          creator_user_id?: string | null
          default_sets?: number | null
          format: Database["public"]["Enums"]["quick_table_format"]
          group_count?: number | null
          id?: string
          is_doubles?: boolean
          is_public?: boolean
          max_skill_level?: number | null
          min_skill_level?: number | null
          name?: string
          parent_tournament_id?: string | null
          player_count: number
          registration_message?: string | null
          requires_registration?: boolean | null
          requires_skill_level?: boolean | null
          share_id?: string
          skill_rating_system?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["quick_table_status"]
          top_per_group?: number | null
          updated_at?: string
          use_wildcard?: boolean | null
          wildcard_count?: number | null
        }
        Update: {
          auto_approve_registrations?: boolean | null
          courts?: string[] | null
          created_at?: string
          creator_user_id?: string | null
          default_sets?: number | null
          format?: Database["public"]["Enums"]["quick_table_format"]
          group_count?: number | null
          id?: string
          is_doubles?: boolean
          is_public?: boolean
          max_skill_level?: number | null
          min_skill_level?: number | null
          name?: string
          parent_tournament_id?: string | null
          player_count?: number
          registration_message?: string | null
          requires_registration?: boolean | null
          requires_skill_level?: boolean | null
          share_id?: string
          skill_rating_system?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["quick_table_status"]
          top_per_group?: number | null
          updated_at?: string
          use_wildcard?: boolean | null
          wildcard_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_tables_parent_tournament_id_fkey"
            columns: ["parent_tournament_id"]
            isOneToOne: false
            referencedRelation: "parent_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          joined_at: string | null
          player_id: string
          session_id: string
          status: string
        }
        Insert: {
          joined_at?: string | null
          player_id: string
          session_id: string
          status?: string
        }
        Update: {
          joined_at?: string | null
          player_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "open_play_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_comments: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_deleted: boolean | null
          parent_id: string | null
          target_id: string
          target_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          parent_id?: string | null
          target_id: string
          target_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          parent_id?: string | null
          target_id?: string
          target_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_follows: {
        Row: {
          created_at: string | null
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string | null
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string | null
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link_url: string | null
          payload: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          payload?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link_url?: string | null
          payload?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      team_match_game_templates: {
        Row: {
          created_at: string | null
          display_name: string | null
          game_type: Database["public"]["Enums"]["team_game_type"]
          id: string
          order_index: number
          scoring_type: Database["public"]["Enums"]["game_scoring_type"]
          tournament_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          game_type: Database["public"]["Enums"]["team_game_type"]
          id?: string
          order_index: number
          scoring_type?: Database["public"]["Enums"]["game_scoring_type"]
          tournament_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          game_type?: Database["public"]["Enums"]["team_game_type"]
          id?: string
          order_index?: number
          scoring_type?: Database["public"]["Enums"]["game_scoring_type"]
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_match_game_templates_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "team_match_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_games: {
        Row: {
          created_at: string | null
          display_name: string | null
          game_type: Database["public"]["Enums"]["team_game_type"]
          id: string
          is_dreambreaker: boolean | null
          lineup_team_a: string[] | null
          lineup_team_b: string[] | null
          match_id: string
          order_index: number
          score_a: number | null
          score_b: number | null
          scoring_type: Database["public"]["Enums"]["game_scoring_type"]
          status: string | null
          template_id: string | null
          updated_at: string | null
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          game_type: Database["public"]["Enums"]["team_game_type"]
          id?: string
          is_dreambreaker?: boolean | null
          lineup_team_a?: string[] | null
          lineup_team_b?: string[] | null
          match_id: string
          order_index: number
          score_a?: number | null
          score_b?: number | null
          scoring_type: Database["public"]["Enums"]["game_scoring_type"]
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          game_type?: Database["public"]["Enums"]["team_game_type"]
          id?: string
          is_dreambreaker?: boolean | null
          lineup_team_a?: string[] | null
          lineup_team_b?: string[] | null
          match_id?: string
          order_index?: number
          score_a?: number | null
          score_b?: number | null
          scoring_type?: Database["public"]["Enums"]["game_scoring_type"]
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "team_match_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_games_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "team_match_game_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "team_match_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_groups: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_match_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "team_match_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_matches: {
        Row: {
          bracket_position: number | null
          created_at: string | null
          display_order: number | null
          games_won_a: number | null
          games_won_b: number | null
          group_id: string | null
          id: string
          is_playoff: boolean | null
          is_third_place: boolean | null
          lineup_a_submitted: boolean | null
          lineup_b_submitted: boolean | null
          next_match_id: string | null
          next_match_slot: number | null
          playoff_round: number | null
          round_number: number | null
          status: Database["public"]["Enums"]["team_match_match_status"] | null
          team_a_id: string | null
          team_b_id: string | null
          total_points_a: number | null
          total_points_b: number | null
          tournament_id: string
          updated_at: string | null
          winner_team_id: string | null
        }
        Insert: {
          bracket_position?: number | null
          created_at?: string | null
          display_order?: number | null
          games_won_a?: number | null
          games_won_b?: number | null
          group_id?: string | null
          id?: string
          is_playoff?: boolean | null
          is_third_place?: boolean | null
          lineup_a_submitted?: boolean | null
          lineup_b_submitted?: boolean | null
          next_match_id?: string | null
          next_match_slot?: number | null
          playoff_round?: number | null
          round_number?: number | null
          status?: Database["public"]["Enums"]["team_match_match_status"] | null
          team_a_id?: string | null
          team_b_id?: string | null
          total_points_a?: number | null
          total_points_b?: number | null
          tournament_id: string
          updated_at?: string | null
          winner_team_id?: string | null
        }
        Update: {
          bracket_position?: number | null
          created_at?: string | null
          display_order?: number | null
          games_won_a?: number | null
          games_won_b?: number | null
          group_id?: string | null
          id?: string
          is_playoff?: boolean | null
          is_third_place?: boolean | null
          lineup_a_submitted?: boolean | null
          lineup_b_submitted?: boolean | null
          next_match_id?: string | null
          next_match_slot?: number | null
          playoff_round?: number | null
          round_number?: number | null
          status?: Database["public"]["Enums"]["team_match_match_status"] | null
          team_a_id?: string | null
          team_b_id?: string | null
          total_points_a?: number | null
          total_points_b?: number | null
          tournament_id?: string
          updated_at?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_match_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "team_match_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "team_match_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "team_match_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "team_match_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "team_match_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "team_match_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_referees: {
        Row: {
          created_at: string | null
          id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_match_referees_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "team_match_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_roster: {
        Row: {
          created_at: string | null
          gender: Database["public"]["Enums"]["player_gender"]
          id: string
          is_captain: boolean | null
          player_name: string
          skill_level: number | null
          status: string | null
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          gender: Database["public"]["Enums"]["player_gender"]
          id?: string
          is_captain?: boolean | null
          player_name: string
          skill_level?: number | null
          status?: string | null
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gender?: Database["public"]["Enums"]["player_gender"]
          id?: string
          is_captain?: boolean | null
          player_name?: string
          skill_level?: number | null
          status?: string | null
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_match_roster_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_match_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_teams: {
        Row: {
          captain_user_id: string | null
          created_at: string | null
          group_id: string | null
          id: string
          invite_code: string | null
          master_team_id: string | null
          seed: number | null
          status: string | null
          team_name: string
          tournament_id: string
          updated_at: string | null
        }
        Insert: {
          captain_user_id?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          invite_code?: string | null
          master_team_id?: string | null
          seed?: number | null
          status?: string | null
          team_name: string
          tournament_id: string
          updated_at?: string | null
        }
        Update: {
          captain_user_id?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          invite_code?: string | null
          master_team_id?: string | null
          seed?: number | null
          status?: string | null
          team_name?: string
          tournament_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_match_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "team_match_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_teams_master_team_id_fkey"
            columns: ["master_team_id"]
            isOneToOne: false
            referencedRelation: "master_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_match_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "team_match_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_tournaments: {
        Row: {
          bracket_pairing_type: string | null
          created_at: string | null
          created_by: string | null
          dreambreaker_game_type:
            | Database["public"]["Enums"]["team_game_type"]
            | null
          dreambreaker_scoring_type:
            | Database["public"]["Enums"]["game_scoring_type"]
            | null
          format: string
          group_count: number | null
          has_dreambreaker: boolean | null
          has_third_place_match: boolean | null
          id: string
          name: string
          playoff_team_count: number | null
          require_min_games_per_player: boolean | null
          require_registration: boolean | null
          share_id: string
          status: Database["public"]["Enums"]["team_match_status"] | null
          team_count: number
          team_roster_size: number
          top_per_group: number | null
          updated_at: string | null
        }
        Insert: {
          bracket_pairing_type?: string | null
          created_at?: string | null
          created_by?: string | null
          dreambreaker_game_type?:
            | Database["public"]["Enums"]["team_game_type"]
            | null
          dreambreaker_scoring_type?:
            | Database["public"]["Enums"]["game_scoring_type"]
            | null
          format?: string
          group_count?: number | null
          has_dreambreaker?: boolean | null
          has_third_place_match?: boolean | null
          id?: string
          name: string
          playoff_team_count?: number | null
          require_min_games_per_player?: boolean | null
          require_registration?: boolean | null
          share_id?: string
          status?: Database["public"]["Enums"]["team_match_status"] | null
          team_count: number
          team_roster_size: number
          top_per_group?: number | null
          updated_at?: string | null
        }
        Update: {
          bracket_pairing_type?: string | null
          created_at?: string | null
          created_by?: string | null
          dreambreaker_game_type?:
            | Database["public"]["Enums"]["team_game_type"]
            | null
          dreambreaker_scoring_type?:
            | Database["public"]["Enums"]["game_scoring_type"]
            | null
          format?: string
          group_count?: number | null
          has_dreambreaker?: boolean | null
          has_third_place_match?: boolean | null
          id?: string
          name?: string
          playoff_team_count?: number | null
          require_min_games_per_player?: boolean | null
          require_registration?: boolean | null
          share_id?: string
          status?: Database["public"]["Enums"]["team_match_status"] | null
          team_count?: number
          team_roster_size?: number
          top_per_group?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["tournament_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          amenities: string[] | null
          city: string
          country: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          district: string | null
          hours_json: Json | null
          id: string
          is_indoor: boolean | null
          is_verified: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          name_vi: string | null
          num_courts: number | null
          phone: string | null
          slug: string
          surface_type: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          city: string
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          district?: string | null
          hours_json?: Json | null
          id?: string
          is_indoor?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          name_vi?: string | null
          num_courts?: number | null
          phone?: string | null
          slug: string
          surface_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          city?: string
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          district?: string | null
          hours_json?: Json | null
          id?: string
          is_indoor?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_vi?: string | null
          num_courts?: number | null
          phone?: string | null
          slug?: string
          surface_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vi_blog_posts: {
        Row: {
          alternate_en_slug: string | null
          author_name: string | null
          category: string | null
          content_html: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          faq_items: Json | null
          focus_keyword: string | null
          id: string
          meta_description: string
          meta_title: string
          published_at: string | null
          related_post_slugs: string[] | null
          skip_email_blast: boolean | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          alternate_en_slug?: string | null
          author_name?: string | null
          category?: string | null
          content_html: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq_items?: Json | null
          focus_keyword?: string | null
          id?: string
          meta_description: string
          meta_title: string
          published_at?: string | null
          related_post_slugs?: string[] | null
          skip_email_blast?: boolean | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          alternate_en_slug?: string | null
          author_name?: string | null
          category?: string | null
          content_html?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq_items?: Json | null
          focus_keyword?: string | null
          id?: string
          meta_description?: string
          meta_title?: string
          published_at?: string | null
          related_post_slugs?: string[] | null
          skip_email_blast?: boolean | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          mux_asset_id: string | null
          mux_playback_id: string | null
          organization_id: string
          published_at: string | null
          source: string
          status: Database["public"]["Enums"]["content_status"]
          storage_path: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          tournament_id: string | null
          type: Database["public"]["Enums"]["video_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          organization_id: string
          published_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["content_status"]
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["video_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          organization_id?: string
          published_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["content_status"]
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["video_type"]
        }
        Relationships: [
          {
            foreignKeyName: "videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      view_counts: {
        Row: {
          count: number
          id: string
          last_updated_at: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
        }
        Insert: {
          count?: number
          id?: string
          last_updated_at?: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
        }
        Update: {
          count?: number
          id?: string
          last_updated_at?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
        }
        Relationships: []
      }
      view_events: {
        Row: {
          created_at: string
          id: string
          is_replay: boolean
          organization_id: string | null
          source: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          viewer_ip: string | null
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_replay?: boolean
          organization_id?: string | null
          source?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          viewer_ip?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_replay?: boolean
          organization_id?: string | null
          source?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
          viewer_ip?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_livestreams: {
        Row: {
          created_at: string | null
          description: string | null
          ended_at: string | null
          hls_url: string | null
          id: string | null
          mux_asset_id: string | null
          mux_asset_playback_id: string | null
          mux_playback_id: string | null
          organization_id: string | null
          scheduled_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["livestream_status"] | null
          streaming_provider: string | null
          thumbnail_url: string | null
          title: string | null
          tournament_id: string | null
          vod_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          hls_url?: string | null
          id?: string | null
          mux_asset_id?: string | null
          mux_asset_playback_id?: string | null
          mux_playback_id?: string | null
          organization_id?: string | null
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"] | null
          streaming_provider?: string | null
          thumbnail_url?: string | null
          title?: string | null
          tournament_id?: string | null
          vod_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          hls_url?: string | null
          id?: string | null
          mux_asset_id?: string | null
          mux_asset_playback_id?: string | null
          mux_playback_id?: string | null
          organization_id?: string | null
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"] | null
          streaming_provider?: string | null
          thumbnail_url?: string | null
          title?: string | null
          tournament_id?: string | null
          vod_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestreams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          organization_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          organization_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_partner_invitation: {
        Args: {
          _display_name: string
          _invitation_code: string
          _profile_link?: string
          _rating_system?: Database["public"]["Enums"]["skill_rating_system"]
          _skill_level?: number
          _team?: string
          _user_id: string
        }
        Returns: Json
      }
      btc_manage_team: {
        Args: { _action: string; _notes?: string; _team_id: string }
        Returns: Json
      }
      can_create_quick_table: { Args: { _user_id: string }; Returns: boolean }
      can_create_quick_table_with_quota: {
        Args: { _user_id: string }
        Returns: Json
      }
      can_edit_doubles_elimination_scores: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_quick_table_scores: {
        Args: { _table_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_team_match_scores: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      can_moderate_chat: {
        Args: { _livestream_id: string; _user_id: string }
        Returns: boolean
      }
      can_send_chat_message: {
        Args: { _livestream_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_flex_tournament: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: boolean
      }
      cancel_pair_request: { Args: { _request_id: string }; Returns: Json }
      create_pair_request: {
        Args: { _table_id: string; _to_team_id: string }
        Returns: Json
      }
      create_quick_table_with_quota: {
        Args: {
          _auto_approve_registrations?: boolean
          _format: Database["public"]["Enums"]["quick_table_format"]
          _group_count?: number
          _name: string
          _player_count: number
          _registration_message?: string
          _requires_registration?: boolean
          _requires_skill_level?: boolean
        }
        Returns: Json
      }
      delete_quick_table: { Args: { _table_id: string }; Returns: boolean }
      get_active_invitation_count: {
        Args: { _team_id: string }
        Returns: number
      }
      get_blog_post_view_count: {
        Args: {
          p_lang: Database["public"]["Enums"]["blog_lang"]
          p_slug: string
        }
        Returns: number
      }
      get_blog_post_view_counts_batch: {
        Args: { p_pairs: Json }
        Returns: {
          lang: Database["public"]["Enums"]["blog_lang"]
          slug: string
          view_count: number
        }[]
      }
      get_chat_leaderboard: {
        Args: { _limit?: number; _livestream_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          message_count: number
          rank: number
          user_id: string
        }[]
      }
      get_content_stats: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_engagement_stats: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_homepage_stats: {
        Args: never
        Returns: {
          total_tournaments: number
          total_users: number
        }[]
      }
      get_new_users_daily: {
        Args: { p_end: string; p_start: string }
        Returns: {
          count: number
          day: string
        }[]
      }
      get_online_now: { Args: never; Returns: number }
      get_org_analytics_summary: {
        Args: { _days?: number; _org_id: string }
        Returns: Json
      }
      get_org_top_content: {
        Args: { _days?: number; _limit?: number; _org_id: string }
        Returns: Json
      }
      get_org_views_by_type: {
        Args: { _days?: number; _org_id: string }
        Returns: Json
      }
      get_org_views_over_time: {
        Args: { _days?: number; _org_id: string }
        Returns: Json
      }
      get_organization_display_logo: {
        Args: { org_id: string }
        Returns: string
      }
      get_organization_display_logos: {
        Args: { org_ids: string[] }
        Returns: {
          display_logo: string
          org_id: string
        }[]
      }
      get_feed_timeline: {
        Args: {
          p_limit?: number
          p_cursor_score?: number | null
          p_cursor_item_id?: string | null
          p_viewer_id?: string | null
        }
        Returns: {
          item_type: string
          item_id: string
          published_at: string
          score: number
          slug: string | null
          format: string | null
          match_type: string | null
          verification_status: string | null
          venue_name: string | null
          team_a_score: number[] | null
          team_b_score: number[] | null
          winning_team: string | null
          participants: Json | null
          kudos_count: number | null
          viewer_kudoed: boolean | null
          comment_count: number | null
          source_provider: string | null
          source_url: string | null
          tournament_name: string | null
          tournament_event: string | null
          round_name: string | null
          match_played_at: string | null
          title: string | null
          excerpt: string | null
          cover_image_url: string | null
          category: string | null
          duration_seconds: number | null
        }[]
      }
      get_following_feed: {
        Args: {
          p_viewer_id: string
          p_limit?: number
          p_cursor_played_at?: string | null
          p_cursor_match_id?: string | null
        }
        Returns: {
          match_id: string
          slug: string
          played_at: string
          format: string
          match_type: string
          verification_status: string
          venue_name: string
          team_a_score: number[]
          team_b_score: number[]
          winning_team: string
          participants: Json
          kudos_count: number
          viewer_kudoed: boolean
          comment_count: number
          source_provider: string
          source_url: string | null
          tournament_name: string | null
          tournament_event: string | null
          round_name: string | null
        }[]
      }
      get_player_match_history: {
        Args: { p_limit?: number; p_offset?: number; p_player_id: string }
        Returns: {
          format: string
          match_id: string
          match_type: string
          participants: Json
          played_at: string
          player_team: string
          player_won: boolean
          slug: string
          team_a_score: number[]
          team_b_score: number[]
          venue_name: string
          winning_team: string
        }[]
      }
      get_player_stats: {
        Args: { p_username: string }
        Returns: {
          current_streak: number
          followers_count: number
          following_count: number
          last_5_form: string
          losses: number
          profile_id: string
          total_matches: number
          win_rate: number
          wins: number
        }[]
      }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_public_profiles: {
        Args: { profile_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_suggested_follows: {
        Args: { p_limit?: number; p_viewer_id: string }
        Returns: {
          avatar_url: string
          city: string
          display_name: string
          dupr_doubles: number
          id: string
          reason: string
          username: string
        }[]
      }
      get_top_blog_posts: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          lang: Database["public"]["Enums"]["blog_lang"]
          slug: string
          total_views: number
          unique_viewers: number
        }[]
      }
      get_trending_feed: {
        Args: {
          p_limit?: number
          p_cursor_played_at?: string | null
          p_cursor_match_id?: string | null
          p_viewer_id?: string | null
          p_kudos_weight?: number
          p_comments_weight?: number
          p_recency_decay_hours?: number
        }
        Returns: {
          match_id: string
          slug: string
          played_at: string
          format: string
          match_type: string
          verification_status: string
          venue_name: string
          team_a_score: number[]
          team_b_score: number[]
          winning_team: string
          participants: Json
          kudos_count: number
          viewer_kudoed: boolean
          comment_count: number
          source_provider: string
          source_url: string | null
          tournament_name: string | null
          tournament_event: string | null
          round_name: string | null
        }[]
      }
      get_top_content: {
        Args: { p_end: string; p_start: string }
        Returns: {
          target_id: string
          target_type: string
          view_count: number
        }[]
      }
      get_tournament_from_match: {
        Args: { _match_id: string }
        Returns: string
      }
      get_tournament_from_team: { Args: { _team_id: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_quick_table_count: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_quota_info: { Args: { _user_id: string }; Returns: Json }
      get_user_stats: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_view_count: {
        Args: {
          _target_id: string
          _target_type: Database["public"]["Enums"]["target_type"]
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_creator: { Args: never; Returns: boolean }
      is_doubles_elimination_creator: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      is_doubles_elimination_referee: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      is_flex_tournament_creator: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: boolean
      }
      is_forum_post_owner: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      is_quick_table_creator: {
        Args: { _table_id: string; _user_id: string }
        Returns: boolean
      }
      is_quick_table_referee: {
        Args: { _table_id: string; _user_id: string }
        Returns: boolean
      }
      is_table_locked: { Args: { _table_id: string }; Returns: boolean }
      is_team_captain: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_match_creator: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_creator: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _actor_type?: string
          _event_category: string
          _event_type: string
          _metadata?: Json
          _resource_id?: string
          _resource_type?: string
          _severity?: string
        }
        Returns: string
      }
      lookup_user_by_email: {
        Args: { lookup_email: string }
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
      remove_partner_from_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: Json
      }
      respond_pair_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: Json
      }
      search_players: {
        Args: { p_exclude_id?: string; p_limit?: number; p_query: string }
        Returns: {
          avatar_url: string
          city: string
          display_name: string
          dupr_doubles: number
          id: string
          is_ghost: boolean
          is_verified: boolean
          username: string
        }[]
      }
      set_user_quota: {
        Args: { _new_quota: number; _user_id: string }
        Returns: boolean
      }
      toggle_match_kudos: {
        Args: { p_match_id: string }
        Returns: Json
      }
      add_match_comment: {
        Args: {
          p_match_id: string
          p_body: string
          p_parent_comment_id?: string | null
        }
        Returns: Json
      }
      edit_match_comment: {
        Args: { p_comment_id: string; p_body: string }
        Returns: Json
      }
      delete_match_comment: {
        Args: { p_comment_id: string }
        Returns: Json
      }
      get_match_comments: {
        Args: {
          p_match_id: string
          p_limit?: number
          p_cursor_created_at?: string | null
          p_cursor_comment_id?: string | null
        }
        Returns: {
          comment_id: string
          parent_comment_id: string | null
          depth: number
          body: string
          user_id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string | null
          is_deleted: boolean
        }[]
      }
    }
    Enums: {
      app_role: "viewer" | "creator" | "admin" | "moderator"
      blog_lang: "en" | "vi"
      chat_highlight_type: "vip" | "sponsor" | "special_guest"
      content_status: "draft" | "published" | "hidden"
      follow_target_type: "organization" | "tournament"
      forum_like_target: "post" | "comment"
      game_scoring_type: "rally21" | "sideout11"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      livestream_status: "scheduled" | "live" | "ended"
      news_status: "draft" | "scheduled" | "published"
      notification_type: "livestream_scheduled" | "livestream_live"
      player_gender: "male" | "female"
      quick_match_status: "pending" | "completed"
      quick_table_format: "round_robin" | "large_playoff"
      quick_table_status: "setup" | "group_stage" | "playoff" | "completed"
      registration_status: "pending" | "approved" | "rejected"
      skill_rating_system: "DUPR" | "other" | "none"
      target_type: "video" | "livestream"
      team_game_type: "WD" | "MD" | "MX" | "WS" | "MS"
      team_match_match_status:
        | "pending"
        | "lineup"
        | "in_progress"
        | "completed"
      team_match_status: "setup" | "registration" | "ongoing" | "completed"
      team_status:
        | "draft"
        | "pending_partner"
        | "partner_pending"
        | "partner_confirmed"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "removed"
      tournament_status: "upcoming" | "ongoing" | "ended"
      video_type: "short" | "long"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["viewer", "creator", "admin", "moderator"],
      blog_lang: ["en", "vi"],
      chat_highlight_type: ["vip", "sponsor", "special_guest"],
      content_status: ["draft", "published", "hidden"],
      follow_target_type: ["organization", "tournament"],
      forum_like_target: ["post", "comment"],
      game_scoring_type: ["rally21", "sideout11"],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      livestream_status: ["scheduled", "live", "ended"],
      news_status: ["draft", "scheduled", "published"],
      notification_type: ["livestream_scheduled", "livestream_live"],
      player_gender: ["male", "female"],
      quick_match_status: ["pending", "completed"],
      quick_table_format: ["round_robin", "large_playoff"],
      quick_table_status: ["setup", "group_stage", "playoff", "completed"],
      registration_status: ["pending", "approved", "rejected"],
      skill_rating_system: ["DUPR", "other", "none"],
      target_type: ["video", "livestream"],
      team_game_type: ["WD", "MD", "MX", "WS", "MS"],
      team_match_match_status: [
        "pending",
        "lineup",
        "in_progress",
        "completed",
      ],
      team_match_status: ["setup", "registration", "ongoing", "completed"],
      team_status: [
        "draft",
        "pending_partner",
        "partner_pending",
        "partner_confirmed",
        "pending_approval",
        "approved",
        "rejected",
        "removed",
      ],
      tournament_status: ["upcoming", "ongoing", "ended"],
      video_type: ["short", "long"],
    },
  },
} as const

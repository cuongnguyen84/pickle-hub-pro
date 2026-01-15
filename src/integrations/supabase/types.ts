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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
          id: string
          mux_asset_id: string | null
          mux_asset_playback_id: string | null
          mux_live_stream_id: string | null
          mux_playback_id: string | null
          mux_stream_key: string | null
          organization_id: string
          scheduled_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["livestream_status"]
          thumbnail_url: string | null
          title: string
          tournament_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          mux_asset_id?: string | null
          mux_asset_playback_id?: string | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          mux_stream_key?: string | null
          organization_id: string
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"]
          thumbnail_url?: string | null
          title: string
          tournament_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          mux_asset_id?: string | null
          mux_asset_playback_id?: string | null
          mux_live_stream_id?: string | null
          mux_playback_id?: string | null
          mux_stream_key?: string | null
          organization_id?: string
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"]
          thumbnail_url?: string | null
          title?: string
          tournament_id?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          display_name_updated_at: string | null
          email: string
          id: string
          organization_id: string | null
          tournament_create_quota: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          display_name_updated_at?: string | null
          email: string
          id: string
          organization_id?: string | null
          tournament_create_quota?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          display_name_updated_at?: string | null
          email?: string
          id?: string
          organization_id?: string | null
          tournament_create_quota?: number
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
          created_at: string
          display_order: number
          group_id: string | null
          id: string
          is_playoff: boolean
          large_playoff_round: number | null
          live_referee_id: string | null
          next_match_id: string | null
          next_match_slot: number | null
          player1_id: string | null
          player2_id: string | null
          playoff_match_number: number | null
          playoff_round: number | null
          rr_match_index: number | null
          rr_round_number: number | null
          score1: number | null
          score2: number | null
          start_at: string | null
          status: Database["public"]["Enums"]["quick_match_status"]
          table_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          bracket_position?: string | null
          court_id?: number | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          is_playoff?: boolean
          large_playoff_round?: number | null
          live_referee_id?: string | null
          next_match_id?: string | null
          next_match_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          playoff_match_number?: number | null
          playoff_round?: number | null
          rr_match_index?: number | null
          rr_round_number?: number | null
          score1?: number | null
          score2?: number | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["quick_match_status"]
          table_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          bracket_position?: string | null
          court_id?: number | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          is_playoff?: boolean
          large_playoff_round?: number | null
          live_referee_id?: string | null
          next_match_id?: string | null
          next_match_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          playoff_match_number?: number | null
          playoff_round?: number | null
          rr_match_index?: number | null
          rr_round_number?: number | null
          score1?: number | null
          score2?: number | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["quick_match_status"]
          table_id?: string
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
          format: Database["public"]["Enums"]["quick_table_format"]
          group_count: number | null
          id: string
          is_doubles: boolean
          is_public: boolean
          max_skill_level: number | null
          min_skill_level: number | null
          name: string
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
          format: Database["public"]["Enums"]["quick_table_format"]
          group_count?: number | null
          id?: string
          is_doubles?: boolean
          is_public?: boolean
          max_skill_level?: number | null
          min_skill_level?: number | null
          name?: string
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
          format?: Database["public"]["Enums"]["quick_table_format"]
          group_count?: number | null
          id?: string
          is_doubles?: boolean
          is_public?: boolean
          max_skill_level?: number | null
          min_skill_level?: number | null
          name?: string
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
          organization_id: string | null
          source: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          source?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          source?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
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
          id: string | null
          mux_asset_playback_id: string | null
          mux_playback_id: string | null
          organization_id: string | null
          scheduled_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["livestream_status"] | null
          thumbnail_url: string | null
          title: string | null
          tournament_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string | null
          mux_asset_playback_id?: string | null
          mux_playback_id?: string | null
          organization_id?: string | null
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"] | null
          thumbnail_url?: string | null
          title?: string | null
          tournament_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string | null
          mux_asset_playback_id?: string | null
          mux_playback_id?: string | null
          organization_id?: string | null
          scheduled_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"] | null
          thumbnail_url?: string | null
          title?: string | null
          tournament_id?: string | null
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
      can_edit_quick_table_scores: {
        Args: { _table_id: string; _user_id: string }
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
      cancel_pair_request: { Args: { _request_id: string }; Returns: Json }
      create_pair_request: {
        Args: { _table_id: string; _to_team_id: string }
        Returns: Json
      }
      create_quick_table_with_quota:
        | {
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
        | {
            Args: {
              _auto_approve_registrations?: boolean
              _format: Database["public"]["Enums"]["quick_table_format"]
              _group_count?: number
              _is_doubles?: boolean
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
      remove_partner_from_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: Json
      }
      respond_pair_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: Json
      }
      set_user_quota: {
        Args: { _new_quota: number; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "viewer" | "creator" | "admin"
      content_status: "draft" | "published" | "hidden"
      follow_target_type: "organization" | "tournament"
      game_scoring_type: "rally21" | "sideout11"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      livestream_status: "scheduled" | "live" | "ended"
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
      app_role: ["viewer", "creator", "admin"],
      content_status: ["draft", "published", "hidden"],
      follow_target_type: ["organization", "tournament"],
      game_scoring_type: ["rally21", "sideout11"],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      livestream_status: ["scheduled", "live", "ended"],
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

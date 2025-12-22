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
          created_at: string
          display_name: string | null
          email: string
          id: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
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
          status: Database["public"]["Enums"]["content_status"]
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
          status?: Database["public"]["Enums"]["content_status"]
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
          status?: Database["public"]["Enums"]["content_status"]
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
      view_events: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
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
          mux_live_stream_id: string | null
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
          mux_live_stream_id?: string | null
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
          mux_live_stream_id?: string | null
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
      can_moderate_chat: {
        Args: { _livestream_id: string; _user_id: string }
        Returns: boolean
      }
      can_send_chat_message: {
        Args: { _livestream_id: string; _user_id: string }
        Returns: boolean
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
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_creator: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "viewer" | "creator" | "admin"
      content_status: "draft" | "published" | "hidden"
      follow_target_type: "organization" | "tournament"
      livestream_status: "scheduled" | "live" | "ended"
      notification_type: "livestream_scheduled" | "livestream_live"
      target_type: "video" | "livestream"
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
      livestream_status: ["scheduled", "live", "ended"],
      notification_type: ["livestream_scheduled", "livestream_live"],
      target_type: ["video", "livestream"],
      tournament_status: ["upcoming", "ongoing", "ended"],
      video_type: ["short", "long"],
    },
  },
} as const

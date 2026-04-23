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
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: never
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          calendar_event_id: string | null
          cancel_token: string | null
          created_at: string
          credit_pack_id: string | null
          ends_at: string
          id: string
          join_token: string | null
          note: string | null
          session_type: string
          starts_at: string
          status: string
          stripe_payment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          cancel_token?: string | null
          created_at?: string
          credit_pack_id?: string | null
          ends_at: string
          id?: string
          join_token?: string | null
          note?: string | null
          session_type: string
          starts_at: string
          status?: string
          stripe_payment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          cancel_token?: string | null
          created_at?: string
          credit_pack_id?: string | null
          ends_at?: string
          id?: string
          join_token?: string | null
          note?: string | null
          session_type?: string
          starts_at?: string
          status?: string
          stripe_payment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_credit_pack_id_fkey"
            columns: ["credit_pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          created_at: string
          credits_remaining: number
          expires_at: string
          id: string
          pack_size: number
          stripe_payment_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_remaining: number
          expires_at: string
          id?: string
          pack_size: number
          stripe_payment_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number
          expires_at?: string
          id?: string
          pack_size?: number
          stripe_payment_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_packs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_bookings: {
        Row: {
          email: string
          error: string
          failed_at: string
          start_iso: string
          stripe_session_id: string
        }
        Insert: {
          email: string
          error: string
          failed_at: string
          start_iso: string
          stripe_session_id: string
        }
        Update: {
          email?: string
          error?: string
          failed_at?: string
          start_iso?: string
          stripe_session_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          checkout_type: string
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          status: string
          stripe_payment_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          checkout_type: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          checkout_type?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          zoom_session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          zoom_session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          zoom_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_zoom_session_id_fkey"
            columns: ["zoom_session_id"]
            isOneToOne: false
            referencedRelation: "zoom_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_locks: {
        Row: {
          expires_at: string
          start_iso: string
        }
        Insert: {
          expires_at: string
          start_iso: string
        }
        Update: {
          expires_at?: string
          start_iso?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          idempotency_key: string
          processed_at: string
        }
        Insert: {
          idempotency_key: string
          processed_at?: string
        }
        Update: {
          idempotency_key?: string
          processed_at?: string
        }
        Relationships: []
      }
      zoom_sessions: {
        Row: {
          booking_id: string
          created_at: string
          duration_minutes: number
          ended_at: string | null
          id: string
          session_id: string
          session_name: string
          session_passcode: string
          started_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          session_id?: string
          session_name: string
          session_passcode: string
          started_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          session_id?: string
          session_name?: string
          session_passcode?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zoom_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_slot_lock: {
        Args: { p_duration_minutes: number; p_start_iso: string }
        Returns: boolean
      }
      decrement_credit: { Args: { p_user_id: string }; Returns: Json }
      release_slot_lock: { Args: { p_start_iso: string }; Returns: undefined }
      restore_credit: { Args: { p_user_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

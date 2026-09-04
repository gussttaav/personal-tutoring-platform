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
      enrollments: {
        Row: {
          completed_at: string | null
          course_slug: string
          enrolled_at: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_slug: string
          enrolled_at?: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_slug?: string
          enrolled_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_bookings: {
        Row: {
          error: string
          failed_at: string
          start_iso: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          error: string
          failed_at: string
          start_iso: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          error?: string
          failed_at?: string
          start_iso?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      google_review_prompts: {
        Row: {
          accepted_at: string | null
          created_at: string
          dismissed: boolean
          last_shown_completed_count: number | null
          shown_count: number
          skipped_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          dismissed?: boolean
          last_shown_completed_count?: number | null
          shown_count?: number
          skipped_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          dismissed?: boolean
          last_shown_completed_count?: number | null
          shown_count?: number
          skipped_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_review_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          course_slug: string
          id: string
          last_seen_at: string
          lesson_slug: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_slug: string
          id?: string
          last_seen_at?: string
          lesson_slug: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_slug?: string
          id?: string
          last_seen_at?: string
          lesson_slug?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      pending_terminations: {
        Row: {
          attempts: number
          created_at: string
          event_id: string
          fire_at: string
          last_error: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_id: string
          fire_at: string
          last_error?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_id?: string
          fire_at?: string
          last_error?: string | null
        }
        Relationships: []
      }
      booking_settings: {
        Row: {
          cancel_min_notice_hours: number
          id: number
          min_notice_hours: number
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cancel_min_notice_hours?: number
          id?: number
          min_notice_hours?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cancel_min_notice_hours?: number
          id?: number
          min_notice_hours?: number
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          day_of_week: number
          end_minute: number
          id: number
          start_minute: number
        }
        Insert: {
          day_of_week: number
          end_minute: number
          id?: never
          start_minute: number
        }
        Update: {
          day_of_week?: number
          end_minute?: number
          id?: never
          start_minute?: number
        }
        Relationships: []
      }
      pricing: {
        Row: {
          amount_cents: number
          currency: string
          product_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents: number
          currency?: string
          product_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          currency?: string
          product_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          id: number
          pack_validity_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          pack_validity_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          pack_validity_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answer: Json | null
          attempted_at: string
          correct: boolean
          course_slug: string
          id: string
          lesson_slug: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          answer?: Json | null
          attempted_at?: string
          correct: boolean
          course_slug: string
          id?: string
          lesson_slug: string
          quiz_id: string
          user_id: string
        }
        Update: {
          answer?: Json | null
          attempted_at?: string
          correct?: boolean
          course_slug?: string
          id?: string
          lesson_slug?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
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
      single_session_refunds: {
        Row: {
          reason: string
          refunded_at: string
          stripe_payment_id: string
        }
        Insert: {
          reason?: string
          refunded_at?: string
          stripe_payment_id: string
        }
        Update: {
          reason?: string
          refunded_at?: string
          stripe_payment_id?: string
        }
        Relationships: []
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
      subscriptions: {
        Row: {
          created_at: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          locale: string | null
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          locale?: string | null
          name?: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string | null
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
          student_joined_at: string | null
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
          student_joined_at?: string | null
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
          student_joined_at?: string | null
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
      delete_user_account: { Args: { p_email: string }; Returns: Json }
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

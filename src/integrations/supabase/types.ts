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
      ae_notes: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          lender_id: string
          note: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lender_id: string
          note: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lender_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "ae_notes_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          ae_email: string | null
          ae_name: string | null
          ae_phone: string | null
          avg_turn_time_days: number | null
          created_at: string
          created_by: string | null
          id: string
          internal_experience: string | null
          name: string
          niche_advantages: string | null
          reputation_notes: string | null
          states_licensed: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          ae_email?: string | null
          ae_name?: string | null
          ae_phone?: string | null
          avg_turn_time_days?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_experience?: string | null
          name: string
          niche_advantages?: string | null
          reputation_notes?: string | null
          states_licensed?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          ae_email?: string | null
          ae_name?: string | null
          ae_phone?: string | null
          avg_turn_time_days?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_experience?: string | null
          name?: string
          niche_advantages?: string | null
          reputation_notes?: string | null
          states_licensed?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      loan_programs: {
        Row: {
          bk_seasoning_months: number | null
          competitive_advantages: string | null
          created_at: string
          created_by: string | null
          dpa_available: boolean
          dpa_min_fico: number | null
          dscr_min: number | null
          exception_policy: string | null
          fc_seasoning_months: number | null
          foreign_national_eligible: boolean
          gift_funds_allowed: boolean
          id: string
          income_types: string[]
          itin_eligible: boolean
          lender_id: string
          loan_program: string | null
          loan_types: string[]
          max_dti: number | null
          max_loan_amount: number | null
          max_ltv: number | null
          min_fico: number | null
          min_loan_amount: number | null
          niche_advantages: string | null
          notes: string | null
          occupancies: string[]
          product_name: string
          product_type: string | null
          property_types: string[]
          reserve_months: number | null
          seasoning_months: number | null
          special_programs: string[]
          states: string[]
          tags: string[]
          updated_at: string
        }
        Insert: {
          bk_seasoning_months?: number | null
          competitive_advantages?: string | null
          created_at?: string
          created_by?: string | null
          dpa_available?: boolean
          dpa_min_fico?: number | null
          dscr_min?: number | null
          exception_policy?: string | null
          fc_seasoning_months?: number | null
          foreign_national_eligible?: boolean
          gift_funds_allowed?: boolean
          id?: string
          income_types?: string[]
          itin_eligible?: boolean
          lender_id: string
          loan_program?: string | null
          loan_types?: string[]
          max_dti?: number | null
          max_loan_amount?: number | null
          max_ltv?: number | null
          min_fico?: number | null
          min_loan_amount?: number | null
          niche_advantages?: string | null
          notes?: string | null
          occupancies?: string[]
          product_name: string
          product_type?: string | null
          property_types?: string[]
          reserve_months?: number | null
          seasoning_months?: number | null
          special_programs?: string[]
          states?: string[]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          bk_seasoning_months?: number | null
          competitive_advantages?: string | null
          created_at?: string
          created_by?: string | null
          dpa_available?: boolean
          dpa_min_fico?: number | null
          dscr_min?: number | null
          exception_policy?: string | null
          fc_seasoning_months?: number | null
          foreign_national_eligible?: boolean
          gift_funds_allowed?: boolean
          id?: string
          income_types?: string[]
          itin_eligible?: boolean
          lender_id?: string
          loan_program?: string | null
          loan_types?: string[]
          max_dti?: number | null
          max_loan_amount?: number | null
          max_ltv?: number | null
          min_fico?: number | null
          min_loan_amount?: number | null
          niche_advantages?: string | null
          notes?: string | null
          occupancies?: string[]
          product_name?: string
          product_type?: string | null
          property_types?: string[]
          reserve_months?: number | null
          seasoning_months?: number | null
          special_programs?: string[]
          states?: string[]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_programs_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      overlays: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          lender_id: string | null
          overlay_type: string
          program_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          lender_id?: string | null
          overlay_type: string
          program_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          lender_id?: string | null
          overlay_type?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overlays_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overlays_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loan_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      raw_intel: {
        Row: {
          created_at: string
          created_by: string | null
          extraction: Json | null
          id: string
          lender_id: string | null
          raw_text: string
          source_label: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          extraction?: Json | null
          id?: string
          lender_id?: string | null
          raw_text: string
          source_label?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          extraction?: Json | null
          id?: string
          lender_id?: string | null
          raw_text?: string
          source_label?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_intel_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

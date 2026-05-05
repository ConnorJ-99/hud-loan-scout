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
          {
            foreignKeyName: "ae_notes_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          company_logo_url: string | null
          company_name: string | null
          created_at: string
          default_expense_factor: number
          id: string
          large_deposit_threshold: number
          report_branding: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          default_expense_factor?: number
          id?: string
          large_deposit_threshold?: number
          report_branding?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          default_expense_factor?: number
          id?: string
          large_deposit_threshold?: number
          report_branding?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          account_holder: string | null
          account_last4: string | null
          bank_name: string | null
          created_at: string
          created_by: string
          file_name: string | null
          file_path: string | null
          id: string
          income_analysis_id: string
          parse_error: string | null
          parse_status: string
          period_end: string | null
          period_start: string | null
        }
        Insert: {
          account_holder?: string | null
          account_last4?: string | null
          bank_name?: string | null
          created_at?: string
          created_by: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          income_analysis_id: string
          parse_error?: string | null
          parse_status?: string
          period_end?: string | null
          period_start?: string | null
        }
        Update: {
          account_holder?: string | null
          account_last4?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          income_analysis_id?: string
          parse_error?: string | null
          parse_status?: string
          period_end?: string | null
          period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_income_analysis_id_fkey"
            columns: ["income_analysis_id"]
            isOneToOne: false
            referencedRelation: "income_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      borrower_files: {
        Row: {
          borrower_name: string
          created_at: string
          created_by: string
          email: string | null
          id: string
          loan_amount: number | null
          loan_officer: string | null
          loan_purpose: string | null
          notes: string | null
          phone: string | null
          property_address: string | null
          purchase_price: number | null
          status: string
          target_program: string | null
          updated_at: string
        }
        Insert: {
          borrower_name: string
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          loan_amount?: number | null
          loan_officer?: string | null
          loan_purpose?: string | null
          notes?: string | null
          phone?: string | null
          property_address?: string | null
          purchase_price?: number | null
          status?: string
          target_program?: string | null
          updated_at?: string
        }
        Update: {
          borrower_name?: string
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          loan_amount?: number | null
          loan_officer?: string | null
          loan_purpose?: string | null
          notes?: string | null
          phone?: string | null
          property_address?: string | null
          purchase_price?: number | null
          status?: string
          target_program?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          assigned_to: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          date_due: string | null
          date_paid: string | null
          department: string | null
          id: string
          is_recurring: boolean
          name: string
          notes: string | null
          recurrence: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date_due?: string | null
          date_paid?: string | null
          department?: string | null
          id?: string
          is_recurring?: boolean
          name: string
          notes?: string | null
          recurrence?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          date_due?: string | null
          date_paid?: string | null
          department?: string | null
          id?: string
          is_recurring?: boolean
          name?: string
          notes?: string | null
          recurrence?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      income_analyses: {
        Row: {
          ai_notes: string | null
          analysis_type: string
          avg_monthly_deposits: number | null
          borrower_file_id: string | null
          borrower_name: string
          created_at: string
          created_by: string
          excluded_deposits: number | null
          expense_factor: number
          id: string
          large_deposit_threshold: number | null
          months_reviewed: number | null
          qualifying_deposits: number | null
          qualifying_monthly_income: number | null
          reviewer_notes: string | null
          statement_period_end: string | null
          statement_period_start: string | null
          status: string
          total_deposits: number | null
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          analysis_type?: string
          avg_monthly_deposits?: number | null
          borrower_file_id?: string | null
          borrower_name: string
          created_at?: string
          created_by: string
          excluded_deposits?: number | null
          expense_factor?: number
          id?: string
          large_deposit_threshold?: number | null
          months_reviewed?: number | null
          qualifying_deposits?: number | null
          qualifying_monthly_income?: number | null
          reviewer_notes?: string | null
          statement_period_end?: string | null
          statement_period_start?: string | null
          status?: string
          total_deposits?: number | null
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          analysis_type?: string
          avg_monthly_deposits?: number | null
          borrower_file_id?: string | null
          borrower_name?: string
          created_at?: string
          created_by?: string
          excluded_deposits?: number | null
          expense_factor?: number
          id?: string
          large_deposit_threshold?: number | null
          months_reviewed?: number | null
          qualifying_deposits?: number | null
          qualifying_monthly_income?: number | null
          reviewer_notes?: string | null
          statement_period_end?: string | null
          statement_period_start?: string | null
          status?: string
          total_deposits?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_analyses_borrower_file_id_fkey"
            columns: ["borrower_file_id"]
            isOneToOne: false
            referencedRelation: "borrower_files"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_lo: string | null
          converted_loan_id: string | null
          created_at: string
          email: string | null
          id: string
          loan_amount: number | null
          loan_type: string | null
          name: string
          notes: string | null
          phone: string | null
          purchase_price: number | null
          raw_payload: Json | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_lo?: string | null
          converted_loan_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loan_amount?: number | null
          loan_type?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          purchase_price?: number | null
          raw_payload?: Json | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_lo?: string | null
          converted_loan_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          loan_amount?: number | null
          loan_type?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          purchase_price?: number | null
          raw_payload?: Json | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_loan_fk"
            columns: ["converted_loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
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
      loan_fees: {
        Row: {
          amount_mode: Database["public"]["Enums"]["comp_mode"]
          created_at: string
          deduct_from: Database["public"]["Enums"]["fee_deduct_from"]
          flat_amount: number
          id: string
          label: string | null
          loan_id: string
          notes: string | null
          pct_of_gross: number
          recipient_role: Database["public"]["Enums"]["fee_recipient_role"]
          recipient_user_id: string | null
          updated_at: string
        }
        Insert: {
          amount_mode?: Database["public"]["Enums"]["comp_mode"]
          created_at?: string
          deduct_from?: Database["public"]["Enums"]["fee_deduct_from"]
          flat_amount?: number
          id?: string
          label?: string | null
          loan_id: string
          notes?: string | null
          pct_of_gross?: number
          recipient_role?: Database["public"]["Enums"]["fee_recipient_role"]
          recipient_user_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_mode?: Database["public"]["Enums"]["comp_mode"]
          created_at?: string
          deduct_from?: Database["public"]["Enums"]["fee_deduct_from"]
          flat_amount?: number
          id?: string
          label?: string | null
          loan_id?: string
          notes?: string | null
          pct_of_gross?: number
          recipient_role?: Database["public"]["Enums"]["fee_recipient_role"]
          recipient_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_fees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          loan_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          loan_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_notes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_programs: {
        Row: {
          ai_triggers: string[]
          bk_seasoning_months: number | null
          broker_brief: string | null
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
          ai_triggers?: string[]
          bk_seasoning_months?: number | null
          broker_brief?: string | null
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
          ai_triggers?: string[]
          bk_seasoning_months?: number | null
          broker_brief?: string | null
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
          {
            foreignKeyName: "loan_programs_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_searches: {
        Row: {
          ai_summary: string | null
          borrower_file_id: string | null
          created_at: string
          created_by: string
          id: string
          match_count: number | null
          nickname: string | null
          scenario: Json
          top_lender: string | null
          top_product: string | null
        }
        Insert: {
          ai_summary?: string | null
          borrower_file_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          match_count?: number | null
          nickname?: string | null
          scenario: Json
          top_lender?: string | null
          top_product?: string | null
        }
        Update: {
          ai_summary?: string | null
          borrower_file_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          match_count?: number | null
          nickname?: string | null
          scenario?: Json
          top_lender?: string | null
          top_product?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_searches_borrower_file_id_fkey"
            columns: ["borrower_file_id"]
            isOneToOne: false
            referencedRelation: "borrower_files"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["loan_stage"] | null
          id: string
          loan_id: string
          note: string | null
          to_stage: Database["public"]["Enums"]["loan_stage"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["loan_stage"] | null
          id?: string
          loan_id: string
          note?: string | null
          to_stage: Database["public"]["Enums"]["loan_stage"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["loan_stage"] | null
          id?: string
          loan_id?: string
          note?: string | null
          to_stage?: Database["public"]["Enums"]["loan_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "loan_stage_history_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          actual_close_date: string | null
          assigned_lo: string | null
          borrower_email: string | null
          borrower_file_id: string | null
          borrower_name: string
          borrower_phone: string | null
          comp_flat_amount: number
          comp_mode: Database["public"]["Enums"]["comp_mode"]
          comp_points: number
          company_revenue: number | null
          created_at: string
          expected_close_date: string | null
          gross_commission: number
          house_split_pct: number
          id: string
          interest_rate: number | null
          lo_comp_amount: number | null
          lo_comp_pct: number | null
          lo_split_pct: number
          loan_amount: number | null
          loan_type: string | null
          notes: string | null
          purchase_price: number | null
          realtor_email: string | null
          realtor_name: string | null
          realtor_phone: string | null
          source_lead_id: string | null
          stage: Database["public"]["Enums"]["loan_stage"]
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          assigned_lo?: string | null
          borrower_email?: string | null
          borrower_file_id?: string | null
          borrower_name: string
          borrower_phone?: string | null
          comp_flat_amount?: number
          comp_mode?: Database["public"]["Enums"]["comp_mode"]
          comp_points?: number
          company_revenue?: number | null
          created_at?: string
          expected_close_date?: string | null
          gross_commission?: number
          house_split_pct?: number
          id?: string
          interest_rate?: number | null
          lo_comp_amount?: number | null
          lo_comp_pct?: number | null
          lo_split_pct?: number
          loan_amount?: number | null
          loan_type?: string | null
          notes?: string | null
          purchase_price?: number | null
          realtor_email?: string | null
          realtor_name?: string | null
          realtor_phone?: string | null
          source_lead_id?: string | null
          stage?: Database["public"]["Enums"]["loan_stage"]
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          assigned_lo?: string | null
          borrower_email?: string | null
          borrower_file_id?: string | null
          borrower_name?: string
          borrower_phone?: string | null
          comp_flat_amount?: number
          comp_mode?: Database["public"]["Enums"]["comp_mode"]
          comp_points?: number
          company_revenue?: number | null
          created_at?: string
          expected_close_date?: string | null
          gross_commission?: number
          house_split_pct?: number
          id?: string
          interest_rate?: number | null
          lo_comp_amount?: number | null
          lo_comp_pct?: number | null
          lo_split_pct?: number
          loan_amount?: number | null
          loan_type?: string | null
          notes?: string | null
          purchase_price?: number | null
          realtor_email?: string | null
          realtor_name?: string | null
          realtor_phone?: string | null
          source_lead_id?: string | null
          stage?: Database["public"]["Enums"]["loan_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
            foreignKeyName: "overlays_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders_public"
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
          annual_draw: number
          annual_salary: number
          comp_plan: Database["public"]["Enums"]["comp_plan"]
          created_at: string
          default_comp_pct: number
          default_house_split_pct: number
          default_lo_split_pct: number
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          monthly_draw: number
          monthly_salary: number
          pay_day: number | null
          pay_frequency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_draw?: number
          annual_salary?: number
          comp_plan?: Database["public"]["Enums"]["comp_plan"]
          created_at?: string
          default_comp_pct?: number
          default_house_split_pct?: number
          default_lo_split_pct?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          monthly_draw?: number
          monthly_salary?: number
          pay_day?: number | null
          pay_frequency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_draw?: number
          annual_salary?: number
          comp_plan?: Database["public"]["Enums"]["comp_plan"]
          created_at?: string
          default_comp_pct?: number
          default_house_split_pct?: number
          default_lo_split_pct?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          monthly_draw?: number
          monthly_salary?: number
          pay_day?: number | null
          pay_frequency?: string
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
          {
            foreignKeyName: "raw_intel_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payouts: {
        Row: {
          created_at: string
          draw_amount: number
          id: string
          notes: string | null
          paid_on: string | null
          pay_period: string
          salary_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draw_amount?: number
          id?: string
          notes?: string | null
          paid_on?: string | null
          pay_period: string
          salary_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draw_amount?: number
          id?: string
          notes?: string | null
          paid_on?: string | null
          pay_period?: string
          salary_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_transactions: {
        Row: {
          balance: number | null
          bank_statement_id: string
          classification: string
          confidence: number | null
          created_at: string
          created_by: string
          deposit_amount: number | null
          description: string | null
          id: string
          included_in_income: boolean
          income_analysis_id: string
          manual_override: boolean
          notes: string | null
          reason: string | null
          txn_date: string | null
          withdrawal_amount: number | null
        }
        Insert: {
          balance?: number | null
          bank_statement_id: string
          classification?: string
          confidence?: number | null
          created_at?: string
          created_by: string
          deposit_amount?: number | null
          description?: string | null
          id?: string
          included_in_income?: boolean
          income_analysis_id: string
          manual_override?: boolean
          notes?: string | null
          reason?: string | null
          txn_date?: string | null
          withdrawal_amount?: number | null
        }
        Update: {
          balance?: number | null
          bank_statement_id?: string
          classification?: string
          confidence?: number | null
          created_at?: string
          created_by?: string
          deposit_amount?: number | null
          description?: string | null
          id?: string
          included_in_income?: boolean
          income_analysis_id?: string
          manual_override?: boolean
          notes?: string | null
          reason?: string | null
          txn_date?: string | null
          withdrawal_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "statement_transactions_bank_statement_id_fkey"
            columns: ["bank_statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_transactions_income_analysis_id_fkey"
            columns: ["income_analysis_id"]
            isOneToOne: false
            referencedRelation: "income_analyses"
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
      webhook_config: {
        Row: {
          id: string
          shared_secret: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          shared_secret: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          shared_secret?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      lenders_public: {
        Row: {
          avg_turn_time_days: number | null
          created_at: string | null
          id: string | null
          internal_experience: string | null
          name: string | null
          niche_advantages: string | null
          reputation_notes: string | null
          states_licensed: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avg_turn_time_days?: number | null
          created_at?: string | null
          id?: string | null
          internal_experience?: string | null
          name?: string | null
          niche_advantages?: string | null
          reputation_notes?: string | null
          states_licensed?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avg_turn_time_days?: number | null
          created_at?: string | null
          id?: string | null
          internal_experience?: string | null
          name?: string | null
          niche_advantages?: string | null
          reputation_notes?: string | null
          states_licensed?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
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
      app_role: "admin" | "user" | "loan_officer" | "processor" | "assistant"
      comp_mode: "percentage" | "flat"
      comp_plan:
        | "commission_only"
        | "salary"
        | "salary_plus_commission"
        | "draw_against_commission"
      expense_category:
        | "payroll"
        | "rent"
        | "marketing"
        | "zillow_leads"
        | "office"
        | "processing"
        | "licensing"
        | "software"
        | "compliance"
        | "advertising"
        | "team"
        | "misc"
      fee_deduct_from: "lo_split" | "house_split"
      fee_recipient_role: "loan_officer" | "processor" | "assistant" | "admin"
      lead_source:
        | "ghl"
        | "zapier"
        | "website"
        | "zillow"
        | "other"
        | "realtor"
        | "referral"
      lead_status:
        | "new"
        | "contacted"
        | "not_ready"
        | "bad_lead"
        | "duplicate"
        | "moved_to_tracking"
      loan_stage:
        | "new"
        | "application"
        | "processing"
        | "underwriting"
        | "conditional_approval"
        | "clear_to_close"
        | "funded"
        | "lost"
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
      app_role: ["admin", "user", "loan_officer", "processor", "assistant"],
      comp_mode: ["percentage", "flat"],
      comp_plan: [
        "commission_only",
        "salary",
        "salary_plus_commission",
        "draw_against_commission",
      ],
      expense_category: [
        "payroll",
        "rent",
        "marketing",
        "zillow_leads",
        "office",
        "processing",
        "licensing",
        "software",
        "compliance",
        "advertising",
        "team",
        "misc",
      ],
      fee_deduct_from: ["lo_split", "house_split"],
      fee_recipient_role: ["loan_officer", "processor", "assistant", "admin"],
      lead_source: [
        "ghl",
        "zapier",
        "website",
        "zillow",
        "other",
        "realtor",
        "referral",
      ],
      lead_status: [
        "new",
        "contacted",
        "not_ready",
        "bad_lead",
        "duplicate",
        "moved_to_tracking",
      ],
      loan_stage: [
        "new",
        "application",
        "processing",
        "underwriting",
        "conditional_approval",
        "clear_to_close",
        "funded",
        "lost",
      ],
    },
  },
} as const

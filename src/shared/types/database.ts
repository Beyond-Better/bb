export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  abi_auth: {
    Tables: {
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          metadata: Json | null
          name: string
          organization_id: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          metadata?: Json | null
          name: string
          organization_id?: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          role: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          metadata: Json | null
          name: string
          organization_id: string
          settings: Json | null
          slug: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          metadata?: Json | null
          name: string
          organization_id: string
          settings?: Json | null
          slug: string
          team_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          settings?: Json | null
          slug?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          email_verified: boolean | null
          name_first: string | null
          name_last: string | null
          phone_number: string | null
          preferences: Json | null
          profile_id: string
          stripe_customer_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_verified?: boolean | null
          name_first?: string | null
          name_last?: string | null
          phone_number?: string | null
          preferences?: Json | null
          profile_id: string
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_verified?: boolean | null
          name_first?: string | null
          name_last?: string | null
          phone_number?: string | null
          preferences?: Json | null
          profile_id?: string
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_min_org_role: {
        Args: { org_id: string; min_role: string }
        Returns: boolean
      }
      check_min_team_role: {
        Args: { t_id: string; min_role: string }
        Returns: boolean
      }
      check_organization_role: {
        Args: { org_id: string; required_role: string }
        Returns: boolean
      }
      check_organization_roles: {
        Args: { org_id: string; required_roles: string[] }
        Returns: boolean
      }
      check_team_role: {
        Args: { t_id: string; required_role: string }
        Returns: boolean
      }
      check_team_roles: {
        Args: { t_id: string; required_roles: string[] }
        Returns: boolean
      }
      get_user_email: {
        Args: { user_id: string }
        Returns: string
      }
      has_organization_access: {
        Args: { org_id: string }
        Returns: boolean
      }
      has_team_access: {
        Args: { t_id: string }
        Returns: boolean
      }
      is_resource_owner: {
        Args: { resource_user_id: string }
        Returns: boolean
      }
      verify_free_plan_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  abi_billing: {
    Tables: {
      auto_topup_rate_limits: {
        Row: {
          created_at: string
          daily_topup_amount_cents: number
          daily_topup_count: number
          failure_count: number
          last_failure_reason: string | null
          last_failure_timestamp: string | null
          last_success_timestamp: string | null
          last_topup_date: string
          last_topup_timestamp: string | null
          temporary_disable_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_topup_amount_cents?: number
          daily_topup_count?: number
          failure_count?: number
          last_failure_reason?: string | null
          last_failure_timestamp?: string | null
          last_success_timestamp?: string | null
          last_topup_date?: string
          last_topup_timestamp?: string | null
          temporary_disable_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_topup_amount_cents?: number
          daily_topup_count?: number
          failure_count?: number
          last_failure_reason?: string | null
          last_failure_timestamp?: string | null
          last_success_timestamp?: string | null
          last_topup_date?: string
          last_topup_timestamp?: string | null
          temporary_disable_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_topup_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "auto_topup_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "auto_topup_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "auto_topup_rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      balance_cache: {
        Row: {
          balance_micro_usd: number
          last_usage_check_at: string | null
          ledger_updated_at: string
          team_id: string | null
          updated_at: string | null
          user_id: string
          version: number
        }
        Insert: {
          balance_micro_usd?: number
          last_usage_check_at?: string | null
          ledger_updated_at: string
          team_id?: string | null
          updated_at?: string | null
          user_id: string
          version?: number
        }
        Update: {
          balance_micro_usd?: number
          last_usage_check_at?: string | null
          ledger_updated_at?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      balance_ledger: {
        Row: {
          amount_micro_usd: number
          balance_after_micro_usd: number
          created_at: string | null
          effective_date: string
          entry_type: Database["abi_billing"]["Enums"]["ledger_entry_type"]
          expires_at: string | null
          ledger_id: number
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount_micro_usd: number
          balance_after_micro_usd: number
          created_at?: string | null
          effective_date: string
          entry_type: Database["abi_billing"]["Enums"]["ledger_entry_type"]
          expires_at?: string | null
          ledger_id?: number
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount_micro_usd?: number
          balance_after_micro_usd?: number
          created_at?: string | null
          effective_date?: string
          entry_type?: Database["abi_billing"]["Enums"]["ledger_entry_type"]
          expires_at?: string | null
          ledger_id?: number
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      batches_allowance: {
        Row: {
          batch_id: string
          created_at: string
          period_end: string
          period_start: string
          previous_balance_cents_usd: number
          processed_at: string | null
          purchased_allowance_cents_usd: number
          status: string
          subscription_allowance_cents_usd: number
          total_allowance_cents_usd: number
          user_id: string
        }
        Insert: {
          batch_id?: string
          created_at?: string
          period_end: string
          period_start: string
          previous_balance_cents_usd: number
          processed_at?: string | null
          purchased_allowance_cents_usd: number
          status: string
          subscription_allowance_cents_usd: number
          total_allowance_cents_usd: number
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          period_end?: string
          period_start?: string
          previous_balance_cents_usd?: number
          processed_at?: string | null
          purchased_allowance_cents_usd?: number
          status?: string
          subscription_allowance_cents_usd?: number
          total_allowance_cents_usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_allowance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_allowance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_allowance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_allowance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      batches_usage: {
        Row: {
          batch_id: string
          created_at: string
          model_costs: Json | null
          period_end: string
          period_start: string
          processed_at: string | null
          purchased_used_cents_usd: number | null
          request_count: number | null
          status: string
          subscription_used_cents_usd: number | null
          total_used_cents_usd: number | null
          user_id: string
        }
        Insert: {
          batch_id?: string
          created_at?: string
          model_costs?: Json | null
          period_end: string
          period_start: string
          processed_at?: string | null
          purchased_used_cents_usd?: number | null
          request_count?: number | null
          status: string
          subscription_used_cents_usd?: number | null
          total_used_cents_usd?: number | null
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          model_costs?: Json | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          purchased_used_cents_usd?: number | null
          request_count?: number | null
          status?: string
          subscription_used_cents_usd?: number | null
          total_used_cents_usd?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "batches_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      migration_progress: {
        Row: {
          completed_at: string | null
          error_message: string | null
          migration_step: string
          records_processed: number | null
          records_total: number | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          migration_step: string
          records_processed?: number | null
          records_total?: number | null
          started_at?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          migration_step?: string
          records_processed?: number | null
          records_total?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount_cents_usd: number
          created_at: string
          payment_id: string
          payment_method_details: Json | null
          payment_type: string
          purchase_id: string | null
          status: string
          stripe_payment_intent_id: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents_usd: number
          created_at?: string
          payment_id?: string
          payment_method_details?: Json | null
          payment_type: string
          purchase_id?: string | null
          status: string
          stripe_payment_intent_id: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents_usd?: number
          created_at?: string
          payment_id?: string
          payment_method_details?: Json | null
          payment_type?: string
          purchase_id?: string | null
          status?: string
          stripe_payment_intent_id?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "token_purchases"
            referencedColumns: ["purchase_id"]
          },
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_method_errors: {
        Row: {
          created_at: string
          error_id: string
          error_message: string
          error_type: string
          stripe_setup_intent_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_id?: string
          error_message: string
          error_type: string
          stripe_setup_intent_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_id?: string
          error_message?: string
          error_type?: string
          stripe_setup_intent_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_errors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_method_errors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_method_errors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_method_errors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          active_from: string
          active_to: string | null
          billing_interval: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at: string
          metadata: Json | null
          price_id: string
          product_id: string
          stripe_price_id: string
        }
        Insert: {
          active_from: string
          active_to?: string | null
          billing_interval?: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at?: string
          metadata?: Json | null
          price_id?: string
          product_id: string
          stripe_price_id: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          billing_interval?: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at?: string
          metadata?: Json | null
          price_id?: string
          product_id?: string
          stripe_price_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_prices: {
        Row: {
          active: boolean | null
          billing_interval: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at: string
          metadata: Json | null
          price_id: string
          product_id: string
          stripe_price_id: string
          unit_amount_cents_usd: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          billing_interval: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at?: string
          metadata?: Json | null
          price_id?: string
          product_id: string
          stripe_price_id: string
          unit_amount_cents_usd: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          billing_interval?: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at?: string
          metadata?: Json | null
          price_id?: string
          product_id?: string
          stripe_price_id?: string
          unit_amount_cents_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          metadata: Json | null
          name: string
          product_id: string
          product_type: Database["abi_billing"]["Enums"]["product_type"]
          stripe_product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          metadata?: Json | null
          name: string
          product_id?: string
          product_type: Database["abi_billing"]["Enums"]["product_type"]
          stripe_product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          metadata?: Json | null
          name?: string
          product_id?: string
          product_type?: Database["abi_billing"]["Enums"]["product_type"]
          stripe_product_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          event_data: Json
          event_id: string
          event_type: string
          last_error: string | null
          processed_at: string | null
          processing_attempts: number
          processing_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_data: Json
          event_id: string
          event_type: string
          last_error?: string | null
          processed_at?: string | null
          processing_attempts?: number
          processing_status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_id?: string
          event_type?: string
          last_error?: string | null
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          plan_active: boolean | null
          plan_available_for_signup: boolean
          plan_description: string | null
          plan_features: Json | null
          plan_id: string
          plan_name: string
          plan_price_monthly_cents_usd: number | null
          plan_price_yearly_cents_usd: number | null
          plan_sort_order: number | null
          product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          plan_active?: boolean | null
          plan_available_for_signup?: boolean
          plan_description?: string | null
          plan_features?: Json | null
          plan_id?: string
          plan_name: string
          plan_price_monthly_cents_usd?: number | null
          plan_price_yearly_cents_usd?: number | null
          plan_sort_order?: number | null
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          plan_active?: boolean | null
          plan_available_for_signup?: boolean
          plan_description?: string | null
          plan_features?: Json | null
          plan_id?: string
          plan_name?: string
          plan_price_monthly_cents_usd?: number | null
          plan_price_yearly_cents_usd?: number | null
          plan_sort_order?: number | null
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      token_purchases: {
        Row: {
          amount_cents_usd: number
          batch_id: string | null
          created_at: string
          metadata: Json
          product_id: string | null
          purchase_id: string
          purchase_status: string
          subscription_id: string | null
          tokens_added_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents_usd: number
          batch_id?: string | null
          created_at?: string
          metadata?: Json
          product_id?: string | null
          purchase_id?: string
          purchase_status: string
          subscription_id?: string | null
          tokens_added_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents_usd?: number
          batch_id?: string | null
          created_at?: string
          metadata?: Json
          product_id?: string | null
          purchase_id?: string
          purchase_status?: string
          subscription_id?: string | null
          tokens_added_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_batch_allowance"
            columns: ["batch_id", "user_id"]
            isOneToOne: false
            referencedRelation: "batches_allowance"
            referencedColumns: ["batch_id", "user_id"]
          },
          {
            foreignKeyName: "token_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "token_purchases_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "token_purchases_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "token_purchases_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "token_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "token_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "token_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "token_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      token_usage_batches: {
        Row: {
          batch_date: string
          batch_id: string
          created_at: string | null
          event_count: number
          ledger_entry_id: number | null
          period_end: string
          period_start: string
          total_cost_micro_usd: number
          used_micro_usd: number
          user_id: string
        }
        Insert: {
          batch_date: string
          batch_id?: string
          created_at?: string | null
          event_count: number
          ledger_entry_id?: number | null
          period_end: string
          period_start: string
          total_cost_micro_usd: number
          used_micro_usd?: number
          user_id: string
        }
        Update: {
          batch_date?: string
          batch_id?: string
          created_at?: string | null
          event_count?: number
          ledger_entry_id?: number | null
          period_end?: string
          period_start?: string
          total_cost_micro_usd?: number
          used_micro_usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_batches_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "balance_ledger"
            referencedColumns: ["ledger_id"]
          },
          {
            foreignKeyName: "token_usage_batches_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "balance_ledger_dollars"
            referencedColumns: ["ledger_id"]
          },
          {
            foreignKeyName: "token_usage_batches_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "user_balance_history"
            referencedColumns: ["ledger_id"]
          },
          {
            foreignKeyName: "token_usage_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "token_usage_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "token_usage_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "token_usage_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_payment_methods: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string
          is_default: boolean
          payment_method_id: string
          payment_type: string
          stripe_payment_method_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          is_default?: boolean
          payment_method_id?: string
          payment_type: string
          stripe_payment_method_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string
          is_default?: boolean
          payment_method_id?: string
          payment_type?: string
          stripe_payment_method_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_subscription_changes: {
        Row: {
          change_id: string
          change_type: string
          created_at: string
          effective_date: string
          new_plan_id: string
          previous_plan_id: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          change_id?: string
          change_type: string
          created_at?: string
          effective_date: string
          new_plan_id: string
          previous_plan_id?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          change_id?: string
          change_type?: string
          created_at?: string
          effective_date?: string
          new_plan_id?: string
          previous_plan_id?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscription_changes_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_previous_plan_id_fkey"
            columns: ["previous_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscription_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          billing_interval: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at: string
          last_payment_attempt: string | null
          last_payment_error: string | null
          metadata: Json | null
          plan_id: string
          stripe_subscription_id: string | null
          subscription_cancel_at: string | null
          subscription_canceled_at: string | null
          subscription_id: string
          subscription_period_end: string
          subscription_period_start: string
          subscription_status: Database["abi_billing"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at?: string
          last_payment_attempt?: string | null
          last_payment_error?: string | null
          metadata?: Json | null
          plan_id: string
          stripe_subscription_id?: string | null
          subscription_cancel_at?: string | null
          subscription_canceled_at?: string | null
          subscription_id?: string
          subscription_period_end: string
          subscription_period_start: string
          subscription_status: Database["abi_billing"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: Database["abi_billing"]["Enums"]["billing_interval"]
          created_at?: string
          last_payment_attempt?: string | null
          last_payment_error?: string | null
          metadata?: Json | null
          plan_id?: string
          stripe_subscription_id?: string | null
          subscription_cancel_at?: string | null
          subscription_canceled_at?: string | null
          subscription_id?: string
          subscription_period_end?: string
          subscription_period_start?: string
          subscription_status?: Database["abi_billing"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      balance_cache_dollars: {
        Row: {
          balance_usd: number | null
          last_usage_check_at: string | null
          ledger_updated_at: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          balance_usd?: never
          last_usage_check_at?: string | null
          ledger_updated_at?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          balance_usd?: never
          last_usage_check_at?: string | null
          ledger_updated_at?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      balance_ledger_dollars: {
        Row: {
          amount_usd: number | null
          balance_after_usd: number | null
          created_at: string | null
          effective_date: string | null
          entry_type:
            | Database["abi_billing"]["Enums"]["ledger_entry_type"]
            | null
          expires_at: string | null
          ledger_id: number | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_usd?: never
          balance_after_usd?: never
          created_at?: string | null
          effective_date?: string | null
          entry_type?:
            | Database["abi_billing"]["Enums"]["ledger_entry_type"]
            | null
          expires_at?: string | null
          ledger_id?: number | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_usd?: never
          balance_after_usd?: never
          created_at?: string | null
          effective_date?: string | null
          entry_type?:
            | Database["abi_billing"]["Enums"]["ledger_entry_type"]
            | null
          expires_at?: string | null
          ledger_id?: number | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_view: {
        Row: {
          buffer_hits: number | null
          created_at: string | null
          duration_ms: number | null
          metadata: Json | null
          metric_id: string | null
          metric_type: string | null
          record_count: number | null
          temp_files_bytes: number | null
          threshold_exceeded: boolean | null
          timestamp: string | null
        }
        Insert: {
          buffer_hits?: number | null
          created_at?: string | null
          duration_ms?: number | null
          metadata?: Json | null
          metric_id?: string | null
          metric_type?: string | null
          record_count?: number | null
          temp_files_bytes?: number | null
          threshold_exceeded?: never
          timestamp?: string | null
        }
        Update: {
          buffer_hits?: number | null
          created_at?: string | null
          duration_ms?: number | null
          metadata?: Json | null
          metric_id?: string | null
          metric_type?: string | null
          record_count?: number | null
          temp_files_bytes?: number | null
          threshold_exceeded?: never
          timestamp?: string | null
        }
        Relationships: []
      }
      subscription_balance_summary: {
        Row: {
          balance_micro_usd: number | null
          balance_usd: number | null
          display_name: string | null
          email: string | null
          has_active_subscription: boolean | null
          live_balance_micro_usd: number | null
          live_balance_usd: number | null
          plan_name: string | null
          status_summary: string | null
          subscription_cancel_at: string | null
          subscription_cancelling: boolean | null
          subscription_id: string | null
          subscription_period_end: string | null
          subscription_period_start: string | null
          subscription_price_micro_usd: number | null
          subscription_price_usd: number | null
          subscription_status:
            | Database["abi_billing"]["Enums"]["subscription_status"]
            | null
          user_id: string | null
          warning_flag: string | null
        }
        Relationships: []
      }
      system_balance_summary: {
        Row: {
          active_subscriptions: number | null
          active_users_1d: number | null
          active_users_30d: number | null
          active_users_7d: number | null
          avg_user_balance_micro_usd: number | null
          avg_user_balance_usd: number | null
          cancelling_subscriptions: number | null
          max_user_balance_micro_usd: number | null
          min_user_balance_micro_usd: number | null
          purchase_amount_30d_cents: number | null
          purchase_amount_30d_usd: number | null
          purchases_30d: number | null
          snapshot_at: string | null
          total_purchase_amount_cents: number | null
          total_purchase_amount_usd: number | null
          total_purchases: number | null
          total_system_balance_micro_usd: number | null
          total_system_balance_usd: number | null
          total_transactions: number | null
          total_usage_cost_micro_usd: number | null
          total_usage_cost_usd: number | null
          total_users_with_balance: number | null
          total_users_with_purchases: number | null
          total_users_with_subscriptions: number | null
          total_users_with_usage: number | null
          transactions_1d: number | null
          transactions_30d: number | null
          transactions_7d: number | null
          unbatched_cost_micro_usd: number | null
          unbatched_cost_usd: number | null
          unbatched_transactions: number | null
          usage_cost_1d_micro_usd: number | null
          usage_cost_1d_usd: number | null
          usage_cost_30d_micro_usd: number | null
          usage_cost_30d_usd: number | null
          usage_cost_7d_micro_usd: number | null
          usage_cost_7d_usd: number | null
          users_with_negative_balance: number | null
          users_with_positive_balance: number | null
          users_with_zero_balance: number | null
        }
        Relationships: []
      }
      team_balance_summary: {
        Row: {
          balance_micro_usd: number | null
          balance_usd: number | null
          last_batch_at: string | null
          live_balance_micro_usd: number | null
          live_balance_usd: number | null
          team_id: string | null
          team_name: string | null
          user_created_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      token_expiration_summary: {
        Row: {
          earliest_expiration: string | null
          expiring_30d_micro_usd: number | null
          expiring_30d_usd: number | null
          expiring_7d_micro_usd: number | null
          expiring_7d_usd: number | null
          expiring_90d_micro_usd: number | null
          expiring_90d_usd: number | null
          expiring_entries: number | null
          latest_expiration: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_balance_history: {
        Row: {
          amount_micro_usd: number | null
          amount_usd: number | null
          balance_after_micro_usd: number | null
          balance_after_usd: number | null
          created_at: string | null
          effective_date: string | null
          entry_type:
            | Database["abi_billing"]["Enums"]["ledger_entry_type"]
            | null
          expires_at: string | null
          ledger_id: number | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_micro_usd?: number | null
          amount_usd?: never
          balance_after_micro_usd?: number | null
          balance_after_usd?: never
          created_at?: string | null
          effective_date?: string | null
          entry_type?:
            | Database["abi_billing"]["Enums"]["ledger_entry_type"]
            | null
          expires_at?: string | null
          ledger_id?: number | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_micro_usd?: number | null
          amount_usd?: never
          balance_after_micro_usd?: number | null
          balance_after_usd?: never
          created_at?: string | null
          effective_date?: string | null
          entry_type?:
            | Database["abi_billing"]["Enums"]["ledger_entry_type"]
            | null
          expires_at?: string | null
          ledger_id?: number | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_current_balance: {
        Row: {
          balance_micro_usd: number | null
          balance_updated_at: string | null
          balance_usd: number | null
          display_name: string | null
          email: string | null
          has_active_subscription: boolean | null
          last_batch_at: string | null
          live_balance_micro_usd: number | null
          live_balance_usd: number | null
          plan_name: string | null
          subscription_cancel_at: string | null
          subscription_cancelling: boolean | null
          subscription_id: string | null
          subscription_period_end: string | null
          subscription_period_start: string | null
          subscription_price_micro_usd: number | null
          subscription_price_usd: number | null
          subscription_status:
            | Database["abi_billing"]["Enums"]["subscription_status"]
            | null
          unbatched_cost_micro_usd: number | null
          unbatched_transaction_count: number | null
          user_created_at: string | null
          user_id: string | null
          warning_flag: string | null
        }
        Relationships: []
      }
      user_summary_details: {
        Row: {
          accepted_terms: string | null
          balance_usd: number | null
          current_plan_name: string | null
          email: string | null
          email_verified: boolean | null
          marketing_consent: string | null
          name_first: string | null
          name_last: string | null
          signup_date: string | null
          subscription_period_end: string | null
          subscription_period_start: string | null
          subscription_status:
            | Database["abi_billing"]["Enums"]["subscription_status"]
            | null
          theme_preference: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "subscription_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "team_balance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_current_balance"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "balance_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_usage_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_usage_summary: {
        Row: {
          activity_status: string | null
          avg_cost_micro_usd: number | null
          avg_cost_usd: number | null
          cost_1d_micro_usd: number | null
          cost_1d_usd: number | null
          cost_30d_micro_usd: number | null
          cost_30d_usd: number | null
          cost_7d_micro_usd: number | null
          cost_7d_usd: number | null
          display_name: string | null
          email: string | null
          first_usage_at: string | null
          last_usage_at: string | null
          max_cost_micro_usd: number | null
          min_cost_micro_usd: number | null
          total_cost_micro_usd: number | null
          total_cost_usd: number | null
          total_usage_count: number | null
          usage_count_1d: number | null
          usage_count_30d: number | null
          usage_count_7d: number | null
          user_created_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_scheduled_subscription: {
        Args: {
          p_user_id: string
          p_stripe_subscription_id: string
          p_effective_date?: string
        }
        Returns: {
          activated_subscription_id: string
          canceled_subscription_id: string
          transition_successful: boolean
        }[]
      }
      add_ledger_entry: {
        Args: {
          p_user_id: string
          p_team_id: string
          p_entry_type: Database["abi_billing"]["Enums"]["ledger_entry_type"]
          p_amount_micro_usd: number
          p_reference_id?: string
          p_reference_type?: string
          p_effective_date?: string
          p_expires_at?: string
          p_metadata?: Json
        }
        Returns: number
      }
      add_micro: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      batch_daily_usage: {
        Args: Record<PropertyKey, never>
        Returns: {
          users_processed: number
          batches_created: number
        }[]
      }
      batch_heavy_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          users_processed: number
          batches_created: number
        }[]
      }
      batch_user_usage: {
        Args: { p_user_id: string; p_team_id?: string; p_force?: boolean }
        Returns: undefined
      }
      cancel_subscription: {
        Args: { p_user_id: string; p_effective_date?: string }
        Returns: Database["abi_billing"]["CompositeTypes"]["subscription_result"]
      }
      categorize_auto_topup_failure: {
        Args: { p_reason: string }
        Returns: string
      }
      cents_to_dollars: {
        Args: { cents: number }
        Returns: number
      }
      cents_to_micro: {
        Args: { cents: number }
        Returns: number
      }
      change_subscription: {
        Args: {
          p_user_id: string
          p_new_plan_id: string
          p_change_type: string
          p_effective_date?: string
          p_activate_immediately?: boolean
          p_grant_tokens?: boolean
        }
        Returns: Database["abi_billing"]["CompositeTypes"]["subscription_result"]
      }
      check_audit_patterns: {
        Args: { p_time_window?: unknown }
        Returns: undefined
      }
      check_auto_topup_eligibility: {
        Args: { p_user_id: string; p_current_balance_micro_usd: number }
        Returns: {
          eligible: boolean
          reason: string
          min_balance_cents: number
          purchase_amount_cents: number
          daily_limit_remaining_cents: number
          failure_count: number
          payment_method_available: boolean
        }[]
      }
      check_balance: {
        Args: { p_user_id: string; p_team_id?: string }
        Returns: {
          balance_micro_usd: number
          last_updated: string
          usage_since_update: number
          team_id: string
        }[]
      }
      check_migration_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          migration_step: string
          status: string
          records_processed: number
          records_total: number
          progress_percent: number
          error_message: string
          started_at: string
          completed_at: string
          duration: unknown
        }[]
      }
      check_month_end_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          job_name: string
          last_run: string
          next_run: string
          last_success: boolean
          period_processed: string
        }[]
      }
      count_recent_payment_failures: {
        Args: { p_subscription_id: string; p_days?: number }
        Returns: {
          count: number
        }[]
      }
      create_subscription_token_expiries: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      divide_micro: {
        Args: { micro: number; divisor: number }
        Returns: number
      }
      dollars_to_cents: {
        Args: { dollars: number }
        Returns: number
      }
      dollars_to_micro: {
        Args: { dollars: number }
        Returns: number
      }
      fix_ledger_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      format_cents: {
        Args: { micro: number }
        Returns: string
      }
      format_dollars: {
        Args: { micro: number }
        Returns: string
      }
      get_balance_summary_reference_timestamp: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_transaction_history: {
        Args: {
          p_user_id: string
          p_transaction_type?: string
          p_status?: string
          p_date_start?: string
          p_date_end?: string
          p_page?: number
          p_per_page?: number
        }
        Returns: {
          transaction_id: string
          transaction_type: string
          amount_usd: number
          description: string
          status: string
          created_at: string
          payment_method: Json
          credit_details: Json
          subscription_details: Json
          total_items: number
          current_page: number
          total_pages: number
          per_page: number
        }[]
      }
      get_usage_analytics: {
        Args: {
          p_user_id: string
          p_period_start?: string
          p_period_end?: string
          p_include_trends?: boolean
          p_month_filter?: string
          p_model_filter?: string[]
        }
        Returns: {
          total_cost_micro_usd: number
          total_requests: number
          total_tokens: number
          period_start: string
          period_end: string
          model_breakdown: Json
          usage_trends: Json
          filtered_by: Json
        }[]
      }
      has_active_subscription: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      has_plan_feature: {
        Args: { feature_name: string }
        Returns: boolean
      }
      initialize_balance_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      micro_to_cents: {
        Args: { micro: number }
        Returns: number
      }
      micro_to_dollars: {
        Args: { micro: number }
        Returns: number
      }
      migrate_purchase_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      migrate_subscription_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      migrate_usage_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      multiply_micro: {
        Args: { micro: number; factor: number }
        Returns: number
      }
      notify_auto_topup_event: {
        Args: {
          p_user_id: string
          p_event_type: string
          p_amount_cents?: number
          p_error_message?: string
        }
        Returns: undefined
      }
      process_month_end: {
        Args: { p_reference_date?: string }
        Returns: undefined
      }
      process_month_end_batch: {
        Args: { p_period_end?: string }
        Returns: undefined
      }
      process_subscription_month_end: {
        Args: { p_reference_date?: string }
        Returns: undefined
      }
      purchase_tokens: {
        Args: {
          p_user_id: string
          p_team_id: string
          p_amount_cents_usd: number
          p_purchase_date?: string
          p_apply_grant?: boolean
          p_auto_triggered?: boolean
        }
        Returns: Database["abi_billing"]["CompositeTypes"]["token_purchase_result"]
      }
      recalculate_ledger_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      record_auto_topup_attempt: {
        Args: {
          p_user_id: string
          p_amount_cents: number
          p_success: boolean
          p_message: string
        }
        Returns: undefined
      }
      refresh_balance_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      run_billing_data_migration: {
        Args: {
          p_skip_subscription_history?: boolean
          p_skip_purchase_history?: boolean
          p_skip_usage_history?: boolean
          p_skip_subscription_expiries?: boolean
          p_skip_recalculate_balances?: boolean
          p_skip_balance_cache?: boolean
          p_skip_validation?: boolean
        }
        Returns: undefined
      }
      start_subscription: {
        Args: {
          p_user_id: string
          p_plan_id: string
          p_period_start?: string
          p_period_end?: string
          p_activate_immediately?: boolean
        }
        Returns: Database["abi_billing"]["CompositeTypes"]["subscription_result"]
      }
      subscription_rollover: {
        Args: { p_reference_date?: string }
        Returns: undefined
      }
      trigger_auto_topup: {
        Args: { p_user_id: string; p_current_balance_micro_usd?: number }
        Returns: {
          success: boolean
          purchase_id: string
          amount_cents: number
          message: string
          retry_after_seconds: number
        }[]
      }
      update_auto_topup_rate_limits: {
        Args: { p_user_id: string; p_amount_cents: number; p_success: boolean }
        Returns: undefined
      }
      validate_balance_cache: {
        Args: {
          p_user_id?: string
          p_team_id?: string
          p_include_details?: boolean
        }
        Returns: {
          user_id: string
          team_id: string
          cache_balance_micro_usd: number
          calculated_balance_micro_usd: number
          variance_micro_usd: number
          validation_status: string
          details: Json
        }[]
      }
      validate_migration: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      billing_interval: "monthly" | "yearly"
      ledger_entry_type:
        | "token_purchase"
        | "usage_batch"
        | "purchase_expiry"
        | "manual_adjustment"
        | "refund"
      product_type: "plan" | "credits"
      subscription_status:
        | "ACTIVE"
        | "RENEWED"
        | "CANCELED"
        | "PENDING"
        | "EXPIRED"
        | "PENDING_PAYMENT"
    }
    CompositeTypes: {
      subscription_result: {
        subscription:
          | Database["abi_billing"]["Tables"]["user_subscriptions"]["Row"]
          | null
        prorated_amount_micro_usd: number | null
        subscription_metadata: Json | null
      }
      token_purchase_result: {
        token_purchase:
          | Database["abi_billing"]["Tables"]["token_purchases"]["Row"]
          | null
        purchase_amount_micro_usd: number | null
        purchase_metadata: Json | null
      }
    }
  }
  abi_core: {
    Tables: {
      feature_access_cache: {
        Row: {
          access_granted: boolean
          cache_expires_at: string
          cache_id: string
          created_at: string
          feature_key: string
          feature_value: Json | null
          user_id: string
        }
        Insert: {
          access_granted: boolean
          cache_expires_at: string
          cache_id?: string
          created_at?: string
          feature_key: string
          feature_value?: Json | null
          user_id: string
        }
        Update: {
          access_granted?: boolean
          cache_expires_at?: string
          cache_id?: string
          created_at?: string
          feature_key?: string
          feature_value?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      feature_definitions: {
        Row: {
          created_at: string
          default_value: Json | null
          feature_category: string | null
          feature_description: string | null
          feature_id: string
          feature_key: string
          feature_name: string
          feature_type: string
          is_active: boolean
          parent_feature_id: string | null
          updated_at: string
          value_schema: Json | null
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          feature_category?: string | null
          feature_description?: string | null
          feature_id?: string
          feature_key: string
          feature_name: string
          feature_type: string
          is_active?: boolean
          parent_feature_id?: string | null
          updated_at?: string
          value_schema?: Json | null
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          feature_category?: string | null
          feature_description?: string | null
          feature_id?: string
          feature_key?: string
          feature_name?: string
          feature_type?: string
          is_active?: boolean
          parent_feature_id?: string | null
          updated_at?: string
          value_schema?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_definitions_parent_feature_id_fkey"
            columns: ["parent_feature_id"]
            isOneToOne: false
            referencedRelation: "feature_definitions"
            referencedColumns: ["feature_id"]
          },
        ]
      }
      feature_usage_log: {
        Row: {
          access_granted: boolean
          access_reason: string | null
          created_at: string
          feature_key: string
          log_id: string
          request_context: Json | null
          user_id: string
        }
        Insert: {
          access_granted: boolean
          access_reason?: string | null
          created_at?: string
          feature_key: string
          log_id?: string
          request_context?: Json | null
          user_id: string
        }
        Update: {
          access_granted?: boolean
          access_reason?: string | null
          created_at?: string
          feature_key?: string
          log_id?: string
          request_context?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          buffer_hits: number | null
          created_at: string
          duration_ms: number
          metadata: Json | null
          metric_id: string
          metric_type: string
          record_count: number | null
          temp_files_bytes: number | null
          timestamp: string
        }
        Insert: {
          buffer_hits?: number | null
          created_at?: string
          duration_ms: number
          metadata?: Json | null
          metric_id?: string
          metric_type: string
          record_count?: number | null
          temp_files_bytes?: number | null
          timestamp?: string
        }
        Update: {
          buffer_hits?: number | null
          created_at?: string
          duration_ms?: number
          metadata?: Json | null
          metric_id?: string
          metric_type?: string
          record_count?: number | null
          temp_files_bytes?: number | null
          timestamp?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          feature_id: string
          feature_value: Json
          is_enabled: boolean
          plan_feature_id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          feature_value: Json
          is_enabled?: boolean
          plan_feature_id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          feature_value?: Json
          is_enabled?: boolean
          plan_feature_id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_definitions"
            referencedColumns: ["feature_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          endpoint: string
          first_request_at: string
          id: string
          ip: string
          last_request_at: string
          request_count: number
        }
        Insert: {
          endpoint: string
          first_request_at?: string
          id?: string
          ip: string
          last_request_at?: string
          request_count?: number
        }
        Update: {
          endpoint?: string
          first_request_at?: string
          id?: string
          ip?: string
          last_request_at?: string
          request_count?: number
        }
        Relationships: []
      }
      schema_versions: {
        Row: {
          version_applied_at: string
          version_description: string
          version_id: number
          version_number: string
        }
        Insert: {
          version_applied_at?: string
          version_description: string
          version_id?: number
          version_number: string
        }
        Update: {
          version_applied_at?: string
          version_description?: string
          version_id?: number
          version_number?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      statistics_log: {
        Row: {
          index_bytes: number
          last_analyze: string | null
          last_vacuum: string | null
          log_id: string
          metadata: Json | null
          table_name: string
          timestamp: string
          total_bytes: number
          total_rows: number
        }
        Insert: {
          index_bytes: number
          last_analyze?: string | null
          last_vacuum?: string | null
          log_id?: string
          metadata?: Json | null
          table_name: string
          timestamp?: string
          total_bytes: number
          total_rows: number
        }
        Update: {
          index_bytes?: number
          last_analyze?: string | null
          last_vacuum?: string | null
          log_id?: string
          metadata?: Json | null
          table_name?: string
          timestamp?: string
          total_bytes?: number
          total_rows?: number
        }
        Relationships: []
      }
      user_feature_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          feature_id: string
          override_id: string
          override_reason: string | null
          override_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          feature_id: string
          override_id?: string
          override_reason?: string | null
          override_value: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          feature_id?: string
          override_id?: string
          override_reason?: string | null
          override_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_overrides_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "feature_definitions"
            referencedColumns: ["feature_id"]
          },
        ]
      }
    }
    Views: {
      feature_matrix: {
        Row: {
          base_enabled: boolean | null
          base_value: Json | null
          beyond_enabled: boolean | null
          beyond_value: Json | null
          build_enabled: boolean | null
          build_value: Json | null
          enterprise_enabled: boolean | null
          enterprise_value: Json | null
          feature_category: string | null
          feature_key: string | null
          feature_name: string | null
          feature_type: string | null
        }
        Relationships: []
      }
      plan_features_detailed: {
        Row: {
          default_value: Json | null
          feature_added_at: string | null
          feature_category: string | null
          feature_description: string | null
          feature_key: string | null
          feature_name: string | null
          feature_type: string | null
          feature_updated_at: string | null
          feature_value: Json | null
          is_enabled: boolean | null
          plan_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_email_verification: {
        Args: { user_email: string }
        Returns: Json
      }
      check_feature_access: {
        Args: { p_user_id: string; p_feature_key: string }
        Returns: {
          access_granted: boolean
          access_reason: string
          feature_value: Json
          inheritance_chain: string[]
        }[]
      }
      check_feature_access_cached: {
        Args: { p_user_id: string; p_feature_key: string }
        Returns: {
          access_granted: boolean
          access_reason: string
          feature_value: Json
          from_cache: boolean
        }[]
      }
      check_rate_limit: {
        Args: {
          request_ip: string
          request_endpoint: string
          limit_count: number
          window_seconds: number
        }
        Returns: Json
      }
      check_storage_limits: {
        Args: { user_id: string; bucket_id: string; file_size: number }
        Returns: boolean
      }
      check_team_resource_access: {
        Args: {
          bucket_name: string
          object_path: string
          requesting_user: string
        }
        Returns: boolean
      }
      check_user_exists: {
        Args: { user_email: string }
        Returns: Json
      }
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_overrides: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_feature_override: {
        Args: {
          p_user_id: string
          p_feature_key: string
          p_override_value: Json
          p_override_reason?: string
          p_expires_at?: string
          p_created_by?: string
        }
        Returns: string
      }
      create_subscription_plans: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_feature_analytics: {
        Args: { p_days_back?: number }
        Returns: {
          feature_key: string
          total_requests: number
          granted_requests: number
          denied_requests: number
          grant_rate: number
        }[]
      }
      get_rate_limit: {
        Args: { p_user_id: string; p_limit_type: string }
        Returns: number
      }
      get_secret: {
        Args: { p_key: string; p_default?: string }
        Returns: string
      }
      get_setting: {
        Args: { p_key: string; p_default?: string }
        Returns: string
      }
      get_user_features: {
        Args: { p_user_id: string }
        Returns: {
          feature_key: string
          feature_name: string
          feature_description: string
          feature_type: string
          feature_category: string
          access_granted: boolean
          access_reason: string
          feature_value: Json
        }[]
      }
      has_datasource_access: {
        Args: {
          p_user_id: string
          p_datasource_key: string
          p_access_type?: string
        }
        Returns: boolean
      }
      has_model_access: {
        Args: { p_user_id: string; p_model_key: string }
        Returns: boolean
      }
      log_feature_access: {
        Args: {
          p_user_id: string
          p_feature_key: string
          p_access_granted: boolean
          p_access_reason: string
          p_request_context?: Json
        }
        Returns: undefined
      }
      notify_admin: {
        Args: { p_type: string; p_severity: string; p_metadata: Json }
        Returns: undefined
      }
      record_performance_metric: {
        Args: {
          p_metric_type: string
          p_duration_ms: number
          p_record_count?: number
          p_metadata?: Json
        }
        Returns: string
      }
      refresh_feature_cache: {
        Args: { p_user_id: string }
        Returns: number
      }
      remove_feature_override: {
        Args: { p_user_id: string; p_feature_key: string }
        Returns: boolean
      }
      seed_all_feature_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      seed_base_plan_features: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      seed_beyond_plan_features: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      seed_build_plan_features: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      seed_enterprise_plan_features: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      seed_feature_definitions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_secret: {
        Args: { p_key: string; p_value: string; p_description?: string }
        Returns: string
      }
      set_setting: {
        Args: { p_key: string; p_value: string; p_description?: string }
        Returns: undefined
      }
      store_plan_ids: {
        Args: {
          p_base_plan_id: string
          p_build_plan_id: string
          p_beyond_plan_id: string
          p_enterprise_plan_id: string
        }
        Returns: undefined
      }
      update_statistics: {
        Args: { p_table_names?: string[] }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  abi_llm: {
    Tables: {
      conversation_files: {
        Row: {
          conversation_id: string
          created_at: string
          deleted_at: string | null
          file_hash: string
          file_id: string
          file_name: string
          file_size: number
          file_type: string
          metadata: Json | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          file_hash: string
          file_id?: string
          file_name: string
          file_size: number
          file_type: string
          metadata?: Json | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          file_hash?: string
          file_id?: string
          file_name?: string
          file_size?: number
          file_type?: string
          metadata?: Json | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["conversation_id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          message_id: string
          message_index: number
          message_type: string
          metadata: Json | null
          request_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          message_id?: string
          message_index: number
          message_type: string
          metadata?: Json | null
          request_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          message_id?: string
          message_index?: number
          message_type?: string
          metadata?: Json | null
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "provider_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          metadata: Json | null
          organization_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          metadata?: Json | null
          organization_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          metadata?: Json | null
          organization_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_model_pricing: {
        Row: {
          created_at: string | null
          effective_from: string | null
          effective_until: string | null
          metadata: Json | null
          model_id: string
          per_million_tokens_cents_usd: number
          pricing_id: string
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          metadata?: Json | null
          model_id: string
          per_million_tokens_cents_usd: number
          pricing_id?: string
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          metadata?: Json | null
          model_id?: string
          per_million_tokens_cents_usd?: number
          pricing_id?: string
          token_type?: Database["abi_llm"]["Enums"]["token_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_model_pricing_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "current_model_pricing"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "provider_model_pricing_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "model_pricing_pivot"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "provider_model_pricing_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "provider_models"
            referencedColumns: ["model_id"]
          },
        ]
      }
      provider_models: {
        Row: {
          created_at: string
          is_available: boolean | null
          model_id: string
          model_name: string
          model_type: string
          provider_name: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_available?: boolean | null
          model_id?: string
          model_name: string
          model_type: string
          provider_name: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_available?: boolean | null
          model_id?: string
          model_name?: string
          model_type?: string
          provider_name?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_requests: {
        Row: {
          client_source: string | null
          client_version: string | null
          metadata: Json | null
          model_id: string | null
          provider_duration_ms: number | null
          provider_error_details: string | null
          provider_response_code: number | null
          provider_response_id: string | null
          provider_response_length: number | null
          provider_response_timestamp: string | null
          proxy_request_headers: Json | null
          proxy_request_length: number | null
          proxy_request_path: string
          proxy_request_timestamp: string
          request_id: string
          total_duration_ms: number | null
          user_id: string
        }
        Insert: {
          client_source?: string | null
          client_version?: string | null
          metadata?: Json | null
          model_id?: string | null
          provider_duration_ms?: number | null
          provider_error_details?: string | null
          provider_response_code?: number | null
          provider_response_id?: string | null
          provider_response_length?: number | null
          provider_response_timestamp?: string | null
          proxy_request_headers?: Json | null
          proxy_request_length?: number | null
          proxy_request_path: string
          proxy_request_timestamp?: string
          request_id?: string
          total_duration_ms?: number | null
          user_id: string
        }
        Update: {
          client_source?: string | null
          client_version?: string | null
          metadata?: Json | null
          model_id?: string | null
          provider_duration_ms?: number | null
          provider_error_details?: string | null
          provider_response_code?: number | null
          provider_response_id?: string | null
          provider_response_length?: number | null
          provider_response_timestamp?: string | null
          proxy_request_headers?: Json | null
          proxy_request_length?: number | null
          proxy_request_path?: string
          proxy_request_timestamp?: string
          request_id?: string
          total_duration_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_requests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "current_model_pricing"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "provider_requests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "model_pricing_pivot"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "provider_requests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "provider_models"
            referencedColumns: ["model_id"]
          },
        ]
      }
      rate_limit_violations: {
        Row: {
          current_value: number
          limit_type: string
          limit_value: number
          metadata: Json | null
          recorded_at: string
          request_id: string
          user_id: string
          violation_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          current_value: number
          limit_type: string
          limit_value: number
          metadata?: Json | null
          recorded_at?: string
          request_id: string
          user_id: string
          violation_id?: string
          window_end: string
          window_start: string
        }
        Update: {
          current_value?: number
          limit_type?: string
          limit_value?: number
          metadata?: Json | null
          recorded_at?: string
          request_id?: string
          user_id?: string
          violation_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_violations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "provider_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      request_metrics: {
        Row: {
          auth_duration_ms: number
          auto_topup_check_duration_ms: number
          auto_topup_check_operations: number
          completion_tokens: number
          cost_quota_check_duration_ms: number
          database_duration_ms: number
          db_errors: number
          db_operations: number
          features_duration_ms: number
          features_operations: number
          metadata: Json | null
          metric_id: string
          prompt_tokens: number
          provider_duration_ms: number
          provider_errors: number
          provider_name: string
          provider_request_duration_ms: number
          provider_status_code: number
          provider_transform_duration_ms: number
          provider_validation_duration_ms: number
          rate_limit_check_duration_ms: number
          recorded_at: string
          request_id: string
          request_size_bytes: number
          response_size_bytes: number
          retry_count: number
          token_recording_duration_ms: number
          total_duration_ms: number
          total_tokens: number
        }
        Insert: {
          auth_duration_ms: number
          auto_topup_check_duration_ms?: number
          auto_topup_check_operations?: number
          completion_tokens: number
          cost_quota_check_duration_ms: number
          database_duration_ms: number
          db_errors: number
          db_operations: number
          features_duration_ms?: number
          features_operations?: number
          metadata?: Json | null
          metric_id?: string
          prompt_tokens: number
          provider_duration_ms: number
          provider_errors: number
          provider_name: string
          provider_request_duration_ms: number
          provider_status_code: number
          provider_transform_duration_ms: number
          provider_validation_duration_ms: number
          rate_limit_check_duration_ms: number
          recorded_at?: string
          request_id: string
          request_size_bytes: number
          response_size_bytes: number
          retry_count: number
          token_recording_duration_ms: number
          total_duration_ms: number
          total_tokens: number
        }
        Update: {
          auth_duration_ms?: number
          auto_topup_check_duration_ms?: number
          auto_topup_check_operations?: number
          completion_tokens?: number
          cost_quota_check_duration_ms?: number
          database_duration_ms?: number
          db_errors?: number
          db_operations?: number
          features_duration_ms?: number
          features_operations?: number
          metadata?: Json | null
          metric_id?: string
          prompt_tokens?: number
          provider_duration_ms?: number
          provider_errors?: number
          provider_name?: string
          provider_request_duration_ms?: number
          provider_status_code?: number
          provider_transform_duration_ms?: number
          provider_validation_duration_ms?: number
          rate_limit_check_duration_ms?: number
          recorded_at?: string
          request_id?: string
          request_size_bytes?: number
          response_size_bytes?: number
          retry_count?: number
          token_recording_duration_ms?: number
          total_duration_ms?: number
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_metrics_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "provider_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      token_usage: {
        Row: {
          batch_id: string | null
          cost_micro_usd: number
          created_at: string | null
          model_id: string
          request_id: string
          request_timestamp: string
          token_count: number
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          usage_id: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          cost_micro_usd: number
          created_at?: string | null
          model_id: string
          request_id: string
          request_timestamp?: string
          token_count: number
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          usage_id?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          cost_micro_usd?: number
          created_at?: string | null
          model_id?: string
          request_id?: string
          request_timestamp?: string
          token_count?: number
          token_type?: Database["abi_llm"]["Enums"]["token_type"]
          usage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "current_model_pricing"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "token_usage_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "model_pricing_pivot"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "token_usage_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "provider_models"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "token_usage_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "provider_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      token_usage_daily: {
        Row: {
          batch_id: string | null
          cost_micro_usd: number
          created_at: string
          model_name: string
          request_count: number
          rollup_id: string
          token_count: number
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          cost_micro_usd: number
          created_at?: string
          model_name: string
          request_count: number
          rollup_id?: string
          token_count: number
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          updated_at?: string
          usage_date: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          cost_micro_usd?: number
          created_at?: string
          model_name?: string
          request_count?: number
          rollup_id?: string
          token_count?: number
          token_type?: Database["abi_llm"]["Enums"]["token_type"]
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_alerts: {
        Row: {
          alert_acknowledged_at: string | null
          alert_category: string
          alert_id: string
          alert_threshold: number
          alert_triggered_at: string
          alert_type: string
          created_at: string
          current_usage_micro_usd: number
          limit_value_micro_usd: number
          metadata: Json | null
          model_name: string | null
          user_id: string
        }
        Insert: {
          alert_acknowledged_at?: string | null
          alert_category: string
          alert_id?: string
          alert_threshold: number
          alert_triggered_at?: string
          alert_type: string
          created_at?: string
          current_usage_micro_usd: number
          limit_value_micro_usd: number
          metadata?: Json | null
          model_name?: string | null
          user_id: string
        }
        Update: {
          alert_acknowledged_at?: string | null
          alert_category?: string
          alert_id?: string
          alert_threshold?: number
          alert_triggered_at?: string
          alert_type?: string
          created_at?: string
          current_usage_micro_usd?: number
          limit_value_micro_usd?: number
          metadata?: Json | null
          model_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_model_pricing: {
        Row: {
          metadata: Json | null
          model_id: string | null
          model_name: string | null
          per_million_tokens_cents_usd: number | null
          provider_name: string | null
          token_type: Database["abi_llm"]["Enums"]["token_type"] | null
        }
        Relationships: []
      }
      model_pricing_pivot: {
        Row: {
          anthropic_cache_read_per_million_tokens_cents_usd: number | null
          anthropic_cache_write_5min_per_million_tokens_cents_usd: number | null
          anthropic_cache_write_60min_per_million_tokens_cents_usd:
            | number
            | null
          input_per_million_tokens_cents_usd: number | null
          model_id: string | null
          model_name: string | null
          openai_batch_input_per_million_tokens_cents_usd: number | null
          openai_batch_output_per_million_tokens_cents_usd: number | null
          openai_reasoning_per_million_tokens_cents_usd: number | null
          output_per_million_tokens_cents_usd: number | null
          provider_name: string | null
        }
        Relationships: []
      }
      normalized_pricing: {
        Row: {
          model_name: string | null
          normalized_type: string | null
          per_million_tokens_cents_usd: number | null
          provider_name: string | null
          specific_type: Database["abi_llm"]["Enums"]["token_type"] | null
        }
        Relationships: []
      }
      rate_limit_status: {
        Row: {
          limit_requests: number | null
          limit_tokens: number | null
          minute: string | null
          requests_count: number | null
          requests_usage_pct: number | null
          tokens_count: number | null
          tokens_usage_pct: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_error_rates: {
        Row: {
          avg_duration: number | null
          error_count: number | null
          error_rate: number | null
          p95_duration: number | null
          period: string | null
          provider_name: string | null
          total_requests: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_token_cost: {
        Args: {
          p_token_count: number
          p_token_type: Database["abi_llm"]["Enums"]["token_type"]
          p_model_id: string
        }
        Returns: number
      }
      check_usage_alerts: {
        Args: { p_user_id: string; p_subscription_id: string }
        Returns: undefined
      }
      get_cache_cost: {
        Args: {
          p_provider: string
          p_tokens: number
          p_cache_duration: unknown
        }
        Returns: number
      }
      get_token_usage: {
        Args: { p_user_id: string; p_start_date: string; p_end_date: string }
        Returns: {
          model_name: string
          token_type: Database["abi_llm"]["Enums"]["token_type"]
          token_count: number
          request_count: number
          cost_micro_usd: number
        }[]
      }
      perform_token_usage_rollup: {
        Args: { p_target_date?: string }
        Returns: undefined
      }
      recalculate_historical_rollups: {
        Args: { p_start_date?: string; p_end_date?: string }
        Returns: undefined
      }
      recalculate_token_usage_pricing: {
        Args: {
          p_start_date: string
          p_end_date?: string
          p_recalculate_daily_rollups?: boolean
        }
        Returns: {
          records_updated: number
          daily_rollups_deleted: number
          daily_rollups_created: number
          total_cost_micro_usd: number
          earliest_updated: string
          latest_updated: string
        }[]
      }
    }
    Enums: {
      token_type:
        | "input"
        | "output"
        | "cache_read"
        | "anthropic_cache_read"
        | "anthropic_cache_write_5min"
        | "anthropic_cache_write_60min"
        | "openai_batch_input"
        | "openai_batch_output"
        | "openai_reasoning"
        | "cohere_rerank"
        | "perplexity_search"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  abi_marketing: {
    Tables: {
      email_campaigns: {
        Row: {
          campaign_description: string | null
          campaign_id: string
          campaign_name: string
          campaign_status: string
          campaign_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          emails_failed: number | null
          emails_sent: number | null
          scheduled_at: string | null
          started_at: string | null
          target_audience: Json | null
          template_id: string
          template_variables: Json | null
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          campaign_description?: string | null
          campaign_id?: string
          campaign_name: string
          campaign_status?: string
          campaign_type: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          emails_failed?: number | null
          emails_sent?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          target_audience?: Json | null
          template_id: string
          template_variables?: Json | null
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          campaign_description?: string | null
          campaign_id?: string
          campaign_name?: string
          campaign_status?: string
          campaign_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          emails_failed?: number | null
          emails_sent?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          target_audience?: Json | null
          template_id?: string
          template_variables?: Json | null
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      email_sends: {
        Row: {
          campaign_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          recipient_email: string
          resend_email_id: string | null
          send_id: string
          send_status: string
          sent_at: string | null
          subject: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          recipient_email: string
          resend_email_id?: string | null
          send_id?: string
          send_status?: string
          sent_at?: string | null
          subject: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          send_id?: string
          send_status?: string
          sent_at?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      email_templates: {
        Row: {
          available_variables: Json | null
          created_at: string
          created_by: string | null
          html_template: string
          is_active: boolean | null
          subject_template: string
          template_description: string | null
          template_id: string
          template_name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          available_variables?: Json | null
          created_at?: string
          created_by?: string | null
          html_template: string
          is_active?: boolean | null
          subject_template: string
          template_description?: string | null
          template_id?: string
          template_name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          available_variables?: Json | null
          created_at?: string
          created_by?: string | null
          html_template?: string
          is_active?: boolean | null
          subject_template?: string
          template_description?: string | null
          template_id?: string
          template_name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_campaign_recipients: {
        Args: { campaign_uuid: string }
        Returns: {
          user_id: string
          email: string
          name_first: string
          name_last: string
          preferences: Json
          signup_date: string
        }[]
      }
      render_email_template: {
        Args: { template_uuid: string; variables: Json }
        Returns: {
          subject: string
          html_content: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  abi_auth: {
    Enums: {},
  },
  abi_billing: {
    Enums: {
      billing_interval: ["monthly", "yearly"],
      ledger_entry_type: [
        "token_purchase",
        "usage_batch",
        "purchase_expiry",
        "manual_adjustment",
        "refund",
      ],
      product_type: ["plan", "credits"],
      subscription_status: [
        "ACTIVE",
        "RENEWED",
        "CANCELED",
        "PENDING",
        "EXPIRED",
        "PENDING_PAYMENT",
      ],
    },
  },
  abi_core: {
    Enums: {},
  },
  abi_llm: {
    Enums: {
      token_type: [
        "input",
        "output",
        "cache_read",
        "anthropic_cache_read",
        "anthropic_cache_write_5min",
        "anthropic_cache_write_60min",
        "openai_batch_input",
        "openai_batch_output",
        "openai_reasoning",
        "cohere_rerank",
        "perplexity_search",
      ],
    },
  },
  abi_marketing: {
    Enums: {},
  },
} as const


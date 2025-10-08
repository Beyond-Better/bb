export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	abi_api: {
		Tables: {
			provider_api_requests: {
				Row: {
					client_source: string | null;
					client_version: string | null;
					metadata: Json;
					provider_duration_ms: number | null;
					provider_error_details: string | null;
					provider_response_code: number | null;
					provider_response_id: string | null;
					provider_response_length: number | null;
					provider_response_timestamp: string | null;
					proxy_request_headers: Json | null;
					proxy_request_length: number | null;
					proxy_request_path: string;
					proxy_request_timestamp: string;
					request_id: string;
					service_id: string | null;
					total_duration_ms: number | null;
					user_id: string;
				};
				Insert: {
					client_source?: string | null;
					client_version?: string | null;
					metadata?: Json;
					provider_duration_ms?: number | null;
					provider_error_details?: string | null;
					provider_response_code?: number | null;
					provider_response_id?: string | null;
					provider_response_length?: number | null;
					provider_response_timestamp?: string | null;
					proxy_request_headers?: Json | null;
					proxy_request_length?: number | null;
					proxy_request_path: string;
					proxy_request_timestamp?: string;
					request_id?: string;
					service_id?: string | null;
					total_duration_ms?: number | null;
					user_id: string;
				};
				Update: {
					client_source?: string | null;
					client_version?: string | null;
					metadata?: Json;
					provider_duration_ms?: number | null;
					provider_error_details?: string | null;
					provider_response_code?: number | null;
					provider_response_id?: string | null;
					provider_response_length?: number | null;
					provider_response_timestamp?: string | null;
					proxy_request_headers?: Json | null;
					proxy_request_length?: number | null;
					proxy_request_path?: string;
					proxy_request_timestamp?: string;
					request_id?: string;
					service_id?: string | null;
					total_duration_ms?: number | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'provider_api_requests_service_id_fkey';
						columns: ['service_id'];
						isOneToOne: false;
						referencedRelation: 'provider_services';
						referencedColumns: ['service_id'];
					},
				];
			};
			provider_service_pricing: {
				Row: {
					created_at: string;
					effective_from: string;
					effective_until: string | null;
					metadata: Json;
					per_thousand_requests_cents_usd: number;
					pricing_id: string;
					request_type: string;
					service_id: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					effective_from?: string;
					effective_until?: string | null;
					metadata?: Json;
					per_thousand_requests_cents_usd: number;
					pricing_id?: string;
					request_type: string;
					service_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					effective_from?: string;
					effective_until?: string | null;
					metadata?: Json;
					per_thousand_requests_cents_usd?: number;
					pricing_id?: string;
					request_type?: string;
					service_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'provider_service_pricing_service_id_fkey';
						columns: ['service_id'];
						isOneToOne: false;
						referencedRelation: 'provider_services';
						referencedColumns: ['service_id'];
					},
				];
			};
			provider_services: {
				Row: {
					created_at: string;
					is_available: boolean;
					provider_name: string;
					service_id: string;
					service_name: string;
					service_type: string;
					settings: Json;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					is_available?: boolean;
					provider_name: string;
					service_id?: string;
					service_name: string;
					service_type: string;
					settings?: Json;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					is_available?: boolean;
					provider_name?: string;
					service_id?: string;
					service_name?: string;
					service_type?: string;
					settings?: Json;
					updated_at?: string;
				};
				Relationships: [];
			};
			service_usage: {
				Row: {
					batch_id: string | null;
					cost_micro_usd: number;
					created_at: string;
					request_count: number;
					request_id: string;
					request_timestamp: string;
					request_type: string;
					service_id: string;
					usage_id: string;
					user_id: string;
				};
				Insert: {
					batch_id?: string | null;
					cost_micro_usd: number;
					created_at?: string;
					request_count?: number;
					request_id: string;
					request_timestamp?: string;
					request_type: string;
					service_id: string;
					usage_id?: string;
					user_id: string;
				};
				Update: {
					batch_id?: string | null;
					cost_micro_usd?: number;
					created_at?: string;
					request_count?: number;
					request_id?: string;
					request_timestamp?: string;
					request_type?: string;
					service_id?: string;
					usage_id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'service_usage_request_id_fkey';
						columns: ['request_id'];
						isOneToOne: false;
						referencedRelation: 'provider_api_requests';
						referencedColumns: ['request_id'];
					},
					{
						foreignKeyName: 'service_usage_service_id_fkey';
						columns: ['service_id'];
						isOneToOne: false;
						referencedRelation: 'provider_services';
						referencedColumns: ['service_id'];
					},
				];
			};
			service_usage_batches: {
				Row: {
					batch_date: string;
					batch_id: string;
					created_at: string;
					event_count: number;
					ledger_entry_id: number | null;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
					used_micro_usd: number;
					user_id: string;
				};
				Insert: {
					batch_date: string;
					batch_id?: string;
					created_at?: string;
					event_count: number;
					ledger_entry_id?: number | null;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
					used_micro_usd?: number;
					user_id: string;
				};
				Update: {
					batch_date?: string;
					batch_id?: string;
					created_at?: string;
					event_count?: number;
					ledger_entry_id?: number | null;
					period_end?: string;
					period_start?: string;
					total_cost_micro_usd?: number;
					used_micro_usd?: number;
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			batch_api_usage: {
				Args: {
					p_force_batch?: boolean;
					p_period_end?: string;
					p_period_start?: string;
					p_user_id: string;
				};
				Returns: {
					batch_id: string;
					event_count: number;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
				}[];
			};
			check_api_usage_balance: {
				Args: { p_user_id: string };
				Returns: {
					newest_unbatched_usage: string;
					oldest_unbatched_usage: string;
					unbatched_event_count: number;
					unbatched_usage_micro_usd: number;
				}[];
			};
			cleanup_old_unbatched_usage: {
				Args: { p_older_than_hours?: number };
				Returns: {
					batches_created: number;
					total_cost_batched_micro_usd: number;
					users_processed: number;
				}[];
			};
			get_api_usage_summary: {
				Args: { p_end_date?: string; p_start_date?: string; p_user_id: string };
				Returns: {
					cost_dollars: number;
					date: string;
					providers: Json;
					request_types: Json;
					total_cost_micro_usd: number;
					total_requests: number;
				}[];
			};
			get_service_pricing: {
				Args: {
					p_provider_name: string;
					p_request_type: string;
					p_service_name: string;
				};
				Returns: {
					cost_per_request_micro_usd: number;
					effective_from: string;
					effective_until: string;
					per_thousand_requests_cents_usd: number;
				}[];
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	abi_auth: {
		Tables: {
			admin_audit_log: {
				Row: {
					action: string;
					admin_user_id: string;
					created_at: string;
					details: Json;
					error_message: string | null;
					ip_address: unknown | null;
					log_id: string;
					resource_id: string | null;
					resource_type: string | null;
					success: boolean;
					user_agent: string | null;
				};
				Insert: {
					action: string;
					admin_user_id: string;
					created_at?: string;
					details?: Json;
					error_message?: string | null;
					ip_address?: unknown | null;
					log_id?: string;
					resource_id?: string | null;
					resource_type?: string | null;
					success: boolean;
					user_agent?: string | null;
				};
				Update: {
					action?: string;
					admin_user_id?: string;
					created_at?: string;
					details?: Json;
					error_message?: string | null;
					ip_address?: unknown | null;
					log_id?: string;
					resource_id?: string | null;
					resource_type?: string | null;
					success?: boolean;
					user_agent?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'admin_audit_log_admin_user_id_fkey';
						columns: ['admin_user_id'];
						isOneToOne: false;
						referencedRelation: 'user_profiles';
						referencedColumns: ['user_id'];
					},
				];
			};
			admin_role_assignments: {
				Row: {
					assigned_by: string;
					created_at: string;
					notes: string | null;
					role_id: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					assigned_by: string;
					created_at?: string;
					notes?: string | null;
					role_id: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					assigned_by?: string;
					created_at?: string;
					notes?: string | null;
					role_id?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'admin_role_assignments_assigned_by_fkey';
						columns: ['assigned_by'];
						isOneToOne: false;
						referencedRelation: 'user_profiles';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'admin_role_assignments_role_id_fkey';
						columns: ['role_id'];
						isOneToOne: false;
						referencedRelation: 'admin_roles';
						referencedColumns: ['role_id'];
					},
					{
						foreignKeyName: 'admin_role_assignments_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_profiles';
						referencedColumns: ['user_id'];
					},
				];
			};
			admin_roles: {
				Row: {
					created_at: string;
					description: string | null;
					permissions: Json;
					role_id: string;
					role_level: number;
					role_name: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					permissions?: Json;
					role_id?: string;
					role_level: number;
					role_name: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					permissions?: Json;
					role_id?: string;
					role_level?: number;
					role_name?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			organization_members: {
				Row: {
					created_at: string;
					organization_id: string;
					role: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					organization_id: string;
					role: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					organization_id?: string;
					role?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'organization_members_organization_id_fkey';
						columns: ['organization_id'];
						isOneToOne: false;
						referencedRelation: 'organizations';
						referencedColumns: ['organization_id'];
					},
					{
						foreignKeyName: 'organization_members_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_profiles';
						referencedColumns: ['user_id'];
					},
				];
			};
			organizations: {
				Row: {
					created_at: string;
					deleted_at: string | null;
					description: string | null;
					metadata: Json | null;
					name: string;
					organization_id: string;
					settings: Json | null;
					slug: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					deleted_at?: string | null;
					description?: string | null;
					metadata?: Json | null;
					name: string;
					organization_id?: string;
					settings?: Json | null;
					slug: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					deleted_at?: string | null;
					description?: string | null;
					metadata?: Json | null;
					name?: string;
					organization_id?: string;
					settings?: Json | null;
					slug?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			team_members: {
				Row: {
					created_at: string;
					role: string;
					team_id: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					role: string;
					team_id: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					role?: string;
					team_id?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'team_members_team_id_fkey';
						columns: ['team_id'];
						isOneToOne: false;
						referencedRelation: 'teams';
						referencedColumns: ['team_id'];
					},
					{
						foreignKeyName: 'team_members_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_profiles';
						referencedColumns: ['user_id'];
					},
				];
			};
			teams: {
				Row: {
					created_at: string;
					deleted_at: string | null;
					description: string | null;
					metadata: Json | null;
					name: string;
					organization_id: string;
					settings: Json | null;
					slug: string;
					team_id: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					deleted_at?: string | null;
					description?: string | null;
					metadata?: Json | null;
					name: string;
					organization_id: string;
					settings?: Json | null;
					slug: string;
					team_id?: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					deleted_at?: string | null;
					description?: string | null;
					metadata?: Json | null;
					name?: string;
					organization_id?: string;
					settings?: Json | null;
					slug?: string;
					team_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'teams_organization_id_fkey';
						columns: ['organization_id'];
						isOneToOne: false;
						referencedRelation: 'organizations';
						referencedColumns: ['organization_id'];
					},
				];
			};
			user_profiles: {
				Row: {
					created_at: string;
					email: string | null;
					email_verified: boolean | null;
					name_first: string | null;
					name_last: string | null;
					name_prefix: string | null;
					phone: string | null;
					phone_verified: boolean | null;
					preferences: Json | null;
					stripe_customer_id: string | null;
					timezone: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					email?: string | null;
					email_verified?: boolean | null;
					name_first?: string | null;
					name_last?: string | null;
					name_prefix?: string | null;
					phone?: string | null;
					phone_verified?: boolean | null;
					preferences?: Json | null;
					stripe_customer_id?: string | null;
					timezone?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					email?: string | null;
					email_verified?: boolean | null;
					name_first?: string | null;
					name_last?: string | null;
					name_prefix?: string | null;
					phone?: string | null;
					phone_verified?: boolean | null;
					preferences?: Json | null;
					stripe_customer_id?: string | null;
					timezone?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			check_admin_permission: {
				Args: { permission: string };
				Returns: boolean;
			};
			check_min_admin_role: {
				Args: { min_role: string };
				Returns: boolean;
			};
			check_min_org_role: {
				Args: { min_role: string; org_id: string };
				Returns: boolean;
			};
			check_min_team_role: {
				Args: { min_role: string; t_id: string };
				Returns: boolean;
			};
			check_organization_role: {
				Args: { org_id: string; required_role: string };
				Returns: boolean;
			};
			check_organization_roles: {
				Args: { org_id: string; required_roles: string[] };
				Returns: boolean;
			};
			check_team_role: {
				Args: { required_role: string; t_id: string };
				Returns: boolean;
			};
			check_team_roles: {
				Args: { required_roles: string[]; t_id: string };
				Returns: boolean;
			};
			get_user_admin_context: {
				Args: { target_user_id: string };
				Returns: {
					permissions: Json;
					role_level: number;
					role_name: string;
				}[];
			};
			get_user_email: {
				Args: { user_id: string };
				Returns: string;
			};
			has_organization_access: {
				Args: { org_id: string };
				Returns: boolean;
			};
			has_team_access: {
				Args: { t_id: string };
				Returns: boolean;
			};
			is_admin_user: {
				Args: Record<PropertyKey, never>;
				Returns: boolean;
			};
			is_resource_owner: {
				Args: { resource_user_id: string };
				Returns: boolean;
			};
			log_admin_action: {
				Args: {
					p_action: string;
					p_details?: Json;
					p_error_message?: string;
					p_ip_address?: unknown;
					p_resource_id?: string;
					p_resource_type?: string;
					p_success?: boolean;
					p_user_agent?: string;
				};
				Returns: string;
			};
			verify_free_plan_exists: {
				Args: Record<PropertyKey, never>;
				Returns: boolean;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	abi_billing: {
		Tables: {
			auto_topup_rate_limits: {
				Row: {
					created_at: string;
					daily_topup_amount_cents: number;
					daily_topup_count: number;
					failure_count: number;
					last_failure_reason: string | null;
					last_failure_timestamp: string | null;
					last_success_timestamp: string | null;
					last_topup_date: string;
					last_topup_timestamp: string | null;
					temporary_disable_until: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					daily_topup_amount_cents?: number;
					daily_topup_count?: number;
					failure_count?: number;
					last_failure_reason?: string | null;
					last_failure_timestamp?: string | null;
					last_success_timestamp?: string | null;
					last_topup_date?: string;
					last_topup_timestamp?: string | null;
					temporary_disable_until?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					daily_topup_amount_cents?: number;
					daily_topup_count?: number;
					failure_count?: number;
					last_failure_reason?: string | null;
					last_failure_timestamp?: string | null;
					last_success_timestamp?: string | null;
					last_topup_date?: string;
					last_topup_timestamp?: string | null;
					temporary_disable_until?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'auto_topup_rate_limits_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'auto_topup_rate_limits_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'auto_topup_rate_limits_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'auto_topup_rate_limits_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			balance_cache: {
				Row: {
					balance_micro_usd: number;
					last_usage_check_at: string | null;
					ledger_updated_at: string;
					team_id: string | null;
					updated_at: string | null;
					user_id: string;
					version: number;
				};
				Insert: {
					balance_micro_usd?: number;
					last_usage_check_at?: string | null;
					ledger_updated_at: string;
					team_id?: string | null;
					updated_at?: string | null;
					user_id: string;
					version?: number;
				};
				Update: {
					balance_micro_usd?: number;
					last_usage_check_at?: string | null;
					ledger_updated_at?: string;
					team_id?: string | null;
					updated_at?: string | null;
					user_id?: string;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			balance_ledger: {
				Row: {
					amount_micro_usd: number;
					balance_after_micro_usd: number;
					created_at: string | null;
					effective_date: string;
					entry_type: Database['abi_billing']['Enums']['ledger_entry_type'];
					expires_at: string | null;
					ledger_id: number;
					metadata: Json | null;
					reference_id: string | null;
					reference_type: string | null;
					team_id: string | null;
					updated_at: string | null;
					user_id: string | null;
				};
				Insert: {
					amount_micro_usd: number;
					balance_after_micro_usd: number;
					created_at?: string | null;
					effective_date: string;
					entry_type: Database['abi_billing']['Enums']['ledger_entry_type'];
					expires_at?: string | null;
					ledger_id?: number;
					metadata?: Json | null;
					reference_id?: string | null;
					reference_type?: string | null;
					team_id?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
				};
				Update: {
					amount_micro_usd?: number;
					balance_after_micro_usd?: number;
					created_at?: string | null;
					effective_date?: string;
					entry_type?: Database['abi_billing']['Enums']['ledger_entry_type'];
					expires_at?: string | null;
					ledger_id?: number;
					metadata?: Json | null;
					reference_id?: string | null;
					reference_type?: string | null;
					team_id?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			payment_history: {
				Row: {
					amount_cents_usd: number;
					created_at: string;
					payment_id: string;
					payment_method_details: Json | null;
					payment_type: string;
					purchase_id: string | null;
					status: string;
					stripe_payment_intent_id: string;
					subscription_id: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					amount_cents_usd: number;
					created_at?: string;
					payment_id?: string;
					payment_method_details?: Json | null;
					payment_type: string;
					purchase_id?: string | null;
					status: string;
					stripe_payment_intent_id: string;
					subscription_id?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					amount_cents_usd?: number;
					created_at?: string;
					payment_id?: string;
					payment_method_details?: Json | null;
					payment_type?: string;
					purchase_id?: string | null;
					status?: string;
					stripe_payment_intent_id?: string;
					subscription_id?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'payment_history_purchase_id_fkey';
						columns: ['purchase_id'];
						isOneToOne: false;
						referencedRelation: 'token_purchases';
						referencedColumns: ['purchase_id'];
					},
					{
						foreignKeyName: 'payment_history_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'payment_history_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'payment_history_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_subscriptions';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'payment_history_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'payment_history_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'payment_history_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'payment_history_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			payment_method_errors: {
				Row: {
					created_at: string;
					error_id: string;
					error_message: string;
					error_type: string;
					stripe_setup_intent_id: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					error_id?: string;
					error_message: string;
					error_type: string;
					stripe_setup_intent_id: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					error_id?: string;
					error_message?: string;
					error_type?: string;
					stripe_setup_intent_id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'payment_method_errors_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'payment_method_errors_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'payment_method_errors_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'payment_method_errors_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			product_price_history: {
				Row: {
					active_from: string;
					active_to: string | null;
					billing_interval: Database['abi_billing']['Enums']['billing_interval'];
					created_at: string;
					metadata: Json | null;
					price_id: string;
					product_id: string;
					stripe_price_id: string;
				};
				Insert: {
					active_from: string;
					active_to?: string | null;
					billing_interval?: Database['abi_billing']['Enums']['billing_interval'];
					created_at?: string;
					metadata?: Json | null;
					price_id?: string;
					product_id: string;
					stripe_price_id: string;
				};
				Update: {
					active_from?: string;
					active_to?: string | null;
					billing_interval?: Database['abi_billing']['Enums']['billing_interval'];
					created_at?: string;
					metadata?: Json | null;
					price_id?: string;
					product_id?: string;
					stripe_price_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_price_history_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['product_id'];
					},
				];
			};
			product_prices: {
				Row: {
					active: boolean | null;
					billing_interval: Database['abi_billing']['Enums']['billing_interval'];
					created_at: string;
					metadata: Json | null;
					price_id: string;
					product_id: string;
					stripe_price_id: string;
					unit_amount_cents_usd: number;
					updated_at: string;
				};
				Insert: {
					active?: boolean | null;
					billing_interval: Database['abi_billing']['Enums']['billing_interval'];
					created_at?: string;
					metadata?: Json | null;
					price_id?: string;
					product_id: string;
					stripe_price_id: string;
					unit_amount_cents_usd: number;
					updated_at?: string;
				};
				Update: {
					active?: boolean | null;
					billing_interval?: Database['abi_billing']['Enums']['billing_interval'];
					created_at?: string;
					metadata?: Json | null;
					price_id?: string;
					product_id?: string;
					stripe_price_id?: string;
					unit_amount_cents_usd?: number;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'product_prices_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['product_id'];
					},
				];
			};
			products: {
				Row: {
					active: boolean | null;
					created_at: string;
					description: string | null;
					metadata: Json | null;
					name: string;
					product_id: string;
					product_type: Database['abi_billing']['Enums']['product_type'];
					stripe_product_id: string;
					updated_at: string;
				};
				Insert: {
					active?: boolean | null;
					created_at?: string;
					description?: string | null;
					metadata?: Json | null;
					name: string;
					product_id?: string;
					product_type: Database['abi_billing']['Enums']['product_type'];
					stripe_product_id: string;
					updated_at?: string;
				};
				Update: {
					active?: boolean | null;
					created_at?: string;
					description?: string | null;
					metadata?: Json | null;
					name?: string;
					product_id?: string;
					product_type?: Database['abi_billing']['Enums']['product_type'];
					stripe_product_id?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			stripe_events: {
				Row: {
					created_at: string;
					event_data: Json;
					event_id: string;
					event_type: string;
					last_error: string | null;
					processed_at: string | null;
					processing_attempts: number;
					processing_status: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					event_data: Json;
					event_id: string;
					event_type: string;
					last_error?: string | null;
					processed_at?: string | null;
					processing_attempts?: number;
					processing_status: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					event_data?: Json;
					event_id?: string;
					event_type?: string;
					last_error?: string | null;
					processed_at?: string | null;
					processing_attempts?: number;
					processing_status?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			subscription_coupon_usage: {
				Row: {
					applied_at: string | null;
					coupon_id: string;
					created_at: string;
					discount_applied_cents_usd: number | null;
					discount_months_remaining: number | null;
					expires_at: string | null;
					metadata: Json | null;
					subscription_id: string;
					updated_at: string;
					usage_id: string;
					usage_status: Database['abi_billing']['Enums']['coupon_usage_status'];
					user_id: string;
				};
				Insert: {
					applied_at?: string | null;
					coupon_id: string;
					created_at?: string;
					discount_applied_cents_usd?: number | null;
					discount_months_remaining?: number | null;
					expires_at?: string | null;
					metadata?: Json | null;
					subscription_id: string;
					updated_at?: string;
					usage_id?: string;
					usage_status?: Database['abi_billing']['Enums']['coupon_usage_status'];
					user_id: string;
				};
				Update: {
					applied_at?: string | null;
					coupon_id?: string;
					created_at?: string;
					discount_applied_cents_usd?: number | null;
					discount_months_remaining?: number | null;
					expires_at?: string | null;
					metadata?: Json | null;
					subscription_id?: string;
					updated_at?: string;
					usage_id?: string;
					usage_status?: Database['abi_billing']['Enums']['coupon_usage_status'];
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'subscription_coupon_usage_coupon_id_fkey';
						columns: ['coupon_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_coupons';
						referencedColumns: ['coupon_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_subscriptions';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'subscription_coupon_usage_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			subscription_coupons: {
				Row: {
					coupon_active: boolean;
					coupon_code: string;
					coupon_description: string | null;
					coupon_id: string;
					coupon_name: string;
					created_at: string;
					created_by: string | null;
					current_uses: number;
					discount_duration_months: number | null;
					discount_type: Database['abi_billing']['Enums']['discount_type'];
					discount_value: number;
					eligible_plan_ids: string[] | null;
					max_uses: number | null;
					max_uses_per_user: number | null;
					maximum_discount_cents_usd: number | null;
					metadata: Json | null;
					minimum_plan_value_cents_usd: number | null;
					stripe_coupon_id: string | null;
					updated_at: string;
					valid_from: string;
					valid_until: string | null;
				};
				Insert: {
					coupon_active?: boolean;
					coupon_code: string;
					coupon_description?: string | null;
					coupon_id?: string;
					coupon_name: string;
					created_at?: string;
					created_by?: string | null;
					current_uses?: number;
					discount_duration_months?: number | null;
					discount_type: Database['abi_billing']['Enums']['discount_type'];
					discount_value: number;
					eligible_plan_ids?: string[] | null;
					max_uses?: number | null;
					max_uses_per_user?: number | null;
					maximum_discount_cents_usd?: number | null;
					metadata?: Json | null;
					minimum_plan_value_cents_usd?: number | null;
					stripe_coupon_id?: string | null;
					updated_at?: string;
					valid_from?: string;
					valid_until?: string | null;
				};
				Update: {
					coupon_active?: boolean;
					coupon_code?: string;
					coupon_description?: string | null;
					coupon_id?: string;
					coupon_name?: string;
					created_at?: string;
					created_by?: string | null;
					current_uses?: number;
					discount_duration_months?: number | null;
					discount_type?: Database['abi_billing']['Enums']['discount_type'];
					discount_value?: number;
					eligible_plan_ids?: string[] | null;
					max_uses?: number | null;
					max_uses_per_user?: number | null;
					maximum_discount_cents_usd?: number | null;
					metadata?: Json | null;
					minimum_plan_value_cents_usd?: number | null;
					stripe_coupon_id?: string | null;
					updated_at?: string;
					valid_from?: string;
					valid_until?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'subscription_coupons_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'subscription_coupons_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'subscription_coupons_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'subscription_coupons_created_by_fkey';
						columns: ['created_by'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			subscription_plans: {
				Row: {
					created_at: string;
					metadata: Json | null;
					plan_active: boolean | null;
					plan_available_for_signup: boolean;
					plan_description: string | null;
					plan_features: Json | null;
					plan_id: string;
					plan_name: string;
					plan_price_monthly_cents_usd: number | null;
					plan_price_yearly_cents_usd: number | null;
					plan_sort_order: number | null;
					product_id: string | null;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					metadata?: Json | null;
					plan_active?: boolean | null;
					plan_available_for_signup?: boolean;
					plan_description?: string | null;
					plan_features?: Json | null;
					plan_id?: string;
					plan_name: string;
					plan_price_monthly_cents_usd?: number | null;
					plan_price_yearly_cents_usd?: number | null;
					plan_sort_order?: number | null;
					product_id?: string | null;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					metadata?: Json | null;
					plan_active?: boolean | null;
					plan_available_for_signup?: boolean;
					plan_description?: string | null;
					plan_features?: Json | null;
					plan_id?: string;
					plan_name?: string;
					plan_price_monthly_cents_usd?: number | null;
					plan_price_yearly_cents_usd?: number | null;
					plan_sort_order?: number | null;
					product_id?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'subscription_plans_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['product_id'];
					},
				];
			};
			token_purchases: {
				Row: {
					amount_cents_usd: number;
					batch_id: string | null;
					created_at: string;
					metadata: Json | null;
					product_id: string | null;
					purchase_id: string;
					purchase_status: string;
					subscription_id: string | null;
					tokens_added_at: string | null;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					amount_cents_usd: number;
					batch_id?: string | null;
					created_at?: string;
					metadata?: Json | null;
					product_id?: string | null;
					purchase_id?: string;
					purchase_status: string;
					subscription_id?: string | null;
					tokens_added_at?: string | null;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					amount_cents_usd?: number;
					batch_id?: string | null;
					created_at?: string;
					metadata?: Json | null;
					product_id?: string | null;
					purchase_id?: string;
					purchase_status?: string;
					subscription_id?: string | null;
					tokens_added_at?: string | null;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'token_purchases_product_id_fkey';
						columns: ['product_id'];
						isOneToOne: false;
						referencedRelation: 'products';
						referencedColumns: ['product_id'];
					},
					{
						foreignKeyName: 'token_purchases_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'token_purchases_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'token_purchases_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_subscriptions';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'token_purchases_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'token_purchases_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'token_purchases_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'token_purchases_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			user_payment_methods: {
				Row: {
					card_brand: string | null;
					card_exp_month: number | null;
					card_exp_year: number | null;
					card_last4: string | null;
					created_at: string;
					is_default: boolean;
					payment_method_id: string;
					payment_type: string;
					stripe_payment_method_id: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					card_brand?: string | null;
					card_exp_month?: number | null;
					card_exp_year?: number | null;
					card_last4?: string | null;
					created_at?: string;
					is_default?: boolean;
					payment_method_id?: string;
					payment_type: string;
					stripe_payment_method_id: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					card_brand?: string | null;
					card_exp_month?: number | null;
					card_exp_year?: number | null;
					card_last4?: string | null;
					created_at?: string;
					is_default?: boolean;
					payment_method_id?: string;
					payment_type?: string;
					stripe_payment_method_id?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'user_payment_methods_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_payment_methods_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_payment_methods_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_payment_methods_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			user_subscription_changes: {
				Row: {
					change_id: string;
					change_type: string;
					created_at: string;
					effective_date: string;
					new_plan_id: string;
					previous_plan_id: string | null;
					subscription_id: string;
					user_id: string;
				};
				Insert: {
					change_id?: string;
					change_type: string;
					created_at?: string;
					effective_date: string;
					new_plan_id: string;
					previous_plan_id?: string | null;
					subscription_id: string;
					user_id: string;
				};
				Update: {
					change_id?: string;
					change_type?: string;
					created_at?: string;
					effective_date?: string;
					new_plan_id?: string;
					previous_plan_id?: string | null;
					subscription_id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'user_subscription_changes_new_plan_id_fkey';
						columns: ['new_plan_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_plans';
						referencedColumns: ['plan_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_previous_plan_id_fkey';
						columns: ['previous_plan_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_plans';
						referencedColumns: ['plan_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_subscription_id_fkey';
						columns: ['subscription_id'];
						isOneToOne: false;
						referencedRelation: 'user_subscriptions';
						referencedColumns: ['subscription_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_subscription_changes_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			user_subscriptions: {
				Row: {
					billing_interval: Database['abi_billing']['Enums']['billing_interval'];
					created_at: string;
					last_payment_attempt: string | null;
					last_payment_error: string | null;
					metadata: Json | null;
					plan_id: string;
					stripe_subscription_id: string | null;
					subscription_cancel_at: string | null;
					subscription_canceled_at: string | null;
					subscription_id: string;
					subscription_period_end: string;
					subscription_period_start: string;
					subscription_status: Database['abi_billing']['Enums']['subscription_status'];
					updated_at: string;
					user_id: string;
				};
				Insert: {
					billing_interval?: Database['abi_billing']['Enums']['billing_interval'];
					created_at?: string;
					last_payment_attempt?: string | null;
					last_payment_error?: string | null;
					metadata?: Json | null;
					plan_id: string;
					stripe_subscription_id?: string | null;
					subscription_cancel_at?: string | null;
					subscription_canceled_at?: string | null;
					subscription_id?: string;
					subscription_period_end: string;
					subscription_period_start: string;
					subscription_status: Database['abi_billing']['Enums']['subscription_status'];
					updated_at?: string;
					user_id: string;
				};
				Update: {
					billing_interval?: Database['abi_billing']['Enums']['billing_interval'];
					created_at?: string;
					last_payment_attempt?: string | null;
					last_payment_error?: string | null;
					metadata?: Json | null;
					plan_id?: string;
					stripe_subscription_id?: string | null;
					subscription_cancel_at?: string | null;
					subscription_canceled_at?: string | null;
					subscription_id?: string;
					subscription_period_end?: string;
					subscription_period_start?: string;
					subscription_status?: Database['abi_billing']['Enums']['subscription_status'];
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'user_subscriptions_plan_id_fkey';
						columns: ['plan_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_plans';
						referencedColumns: ['plan_id'];
					},
					{
						foreignKeyName: 'user_subscriptions_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_subscriptions_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_subscriptions_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'user_subscriptions_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
		};
		Views: {
			balance_cache_dollars: {
				Row: {
					balance_usd: number | null;
					last_usage_check_at: string | null;
					ledger_updated_at: string | null;
					team_id: string | null;
					updated_at: string | null;
					user_id: string | null;
					version: number | null;
				};
				Insert: {
					balance_usd?: never;
					last_usage_check_at?: string | null;
					ledger_updated_at?: string | null;
					team_id?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
					version?: number | null;
				};
				Update: {
					balance_usd?: never;
					last_usage_check_at?: string | null;
					ledger_updated_at?: string | null;
					team_id?: string | null;
					updated_at?: string | null;
					user_id?: string | null;
					version?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			balance_ledger_dollars: {
				Row: {
					amount_usd: number | null;
					balance_after_usd: number | null;
					created_at: string | null;
					effective_date: string | null;
					entry_type:
						| Database['abi_billing']['Enums']['ledger_entry_type']
						| null;
					expires_at: string | null;
					ledger_id: number | null;
					metadata: Json | null;
					reference_id: string | null;
					reference_type: string | null;
					team_id: string | null;
					user_id: string | null;
				};
				Insert: {
					amount_usd?: never;
					balance_after_usd?: never;
					created_at?: string | null;
					effective_date?: string | null;
					entry_type?:
						| Database['abi_billing']['Enums']['ledger_entry_type']
						| null;
					expires_at?: string | null;
					ledger_id?: number | null;
					metadata?: Json | null;
					reference_id?: string | null;
					reference_type?: string | null;
					team_id?: string | null;
					user_id?: string | null;
				};
				Update: {
					amount_usd?: never;
					balance_after_usd?: never;
					created_at?: string | null;
					effective_date?: string | null;
					entry_type?:
						| Database['abi_billing']['Enums']['ledger_entry_type']
						| null;
					expires_at?: string | null;
					ledger_id?: number | null;
					metadata?: Json | null;
					reference_id?: string | null;
					reference_type?: string | null;
					team_id?: string | null;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			performance_view: {
				Row: {
					buffer_hits: number | null;
					created_at: string | null;
					duration_ms: number | null;
					metadata: Json | null;
					metric_id: string | null;
					metric_type: string | null;
					record_count: number | null;
					temp_files_bytes: number | null;
					threshold_exceeded: boolean | null;
					timestamp: string | null;
				};
				Insert: {
					buffer_hits?: number | null;
					created_at?: string | null;
					duration_ms?: number | null;
					metadata?: Json | null;
					metric_id?: string | null;
					metric_type?: string | null;
					record_count?: number | null;
					temp_files_bytes?: number | null;
					threshold_exceeded?: never;
					timestamp?: string | null;
				};
				Update: {
					buffer_hits?: number | null;
					created_at?: string | null;
					duration_ms?: number | null;
					metadata?: Json | null;
					metric_id?: string | null;
					metric_type?: string | null;
					record_count?: number | null;
					temp_files_bytes?: number | null;
					threshold_exceeded?: never;
					timestamp?: string | null;
				};
				Relationships: [];
			};
			subscription_balance_summary: {
				Row: {
					balance_micro_usd: number | null;
					balance_usd: number | null;
					display_name: string | null;
					email: string | null;
					has_active_subscription: boolean | null;
					live_balance_micro_usd: number | null;
					live_balance_usd: number | null;
					phone: string | null;
					plan_name: string | null;
					status_summary: string | null;
					subscription_cancel_at: string | null;
					subscription_cancelling: boolean | null;
					subscription_id: string | null;
					subscription_period_end: string | null;
					subscription_period_start: string | null;
					subscription_price_micro_usd: number | null;
					subscription_price_usd: number | null;
					subscription_status:
						| Database['abi_billing']['Enums']['subscription_status']
						| null;
					user_id: string | null;
					warning_flag: string | null;
				};
				Relationships: [];
			};
			system_balance_summary: {
				Row: {
					active_subscriptions: number | null;
					active_users_1d: number | null;
					active_users_30d: number | null;
					active_users_7d: number | null;
					avg_user_balance_micro_usd: number | null;
					avg_user_balance_usd: number | null;
					cancelling_subscriptions: number | null;
					max_user_balance_micro_usd: number | null;
					min_user_balance_micro_usd: number | null;
					purchase_amount_30d_cents: number | null;
					purchase_amount_30d_usd: number | null;
					purchases_30d: number | null;
					snapshot_at: string | null;
					total_purchase_amount_cents: number | null;
					total_purchase_amount_usd: number | null;
					total_purchases: number | null;
					total_system_balance_micro_usd: number | null;
					total_system_balance_usd: number | null;
					total_transactions: number | null;
					total_usage_cost_micro_usd: number | null;
					total_usage_cost_usd: number | null;
					total_users_with_balance: number | null;
					total_users_with_purchases: number | null;
					total_users_with_subscriptions: number | null;
					total_users_with_usage: number | null;
					transactions_1d: number | null;
					transactions_30d: number | null;
					transactions_7d: number | null;
					unbatched_cost_micro_usd: number | null;
					unbatched_cost_usd: number | null;
					unbatched_transactions: number | null;
					usage_cost_1d_micro_usd: number | null;
					usage_cost_1d_usd: number | null;
					usage_cost_30d_micro_usd: number | null;
					usage_cost_30d_usd: number | null;
					usage_cost_7d_micro_usd: number | null;
					usage_cost_7d_usd: number | null;
					users_with_negative_balance: number | null;
					users_with_positive_balance: number | null;
					users_with_zero_balance: number | null;
				};
				Relationships: [];
			};
			team_balance_summary: {
				Row: {
					balance_micro_usd: number | null;
					balance_usd: number | null;
					last_batch_at: string | null;
					live_balance_micro_usd: number | null;
					live_balance_usd: number | null;
					team_id: string | null;
					team_name: string | null;
					user_created_at: string | null;
					user_id: string | null;
				};
				Relationships: [];
			};
			token_expiration_summary: {
				Row: {
					earliest_expiration: string | null;
					expiring_30d_micro_usd: number | null;
					expiring_30d_usd: number | null;
					expiring_7d_micro_usd: number | null;
					expiring_7d_usd: number | null;
					expiring_90d_micro_usd: number | null;
					expiring_90d_usd: number | null;
					expiring_entries: number | null;
					latest_expiration: string | null;
					user_id: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			user_balance_history: {
				Row: {
					amount_micro_usd: number | null;
					amount_usd: number | null;
					balance_after_micro_usd: number | null;
					balance_after_usd: number | null;
					created_at: string | null;
					effective_date: string | null;
					entry_type:
						| Database['abi_billing']['Enums']['ledger_entry_type']
						| null;
					expires_at: string | null;
					ledger_id: number | null;
					metadata: Json | null;
					reference_id: string | null;
					reference_type: string | null;
					team_id: string | null;
					user_id: string | null;
				};
				Insert: {
					amount_micro_usd?: number | null;
					amount_usd?: never;
					balance_after_micro_usd?: number | null;
					balance_after_usd?: never;
					created_at?: string | null;
					effective_date?: string | null;
					entry_type?:
						| Database['abi_billing']['Enums']['ledger_entry_type']
						| null;
					expires_at?: string | null;
					ledger_id?: number | null;
					metadata?: Json | null;
					reference_id?: string | null;
					reference_type?: string | null;
					team_id?: string | null;
					user_id?: string | null;
				};
				Update: {
					amount_micro_usd?: number | null;
					amount_usd?: never;
					balance_after_micro_usd?: number | null;
					balance_after_usd?: never;
					created_at?: string | null;
					effective_date?: string | null;
					entry_type?:
						| Database['abi_billing']['Enums']['ledger_entry_type']
						| null;
					expires_at?: string | null;
					ledger_id?: number | null;
					metadata?: Json | null;
					reference_id?: string | null;
					reference_type?: string | null;
					team_id?: string | null;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_ledger_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			user_current_balance: {
				Row: {
					balance_micro_usd: number | null;
					balance_updated_at: string | null;
					balance_usd: number | null;
					display_name: string | null;
					email: string | null;
					has_active_subscription: boolean | null;
					last_batch_at: string | null;
					live_balance_micro_usd: number | null;
					live_balance_usd: number | null;
					phone: string | null;
					plan_name: string | null;
					subscription_cancel_at: string | null;
					subscription_cancelling: boolean | null;
					subscription_id: string | null;
					subscription_period_end: string | null;
					subscription_period_start: string | null;
					subscription_price_micro_usd: number | null;
					subscription_price_usd: number | null;
					subscription_status:
						| Database['abi_billing']['Enums']['subscription_status']
						| null;
					unbatched_cost_micro_usd: number | null;
					unbatched_transaction_count: number | null;
					user_created_at: string | null;
					user_id: string | null;
					warning_flag: string | null;
				};
				Relationships: [];
			};
			user_summary_details: {
				Row: {
					accepted_terms: string | null;
					balance_usd: number | null;
					current_plan_name: string | null;
					email: string | null;
					email_verified: boolean | null;
					marketing_consent: string | null;
					name_first: string | null;
					name_last: string | null;
					phone: string | null;
					phone_verified: boolean | null;
					signup_date: string | null;
					subscription_period_end: string | null;
					subscription_period_start: string | null;
					subscription_status:
						| Database['abi_billing']['Enums']['subscription_status']
						| null;
					theme_preference: string | null;
					user_id: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'subscription_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'team_balance_summary';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_current_balance';
						referencedColumns: ['user_id'];
					},
					{
						foreignKeyName: 'balance_cache_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: true;
						referencedRelation: 'user_usage_summary';
						referencedColumns: ['user_id'];
					},
				];
			};
			user_usage_summary: {
				Row: {
					activity_status: string | null;
					avg_cost_micro_usd: number | null;
					avg_cost_usd: number | null;
					cost_1d_micro_usd: number | null;
					cost_1d_usd: number | null;
					cost_30d_micro_usd: number | null;
					cost_30d_usd: number | null;
					cost_7d_micro_usd: number | null;
					cost_7d_usd: number | null;
					display_name: string | null;
					email: string | null;
					first_usage_at: string | null;
					last_usage_at: string | null;
					max_cost_micro_usd: number | null;
					min_cost_micro_usd: number | null;
					phone: string | null;
					total_cost_micro_usd: number | null;
					total_cost_usd: number | null;
					total_usage_count: number | null;
					usage_count_1d: number | null;
					usage_count_30d: number | null;
					usage_count_7d: number | null;
					user_created_at: string | null;
					user_id: string | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			activate_immediate_subscription: {
				Args: {
					p_effective_date?: string;
					p_stripe_subscription_id: string;
					p_user_id: string;
				};
				Returns: {
					activated_subscription_id: string;
					canceled_subscription_id: string;
					transition_successful: boolean;
				}[];
			};
			activate_scheduled_subscription: {
				Args: {
					p_effective_date?: string;
					p_stripe_subscription_id: string;
					p_user_id: string;
				};
				Returns: {
					activated_subscription_id: string;
					canceled_subscription_id: string;
					transition_successful: boolean;
				}[];
			};
			add_ledger_entry: {
				Args: {
					p_amount_micro_usd: number;
					p_effective_date?: string;
					p_entry_type: Database['abi_billing']['Enums']['ledger_entry_type'];
					p_expires_at?: string;
					p_metadata?: Json;
					p_reference_id?: string;
					p_reference_type?: string;
					p_team_id: string;
					p_user_id: string;
				};
				Returns: number;
			};
			add_micro: {
				Args: Record<PropertyKey, never>;
				Returns: number;
			};
			apply_coupon: {
				Args: {
					p_base_amount_micro?: number;
					p_coupon_code: string;
					p_effective_date?: string;
					p_subscription_id: string;
					p_user_id: string;
				};
				Returns: Json;
			};
			batch_daily_usage: {
				Args: Record<PropertyKey, never>;
				Returns: {
					batches_created: number;
					users_processed: number;
				}[];
			};
			batch_heavy_usage: {
				Args: Record<PropertyKey, never>;
				Returns: {
					batches_created: number;
					users_processed: number;
				}[];
			};
			batch_user_usage: {
				Args: { p_force?: boolean; p_team_id?: string; p_user_id: string };
				Returns: undefined;
			};
			calculate_discount: {
				Args: {
					p_base_amount_micro: number;
					p_discount_type: Database['abi_billing']['Enums']['discount_type'];
					p_discount_value: number;
					p_maximum_discount_micro?: number;
				};
				Returns: number;
			};
			calculate_prorated_amount: {
				Args: {
					p_current_plan_price_cents_usd: number;
					p_effective_date?: string;
					p_new_plan_price_cents_usd: number;
				};
				Returns: {
					calculation_metadata: Json;
					cost_difference_cents_usd: number;
					days_in_month: number;
					days_remaining: number;
					prorated_amount_micro_usd: number;
					proration_factor: number;
				}[];
			};
			calculate_subscription_total_with_coupons: {
				Args: {
					p_base_amount_cents_usd: number;
					p_effective_date?: string;
					p_subscription_id: string;
				};
				Returns: Json;
			};
			cancel_subscription: {
				Args: { p_effective_date?: string; p_user_id: string };
				Returns: Database['abi_billing']['CompositeTypes']['subscription_result'];
			};
			categorize_auto_topup_failure: {
				Args: { p_reason: string };
				Returns: string;
			};
			cents_to_dollars: {
				Args: { cents: number };
				Returns: number;
			};
			cents_to_micro: {
				Args: { cents: number };
				Returns: number;
			};
			change_subscription: {
				Args: {
					p_activate_immediately?: boolean;
					p_change_type: string;
					p_coupon_code?: string;
					p_effective_date?: string;
					p_grant_tokens?: boolean;
					p_new_plan_id: string;
					p_user_id: string;
				};
				Returns: Database['abi_billing']['CompositeTypes']['subscription_result'];
			};
			check_audit_patterns: {
				Args: { p_time_window?: unknown };
				Returns: undefined;
			};
			check_auto_topup_eligibility: {
				Args: { p_current_balance_micro_usd: number; p_user_id: string };
				Returns: {
					daily_limit_remaining_cents: number;
					eligible: boolean;
					failure_count: number;
					min_balance_cents: number;
					payment_method_available: boolean;
					purchase_amount_cents: number;
					reason: string;
				}[];
			};
			check_balance: {
				Args: { p_team_id?: string; p_user_id: string };
				Returns: {
					balance_micro_usd: number;
					last_updated: string;
					team_id: string;
					usage_since_update: number;
				}[];
			};
			check_month_end_job_status: {
				Args: Record<PropertyKey, never>;
				Returns: {
					job_name: string;
					last_run: string;
					last_success: boolean;
					next_run: string;
					period_processed: string;
				}[];
			};
			count_recent_payment_failures: {
				Args: { p_days?: number; p_subscription_id: string };
				Returns: {
					count: number;
				}[];
			};
			cron_daily_balance_validation: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			cron_daily_usage_batching: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			cron_heavy_usage_batching: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			cron_monthly_subscription_processing: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			cron_weekly_balance_validation_admin: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			divide_micro: {
				Args: { divisor: number; micro: number };
				Returns: number;
			};
			dollars_to_cents: {
				Args: { dollars: number };
				Returns: number;
			};
			dollars_to_micro: {
				Args: { dollars: number };
				Returns: number;
			};
			fix_balance_cache: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			format_cents: {
				Args: { micro: number };
				Returns: string;
			};
			format_dollars: {
				Args: { micro: number };
				Returns: string;
			};
			get_subscription_coupon_discounts: {
				Args: { p_effective_date?: string; p_subscription_id: string };
				Returns: {
					coupon_code: string;
					coupon_name: string;
					discount_applied_cents_usd: number;
					discount_months_remaining: number;
					discount_type: Database['abi_billing']['Enums']['discount_type'];
					expires_at: string;
					usage_id: string;
				}[];
			};
			get_transaction_history: {
				Args: {
					p_date_end?: string;
					p_date_start?: string;
					p_page?: number;
					p_per_page?: number;
					p_status?: string;
					p_transaction_type?: string;
					p_user_id: string;
				};
				Returns: {
					amount_usd: number;
					created_at: string;
					credit_details: Json;
					current_page: number;
					description: string;
					payment_method: Json;
					per_page: number;
					status: string;
					subscription_details: Json;
					total_items: number;
					total_pages: number;
					transaction_id: string;
					transaction_type: string;
				}[];
			};
			get_usage_analytics: {
				Args: {
					p_include_trends?: boolean;
					p_model_filter?: string[];
					p_month_filter?: string;
					p_period_end?: string;
					p_period_start?: string;
					p_user_id: string;
				};
				Returns: {
					filtered_by: Json;
					model_breakdown: Json;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
					total_requests: number;
					total_tokens: number;
					usage_trends: Json;
				}[];
			};
			get_usage_analytics_lite: {
				Args: {
					p_period_end?: string;
					p_period_start?: string;
					p_user_id: string;
				};
				Returns: {
					model_breakdown: Json;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
					total_requests: number;
					total_tokens: number;
				}[];
			};
			has_active_subscription: {
				Args: { check_user_id: string };
				Returns: boolean;
			};
			has_plan_feature: {
				Args: { feature_name: string };
				Returns: boolean;
			};
			micro_to_cents: {
				Args: { micro: number };
				Returns: number;
			};
			micro_to_dollars: {
				Args: { micro: number };
				Returns: number;
			};
			multiply_micro: {
				Args: { factor: number; micro: number };
				Returns: number;
			};
			notify_auto_topup_event: {
				Args: {
					p_amount_cents?: number;
					p_error_message?: string;
					p_event_type: string;
					p_user_id: string;
				};
				Returns: undefined;
			};
			process_coupon_expiry: {
				Args: { p_reference_date?: string };
				Returns: Json;
			};
			process_subscription_month_end: {
				Args: { p_reference_date?: string };
				Returns: undefined;
			};
			purchase_tokens: {
				Args: {
					p_amount_cents_usd: number;
					p_apply_grant?: boolean;
					p_auto_triggered?: boolean;
					p_purchase_date?: string;
					p_team_id: string;
					p_user_id: string;
				};
				Returns: Database['abi_billing']['CompositeTypes']['token_purchase_result'];
			};
			record_auto_topup_attempt: {
				Args: {
					p_amount_cents: number;
					p_message: string;
					p_success: boolean;
					p_user_id: string;
				};
				Returns: undefined;
			};
			start_subscription: {
				Args: {
					p_activate_immediately?: boolean;
					p_coupon_code?: string;
					p_period_end?: string;
					p_period_start?: string;
					p_plan_id: string;
					p_user_id: string;
				};
				Returns: Database['abi_billing']['CompositeTypes']['subscription_result'];
			};
			trigger_auto_topup: {
				Args: { p_current_balance_micro_usd?: number; p_user_id: string };
				Returns: {
					amount_cents: number;
					message: string;
					purchase_id: string;
					retry_after_seconds: number;
					success: boolean;
				}[];
			};
			update_auto_topup_rate_limits: {
				Args: { p_amount_cents: number; p_success: boolean; p_user_id: string };
				Returns: undefined;
			};
			validate_balance_cache: {
				Args: {
					p_include_details?: boolean;
					p_team_id?: string;
					p_user_id?: string;
				};
				Returns: {
					cache_balance_micro_usd: number;
					calculated_balance_micro_usd: number;
					details: Json;
					team_id: string;
					user_id: string;
					validation_status: string;
					variance_micro_usd: number;
				}[];
			};
			validate_coupon: {
				Args: {
					p_coupon_code: string;
					p_effective_date?: string;
					p_plan_id?: string;
					p_user_id: string;
				};
				Returns: Json;
			};
		};
		Enums: {
			billing_interval: 'monthly' | 'yearly';
			coupon_usage_status: 'pending' | 'applied' | 'expired' | 'invalid';
			discount_type: 'percentage' | 'fixed_amount';
			ledger_entry_type:
				| 'token_purchase'
				| 'usage_batch'
				| 'purchase_expiry'
				| 'manual_adjustment'
				| 'refund';
			product_type: 'plan' | 'credits';
			subscription_status:
				| 'ACTIVE'
				| 'RENEWED'
				| 'CANCELED'
				| 'PENDING'
				| 'EXPIRED'
				| 'PENDING_PAYMENT';
		};
		CompositeTypes: {
			subscription_result: {
				subscription:
					| Database['abi_billing']['Tables']['user_subscriptions']['Row']
					| null;
				prorated_amount_micro_usd: number | null;
				subscription_metadata: Json | null;
			};
			token_purchase_result: {
				token_purchase:
					| Database['abi_billing']['Tables']['token_purchases']['Row']
					| null;
				purchase_amount_micro_usd: number | null;
				purchase_metadata: Json | null;
			};
		};
	};
	abi_core: {
		Tables: {
			feature_access_cache: {
				Row: {
					access_granted: boolean;
					cache_expires_at: string;
					cache_id: string;
					created_at: string;
					feature_key: string;
					feature_value: Json | null;
					user_id: string;
				};
				Insert: {
					access_granted: boolean;
					cache_expires_at: string;
					cache_id?: string;
					created_at?: string;
					feature_key: string;
					feature_value?: Json | null;
					user_id: string;
				};
				Update: {
					access_granted?: boolean;
					cache_expires_at?: string;
					cache_id?: string;
					created_at?: string;
					feature_key?: string;
					feature_value?: Json | null;
					user_id?: string;
				};
				Relationships: [];
			};
			feature_definitions: {
				Row: {
					created_at: string;
					default_value: Json | null;
					feature_category: string | null;
					feature_description: string | null;
					feature_id: string;
					feature_key: string;
					feature_name: string;
					feature_type: string;
					is_active: boolean;
					parent_feature_id: string | null;
					updated_at: string;
					value_schema: Json | null;
				};
				Insert: {
					created_at?: string;
					default_value?: Json | null;
					feature_category?: string | null;
					feature_description?: string | null;
					feature_id?: string;
					feature_key: string;
					feature_name: string;
					feature_type: string;
					is_active?: boolean;
					parent_feature_id?: string | null;
					updated_at?: string;
					value_schema?: Json | null;
				};
				Update: {
					created_at?: string;
					default_value?: Json | null;
					feature_category?: string | null;
					feature_description?: string | null;
					feature_id?: string;
					feature_key?: string;
					feature_name?: string;
					feature_type?: string;
					is_active?: boolean;
					parent_feature_id?: string | null;
					updated_at?: string;
					value_schema?: Json | null;
				};
				Relationships: [
					{
						foreignKeyName: 'feature_definitions_parent_feature_id_fkey';
						columns: ['parent_feature_id'];
						isOneToOne: false;
						referencedRelation: 'feature_definitions';
						referencedColumns: ['feature_id'];
					},
				];
			};
			feature_usage_log: {
				Row: {
					access_granted: boolean;
					access_reason: string | null;
					created_at: string;
					feature_key: string;
					log_id: string;
					request_context: Json | null;
					user_id: string;
				};
				Insert: {
					access_granted: boolean;
					access_reason?: string | null;
					created_at?: string;
					feature_key: string;
					log_id?: string;
					request_context?: Json | null;
					user_id: string;
				};
				Update: {
					access_granted?: boolean;
					access_reason?: string | null;
					created_at?: string;
					feature_key?: string;
					log_id?: string;
					request_context?: Json | null;
					user_id?: string;
				};
				Relationships: [];
			};
			performance_metrics: {
				Row: {
					buffer_hits: number | null;
					created_at: string;
					duration_ms: number;
					metadata: Json | null;
					metric_id: string;
					metric_type: string;
					record_count: number | null;
					temp_files_bytes: number | null;
					timestamp: string;
				};
				Insert: {
					buffer_hits?: number | null;
					created_at?: string;
					duration_ms: number;
					metadata?: Json | null;
					metric_id?: string;
					metric_type: string;
					record_count?: number | null;
					temp_files_bytes?: number | null;
					timestamp?: string;
				};
				Update: {
					buffer_hits?: number | null;
					created_at?: string;
					duration_ms?: number;
					metadata?: Json | null;
					metric_id?: string;
					metric_type?: string;
					record_count?: number | null;
					temp_files_bytes?: number | null;
					timestamp?: string;
				};
				Relationships: [];
			};
			plan_features: {
				Row: {
					created_at: string;
					feature_id: string;
					feature_value: Json;
					is_enabled: boolean;
					plan_feature_id: string;
					plan_id: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					feature_id: string;
					feature_value: Json;
					is_enabled?: boolean;
					plan_feature_id?: string;
					plan_id: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					feature_id?: string;
					feature_value?: Json;
					is_enabled?: boolean;
					plan_feature_id?: string;
					plan_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'plan_features_feature_id_fkey';
						columns: ['feature_id'];
						isOneToOne: false;
						referencedRelation: 'feature_definitions';
						referencedColumns: ['feature_id'];
					},
				];
			};
			rate_limits: {
				Row: {
					endpoint: string;
					first_request_at: string;
					id: string;
					ip: string;
					last_request_at: string;
					request_count: number;
				};
				Insert: {
					endpoint: string;
					first_request_at?: string;
					id?: string;
					ip: string;
					last_request_at?: string;
					request_count?: number;
				};
				Update: {
					endpoint?: string;
					first_request_at?: string;
					id?: string;
					ip?: string;
					last_request_at?: string;
					request_count?: number;
				};
				Relationships: [];
			};
			schema_versions: {
				Row: {
					version_applied_at: string;
					version_description: string;
					version_id: number;
					version_number: string;
				};
				Insert: {
					version_applied_at?: string;
					version_description: string;
					version_id?: number;
					version_number: string;
				};
				Update: {
					version_applied_at?: string;
					version_description?: string;
					version_id?: number;
					version_number?: string;
				};
				Relationships: [];
			};
			settings: {
				Row: {
					created_at: string;
					description: string | null;
					key: string;
					updated_at: string;
					value: string;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					key: string;
					updated_at?: string;
					value: string;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					key?: string;
					updated_at?: string;
					value?: string;
				};
				Relationships: [];
			};
			statistics_log: {
				Row: {
					index_bytes: number;
					last_analyze: string | null;
					last_vacuum: string | null;
					log_id: string;
					metadata: Json | null;
					table_name: string;
					timestamp: string;
					total_bytes: number;
					total_rows: number;
				};
				Insert: {
					index_bytes: number;
					last_analyze?: string | null;
					last_vacuum?: string | null;
					log_id?: string;
					metadata?: Json | null;
					table_name: string;
					timestamp?: string;
					total_bytes: number;
					total_rows: number;
				};
				Update: {
					index_bytes?: number;
					last_analyze?: string | null;
					last_vacuum?: string | null;
					log_id?: string;
					metadata?: Json | null;
					table_name?: string;
					timestamp?: string;
					total_bytes?: number;
					total_rows?: number;
				};
				Relationships: [];
			};
			user_feature_overrides: {
				Row: {
					created_at: string;
					created_by: string | null;
					expires_at: string | null;
					feature_id: string;
					override_id: string;
					override_reason: string | null;
					override_value: Json;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					created_by?: string | null;
					expires_at?: string | null;
					feature_id: string;
					override_id?: string;
					override_reason?: string | null;
					override_value: Json;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					expires_at?: string | null;
					feature_id?: string;
					override_id?: string;
					override_reason?: string | null;
					override_value?: Json;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'user_feature_overrides_feature_id_fkey';
						columns: ['feature_id'];
						isOneToOne: false;
						referencedRelation: 'feature_definitions';
						referencedColumns: ['feature_id'];
					},
				];
			};
		};
		Views: {
			feature_matrix: {
				Row: {
					base_enabled: boolean | null;
					base_value: Json | null;
					beyond_enabled: boolean | null;
					beyond_value: Json | null;
					build_enabled: boolean | null;
					build_value: Json | null;
					enterprise_enabled: boolean | null;
					enterprise_value: Json | null;
					feature_category: string | null;
					feature_key: string | null;
					feature_name: string | null;
					feature_type: string | null;
				};
				Relationships: [];
			};
			plan_features_detailed: {
				Row: {
					default_value: Json | null;
					feature_added_at: string | null;
					feature_category: string | null;
					feature_description: string | null;
					feature_key: string | null;
					feature_name: string | null;
					feature_type: string | null;
					feature_updated_at: string | null;
					feature_value: Json | null;
					is_enabled: boolean | null;
					plan_name: string | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			check_email_verification: {
				Args: { user_email: string };
				Returns: Json;
			};
			check_feature_access: {
				Args: { p_feature_key: string; p_user_id: string };
				Returns: {
					access_granted: boolean;
					access_reason: string;
					feature_value: Json;
					inheritance_chain: string[];
				}[];
			};
			check_feature_access_cached: {
				Args: { p_feature_key: string; p_user_id: string };
				Returns: {
					access_granted: boolean;
					access_reason: string;
					feature_value: Json;
					from_cache: boolean;
				}[];
			};
			check_rate_limit: {
				Args: {
					limit_count: number;
					request_endpoint: string;
					request_ip: string;
					window_seconds: number;
				};
				Returns: Json;
			};
			check_storage_limits: {
				Args: { bucket_id: string; file_size: number; user_id: string };
				Returns: boolean;
			};
			check_team_resource_access: {
				Args: {
					bucket_name: string;
					object_path: string;
					requesting_user: string;
				};
				Returns: boolean;
			};
			check_user_exists: {
				Args: { user_email: string };
				Returns: Json;
			};
			cleanup_expired_cache: {
				Args: Record<PropertyKey, never>;
				Returns: number;
			};
			cleanup_expired_overrides: {
				Args: Record<PropertyKey, never>;
				Returns: number;
			};
			cleanup_rate_limits: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			create_feature_override: {
				Args: {
					p_created_by?: string;
					p_expires_at?: string;
					p_feature_key: string;
					p_override_reason?: string;
					p_override_value: Json;
					p_user_id: string;
				};
				Returns: string;
			};
			cron_update_all_table_statistics: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			cron_update_statistics_monitoring: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			get_feature_analytics: {
				Args: { p_days_back?: number };
				Returns: {
					denied_requests: number;
					feature_key: string;
					grant_rate: number;
					granted_requests: number;
					total_requests: number;
				}[];
			};
			get_rate_limit: {
				Args: { p_limit_type: string; p_user_id: string };
				Returns: number;
			};
			get_secret: {
				Args: { p_default?: string; p_key: string };
				Returns: string;
			};
			get_setting: {
				Args: { p_default?: string; p_key: string };
				Returns: string;
			};
			get_user_features: {
				Args: { p_user_id: string };
				Returns: {
					access_granted: boolean;
					access_reason: string;
					feature_category: string;
					feature_description: string;
					feature_key: string;
					feature_name: string;
					feature_type: string;
					feature_value: Json;
				}[];
			};
			has_datasource_access: {
				Args: {
					p_access_type?: string;
					p_datasource_key: string;
					p_user_id: string;
				};
				Returns: boolean;
			};
			has_model_access: {
				Args: { p_model_key: string; p_user_id: string };
				Returns: boolean;
			};
			log_feature_access: {
				Args: {
					p_access_granted: boolean;
					p_access_reason: string;
					p_feature_key: string;
					p_request_context?: Json;
					p_user_id: string;
				};
				Returns: undefined;
			};
			notify_admin: {
				Args: { p_metadata: Json; p_severity: string; p_type: string };
				Returns: undefined;
			};
			record_performance_metric: {
				Args: {
					p_duration_ms: number;
					p_metadata?: Json;
					p_metric_type: string;
					p_record_count?: number;
				};
				Returns: string;
			};
			refresh_feature_cache: {
				Args: { p_user_id: string };
				Returns: number;
			};
			remove_feature_override: {
				Args: { p_feature_key: string; p_user_id: string };
				Returns: boolean;
			};
			set_secret: {
				Args: { p_description?: string; p_key: string; p_value: string };
				Returns: string;
			};
			set_setting: {
				Args: { p_description?: string; p_key: string; p_value: string };
				Returns: undefined;
			};
			update_statistics: {
				Args: { p_table_names?: string[] };
				Returns: undefined;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	abi_llm: {
		Tables: {
			conversation_files: {
				Row: {
					conversation_id: string;
					created_at: string;
					deleted_at: string | null;
					file_hash: string;
					file_id: string;
					file_name: string;
					file_size: number;
					file_type: string;
					metadata: Json | null;
					storage_path: string;
					updated_at: string;
				};
				Insert: {
					conversation_id: string;
					created_at?: string;
					deleted_at?: string | null;
					file_hash: string;
					file_id?: string;
					file_name: string;
					file_size: number;
					file_type: string;
					metadata?: Json | null;
					storage_path: string;
					updated_at?: string;
				};
				Update: {
					conversation_id?: string;
					created_at?: string;
					deleted_at?: string | null;
					file_hash?: string;
					file_id?: string;
					file_name?: string;
					file_size?: number;
					file_type?: string;
					metadata?: Json | null;
					storage_path?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'conversation_files_conversation_id_fkey';
						columns: ['conversation_id'];
						isOneToOne: false;
						referencedRelation: 'conversations';
						referencedColumns: ['conversation_id'];
					},
				];
			};
			conversation_messages: {
				Row: {
					content: string;
					conversation_id: string;
					created_at: string;
					message_id: string;
					message_index: number;
					message_type: string;
					metadata: Json | null;
					request_id: string;
					updated_at: string;
				};
				Insert: {
					content: string;
					conversation_id: string;
					created_at?: string;
					message_id?: string;
					message_index: number;
					message_type: string;
					metadata?: Json | null;
					request_id: string;
					updated_at?: string;
				};
				Update: {
					content?: string;
					conversation_id?: string;
					created_at?: string;
					message_id?: string;
					message_index?: number;
					message_type?: string;
					metadata?: Json | null;
					request_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'conversation_messages_conversation_id_fkey';
						columns: ['conversation_id'];
						isOneToOne: false;
						referencedRelation: 'conversations';
						referencedColumns: ['conversation_id'];
					},
					{
						foreignKeyName: 'conversation_messages_request_id_fkey';
						columns: ['request_id'];
						isOneToOne: false;
						referencedRelation: 'provider_requests';
						referencedColumns: ['request_id'];
					},
				];
			};
			conversations: {
				Row: {
					conversation_id: string;
					created_at: string;
					deleted_at: string | null;
					description: string | null;
					metadata: Json | null;
					organization_id: string | null;
					title: string;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					conversation_id?: string;
					created_at?: string;
					deleted_at?: string | null;
					description?: string | null;
					metadata?: Json | null;
					organization_id?: string | null;
					title: string;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					conversation_id?: string;
					created_at?: string;
					deleted_at?: string | null;
					description?: string | null;
					metadata?: Json | null;
					organization_id?: string | null;
					title?: string;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [];
			};
			provider_model_pricing: {
				Row: {
					created_at: string | null;
					effective_from: string | null;
					effective_until: string | null;
					metadata: Json | null;
					model_id: string;
					per_million_tokens_cents_usd: number;
					pricing_id: string;
					token_type: string;
					updated_at: string;
				};
				Insert: {
					created_at?: string | null;
					effective_from?: string | null;
					effective_until?: string | null;
					metadata?: Json | null;
					model_id: string;
					per_million_tokens_cents_usd: number;
					pricing_id?: string;
					token_type: string;
					updated_at?: string;
				};
				Update: {
					created_at?: string | null;
					effective_from?: string | null;
					effective_until?: string | null;
					metadata?: Json | null;
					model_id?: string;
					per_million_tokens_cents_usd?: number;
					pricing_id?: string;
					token_type?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'provider_model_pricing_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'current_model_pricing';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'provider_model_pricing_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'model_pricing_summary';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'provider_model_pricing_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'provider_models';
						referencedColumns: ['model_id'];
					},
				];
			};
			provider_models: {
				Row: {
					created_at: string;
					is_available: boolean | null;
					model_id: string;
					model_name: string;
					model_type: string;
					provider_name: string;
					settings: Json | null;
					updated_at: string;
				};
				Insert: {
					created_at?: string;
					is_available?: boolean | null;
					model_id?: string;
					model_name: string;
					model_type: string;
					provider_name: string;
					settings?: Json | null;
					updated_at?: string;
				};
				Update: {
					created_at?: string;
					is_available?: boolean | null;
					model_id?: string;
					model_name?: string;
					model_type?: string;
					provider_name?: string;
					settings?: Json | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			provider_requests: {
				Row: {
					client_source: string | null;
					client_version: string | null;
					metadata: Json | null;
					model_id: string | null;
					provider_duration_ms: number | null;
					provider_error_details: string | null;
					provider_response_code: number | null;
					provider_response_id: string | null;
					provider_response_length: number | null;
					provider_response_timestamp: string | null;
					proxy_request_headers: Json | null;
					proxy_request_length: number | null;
					proxy_request_path: string;
					proxy_request_timestamp: string;
					request_id: string;
					total_duration_ms: number | null;
					user_id: string;
				};
				Insert: {
					client_source?: string | null;
					client_version?: string | null;
					metadata?: Json | null;
					model_id?: string | null;
					provider_duration_ms?: number | null;
					provider_error_details?: string | null;
					provider_response_code?: number | null;
					provider_response_id?: string | null;
					provider_response_length?: number | null;
					provider_response_timestamp?: string | null;
					proxy_request_headers?: Json | null;
					proxy_request_length?: number | null;
					proxy_request_path: string;
					proxy_request_timestamp?: string;
					request_id?: string;
					total_duration_ms?: number | null;
					user_id: string;
				};
				Update: {
					client_source?: string | null;
					client_version?: string | null;
					metadata?: Json | null;
					model_id?: string | null;
					provider_duration_ms?: number | null;
					provider_error_details?: string | null;
					provider_response_code?: number | null;
					provider_response_id?: string | null;
					provider_response_length?: number | null;
					provider_response_timestamp?: string | null;
					proxy_request_headers?: Json | null;
					proxy_request_length?: number | null;
					proxy_request_path?: string;
					proxy_request_timestamp?: string;
					request_id?: string;
					total_duration_ms?: number | null;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'provider_requests_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'current_model_pricing';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'provider_requests_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'model_pricing_summary';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'provider_requests_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'provider_models';
						referencedColumns: ['model_id'];
					},
				];
			};
			rate_limit_violations: {
				Row: {
					current_value: number;
					limit_type: string;
					limit_value: number;
					metadata: Json | null;
					recorded_at: string;
					request_id: string;
					user_id: string;
					violation_id: string;
					window_end: string;
					window_start: string;
				};
				Insert: {
					current_value: number;
					limit_type: string;
					limit_value: number;
					metadata?: Json | null;
					recorded_at?: string;
					request_id: string;
					user_id: string;
					violation_id?: string;
					window_end: string;
					window_start: string;
				};
				Update: {
					current_value?: number;
					limit_type?: string;
					limit_value?: number;
					metadata?: Json | null;
					recorded_at?: string;
					request_id?: string;
					user_id?: string;
					violation_id?: string;
					window_end?: string;
					window_start?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'rate_limit_violations_request_id_fkey';
						columns: ['request_id'];
						isOneToOne: false;
						referencedRelation: 'provider_requests';
						referencedColumns: ['request_id'];
					},
				];
			};
			request_metrics: {
				Row: {
					auth_duration_ms: number;
					auto_topup_check_duration_ms: number;
					auto_topup_check_operations: number;
					completion_tokens: number;
					cost_quota_check_duration_ms: number;
					database_duration_ms: number;
					db_errors: number;
					db_operations: number;
					features_duration_ms: number;
					features_operations: number;
					metadata: Json | null;
					metric_id: string;
					prompt_tokens: number;
					provider_duration_ms: number;
					provider_errors: number;
					provider_name: string;
					provider_request_duration_ms: number;
					provider_status_code: number;
					provider_transform_duration_ms: number;
					provider_validation_duration_ms: number;
					rate_limit_check_duration_ms: number;
					recorded_at: string;
					request_id: string;
					request_size_bytes: number;
					response_size_bytes: number;
					retry_count: number;
					token_recording_duration_ms: number;
					total_duration_ms: number;
					total_tokens: number;
				};
				Insert: {
					auth_duration_ms: number;
					auto_topup_check_duration_ms?: number;
					auto_topup_check_operations?: number;
					completion_tokens: number;
					cost_quota_check_duration_ms: number;
					database_duration_ms: number;
					db_errors: number;
					db_operations: number;
					features_duration_ms?: number;
					features_operations?: number;
					metadata?: Json | null;
					metric_id?: string;
					prompt_tokens: number;
					provider_duration_ms: number;
					provider_errors: number;
					provider_name: string;
					provider_request_duration_ms: number;
					provider_status_code: number;
					provider_transform_duration_ms: number;
					provider_validation_duration_ms: number;
					rate_limit_check_duration_ms: number;
					recorded_at?: string;
					request_id: string;
					request_size_bytes: number;
					response_size_bytes: number;
					retry_count: number;
					token_recording_duration_ms: number;
					total_duration_ms: number;
					total_tokens: number;
				};
				Update: {
					auth_duration_ms?: number;
					auto_topup_check_duration_ms?: number;
					auto_topup_check_operations?: number;
					completion_tokens?: number;
					cost_quota_check_duration_ms?: number;
					database_duration_ms?: number;
					db_errors?: number;
					db_operations?: number;
					features_duration_ms?: number;
					features_operations?: number;
					metadata?: Json | null;
					metric_id?: string;
					prompt_tokens?: number;
					provider_duration_ms?: number;
					provider_errors?: number;
					provider_name?: string;
					provider_request_duration_ms?: number;
					provider_status_code?: number;
					provider_transform_duration_ms?: number;
					provider_validation_duration_ms?: number;
					rate_limit_check_duration_ms?: number;
					recorded_at?: string;
					request_id?: string;
					request_size_bytes?: number;
					response_size_bytes?: number;
					retry_count?: number;
					token_recording_duration_ms?: number;
					total_duration_ms?: number;
					total_tokens?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'request_metrics_request_id_fkey';
						columns: ['request_id'];
						isOneToOne: false;
						referencedRelation: 'provider_requests';
						referencedColumns: ['request_id'];
					},
				];
			};
			token_usage: {
				Row: {
					batch_id: string | null;
					cost_micro_usd: number;
					created_at: string | null;
					model_id: string;
					request_id: string;
					request_timestamp: string;
					token_count: number;
					token_type: string;
					usage_id: string;
					user_id: string;
				};
				Insert: {
					batch_id?: string | null;
					cost_micro_usd: number;
					created_at?: string | null;
					model_id: string;
					request_id: string;
					request_timestamp?: string;
					token_count: number;
					token_type: string;
					usage_id?: string;
					user_id: string;
				};
				Update: {
					batch_id?: string | null;
					cost_micro_usd?: number;
					created_at?: string | null;
					model_id?: string;
					request_id?: string;
					request_timestamp?: string;
					token_count?: number;
					token_type?: string;
					usage_id?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_token_usage_batch_id';
						columns: ['batch_id'];
						isOneToOne: false;
						referencedRelation: 'token_usage_batches';
						referencedColumns: ['batch_id'];
					},
					{
						foreignKeyName: 'token_usage_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'current_model_pricing';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'token_usage_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'model_pricing_summary';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'token_usage_model_id_fkey';
						columns: ['model_id'];
						isOneToOne: false;
						referencedRelation: 'provider_models';
						referencedColumns: ['model_id'];
					},
					{
						foreignKeyName: 'token_usage_request_id_fkey';
						columns: ['request_id'];
						isOneToOne: false;
						referencedRelation: 'provider_requests';
						referencedColumns: ['request_id'];
					},
				];
			};
			token_usage_batches: {
				Row: {
					batch_date: string;
					batch_id: string;
					created_at: string | null;
					event_count: number;
					ledger_entry_id: number | null;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
					used_micro_usd: number;
					user_id: string;
				};
				Insert: {
					batch_date: string;
					batch_id?: string;
					created_at?: string | null;
					event_count: number;
					ledger_entry_id?: number | null;
					period_end: string;
					period_start: string;
					total_cost_micro_usd: number;
					used_micro_usd?: number;
					user_id: string;
				};
				Update: {
					batch_date?: string;
					batch_id?: string;
					created_at?: string | null;
					event_count?: number;
					ledger_entry_id?: number | null;
					period_end?: string;
					period_start?: string;
					total_cost_micro_usd?: number;
					used_micro_usd?: number;
					user_id?: string;
				};
				Relationships: [];
			};
			usage_alerts: {
				Row: {
					alert_acknowledged_at: string | null;
					alert_category: string;
					alert_id: string;
					alert_threshold: number;
					alert_triggered_at: string;
					alert_type: string;
					created_at: string;
					current_usage_micro_usd: number;
					limit_value_micro_usd: number;
					metadata: Json | null;
					model_name: string | null;
					user_id: string;
				};
				Insert: {
					alert_acknowledged_at?: string | null;
					alert_category: string;
					alert_id?: string;
					alert_threshold: number;
					alert_triggered_at?: string;
					alert_type: string;
					created_at?: string;
					current_usage_micro_usd: number;
					limit_value_micro_usd: number;
					metadata?: Json | null;
					model_name?: string | null;
					user_id: string;
				};
				Update: {
					alert_acknowledged_at?: string | null;
					alert_category?: string;
					alert_id?: string;
					alert_threshold?: number;
					alert_triggered_at?: string;
					alert_type?: string;
					created_at?: string;
					current_usage_micro_usd?: number;
					limit_value_micro_usd?: number;
					metadata?: Json | null;
					model_name?: string | null;
					user_id?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			current_model_pricing: {
				Row: {
					metadata: Json | null;
					model_id: string | null;
					model_name: string | null;
					per_million_tokens_cents_usd: number | null;
					provider_name: string | null;
					token_type: string | null;
				};
				Relationships: [];
			};
			error_rates: {
				Row: {
					avg_duration: number | null;
					error_count: number | null;
					error_rate: number | null;
					p95_duration: number | null;
					period: string | null;
					provider_name: string | null;
					total_requests: number | null;
				};
				Relationships: [];
			};
			model_pricing_summary: {
				Row: {
					available_token_types: string[] | null;
					base_input_price_cents_usd: number | null;
					base_output_price_cents_usd: number | null;
					base_thought_price_cents_usd: number | null;
					combined_metadata: Json | null;
					has_cache_pricing: boolean | null;
					has_thought_pricing: boolean | null;
					has_tiered_pricing: boolean | null;
					max_price_cents_usd: number | null;
					min_price_cents_usd: number | null;
					model_id: string | null;
					model_name: string | null;
					provider_name: string | null;
					token_type_count: number | null;
				};
				Relationships: [];
			};
			normalized_pricing: {
				Row: {
					model_name: string | null;
					normalized_type: string | null;
					per_million_tokens_cents_usd: number | null;
					provider_name: string | null;
					specific_type: string | null;
				};
				Relationships: [];
			};
			rate_limit_status: {
				Row: {
					limit_requests: number | null;
					limit_tokens: number | null;
					minute: string | null;
					requests_count: number | null;
					requests_usage_pct: number | null;
					tokens_count: number | null;
					tokens_usage_pct: number | null;
					user_id: string | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			analyze_token_usage_fallbacks: {
				Args: { p_check_unbatched?: boolean; p_hours_back?: number };
				Returns: {
					affected_users: number;
					avg_cost_per_token: number;
					expected_token_pattern: string;
					fallback_confidence: string;
					model_name: string;
					provider_name: string;
					token_type: string;
					total_cost_micro_usd: number;
					total_tokens: number;
					usage_count: number;
				}[];
			};
			check_usage_alerts: {
				Args: { p_user_id: string };
				Returns: undefined;
			};
			cron_pricing_validation: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			cron_token_usage_fallback_monitoring: {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			detect_tiered_pricing_mismatches: {
				Args: Record<PropertyKey, never>;
				Returns: {
					base_records_only: string[];
					has_tiered_records: boolean;
					model_id: string;
					model_name: string;
					provider_name: string;
					supports_tiered_pricing: boolean;
				}[];
			};
			get_cache_cost: {
				Args: {
					p_cache_duration: unknown;
					p_provider: string;
					p_tokens: number;
				};
				Returns: number;
			};
			validate_model_pricing: {
				Args: Record<PropertyKey, never>;
				Returns: {
					missing_types: string[];
					model_id: string;
					model_name: string;
					provider_name: string;
				}[];
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	abi_marketing: {
		Tables: {
			bulk_email_sends: {
				Row: {
					campaign_id: string;
					created_at: string;
					error_code: string | null;
					error_message: string | null;
					failed_at: string | null;
					recipient_email: string;
					resend_email_id: string | null;
					send_id: string;
					send_status: Database['abi_marketing']['Enums']['send_status'];
					sent_at: string | null;
					subject: string;
					user_id: string;
				};
				Insert: {
					campaign_id: string;
					created_at?: string;
					error_code?: string | null;
					error_message?: string | null;
					failed_at?: string | null;
					recipient_email: string;
					resend_email_id?: string | null;
					send_id?: string;
					send_status?: Database['abi_marketing']['Enums']['send_status'];
					sent_at?: string | null;
					subject: string;
					user_id: string;
				};
				Update: {
					campaign_id?: string;
					created_at?: string;
					error_code?: string | null;
					error_message?: string | null;
					failed_at?: string | null;
					recipient_email?: string;
					resend_email_id?: string | null;
					send_id?: string;
					send_status?: Database['abi_marketing']['Enums']['send_status'];
					sent_at?: string | null;
					subject?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'bulk_email_sends_campaign_id_fkey';
						columns: ['campaign_id'];
						isOneToOne: false;
						referencedRelation: 'email_campaigns';
						referencedColumns: ['campaign_id'];
					},
				];
			};
			email_campaigns: {
				Row: {
					campaign_description: string | null;
					campaign_id: string;
					campaign_name: string;
					campaign_status: string;
					campaign_type: string;
					completed_at: string | null;
					created_at: string;
					created_by: string | null;
					emails_failed: number | null;
					emails_sent: number | null;
					scheduled_at: string | null;
					started_at: string | null;
					target_audience: Json | null;
					template_id: string;
					template_variables: Json | null;
					total_recipients: number | null;
					updated_at: string;
				};
				Insert: {
					campaign_description?: string | null;
					campaign_id?: string;
					campaign_name: string;
					campaign_status?: string;
					campaign_type: string;
					completed_at?: string | null;
					created_at?: string;
					created_by?: string | null;
					emails_failed?: number | null;
					emails_sent?: number | null;
					scheduled_at?: string | null;
					started_at?: string | null;
					target_audience?: Json | null;
					template_id: string;
					template_variables?: Json | null;
					total_recipients?: number | null;
					updated_at?: string;
				};
				Update: {
					campaign_description?: string | null;
					campaign_id?: string;
					campaign_name?: string;
					campaign_status?: string;
					campaign_type?: string;
					completed_at?: string | null;
					created_at?: string;
					created_by?: string | null;
					emails_failed?: number | null;
					emails_sent?: number | null;
					scheduled_at?: string | null;
					started_at?: string | null;
					target_audience?: Json | null;
					template_id?: string;
					template_variables?: Json | null;
					total_recipients?: number | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'email_campaigns_template_id_fkey';
						columns: ['template_id'];
						isOneToOne: false;
						referencedRelation: 'email_templates';
						referencedColumns: ['template_id'];
					},
				];
			};
			email_templates: {
				Row: {
					available_variables: Json | null;
					created_at: string;
					created_by: string | null;
					email_type_id: string | null;
					html_template: string;
					is_active: boolean | null;
					metadata: Json | null;
					subject_template: string;
					template_description: string | null;
					template_id: string;
					template_name: string;
					template_variables: Json | null;
					updated_at: string;
					version: number;
				};
				Insert: {
					available_variables?: Json | null;
					created_at?: string;
					created_by?: string | null;
					email_type_id?: string | null;
					html_template: string;
					is_active?: boolean | null;
					metadata?: Json | null;
					subject_template: string;
					template_description?: string | null;
					template_id?: string;
					template_name: string;
					template_variables?: Json | null;
					updated_at?: string;
					version?: number;
				};
				Update: {
					available_variables?: Json | null;
					created_at?: string;
					created_by?: string | null;
					email_type_id?: string | null;
					html_template?: string;
					is_active?: boolean | null;
					metadata?: Json | null;
					subject_template?: string;
					template_description?: string | null;
					template_id?: string;
					template_name?: string;
					template_variables?: Json | null;
					updated_at?: string;
					version?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'email_templates_email_type_id_fkey';
						columns: ['email_type_id'];
						isOneToOne: false;
						referencedRelation: 'email_types';
						referencedColumns: ['type_id'];
					},
				];
			};
			email_types: {
				Row: {
					category: string;
					created_at: string;
					default_from_email: string;
					default_from_name: string;
					description: string | null;
					display_name: string;
					is_active: boolean;
					standard_variables: string[];
					type_id: string;
					type_name: string;
					updated_at: string;
				};
				Insert: {
					category: string;
					created_at?: string;
					default_from_email: string;
					default_from_name: string;
					description?: string | null;
					display_name: string;
					is_active?: boolean;
					standard_variables?: string[];
					type_id?: string;
					type_name: string;
					updated_at?: string;
				};
				Update: {
					category?: string;
					created_at?: string;
					default_from_email?: string;
					default_from_name?: string;
					description?: string | null;
					display_name?: string;
					is_active?: boolean;
					standard_variables?: string[];
					type_id?: string;
					type_name?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			transactional_email_sends: {
				Row: {
					created_at: string;
					email_type_id: string;
					error_code: string | null;
					error_message: string | null;
					failed_at: string | null;
					recipient_email: string;
					resend_email_id: string | null;
					send_id: string;
					send_status: Database['abi_marketing']['Enums']['send_status'];
					sent_at: string | null;
					subject: string;
					template_id: string;
					user_id: string | null;
				};
				Insert: {
					created_at?: string;
					email_type_id: string;
					error_code?: string | null;
					error_message?: string | null;
					failed_at?: string | null;
					recipient_email: string;
					resend_email_id?: string | null;
					send_id?: string;
					send_status?: Database['abi_marketing']['Enums']['send_status'];
					sent_at?: string | null;
					subject: string;
					template_id: string;
					user_id?: string | null;
				};
				Update: {
					created_at?: string;
					email_type_id?: string;
					error_code?: string | null;
					error_message?: string | null;
					failed_at?: string | null;
					recipient_email?: string;
					resend_email_id?: string | null;
					send_id?: string;
					send_status?: Database['abi_marketing']['Enums']['send_status'];
					sent_at?: string | null;
					subject?: string;
					template_id?: string;
					user_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'transactional_email_sends_email_type_id_fkey';
						columns: ['email_type_id'];
						isOneToOne: false;
						referencedRelation: 'email_types';
						referencedColumns: ['type_id'];
					},
					{
						foreignKeyName: 'transactional_email_sends_template_id_fkey';
						columns: ['template_id'];
						isOneToOne: false;
						referencedRelation: 'email_templates';
						referencedColumns: ['template_id'];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			get_all_active_templates: {
				Args: Record<PropertyKey, never>;
				Returns: {
					email_type_id: string;
					html_template: string;
					subject_template: string;
					template_id: string;
					template_name: string;
					template_variables: Json;
				}[];
			};
			get_campaign_recipients: {
				Args: { campaign_uuid: string };
				Returns: {
					email: string;
					name_first: string;
					name_last: string;
					preferences: Json;
					signup_date: string;
					user_id: string;
				}[];
			};
			get_email_template_data: {
				Args: { template_name_param: string };
				Returns: {
					category: string;
					default_from_email: string;
					default_from_name: string;
					email_type_id: string;
					html_template: string;
					standard_variables: string[];
					subject_template: string;
					template_id: string;
					template_name: string;
					template_variables: Json;
					type_name: string;
				}[];
			};
			render_email_template: {
				Args: { template_uuid: string; variables: Json };
				Returns: {
					html_content: string;
					subject: string;
				}[];
			};
			send_transactional_email: {
				Args: {
					p_template_name: string;
					p_to_email: string;
					p_user_id?: string;
					p_variables?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			send_status:
				| 'pending'
				| 'sent'
				| 'failed'
				| 'bounced'
				| 'spam'
				| 'delivered'
				| 'opened'
				| 'clicked';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	} ? keyof (
			& DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
			& DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views']
		)
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? (
		& DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		& DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views']
	)[TableName] extends {
		Row: infer R;
	} ? R
	: never
	: DefaultSchemaTableNameOrOptions extends keyof (
		& DefaultSchema['Tables']
		& DefaultSchema['Views']
	) ? (
			& DefaultSchema['Tables']
			& DefaultSchema['Views']
		)[DefaultSchemaTableNameOrOptions] extends {
			Row: infer R;
		} ? R
		: never
	: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
		Insert: infer I;
	} ? I
	: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
			Insert: infer I;
		} ? I
		: never
	: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
		Update: infer U;
	} ? U
	: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
			Update: infer U;
		} ? U
		: never
	: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema['Enums']
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
	: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
	: never;

export const Constants = {
	abi_api: {
		Enums: {},
	},
	abi_auth: {
		Enums: {},
	},
	abi_billing: {
		Enums: {
			billing_interval: ['monthly', 'yearly'],
			coupon_usage_status: ['pending', 'applied', 'expired', 'invalid'],
			discount_type: ['percentage', 'fixed_amount'],
			ledger_entry_type: [
				'token_purchase',
				'usage_batch',
				'purchase_expiry',
				'manual_adjustment',
				'refund',
			],
			product_type: ['plan', 'credits'],
			subscription_status: [
				'ACTIVE',
				'RENEWED',
				'CANCELED',
				'PENDING',
				'EXPIRED',
				'PENDING_PAYMENT',
			],
		},
	},
	abi_core: {
		Enums: {},
	},
	abi_llm: {
		Enums: {},
	},
	abi_marketing: {
		Enums: {
			send_status: [
				'pending',
				'sent',
				'failed',
				'bounced',
				'spam',
				'delivered',
				'opened',
				'clicked',
			],
		},
	},
	public: {
		Enums: {},
	},
} as const;

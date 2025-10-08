import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.ts';

// @ts-ignore any is type used by supabase client
export type SupabaseClientWithSchema<T extends string> = SupabaseClient<Database, T, any>;

export type SupabaseClientBilling = SupabaseClientWithSchema<'abi_billing'>;
export type SupabaseClientLlm = SupabaseClientWithSchema<'abi_llm'>;
export type SupabaseClientAuth = SupabaseClientWithSchema<'abi_auth'>;
export type SupabaseClientCore = SupabaseClientWithSchema<'abi_core'>;
export type SupabaseClientMarketing = SupabaseClientWithSchema<'abi_marketing'>;
export type SupabaseClientPublic = SupabaseClientWithSchema<'public'>;

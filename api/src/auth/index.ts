/**
 * BB API Authentication Module
 * 
 * Provides Supabase authentication integration using Deno's Storage API
 */

export { SessionManager } from "./session.ts";
export { validateSupabaseConfig, fetchSupabaseConfig } from "./config.ts";

// Re-export types
export type { SupabaseConfig, Session, ConfigFetchError, SessionError } from "../types/auth.ts";
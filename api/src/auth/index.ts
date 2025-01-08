/**
 * BB API Authentication Module
 *
 * Provides Supabase authentication integration using Deno's Storage API
 */

export { SessionManager } from './session.ts';
export { fetchSupabaseConfig, validateSupabaseConfig } from './config.ts';

// Re-export types
export type { ConfigFetchError, Session, SessionError, SupabaseConfig } from '../types/auth.ts';

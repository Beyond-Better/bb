/**
 * BB API Authentication Module
 *
 * Provides Supabase authentication integration using Deno's Storage API
 */

export { UserAuthSession } from './userAuthSession.ts';
export { fetchSupabaseConfig, validateSupabaseConfig } from './config.ts';

// Re-export types
export type { ConfigFetchError, Session, SessionError, SupabaseConfig } from 'api/types/auth.ts';

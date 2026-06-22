import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client constructed with the service-role key.
 *
 * SECURITY: This module MUST NOT be imported from any client/React code. The
 * service-role key bypasses Row Level Security and grants full read/write access
 * to the database. It is only safe inside the trusted Vercel serverless boundary.
 *
 * Environment variables (server-only, never `VITE_`-prefixed so they are never
 * exposed to the client bundle):
 *   - SUPABASE_URL              : the project URL (e.g. https://xxxx.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY : the service-role secret key
 *
 * Design refs: "Server→DB access — Supabase service-role key (server-only env var)"
 * and "RLS Strategy" (Requirements 5.3, 5.8, 10.1).
 */

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // Fail loudly at module load so a misconfigured deployment is obvious rather
  // than silently producing unauthenticated/anon requests.
  throw new Error(
    'Missing server Supabase configuration: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

/**
 * Authoritative, service-role Supabase client for use by serverless functions.
 * Auth session persistence is disabled because each serverless invocation is
 * stateless and never represents an end-user session.
 */
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

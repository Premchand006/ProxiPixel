/**
 * Public Supabase config. Only the URL + anon key reach the browser; the
 * service-role key is server-only and never imported here.
 *
 * Safe fallbacks keep `next build` working without a configured project (the
 * client is only actually used at runtime). `isSupabaseConfigured` lets the UI
 * detect a missing setup and degrade gracefully.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key";

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

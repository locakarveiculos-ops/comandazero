"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente do navegador (chave anon + RLS). Fase 2: os repositórios passam a usar este cliente.
let client: SupabaseClient | null = null;

export const supabaseConfigured = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function getSupabase() {
  if (!supabaseConfigured()) return null;
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

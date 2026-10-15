// ============================================
// OpenNotebook AI - Supabase Client
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ============================================
// Auth Helpers
// ============================================

export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ============================================
// Database Types
// ============================================

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseNotebook {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSource {
  id: string;
  notebook_id: string;
  name: string;
  type: string;
  content: string;
  chunks: any[];
  status: string;
  metadata: any;
  enabled: boolean;
  tags: string[];
  created_at: string;
  processed_at?: string;
}

export interface DatabaseConversation {
  id: string;
  notebook_id: string;
  title: string;
  messages: any[];
  model?: string;
  provider?: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseNote {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  source_ids: string[];
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAIProvider {
  id: string;
  user_id: string;
  provider_id: string;
  name: string;
  icon: string;
  base_url: string;
  api_key_encrypted: string;
  status: string;
  models: any[];
  last_validated?: string;
  created_at: string;
}

export interface DatabaseUserSettings {
  id: string;
  user_id: string;
  theme: string;
  default_provider?: string;
  default_model?: string;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

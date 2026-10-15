// ============================================
// OpenNotebook AI - Supabase Services
// ============================================

import { supabase } from './supabase';
import type {
  DatabaseNotebook,
  DatabaseSource,
  DatabaseConversation,
  DatabaseNote,
  DatabaseAIProvider,
  DatabaseUserSettings,
} from './supabase';

// ============================================
// Notebooks
// ============================================

export async function getNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as DatabaseNotebook[];
}

export async function getNotebook(id: string) {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as DatabaseNotebook;
}

export async function createNotebook(notebook: Partial<DatabaseNotebook>) {
  const { data, error } = await supabase
    .from('notebooks')
    .insert([notebook])
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseNotebook;
}

export async function updateNotebook(id: string, updates: Partial<DatabaseNotebook>) {
  const { data, error } = await supabase
    .from('notebooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseNotebook;
}

export async function deleteNotebook(id: string) {
  const { error } = await supabase
    .from('notebooks')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================
// Sources
// ============================================

export async function getSources(notebookId: string) {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as DatabaseSource[];
}

export async function createSource(source: Partial<DatabaseSource>) {
  const { data, error } = await supabase
    .from('sources')
    .insert([source])
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseSource;
}

export async function updateSource(id: string, updates: Partial<DatabaseSource>) {
  const { data, error } = await supabase
    .from('sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseSource;
}

export async function deleteSource(id: string) {
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================
// Conversations
// ============================================

export async function getConversations(notebookId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as DatabaseConversation[];
}

export async function createConversation(conversation: Partial<DatabaseConversation>) {
  const { data, error } = await supabase
    .from('conversations')
    .insert([conversation])
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseConversation;
}

export async function updateConversation(id: string, updates: Partial<DatabaseConversation>) {
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseConversation;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================
// Notes
// ============================================

export async function getNotes(notebookId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as DatabaseNote[];
}

export async function createNote(note: Partial<DatabaseNote>) {
  const { data, error } = await supabase
    .from('notes')
    .insert([note])
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseNote;
}

export async function updateNote(id: string, updates: Partial<DatabaseNote>) {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseNote;
}

export async function deleteNote(id: string) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================
// AI Providers
// ============================================

export async function getAIProviders() {
  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as DatabaseAIProvider[];
}

export async function createAIProvider(provider: Partial<DatabaseAIProvider>) {
  const { data, error } = await supabase
    .from('ai_providers')
    .insert([provider])
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseAIProvider;
}

export async function updateAIProvider(id: string, updates: Partial<DatabaseAIProvider>) {
  const { data, error } = await supabase
    .from('ai_providers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseAIProvider;
}

export async function deleteAIProvider(id: string) {
  const { error } = await supabase
    .from('ai_providers')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================
// User Settings
// ============================================

export async function getUserSettings() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data as DatabaseUserSettings | null;
}

export async function updateUserSettings(updates: Partial<DatabaseUserSettings>) {
  const { data, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .select()
    .single();
  
  if (error) throw error;
  return data as DatabaseUserSettings;
}

// ============================================
// Realtime Subscriptions
// ============================================

export function subscribeToNotebooks(userId: string, callback: (payload: any) => void) {
  return supabase
    .channel('notebooks-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'notebooks', filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
}

export function subscribeToNotebook(notebookId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`notebook-${notebookId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'sources', filter: `notebook_id=eq.${notebookId}` },
      callback
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'conversations', filter: `notebook_id=eq.${notebookId}` },
      callback
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'notes', filter: `notebook_id=eq.${notebookId}` },
      callback
    )
    .subscribe();
}

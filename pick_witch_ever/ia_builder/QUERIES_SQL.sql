-- ============================================
-- OPENNOTEBOOK AI - QUERIES SQL PARA SUPABASE
-- ============================================
-- Execute estas queries na ordem indicada no SQL Editor do Supabase
-- ============================================

-- ============================================
-- PARTE 1: CRIAR TABELAS
-- ============================================

-- 1.1 Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 Tabela de notebooks
CREATE TABLE IF NOT EXISTS public.notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📚',
  color TEXT DEFAULT '#7c3aed',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.3 Tabela de fontes (sources)
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'txt', 'md', 'url', 'youtube', 'audio', 'pasted', 'rss')),
  content TEXT NOT NULL,
  chunks JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  meta JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 1.4 Tabela de conversas
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Nova Conversa',
  messages JSONB DEFAULT '[]',
  model TEXT,
  provider TEXT,
  mode TEXT DEFAULT 'sources' CHECK (mode IN ('sources', 'creative', 'hybrid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.5 Tabela de notas
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_ids TEXT[] DEFAULT '{}',
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.6 Tabela de provedores de IA (chaves de API)
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  status TEXT DEFAULT 'configured' CHECK (status IN ('configured', 'unconfigured', 'error')),
  models JSONB DEFAULT '[]',
  last_validated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider_id)
);

-- 1.7 Tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  default_provider TEXT,
  default_model TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PARTE 2: CRIAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_notebook_id ON public.sources(notebook_id);
CREATE INDEX IF NOT EXISTS idx_conversations_notebook_id ON public.conversations(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON public.notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON public.ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- ============================================
-- PARTE 3: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 4: CRIAR POLICIES DE SEGURANÇA
-- ============================================

-- 4.1 Policies para profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4.2 Policies para notebooks
DROP POLICY IF EXISTS "Users can view own notebooks" ON public.notebooks;
CREATE POLICY "Users can view own notebooks" ON public.notebooks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own notebooks" ON public.notebooks;
CREATE POLICY "Users can create own notebooks" ON public.notebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notebooks" ON public.notebooks;
CREATE POLICY "Users can update own notebooks" ON public.notebooks
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notebooks" ON public.notebooks;
CREATE POLICY "Users can delete own notebooks" ON public.notebooks
  FOR DELETE USING (auth.uid() = user_id);

-- 4.3 Policies para sources (via notebook)
DROP POLICY IF EXISTS "Users can view sources of own notebooks" ON public.sources;
CREATE POLICY "Users can view sources of own notebooks" ON public.sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = sources.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create sources in own notebooks" ON public.sources;
CREATE POLICY "Users can create sources in own notebooks" ON public.sources
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = sources.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update sources in own notebooks" ON public.sources;
CREATE POLICY "Users can update sources in own notebooks" ON public.sources
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = sources.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete sources in own notebooks" ON public.sources;
CREATE POLICY "Users can delete sources in own notebooks" ON public.sources
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = sources.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

-- 4.4 Policies para conversations (via notebook)
DROP POLICY IF EXISTS "Users can view conversations of own notebooks" ON public.conversations;
CREATE POLICY "Users can view conversations of own notebooks" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = conversations.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create conversations in own notebooks" ON public.conversations;
CREATE POLICY "Users can create conversations in own notebooks" ON public.conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = conversations.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update conversations in own notebooks" ON public.conversations;
CREATE POLICY "Users can update conversations in own notebooks" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = conversations.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete conversations in own notebooks" ON public.conversations;
CREATE POLICY "Users can delete conversations in own notebooks" ON public.conversations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = conversations.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

-- 4.5 Policies para notes (via notebook)
DROP POLICY IF EXISTS "Users can view notes of own notebooks" ON public.notes;
CREATE POLICY "Users can view notes of own notebooks" ON public.notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = notes.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create notes in own notebooks" ON public.notes;
CREATE POLICY "Users can create notes in own notebooks" ON public.notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = notes.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update notes in own notebooks" ON public.notes;
CREATE POLICY "Users can update notes in own notebooks" ON public.notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = notes.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete notes in own notebooks" ON public.notes;
CREATE POLICY "Users can delete notes in own notebooks" ON public.notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.notebooks
      WHERE notebooks.id = notes.notebook_id
      AND notebooks.user_id = auth.uid()
    )
  );

-- 4.6 Policies para ai_providers
DROP POLICY IF EXISTS "Users can view own providers" ON public.ai_providers;
CREATE POLICY "Users can view own providers" ON public.ai_providers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own providers" ON public.ai_providers;
CREATE POLICY "Users can create own providers" ON public.ai_providers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own providers" ON public.ai_providers;
CREATE POLICY "Users can update own providers" ON public.ai_providers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own providers" ON public.ai_providers;
CREATE POLICY "Users can delete own providers" ON public.ai_providers
  FOR DELETE USING (auth.uid() = user_id);

-- 4.7 Policies para user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own settings" ON public.user_settings;
CREATE POLICY "Users can create own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- PARTE 5: CRIAR FUNCTIONS E TRIGGERS
-- ============================================

-- 5.1 Function para criar profile automaticamente quando um novo usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Criar settings padrão para o novo usuário
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 Trigger para criar profile automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.3 Function para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.4 Triggers para updated_at
DROP TRIGGER IF EXISTS update_notebooks_updated_at ON public.notebooks;
CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON public.notebooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PARTE 6: CRIAR STORAGE BUCKET (OPCIONAL)
-- ============================================

-- Criar bucket para arquivos de fontes
INSERT INTO storage.buckets (id, name, public)
VALUES ('source-files', 'source-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- QUERIES AUXILIARES (OPCIONAIS)
-- ============================================

-- Ver todas as tabelas criadas
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Ver todas as policies
-- SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Ver todos os triggers
-- SELECT * FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relname IN ('notebooks', 'conversations', 'notes', 'profiles', 'user_settings'));

-- Contar registros em cada tabela
-- SELECT 
--   (SELECT COUNT(*) FROM notebooks) as notebooks_count,
--   (SELECT COUNT(*) FROM sources) as sources_count,
--   (SELECT COUNT(*) FROM conversations) as conversations_count,
--   (SELECT COUNT(*) FROM notes) as notes_count,
--   (SELECT COUNT(*) FROM ai_providers) as providers_count;

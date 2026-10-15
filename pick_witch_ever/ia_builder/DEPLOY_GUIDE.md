# Guia de Deploy - OpenNotebook AI no Netlify

## 🚀 Deploy Rápido no Netlify

### Opção 1: Via GitHub (Recomendado)

1. **Faça push para o GitHub**:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/opennotebook-ai.git
git push -u origin main
```

2. **Conecte ao Netlify**:
- Acesse https://app.netlify.com
- Clique em "Add new site" → "Import an existing project"
- Selecione seu repositório GitHub
- Configure:
  - **Build command**: `npm run build`
  - **Publish directory**: `dist`
- Clique em "Deploy site"

3. **Pronto!** Seu site estará em `https://seu-site.netlify.app`

### Opção 2: Drag & Drop

1. Execute `npm run build` localmente
2. Arraste a pasta `dist/` para https://app.netlify.com/drop

---

## 💾 Persistência de Dados

### Situação Atual: localStorage (Local)

O sistema atual usa **localStorage** que tem estas características:

| Aspecto | Comportamento |
|---------|---------------|
| Onde ficam | No navegador do usuário |
| Sincronização | ❌ Não sincroniza entre dispositivos |
| Backup | ⚠️ Manual (export/import) |
| Limite | ~5-10 MB |
| Custo | Grátis |

**Problemas**:
- Se o usuário limpar o cache, perde tudo
- Dados não aparecem em outro dispositivo/navegador
- Não há backup automático

### Solução Implementada: Export/Import Manual

Adicionei na tela de **Configurações → Gerenciamento de Dados**:

1. **Exportar Backup**: Baixa um arquivo JSON com todos os dados
2. **Importar Backup**: Restaura de um arquivo JSON
3. **Apagar Dados**: Limpa tudo (com confirmação)

**Como usar**:
1. Vá em Configurações
2. Role até "Gerenciamento de Dados"
3. Clique em "Exportar Backup" regularmente
4. Guarde o arquivo em local seguro

---

## 🔥 Opções para Persistência Real (Cloud)

Se você quer que os dados sincronizem entre dispositivos, aqui estão as opções:

### Opção A: Supabase (Recomendado - Grátis até 500MB)

**Vantagens**:
- PostgreSQL gratuito (500MB)
- Autenticação pronta
- Realtime sync
- API REST automática

**Como implementar**:

1. Crie conta em https://supabase.com
2. Crie um projeto
3. Execute o SQL para criar as tabelas:

```sql
-- Tabela de usuários (já existe no Supabase Auth)

-- Tabela de notebooks
CREATE TABLE notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de fontes
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  content TEXT,
  chunks JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Tabela de conversas
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB DEFAULT '[]',
  model TEXT,
  provider TEXT,
  mode TEXT DEFAULT 'sources',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de notas
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID REFERENCES notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  source_ids TEXT[] DEFAULT '{}',
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de API keys (criptografadas)
CREATE TABLE user_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  status TEXT DEFAULT 'configured',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider_id)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_providers ENABLE ROW LEVEL SECURITY;

-- Policies: cada usuário só vê seus dados
CREATE POLICY "Users can view own notebooks" ON notebooks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notebooks" ON notebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebooks" ON notebooks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notebooks" ON notebooks
  FOR DELETE USING (auth.uid() = user_id);

-- Repita para sources, conversations, notes via notebook_id
-- Repita para user_providers via user_id
```

4. Instale o client:
```bash
npm install @supabase/supabase-js
```

5. Crie `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

6. Adicione no `.env`:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

7. Modifique o `useStore.ts` para usar Supabase em vez de localStorage.

### Opção B: Firebase (Google)

**Vantagens**:
- Firestore (NoSQL) gratuito até 1GB
- Auth fácil (Google, GitHub, etc)
- Hosting gratuito
- Realtime sync

**Como implementar**:

1. Crie projeto em https://console.firebase.google.com
2. Ative Authentication e Firestore
3. Instale:
```bash
npm install firebase
```

4. Crie `src/lib/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### Opção C: Backend Próprio (Node.js + PostgreSQL)

**Vantagens**:
- Controle total
- Sem limites de provedor
- Pode hospedar no Railway, Render, etc

**Estrutura básica**:
```
backend/
├── src/
│   ├── routes/
│   │   ├── notebooks.ts
│   │   ├── sources.ts
│   │   ├── conversations.ts
│   │   └── auth.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── db/
│   │   └── schema.sql
│   └── index.ts
├── package.json
└── .env
```

**Deploy**:
- Backend: Railway, Render, Fly.io
- Frontend: Netlify, Vercel
- Banco: Supabase, Neon, PlanetScale

---

## 📋 Checklist de Deploy

### Antes de Deployar

- [ ] Execute `npm run build` localmente para testar
- [ ] Verifique se não há erros no console
- [ ] Teste todas as funcionalidades principais
- [ ] Configure as variáveis de ambiente (se usar Supabase/Firebase)

### No Netlify

- [ ] Conecte o repositório GitHub
- [ ] Configure build command: `npm run build`
- [ ] Configure publish directory: `dist`
- [ ] Adicione variáveis de ambiente em Site settings → Environment variables
- [ ] Configure custom domain (opcional)
- [ ] Habilite HTTPS (automático no Netlify)

### Pós-Deploy

- [ ] Teste o fluxo completo no site publicado
- [ ] Configure backups automáticos (se usar localStorage)
- [ ] Monitore erros (adicione Sentry, por exemplo)
- [ ] Configure analytics (Plausible, Umami, etc)

---

## 🔐 Segurança no Deploy

### Variáveis de Ambiente no Netlify

1. Vá em Site settings → Environment variables
2. Adicione:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

**IMPORTANTE**: 
- ✅ Use prefixo `VITE_` para variáveis do frontend
- ❌ NUNCA coloque API keys de IA aqui (elas são do usuário)
- ✅ API keys de IA ficam no localStorage do usuário

### CORS e Headers

Crie `netlify.toml` na raiz:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.groq.com https://api.mistral.ai https://openrouter.ai http://localhost:11434"
```

---

## 📊 Comparação de Opções

| Solução | Custo | Complexidade | Sync | Backup | Recomendação |
|---------|-------|--------------|------|--------|--------------|
| **localStorage** | Grátis | Já implementado ✅ | ❌ | Manual | Demo/MVP |
| **Supabase** | Grátis até 500MB | Média | ✅ | Automático | Produção |
| **Firebase** | Grátis até 1GB | Média | ✅ | Automático | Produção |
| **Backend próprio** | $5-20/mês | Alta | ✅ | Automático | Enterprise |

---

## 🎯 Recomendação

### Para Agora (Deploy Rápido)
Use **localStorage + Export/Import** (já implementado):
1. Deploy no Netlify
2. Instrua usuários a fazer backup regular
3. Adicione aviso sobre limitações

### Para o Futuro (Produção)
Migre para **Supabase**:
1. Crie conta gratuita
2. Implemente auth (login com Google/GitHub)
3. Migre dados para PostgreSQL
4. Adicione sync em tempo real

---

## 🆘 Problemas Comuns no Deploy

### 1. API de IA não funciona (CORS)
**Solução**: Os provedores de IA já permitem chamadas do browser. Se não funcionar, crie um proxy no Netlify:

```toml
# netlify.toml
[[redirects]]
  from = "/api/openai/*"
  to = "https://api.openai.com/v1/:splat"
  status = 200
  force = true
```

### 2. Variáveis de ambiente não carregam
**Solução**: 
- Use prefixo `VITE_` para variáveis do frontend
- Faça redeploy após adicionar variáveis
- Verifique em DevTools → Console se `import.meta.env.VITE_XXX` existe

### 3. Build falha no Netlify
**Solução**:
- Teste `npm run build` localmente primeiro
- Verifique se todas as dependências estão no `package.json`
- Confira a versão do Node (Netlify usa 18+ por padrão)

### 4. Dados somem ao recarregar
**Solução**: 
- Isso é esperado com localStorage
- Implemente Supabase/Firebase para persistência real
- Ou use Export/Import para backup manual

---

## 📚 Recursos Úteis

- [Netlify Docs](https://docs.netlify.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Vite Deploy Guide](https://vitejs.dev/guide/static-deploy.html)

---

**Precisa de ajuda para implementar Supabase ou Firebase?** Me avise que eu implemento a integração completa! 🚀

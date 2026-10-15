# 🚀 Guia Rápido: Configurar Supabase para OpenNotebook AI

## ⚠️ IMPORTANTE: Verifique suas Credenciais

A chave que você forneceu (`sb_publishable_u28nlCIdc1YGzja9_BmI6Q_fab5gXWv`) parece incompleta. As chaves `anon` do Supabase são JWTs longos que começam com `eyJ...` e têm centenas de caracteres.

### Como obter as credenciais corretas:

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard/)
2. Vá em **Settings** (ícone de engrenagem no menu lateral)
3. Clique em **API**
4. Copie:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT longo)

---

## 📝 Passo 1: Executar as Queries SQL

### Opção A: Usar o arquivo completo (Recomendado)

1. Abra o arquivo `QUERIES_SQL.sql` no seu editor
2. Copie **TODO** o conteúdo
3. No Supabase Dashboard, vá em **SQL Editor**
4. Clique em **New Query**
5. Cole o conteúdo
6. Clique em **Run** (ou Ctrl+Enter)

### Opção B: Executar por partes

Se preferir executar por partes, siga esta ordem:

#### Parte 1: Criar Tabelas
```sql
-- Execute o bloco "PARTE 1: CRIAR TABELAS" do arquivo QUERIES_SQL.sql
```

#### Parte 2: Criar Índices
```sql
-- Execute o bloco "PARTE 2: CRIAR ÍNDICES"
```

#### Parte 3: Habilitar RLS
```sql
-- Execute o bloco "PARTE 3: HABILITAR ROW LEVEL SECURITY"
```

#### Parte 4: Criar Policies
```sql
-- Execute o bloco "PARTE 4: CRIAR POLICIES DE SEGURANÇA"
```

#### Parte 5: Criar Functions e Triggers
```sql
-- Execute o bloco "PARTE 5: CRIAR FUNCTIONS E TRIGGERS"
```

#### Parte 6: Criar Storage (Opcional)
```sql
-- Execute o bloco "PARTE 6: CRIAR STORAGE BUCKET"
```

---

## 🔑 Passo 2: Configurar Variáveis de Ambiente

1. Abra o arquivo `.env` na raiz do projeto
2. Substitua com suas credenciais reais:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE**: 
- Use a chave `anon public`, NÃO a `service_role`
- A chave `anon` é segura para usar no frontend
- A chave `service_role` tem acesso total e deve ser mantida em segredo

---

## 🧪 Passo 3: Testar a Conexão

1. Reinicie o servidor de desenvolvimento:
```bash
npm run dev
```

2. Acesse o app no navegador
3. Você deve ver a tela de login
4. Tente criar uma conta:
   - Email: seu@email.com
   - Senha: minimo 6 caracteres
   - Nome: Seu Nome

5. Se tudo funcionar, você será redirecionado para o dashboard!

---

## ✅ Verificar se Tudo foi Criado

Execute estas queries no SQL Editor para verificar:

```sql
-- Ver todas as tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Deve retornar:
-- ai_providers
-- conversations
-- notes
-- notebooks
-- profiles
-- sources
-- user_settings

-- Ver todas as policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Deve retornar várias policies para cada tabela
```

---

## 🐛 Troubleshooting

### Erro: "relation already exists"
As tabelas já existem. Você pode:
- Ignorar o erro (usamos `IF NOT EXISTS`)
- Ou dropar as tabelas e recriar:
```sql
DROP TABLE IF EXISTS public.user_settings;
DROP TABLE IF EXISTS public.ai_providers;
DROP TABLE IF EXISTS public.notes;
DROP TABLE IF EXISTS public.conversations;
DROP TABLE IF EXISTS public.sources;
DROP TABLE IF EXISTS public.notebooks;
DROP TABLE IF EXISTS public.profiles;
```

### Erro: "permission denied"
Verifique se você está executando as queries com permissões adequadas. No Supabase, use o SQL Editor com sua conta de administrador.

### Erro: "invalid API key"
- Verifique se copiou a chave `anon public` completa
- Verifique se não há espaços extras
- Reinicie o servidor após alterar o `.env`

### Erro: "new row violates row-level security policy"
As policies não foram criadas corretamente. Execute novamente o bloco "PARTE 4: CRIAR POLICIES DE SEGURANÇA".

---

## 📚 Próximos Passos

Após configurar o Supabase com sucesso:

1. **Integrar autenticação no App.tsx**
   - Ver `IMPLEMENTATION_GUIDE.md` - Passo 2

2. **Migrar store para Supabase**
   - Ver `IMPLEMENTATION_GUIDE.md` - Passo 3

3. **Implementar Realtime Sync**
   - Ver `IMPLEMENTATION_GUIDE.md` - Passo 4

4. **Migrar gerenciamento de chaves**
   - Ver `IMPLEMENTATION_GUIDE.md` - Passo 5

---

## 🆘 Precisa de Ajuda?

- Documentação completa: `SUPABASE_SETUP.md`
- Análise do sistema: `SYSTEM_ANALYSIS.md`
- Guia de implementação: `IMPLEMENTATION_GUIDE.md`
- Queries SQL: `QUERIES_SQL.sql`

---

**Boa sorte! 🚀**

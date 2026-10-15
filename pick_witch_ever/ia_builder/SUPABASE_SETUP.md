# 🚀 Guia de Configuração do Supabase

Este guia vai te ajudar a configurar o Supabase para o OpenNotebook AI.

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com) (grátis)
- Projeto criado no Supabase
- Variáveis de ambiente configuradas

---

## 🔧 Passo 1: Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha os dados:
   - **Name**: OpenNotebook AI
   - **Database Password**: (guarde esta senha!)
   - **Region**: Escolha a mais próxima (ex: South America - São Paulo)
5. Clique em **"Create new project"**
6. Aguarde o projeto ser criado (1-2 minutos)

---

## 🗄️ Passo 2: Executar Schema SQL

1. No painel do Supabase, clique em **"SQL Editor"** (ícone no menu lateral)
2. Clique em **"New query"**
3. Copie todo o conteúdo do arquivo `supabase/schema.sql`
4. Cole no editor SQL
5. Clique em **"Run"** (ou Ctrl+Enter)
6. Aguarde a execução (deve aparecer "Success")

### O que foi criado:

✅ **Tabelas:**
- `profiles` - Perfis de usuário
- `notebooks` - Notebooks de pesquisa
- `sources` - Fontes de conhecimento
- `conversations` - Conversas de chat
- `notes` - Notas pessoais
- `ai_providers` - Provedores de IA (chaves)
- `user_settings` - Configurações do usuário

✅ **Segurança:**
- Row Level Security (RLS) habilitado
- Policies para cada tabela
- Usuários só acessam seus próprios dados

✅ **Automação:**
- Trigger para criar profile automaticamente
- Trigger para atualizar `updated_at`
- Storage bucket para arquivos

---

## 🔑 Passo 3: Obter Credenciais

1. No painel do Supabase, clique em **"Settings"** (ícone de engrenagem)
2. Clique em **"API"** no menu lateral
3. Copie as seguintes informações:

### Project URL
```
https://xxxxx.supabase.co
```

### anon public key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE:** 
- Use a chave `anon public`, NÃO a `service_role`
- A chave `anon` é segura para usar no frontend
- A chave `service_role` tem acesso total e deve ser mantida em segredo

---

## 📝 Passo 4: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Substitua os valores** pelas suas credenciais reais!

### Adicionar ao .gitignore

Certifique-se de que o arquivo `.env` está no `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production.local
```

---

## 🧪 Passo 5: Testar Conexão

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

## 🔐 Passo 6: Configurar Autenticação (Opcional)

### Habilitar Email Confirmation (Recomendado)

1. No Supabase, vá em **Authentication** → **Providers**
2. Clique em **"Email"**
3. Habilite **"Enable Email provider"**
4. Configure:
   - **Confirm email**: ON (recomendado)
   - **Email templates**: Personalize se quiser

### Habilitar OAuth (Google, GitHub, etc)

1. Vá em **Authentication** → **Providers**
2. Clique no provider desejado (ex: Google)
3. Siga as instruções para configurar OAuth
4. Adicione as credenciais (Client ID, Client Secret)

---

## 💾 Passo 7: Configurar Storage (Opcional)

Se quiser fazer upload de arquivos (PDFs, imagens):

1. Vá em **Storage** no menu lateral
2. O bucket `source-files` já foi criado pelo schema SQL
3. Configure as permissões se necessário

---

## 📊 Passo 8: Monitorar Uso

### Dashboard do Supabase

1. Vá em **Reports** no menu lateral
2. Veja métricas de:
   - API requests
   - Database connections
   - Auth events
   - Storage usage

### Limites do Plano Gratuito

- **Database**: 500 MB
- **Storage**: 1 GB
- **Bandwidth**: 2 GB
- **Auth**: 50,000 MAUs (Monthly Active Users)
- **Edge Functions**: 500,000 invocations/month

Para a maioria dos casos de uso pessoal, o plano gratuito é mais que suficiente!

---

## 🔄 Passo 9: Migração de Dados (Opcional)

Se você já tem dados no localStorage e quer migrar para o Supabase:

1. Exporte seus dados no app (Configurações → Exportar)
2. Faça login no app com Supabase configurado
3. Importe os dados (Configurações → Importar)

⚠️ **Atenção:** Os dados serão salvos no Supabase e sincronizados!

---

## 🛠️ Troubleshooting

### Erro: "Failed to fetch"

**Causa:** URL do Supabase incorreta ou projeto não criado

**Solução:**
1. Verifique se o projeto existe no Supabase
2. Confirme a URL em Settings → API
3. Reinicie o servidor

### Erro: "Invalid API key"

**Causa:** Chave anon incorreta

**Solução:**
1. Copie a chave `anon public` (NÃO `service_role`)
2. Atualize o arquivo `.env`
3. Reinicie o servidor

### Erro: "new row violates row-level security policy"

**Causa:** Políticas RLS não foram criadas

**Solução:**
1. Execute o schema SQL novamente
2. Verifique se todas as policies foram criadas em:
   - Authentication → Policies

### Erro: "User not found"

**Causa:** Usuário não foi criado ou email não confirmado

**Solução:**
1. Verifique em Authentication → Users
2. Se email confirmation está ON, confirme o email
3. Ou desative email confirmation para testes

---

## 🚀 Deploy no Netlify

### Adicionar Variáveis de Ambiente no Netlify

1. Acesse seu site no Netlify
2. Vá em **Site settings** → **Environment variables**
3. Adicione:
   - `VITE_SUPABASE_URL` = sua URL
   - `VITE_SUPABASE_ANON_KEY` = sua chave anon
4. Faça redeploy

### Configurar Redirects

Crie o arquivo `netlify.toml` (já existe no projeto):

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Isso garante que o SPA funcione corretamente.

---

## 📚 Recursos Úteis

- [Documentação Supabase](https://supabase.com/docs)
- [Guia de Autenticação](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [JavaScript Client](https://supabase.com/docs/reference/javascript)

---

## ✅ Checklist Final

- [ ] Projeto criado no Supabase
- [ ] Schema SQL executado com sucesso
- [ ] Credenciais copiadas (URL + anon key)
- [ ] Arquivo `.env` criado com as credenciais
- [ ] Servidor reiniciado
- [ ] Teste de login/registro funcionando
- [ ] Dados sendo salvos no Supabase
- [ ] (Opcional) Email confirmation configurado
- [ ] (Opcional) OAuth configurado
- [ ] (Opcional) Storage configurado

---

## 🎉 Pronto!

Seu OpenNotebook AI agora está integrado com Supabase!

### O que você tem agora:

✅ **Autenticação completa** (email/senha)
✅ **Persistência real** (PostgreSQL)
✅ **Segurança** (RLS + criptografia)
✅ **Sincronização** (realtime)
✅ **Multi-dispositivo** (acesse de qualquer lugar)
✅ **Backup automático** (Supabase cuida disso)

### Próximos passos:

1. Teste todas as funcionalidades
2. Configure OAuth se quiser login social
3. Personalize templates de email
4. Monitore uso no dashboard
5. Faça deploy no Netlify/Vercel

---

**Precisa de ajuda?** Abra uma issue no GitHub ou consulte a documentação do Supabase!

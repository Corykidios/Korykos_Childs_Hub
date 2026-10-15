# 🔑 Configurar Credenciais do Supabase

## ⚠️ ATENÇÃO: Chave Incompleta

A chave que você forneceu (`sb_publishable_u28nlCIdc1YGzja9_BmI6Q_fab5gXWv`) parece incompleta.

### Como obter as credenciais CORRETAS:

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard/)
2. Selecione seu projeto
3. No menu lateral, clique em **Settings** (ícone de engrenagem ⚙️)
4. Clique em **API**
5. Você verá duas seções:

#### Project URL
```
https://xxxxx.supabase.co
```
Copie esta URL completa.

#### Project API keys
Você verá duas chaves:
- **anon public** ← Use ESTA (começa com `eyJ...` e é longa)
- **service_role** ← NÃO use esta (é secreta)

A chave `anon public` deve ser algo como:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InUyOG5sY2lkYzF5Z3pqYTlibWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.XXXXX...
```

### Atualize o arquivo `.env`:

```env
VITE_SUPABASE_URL=https://u28nlcidc1ygzja9bmib.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (chave completa)
```

---

## 📝 Passo a Passo com Imagens (Mental)

```
┌─────────────────────────────────────┐
│  Supabase Dashboard                 │
│  ┌────────────────────────────┐    │
│  │ Settings ⚙️                │    │
│  │   └─ API                   │    │
│  │       ├─ Project URL       │    │
│  │       │  https://xxx...    │ ← Copie aqui
│  │       │                    │    │
│  │       └─ Project API keys  │    │
│  │          anon public       │    │
│  │          eyJhbGci...       │ ← Copie ESTA
│  │          (chave longa)     │    │
│  │                            │    │
│  │          service_role      │    │
│  │          (NÃO use esta)    │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## ✅ Checklist

- [ ] Acessou o Supabase Dashboard
- [ ] Foi em Settings > API
- [ ] Copiou o Project URL
- [ ] Copiou a chave anon public (JWT longo)
- [ ] Atualizou o arquivo `.env`
- [ ] Reiniciou o servidor (`npm run dev`)

---

## 🆘 Ainda com Problemas?

Se a chave que você forneceu é realmente a correta (algumas versões antigas do Supabase usavam chaves mais curtas), tente:

1. Verificar se o projeto existe
2. Verificar se a chave não expirou
3. Gerar uma nova chave em Settings > API

Se nada funcionar, crie um novo projeto no Supabase e use as novas credenciais.

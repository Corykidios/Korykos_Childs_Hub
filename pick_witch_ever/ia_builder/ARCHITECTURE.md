# Documentação de Arquitetura - OpenNotebook AI

## Visão Geral

O OpenNotebook AI é um sistema de pesquisa inteligente baseado em documentos pessoais, inspirado no NotebookLM do Google, mas com suporte a múltiplos provedores de IA através de uma camada de abstração unificada.

## Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │   Notebook   │  │  Settings    │      │
│  │              │  │     View     │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │                                  │
│                    ┌───────▼────────┐                        │
│                    │  Zustand Store │                        │
│                    │  (State Mgmt)  │                        │
│                    └───────┬────────┘                        │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼──────┐  ┌───────▼───────┐  ┌──────▼──────┐      │
│  │ AI Adapter  │  │ RAG Pipeline  │  │   Crypto    │      │
│  │  (Multi-    │  │  (Chunking,   │  │   (Keys)    │      │
│  │  Provider)  │  │  Embedding,   │  │             │      │
│  │             │  │  Search)      │  │             │      │
│  └──────┬──────┘  └───────────────┘  └─────────────┘      │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ HTTPS (API Calls)
          │
    ┌─────▼──────────────────────────────────────────────┐
    │              AI PROVIDERS (External)                 │
    ├──────────────────────────────────────────────────────┤
    │  • OpenAI (GPT-6, GPT-5.6)                          │
    │  • Anthropic (Claude Opus 5, Sonnet 5)              │
    │  • Google (Gemini 2.5/3.x)                          │
    │  • Groq (GPT-OSS, Qwen, Llama)                      │
    │  • Mistral (Large 3, Medium 3.5)                    │
    │  • Ollama (Local models)                            │
    │  • OpenRouter (100+ models)                         │
    └──────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. AI Provider Adapter (`lib/ai-adapter.ts`)

**Responsabilidade**: Abstrair a comunicação com diferentes provedores de IA.

**Interface Unificada**:
```typescript
class AIProviderAdapter {
  chat(providerId, modelId, messages, options): Promise<string>
  embed(providerId, modelId, texts): Promise<number[][]>
  validateProvider(providerId): Promise<{success, error?}>
}
```

**Fluxo**:
1. Recebe chamada genérica (providerId, modelId, messages)
2. Roteia para implementação específica (OpenAI, Anthropic, Gemini)
3. Trata autenticação e headers específicos
4. Retorna resposta unificada

**Provedores Suportados**:
- **OpenAI-compatible**: OpenAI, Groq, Mistral, Ollama, OpenRouter
- **Anthropic**: API própria com headers especiais
- **Google Gemini**: API REST com query params

### 2. RAG Pipeline (`lib/rag-pipeline.ts`)

**Responsabilidade**: Processar documentos e buscar trechos relevantes.

**Etapas**:

#### 2.1 Ingestão
```typescript
addSource(notebookId, name, type, content)
```
- Recebe conteúdo (texto, arquivo, URL)
- Cria objeto Source com metadados
- Dispara processamento automático

#### 2.2 Chunking
```typescript
chunkText(text, chunkSize=512, overlap=50)
```
- Divide texto em chunks de ~512 tokens
- Respeita parágrafos e seções
- Overlap de 50 caracteres entre chunks
- Preserva contexto semântico

#### 2.3 Embedding
```typescript
generateSimpleEmbedding(text) // Fallback
// ou
embed(providerId, modelId, texts) // Real
```
- **Atual**: Hash-based pseudo-embedding (demo)
- **Produção**: Embeddings reais dos provedores
- Dimensão: 384 (fallback) ou 1536+ (real)

#### 2.4 Busca
```typescript
searchChunks(query, chunks, queryEmbedding, topK=5)
```
- **Busca Vetorial**: Cosine similarity (70% peso)
- **Busca Keyword**: TF-based (30% peso)
- **Híbrida**: Combinação das duas
- Retorna top K chunks mais relevantes

#### 2.5 Contexto
```typescript
buildContextFromChunks(chunks)
```
- Monta prompt com fontes relevantes
- Gera citações numeradas
- Limita contexto a ~2500 tokens

### 3. State Management (`store/useStore.ts`)

**Responsabilidade**: Gerenciar estado global da aplicação.

**Tecnologia**: Zustand (leve, performático)

**Estrutura**:
```typescript
{
  // Navegação
  currentPage: 'dashboard' | 'notebook' | 'settings' | 'onboarding'
  currentNotebookId: string | null
  currentConversationId: string | null
  
  // Dados
  notebooks: Notebook[]
  settings: AppSettings
  
  // UI
  isStreaming: boolean
  isLoading: boolean
  toastMessage: { type, text } | null
  
  // Actions
  createNotebook, deleteNotebook, updateNotebook
  addSource, removeSource, processSource
  sendMessage, regenerateResponse
  runAnalysis
  setProviderKey, validateProvider
}
```

**Persistência**:
- localStorage para notebooks e configurações
- Keys criptografadas (XOR + Base64)
- Limite: ~5-10MB

### 4. Crypto (`lib/crypto.ts`)

**Responsabilidade**: Ofuscar API keys no localStorage.

**Método Atual** (Demo):
```typescript
encryptKey(plaintext) → XOR + Base64
decryptKey(encrypted) → Base64 + XOR
```

**Produção Recomendada**:
- Backend com AES-256-GCM
- Chave mestra em variável de ambiente
- Nunca expor keys no frontend

## Fluxos Principais

### Fluxo 1: Chat com RAG

```
Usuário digita pergunta
         ↓
Store.sendMessage()
         ↓
Busca chunks relevantes (RAG)
         ↓
Monta contexto com citações
         ↓
Chama AI Adapter (chat)
         ↓
Roteia para provedor específico
         ↓
Streaming de resposta
         ↓
Atualiza UI em tempo real
         ↓
Salva no localStorage
```

### Fluxo 2: Adicionar Fonte

```
Usuário faz upload/cola texto
         ↓
Store.addSource()
         ↓
Cria objeto Source (status: pending)
         ↓
Store.processSource()
         ↓
Chunking (divide em ~512 tokens)
         ↓
Embedding (hash-based ou real)
         ↓
Atualiza Source (status: ready)
         ↓
Pronto para busca
```

### Fluxo 3: Análise de Fontes

```
Usuário clica em ferramenta (ex: Resumo)
         ↓
Store.runAnalysis()
         ↓
Coleta conteúdo de todas as fontes
         ↓
Monta prompt específico
         ↓
Chama AI Adapter (chat)
         ↓
Recebe resposta completa
         ↓
Exibe resultado formatado
         ↓
Opção de salvar como nota
```

## Modelos de Dados

### Notebook
```typescript
{
  id: string
  name: string
  description: string
  icon: string
  color: string
  sources: Source[]
  conversations: Conversation[]
  notes: Note[]
  settings: NotebookSettings
  createdAt: number
  updatedAt: number
}
```

### Source
```typescript
{
  id: string
  notebookId: string
  name: string
  type: 'pdf' | 'txt' | 'md' | 'url' | 'youtube' | 'audio'
  content: string
  chunks: SourceChunk[]
  status: 'pending' | 'processing' | 'ready' | 'error'
  metadata: { wordCount, pages, url, ... }
  enabled: boolean
  tags: string[]
  createdAt: number
  processedAt?: number
}
```

### SourceChunk
```typescript
{
  id: string
  sourceId: string
  index: number
  text: string
  embedding?: number[]
  metadata: {
    page?: number
    section?: string
    startChar: number
    endChar: number
  }
}
```

### Conversation
```typescript
{
  id: string
  notebookId: string
  title: string
  messages: ChatMessage[]
  model: string
  provider: string
  mode: 'sources' | 'creative' | 'hybrid'
  createdAt: number
  updatedAt: number
}
```

### ChatMessage
```typescript
{
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  provider?: string
  timestamp: number
  citations?: Citation[]
  isStreaming?: boolean
  pinned?: boolean
}
```

### Citation
```typescript
{
  id: string
  sourceId: string
  sourceName: string
  chunkIndex: number
  text: string
  score: number
  page?: number
  section?: string
}
```

## Decisões de Design

### 1. Por que Zustand e não Redux/Context?

**Vantagens**:
- Menos boilerplate
- Melhor performance (selective re-renders)
- API mais simples
- TypeScript-friendly
- Persistência fácil

### 2. Por que localStorage e não IndexedDB?

**Demo atual**:
- Simplicidade
- Sincronização automática
- Limite de 5-10MB suficiente para demo

**Produção recomendada**:
- IndexedDB para grandes volumes
- Backend com PostgreSQL
- Sincronização em nuvem

### 3. Por que embeddings hash-based?

**Demo atual**:
- Não requer API key adicional
- Funciona offline
- Rápido para demonstração

**Produção recomendada**:
- Embeddings reais dos provedores
- Melhor qualidade semântica
- Requer API de embeddings

### 4. Por que chamadas diretas para APIs?

**Demo atual**:
- Sem backend necessário
- Deploy estático (Vercel, Netlify)
- Mais simples de configurar

**Produção recomendada**:
- Backend como proxy
- Rate limiting centralizado
- Cache de respostas
- Logs e monitoramento

## Segurança

### Atual (Demo)
- ✅ Keys ofuscadas (XOR + Base64)
- ✅ Armazenamento local
- ✅ Keys nunca em logs
- ⚠️ Keys expostas no browser (risco)

### Produção Recomendada
- ✅ Backend com AES-256-GCM
- ✅ Chave mestra em env vars
- ✅ Proxy para chamadas de IA
- ✅ Rate limiting por usuário
- ✅ Sanitização de inputs
- ✅ HTTPS obrigatório
- ✅ CSP headers

## Performance

### Otimizações Atuais
- Lazy loading de componentes
- Memoization com React.memo
- Zustand selectors (selective re-renders)
- Debounce em buscas
- Streaming de respostas

### Otimizações Futuras
- Cache de embeddings
- Web Workers para chunking
- Virtual scrolling para listas longas
- Service Worker para offline
- Compressão de dados

## Escalabilidade

### Limites Atuais
- ~50 fontes por notebook
- ~100MB de conteúdo total
- ~1000 mensagens por conversa
- ~10 notebooks simultâneos

### Para Escalar
1. **Backend**: Node.js/Python com PostgreSQL
2. **Banco Vetorial**: pgvector, Chroma, Qdrant
3. **Fila**: Redis/Bull para processamento assíncrono
4. **Cache**: Redis para respostas frequentes
5. **CDN**: Para assets estáticos
6. **Auth**: NextAuth/Clerk para multiusuário

## Testes

### Testes Unitários (Recomendado)
```typescript
// AI Adapter
test('chat() calls correct provider')
test('embed() returns correct dimensions')
test('validateProvider() handles errors')

// RAG Pipeline
test('chunkText() respects chunk size')
test('cosineSimilarity() calculates correctly')
test('searchChunks() returns top K')

// Store
test('createNotebook() adds to state')
test('sendMessage() updates conversation')
test('processSource() updates chunks')
```

### Testes E2E (Recomendado)
```typescript
test('User can create notebook and add sources')
test('User can chat and receive citations')
test('User can run analysis tools')
test('User can configure multiple providers')
```

## Deploy

### Frontend (Atual)
```bash
npm run build
# Deploy dist/ para Vercel/Netlify
```

### Full Stack (Produção)
```bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend
cd frontend
npm install
npm run build
# Deploy para CDN
```

## Monitoramento

### Métricas Importantes
- Latência de respostas de IA
- Taxa de erro por provedor
- Uso de tokens (custo)
- Tempo de processamento de fontes
- Tamanho do localStorage

### Ferramentas Recomendadas
- Sentry para erros
- PostHog para analytics
- DataDog para métricas
- LogRocket para sessões

## Roadmap Técnico

### Fase 1 (Atual - Demo)
- [x] Multi-provider support
- [x] RAG pipeline básico
- [x] Chat com citações
- [x] Ferramentas de análise
- [x] Editor de notas

### Fase 2 (Backend)
- [ ] API REST (Node.js/Python)
- [ ] PostgreSQL + pgvector
- [ ] Autenticação JWT
- [ ] Upload de arquivos
- [ ] Web scraping

### Fase 3 (Avançado)
- [ ] Embeddings reais
- [ ] Reranking com Cross-Encoder
- [ ] Fila de processamento
- [ ] Cache distribuído
- [ ] Multiusuário

### Fase 4 (Enterprise)
- [ ] SSO/SAML
- [ ] Audit logs
- [ ] Compliance (GDPR, LGPD)
- [ ] On-premise deployment
- [ ] Custom models

## Contribuindo

### Estrutura de Commits
```
feat: Nova funcionalidade
fix: Correção de bug
docs: Documentação
style: Formatação
refactor: Refatoração
test: Testes
chore: Manutenção
```

### Pull Requests
1. Fork o projeto
2. Crie branch (`git checkout -b feature/nova-feature`)
3. Commit mudanças (`git commit -m 'feat: adiciona nova feature'`)
4. Push para branch (`git push origin feature/nova-feature`)
5. Abra Pull Request

## Licença

MIT © 2026

---

**Desenvolvido com React, TypeScript, Tailwind CSS, Zustand**

**Arquitetura inspirada em:**
- NotebookLM (Google)
- LangChain
- LlamaIndex
- Semantic Kernel

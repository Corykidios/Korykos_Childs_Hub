# OpenNotebook AI 🧠

Sistema completo de pesquisa inteligente inspirado no NotebookLM do Google, com suporte a **múltiplos provedores de IA**.

## 🚀 Funcionalidades

### Multi-Provider IA
- **OpenAI**: GPT-6 Astra, GPT-5.6 Sol/Terra/Luna
- **Anthropic**: Claude Opus 5, Sonnet 5, Fable 5.1, Haiku 4.5
- **Google Gemini**: 2.5 Pro/Flash, 3.5 Flash, 3.1 Pro
- **Groq**: GPT-OSS 120B/20B, Qwen3.8 27B, Llama 3.1 8B
- **Mistral AI**: Large 3, Medium 3.5, Small 3.2, Devstral
- **Ollama**: Modelos locais (Llama, Mistral, CodeLlama)
- **OpenRouter**: 100+ modelos via API unificada

### Notebook Inteligente
- 📚 Crie múltiplos notebooks para organizar pesquisas
- 📄 Upload de fontes (PDF, TXT, MD, URLs, textos colados)
- 💬 Chat contextual com citações automáticas
- 🔄 Streaming de respostas em tempo real
- 📌 Fixar respostas importantes
- 🔀 Regenerar com outro modelo

### Pipeline RAG (Retrieval-Augmented Generation)
- Chunking inteligente de documentos
- Embeddings vetoriais
- Busca híbrida (vetorial + palavras-chave)
- Citações com links para trechos originais

### Ferramentas de Análise
- 📝 Resumo executivo
- 📋 Flashcards de estudo
- ❓ FAQ automático
- 🗺️ Mapa mental
- ⚖️ Tabela comparativa
- 📊 Cronologia
- 💡 Insights e conexões
- 📄 Gerador de artigos

### Editor de Notas
- Notas pessoais vinculadas ao notebook
- Notas geradas pela IA
- Exportação em Markdown

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 🔑 Configuração de API Keys

1. Complete o onboarding inicial
2. Vá em **Configurações**
3. Selecione um provedor (ex: Groq, OpenAI, Anthropic)
4. Cole sua API key
5. Clique em **Validar** para testar a conexão

### Onde obter API keys:
- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys
- **Google Gemini**: https://aistudio.google.com/app/apikey
- **Groq**: https://console.groq.com/keys (gratuito!)
- **Mistral**: https://console.mistral.ai/api-keys/
- **OpenRouter**: https://openrouter.ai/keys

## 🏗️ Arquitetura

```
src/
├── App.tsx                    # Entry point
├── components/
│   ├── Dashboard.tsx          # Lista de notebooks
│   ├── NotebookView.tsx       # Workspace principal
│   ├── SourceManager.tsx      # Gerenciamento de fontes
│   ├── AnalysisTools.tsx      # Ferramentas de análise
│   ├── NotesPanel.tsx         # Editor de notas
│   ├── Settings.tsx           # Configuração de provedores
│   ├── Onboarding.tsx         # Tour inicial
│   └── Toast.tsx              # Notificações
├── lib/
│   ├── types.ts               # Tipos TypeScript
│   ├── ai-adapter.ts          # Adaptador multi-provider
│   ├── rag-pipeline.ts        # Pipeline RAG
│   └── crypto.ts              # Criptografia de keys
└── store/
    └── useStore.ts            # Estado global Zustand
```

### Camada de Abstração (AIProviderAdapter)

O sistema usa uma interface unificada que suporta todos os provedores:

```typescript
interface AIProviderAdapter {
  chat(providerId, modelId, messages, options): Promise<string>
  embed(providerId, modelId, texts): Promise<number[][]>
  validateProvider(providerId): Promise<{success, error?}>
}
```

### Pipeline RAG

1. **Ingestão**: Upload de documentos
2. **Chunking**: Divisão em chunks de ~512 tokens
3. **Embedding**: Geração de vetores (ou fallback hash-based)
4. **Busca**: Cosine similarity + keyword matching
5. **Contexto**: Montagem do prompt com fontes relevantes
6. **Geração**: Chamada ao modelo com citações

## 🔒 Segurança

- ✅ API keys criptografadas (XOR + Base64)
- ✅ Armazenamento local (localStorage)
- ✅ Keys nunca enviadas para logs
- ✅ Chamadas diretas para provedores (sem backend intermediário)

**Nota para produção**: Implementar backend com AES-256 e proxy para chamadas de IA.

## 📊 Modelos Atualizados (2026)

### OpenAI
- `gpt-6-astra` - Modelo mais capaz
- `gpt-5.6-sol` - Profissional complexo
- `gpt-5.6-terra` - Equilíbrio custo/inteligência
- `gpt-5.6-luna` - Custo-eficiente

### Anthropic
- `claude-opus-5` - Complexo e agêntico
- `claude-sonnet-5` - Velocidade + inteligência
- `claude-fable-5-1` - Raciocínio avançado
- `claude-haiku-4-5-20251001` - Mais rápido

### Google Gemini
- `gemini-2.5-pro` - 2M contexto
- `gemini-2.5-flash` - Rápido e capaz
- `gemini-3.5-flash` - Última geração
- `gemini-3.1-pro` - Profissional

### Groq (Gratuito!)
- `openai/gpt-oss-120b` - 120B parâmetros
- `openai/gpt-oss-20b` - 20B parâmetros
- `qwen/qwen3.8-27b` - Qwen3.8
- `llama-3.1-8b-instant` - Rápido e leve

### Mistral AI
- `mistral-large-latest` - Large 3
- `mistral-medium-latest` - Medium 3.5
- `mistral-small-latest` - Small 3.2 24B
- `devstral-small-2507` - Devstral 1.1

## 🎯 Casos de Uso

### Pesquisa Acadêmica
1. Crie notebook "TCC - Direito Digital"
2. Adicione PDFs de artigos, leis, doutrinas
3. Use chat para explorar conceitos
4. Gere resumo executivo e flashcards
5. Exporte notas para seu trabalho

### Estudo de Documentos
1. Upload de contratos, relatórios, manuais
2. Faça perguntas específicas
3. Gere FAQ e tabela comparativa
4. Salve insights como notas

### Análise de Múltiplas Fontes
1. Adicione artigos com perspectivas diferentes
2. Use "Tabela Comparativa" para contrastar
3. Gere "Insights" para conexões não óbvias
4. Crie artigo sintetizando tudo

## 🚧 Roadmap Futuro

- [ ] Backend com PostgreSQL + pgvector
- [ ] Autenticação multiusuário
- [ ] Compartilhamento de notebooks
- [ ] Web scraping automático de URLs
- [ ] Transcrição de YouTube/áudio
- [ ] Embeddings reais (não hash-based)
- [ ] Reranking com Cross-Encoder
- [ ] Comparação lado a lado de modelos
- [ ] Exportação de notebook completo
- [ ] Rate limiting e cache
- [ ] Fila de processamento assíncrono

## 📝 Notas Técnicas

### Limitações Atuais
- Embeddings usam hash-based (fallback) - em produção use embeddings reais
- Armazenamento em localStorage (limite ~5-10MB)
- Sem backend (chamadas diretas para APIs)
- Streaming funciona apenas para OpenAI-compatible

### Performance
- Chunking: ~512 tokens por chunk
- Busca: Top 5 chunks mais relevantes
- Contexto: ~2500 tokens de fontes no prompt
- Suporta 50+ fontes por notebook

### Compatibilidade
- Funciona com qualquer API compatível com OpenAI
- Adicione provedores customizados editando `ai-adapter.ts`
- Suporte a modelos locais via Ollama

## 🤝 Contribuindo

Este é um projeto demonstração. Para produção:
1. Implemente backend (Node.js/Python)
2. Use banco de dados vetorial real (pgvector, Chroma, Qdrant)
3. Adicione autenticação e autorização
4. Implemente criptografia AES-256 no backend
5. Adicione rate limiting e cache
6. Use embeddings reais dos provedores

## 📄 Licença

MIT

## 🙏 Agradecimentos

Inspirado no [NotebookLM](https://notebooklm.google.com/) do Google, mas com suporte multi-provider para liberdade de escolha.

---

**Desenvolvido com ❤️ usando React, TypeScript, Tailwind CSS e Zustand**

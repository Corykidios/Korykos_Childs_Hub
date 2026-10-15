# Guia de Troubleshooting - OpenNotebook AI

## ❌ Erros Comuns e Soluções

### 1. Erro "Model not found" ou "404"

**Problema**: O modelo especificado não existe ou foi depreciado.

**Solução**: 
- Verifique se está usando os modelos atualizados (2026)
- Consulte a documentação oficial do provedor
- Exemplo: Groq mudou de `llama-3.3-70b-versatile` para `openai/gpt-oss-120b`

**Modelos Atualizados por Provedor**:

#### Groq (Gratuito)
✅ Correto:
- `openai/gpt-oss-120b`
- `openai/gpt-oss-20b`
- `qwen/qwen3.8-27b`
- `llama-3.1-8b-instant`

❌ Depreciado:
- `llama-3.3-70b-versatile` (agora Enterprise)
- `mixtral-8x7b-32768`

#### OpenAI
✅ Correto:
- `gpt-6-astra`
- `gpt-5.6-sol`
- `gpt-5.6-terra`
- `gpt-5.6-luna`

❌ Depreciado:
- `gpt-4o`
- `gpt-4o-mini`
- `o1`, `o3-mini`

#### Anthropic
✅ Correto:
- `claude-opus-5`
- `claude-sonnet-5`
- `claude-fable-5-1`
- `claude-haiku-4-5-20251001`

❌ Depreciado:
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`
- `claude-3-haiku-20240307`

#### Google Gemini
✅ Correto:
- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-3.5-flash`
- `gemini-3.1-pro`

❌ Depreciado:
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-2.0-flash`

### 2. Erro "API key not set" ou "401 Unauthorized"

**Problema**: A API key não está configurada ou é inválida.

**Solução**:
1. Vá em **Configurações**
2. Selecione o provedor
3. Verifique se a API key está preenchida
4. Clique em **Validar** para testar
5. Se falhar, gere uma nova key no site do provedor

**Links para obter API keys**:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Google: https://aistudio.google.com/app/apikey
- Groq: https://console.groq.com/keys
- Mistral: https://console.mistral.ai/api-keys/

### 3. Erro "Rate limit exceeded" ou "429"

**Problema**: Você excedeu o limite de requisições do provedor.

**Solução**:
- Aguarde alguns minutos antes de tentar novamente
- Verifique os limites do seu plano (gratuito vs pago)
- Troque para outro provedor temporariamente

**Limites comuns (plano gratuito)**:
- Groq: 30 RPM (requisições por minuto)
- OpenAI: Depende do plano
- Google Gemini: 60 RPM
- Anthropic: Depende do plano

### 4. Erro "CORS" ou "Network Error"

**Problema**: O navegador está bloqueando a requisição por política de segurança.

**Solução**:
- Certifique-se de que a API key está correta
- Alguns provedores (como Anthropic) requerem headers especiais
- O sistema já inclui `anthropic-dangerous-direct-browser-access: true` para Anthropic
- Em produção, use um backend como proxy

### 5. Fonte não processa ou fica em "Processando..."

**Problema**: O chunking ou embedding falhou.

**Solução**:
1. Verifique se o conteúdo não está vazio
2. Tente remover e adicionar a fonte novamente
3. Verifique o console do navegador (F12) para erros
4. Fontes muito grandes (>100KB) podem demorar

### 6. Respostas da IA não citam as fontes

**Problema**: O sistema RAG não encontrou chunks relevantes.

**Solução**:
1. Certifique-se de que as fontes estão **ativas** (ícone de olho)
2. Verifique se as fontes foram processadas (status "Pronto")
3. Tente reformular a pergunta
4. Adicione mais fontes relacionadas ao tema

### 7. Streaming não funciona

**Problema**: As respostas aparecem de uma vez, não em tempo real.

**Solução**:
- Streaming funciona apenas para provedores OpenAI-compatible
- Anthropic e Google Gemini não suportam streaming neste momento
- Isso é uma limitação técnica, não um bug

### 8. Dados desaparecem ao recarregar

**Problema**: O localStorage foi limpo ou está cheio.

**Solução**:
- O sistema usa localStorage (limite ~5-10MB)
- Muitos notebooks com fontes grandes podem exceder o limite
- Exporte notas importantes regularmente
- Em produção, use um banco de dados real

### 9. Erro "Provider not configured"

**Problema**: Tentando usar um provedor sem API key.

**Solução**:
1. Vá em **Configurações**
2. Adicione a API key do provedor desejado
3. Clique em **Validar**
4. Selecione o provedor como padrão

### 10. Embeddings não funcionam

**Problema**: O sistema usa embeddings hash-based (fallback) em vez de embeddings reais.

**Solução**:
- Isso é esperado no modo atual
- Para embeddings reais, implemente:
  1. Backend com API de embeddings
  2. Banco vetorial (pgvector, Chroma, Qdrant)
  3. Integração com provedores de embedding

## 🔧 Dicas de Uso

### Melhorando a Qualidade das Respostas

1. **Fontes de qualidade**: Use documentos bem estruturados
2. **Perguntas específicas**: Seja claro e direto
3. **Múltiplas fontes**: Adicione diferentes perspectivas
4. **Modo "Somente fontes"**: Para respostas baseadas apenas nos documentos
5. **Temperatura**: Ajuste nas configurações do notebook (0.3 = mais preciso, 0.8 = mais criativo)

### Gerenciando Notebooks

1. **Organize por tema**: Um notebook por projeto/assunto
2. **Limpe fontes antigas**: Remova fontes não relevantes
3. **Use tags**: Organize fontes com tags (futuro)
4. **Exporte notas**: Salve insights importantes localmente

### Escolhendo o Modelo Certo

**Para precisão e citações**:
- Claude Sonnet 5
- GPT-5.6 Terra
- Gemini 2.5 Pro

**Para velocidade**:
- Groq (GPT-OSS 20B)
- Gemini 2.5 Flash
- Claude Haiku 4.5

**Para raciocínio complexo**:
- GPT-6 Astra
- Claude Opus 5
- Claude Fable 5.1

**Para custo-benefício**:
- Groq (gratuito!)
- GPT-5.6 Luna
- Gemini 2.5 Flash

## 📊 Verificando Status

### Console do Navegador (F12)

Abra o console para ver:
- Erros de API
- Status de processamento
- Logs de debug

### LocalStorage

Veja os dados salvos em:
- DevTools → Application → Local Storage
- Keys: `onb_notebooks`, `onb_settings`, `onb_providers`

### Validação de Provedores

Use o botão **Validar** nas configurações para testar:
- Se a API key está correta
- Se o modelo está disponível
- Se há conectividade

## 🆘 Suporte

Se o problema persistir:

1. Verifique o console do navegador (F12)
2. Teste com outro provedor
3. Limpe o localStorage e reconfigure
4. Verifique se a API key tem créditos/permissões
5. Consulte a documentação oficial do provedor

## 📝 Checklist de Configuração

Antes de usar, verifique:

- [ ] API key configurada em **Configurações**
- [ ] Provedor validado com sucesso (ícone verde)
- [ ] Modelo padrão selecionado
- [ ] Notebook criado
- [ ] Fontes adicionadas e processadas (status "Pronto")
- [ ] Fontes ativadas (ícone de olho visível)

---

**Última atualização**: 2026
**Versão**: 1.0.0

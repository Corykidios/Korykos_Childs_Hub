// ============================================
// OpenNotebook AI - Multi-Provider Adapter
// Unified interface for all AI providers
// ============================================

import { AIModel, AIProviderConfig, ChatMessage, Citation } from './types';
import { decryptKey } from './crypto';

// ---- Provider Definitions ----
export const PROVIDER_DEFINITIONS: Record<string, {
  name: string;
  icon: string;
  baseUrl: string;
  models: AIModel[];
  apiKeyPrefix: string;
  apiKeyUrl: string;
}> = {
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPrefix: 'sk-',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-6-astra', name: 'GPT-6 Astra', provider: 'openai', type: 'chat', maxTokens: 128000, contextWindow: 1050000 },
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'openai', type: 'chat', maxTokens: 128000, contextWindow: 1050000 },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'openai', type: 'chat', maxTokens: 128000, contextWindow: 1050000 },
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai', type: 'chat', maxTokens: 128000, contextWindow: 1050000 },
      { id: 'text-embedding-3-small', name: 'Embedding 3 Small', provider: 'openai', type: 'embedding', maxTokens: 8191, contextWindow: 8191 },
      { id: 'text-embedding-3-large', name: 'Embedding 3 Large', provider: 'openai', type: 'embedding', maxTokens: 8191, contextWindow: 8191 },
    ]
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🟠',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyPrefix: 'sk-ant-',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic', type: 'chat', maxTokens: 128000, contextWindow: 1000000 },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic', type: 'chat', maxTokens: 128000, contextWindow: 1000000 },
      { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', provider: 'anthropic', type: 'chat', maxTokens: 128000, contextWindow: 1000000 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', type: 'chat', maxTokens: 64000, contextWindow: 200000 },
    ]
  },
  google: {
    name: 'Google Gemini',
    icon: '🔵',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyPrefix: 'AI',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', type: 'chat', maxTokens: 65536, contextWindow: 2000000 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', type: 'chat', maxTokens: 65536, contextWindow: 1000000 },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', type: 'chat', maxTokens: 65536, contextWindow: 1000000 },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', provider: 'google', type: 'chat', maxTokens: 65536, contextWindow: 2000000 },
      { id: 'text-embedding-004', name: 'Text Embedding', provider: 'google', type: 'embedding', maxTokens: 2048, contextWindow: 2048 },
    ]
  },
  groq: {
    name: 'Groq',
    icon: '⚡',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPrefix: 'gsk_',
    apiKeyUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'groq', type: 'chat', maxTokens: 65536, contextWindow: 131072 },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'groq', type: 'chat', maxTokens: 65536, contextWindow: 131072 },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen3.8 27B', provider: 'groq', type: 'chat', maxTokens: 16384, contextWindow: 131042 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', type: 'chat', maxTokens: 131072, contextWindow: 131072 },
    ]
  },
  mistral: {
    name: 'Mistral AI',
    icon: '🟣',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyPrefix: '',
    apiKeyUrl: 'https://console.mistral.ai/api-keys/',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large 3', provider: 'mistral', type: 'chat', maxTokens: 8192, contextWindow: 131000 },
      { id: 'mistral-medium-latest', name: 'Mistral Medium 3.5', provider: 'mistral', type: 'chat', maxTokens: 8192, contextWindow: 131000 },
      { id: 'mistral-small-latest', name: 'Mistral Small 3.2 24B', provider: 'mistral', type: 'chat', maxTokens: 8192, contextWindow: 131000 },
      { id: 'devstral-small-2507', name: 'Devstral Small 1.1', provider: 'mistral', type: 'chat', maxTokens: 8192, contextWindow: 131000 },
    ]
  },
  ollama: {
    name: 'Ollama (Local)',
    icon: '🦙',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyPrefix: '',
    apiKeyUrl: 'http://localhost:11434',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', type: 'chat', maxTokens: 8192, contextWindow: 128000 },
      { id: 'mistral', name: 'Mistral', provider: 'ollama', type: 'chat', maxTokens: 8192, contextWindow: 32000 },
      { id: 'codellama', name: 'Code Llama', provider: 'ollama', type: 'chat', maxTokens: 4096, contextWindow: 16000 },
      { id: 'nomic-embed-text', name: 'Nomic Embed', provider: 'ollama', type: 'embedding', maxTokens: 8192, contextWindow: 8192 },
    ]
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🔀',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPrefix: 'sk-or-',
    apiKeyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna (via OR)', provider: 'openrouter', type: 'chat', maxTokens: 128000, contextWindow: 1050000 },
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5 (via OR)', provider: 'openrouter', type: 'chat', maxTokens: 128000, contextWindow: 1000000 },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (via OR)', provider: 'openrouter', type: 'chat', maxTokens: 65536, contextWindow: 1000000 },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (via OR)', provider: 'openrouter', type: 'chat', maxTokens: 32768, contextWindow: 128000 },
    ]
  },
  local: {
    name: 'IA Local & Gratuita',
    icon: '📱',
    baseUrl: 'local',
    apiKeyPrefix: '',
    apiKeyUrl: '#local-ai',
    models: [
      // Modelos locais (offline) - modelos confiáveis e testados
      { id: 'Xenova/distilgpt2', name: 'DistilGPT-2 (Local)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
      { id: 'Xenova/LaMini-Flan-T5-248M', name: 'LaMini Flan-T5 (Local)', provider: 'local', type: 'chat', maxTokens: 512, contextWindow: 512 },
      { id: 'Xenova/gpt2', name: 'GPT-2 (Local)', provider: 'local', type: 'chat', maxTokens: 512, contextWindow: 1024 },
      { id: 'Xenova/all-MiniLM-L6-v2', name: 'MiniLM Embeddings (Local)', provider: 'local', type: 'embedding', maxTokens: 512, contextWindow: 512 },
      // APIs gratuitas (online)
      { id: 'huggingface:microsoft/DialoGPT-large', name: 'DialoGPT (Gratuito)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
      { id: 'huggingface:facebook/blenderbot-400M-distill', name: 'BlenderBot (Gratuito)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
    ]
  },
};

// ---- AI Provider Adapter Class ----
export class AIProviderAdapter {
  private providers: Record<string, AIProviderConfig> = {};

  constructor() {
    this.loadProviders();
  }

  private loadProviders() {
    try {
      const stored = localStorage.getItem('onb_providers');
      if (stored) {
        this.providers = JSON.parse(stored);
      }
      
      // Garantir que provider "local" esteja sempre configurado
      if (!this.providers['local'] || this.providers['local'].status !== 'configured') {
        const localDef = PROVIDER_DEFINITIONS['local'];
        if (localDef) {
          this.providers['local'] = {
            id: 'local',
            name: localDef.name,
            icon: localDef.icon,
            baseUrl: localDef.baseUrl,
            apiKey: '',
            models: localDef.models,
            status: 'configured',
            lastValidated: new Date().toISOString(),
          };
          this.saveProviders();
        }
      }
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  }

  private saveProviders() {
    localStorage.setItem('onb_providers', JSON.stringify(this.providers));
  }

  getProvider(id: string): AIProviderConfig | undefined {
    return this.providers[id];
  }

  getAllProviders(): AIProviderConfig[] {
    return Object.values(this.providers);
  }

  getConfiguredProviders(): AIProviderConfig[] {
    return Object.values(this.providers).filter(p => p.status === 'configured');
  }

  getAvailableModels(): AIModel[] {
    const models: AIModel[] = [];
    for (const provider of Object.values(this.providers)) {
      if (provider.status === 'configured') {
        models.push(...provider.models);
      }
    }
    return models;
  }

  getChatModels(): AIModel[] {
    return this.getAvailableModels().filter(m => m.type === 'chat');
  }

  getEmbeddingModels(): AIModel[] {
    return this.getAvailableModels().filter(m => m.type === 'embedding');
  }

  setProvider(id: string, config: Partial<AIProviderConfig>) {
    const def = PROVIDER_DEFINITIONS[id];
    if (!def) throw new Error(`Unknown provider: ${id}`);
    
    // Provider "local" não precisa de API key, sempre configurado
    const status = id === 'local' ? 'configured' : (config.apiKey ? 'configured' : 'unconfigured');
    
    this.providers[id] = {
      id,
      name: def.name,
      icon: def.icon,
      baseUrl: config.baseUrl || def.baseUrl,
      apiKey: config.apiKey || '',
      models: def.models,
      status,
      lastValidated: config.lastValidated,
    };
    this.saveProviders();
  }

  removeProvider(id: string) {
    delete this.providers[id];
    this.saveProviders();
  }

  // ---- Chat Completion ----
  async chat(
    providerId: string,
    modelId: string,
    messages: { role: string; content: string }[],
    options: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stream?: boolean;
      onChunk?: (chunk: string) => void;
    } = {}
  ): Promise<string> {
    const provider = this.providers[providerId];
    if (!provider) throw new Error(`Provider ${providerId} not configured`);
    
    const apiKey = decryptKey(provider.apiKey);
    // Provider "local" e "ollama" não precisam de API key
    if (!apiKey && providerId !== 'ollama' && providerId !== 'local') {
      throw new Error(`API key not set for ${provider.name}`);
    }

    // Build full messages with system prompt
    const fullMessages = options.systemPrompt 
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages;

    // Route to appropriate provider
    switch (providerId) {
      case 'anthropic':
        return this.callAnthropic(apiKey, modelId, fullMessages, options);
      case 'google':
        return this.callGemini(apiKey, modelId, fullMessages, options);
      case 'local':
        return this.callLocalAI(modelId, fullMessages, options);
      default:
        return this.callOpenAICompatible(provider.baseUrl, apiKey, modelId, fullMessages, options);
    }
  }

  // ---- OpenAI Compatible (works for OpenAI, Groq, Mistral, Ollama, OpenRouter) ----
  private async callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    options: { temperature?: number; maxTokens?: number; stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      stream: options.stream ?? false,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error (${response.status}): ${err}`);
    }

    if (options.stream && options.onChunk && response.body) {
      return this.handleStream(response, options.onChunk);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ---- Anthropic ----
  private async callAnthropic(
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: systemMsg?.content,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  // ---- Google Gemini ----
  private async callGemini(
    apiKey: string,
    model: string,
    messages: { role: string; content: string }[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 8192,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ---- Local AI (Transformers.js + Free APIs) ----
  private async callLocalAI(
    model: string,
    messages: { role: string; content: string }[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const { localAI } = await import('./local-ai');
    
    // Construir prompt a partir das mensagens
    const prompt = messages
      .map(m => {
        if (m.role === 'system') return `[Sistema]: ${m.content}`;
        if (m.role === 'user') return `[Usuário]: ${m.content}`;
        if (m.role === 'assistant') return `[Assistente]: ${m.content}`;
        return m.content;
      })
      .join('\n\n');

    // Verificar se é API gratuita (prefixo "huggingface:")
    if (model.startsWith('huggingface:')) {
      const modelId = model.replace('huggingface:', '');
      const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;
      
      // Retry logic para API gratuita (pode demorar para carregar o modelo)
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                max_new_tokens: options.maxTokens || 256,
                temperature: options.temperature || 0.7,
              },
            }),
          });

          if (response.status === 503) {
            // Modelo está carregando, aguardar e tentar novamente
            const waitTime = (attempt + 1) * 5000; // 5s, 10s, 15s
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          
          // Hugging Face retorna array com generated_text
          if (Array.isArray(data) && data[0]?.generated_text) {
            return data[0].generated_text;
          }
          
          return JSON.stringify(data);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Erro desconhecido');
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      throw new Error(`Erro ao usar API gratuita após 3 tentativas: ${lastError?.message || 'Erro desconhecido'}`);
    }
    
    // Modelo local (Transformers.js)
    // Sempre tentar carregar automaticamente (pode estar em cache mas não na memória)
    if (!localAI.isModelLoaded(model)) {
      try {
        console.log(`[Local AI] Carregando modelo ${model} automaticamente...`);
        console.log(`[Local AI] Isso pode demorar alguns minutos na primeira vez...`);
        
        await localAI.loadModel(model, (progress) => {
          console.log(`[Local AI] Progresso do download: ${progress}%`);
        });
        
        console.log(`[Local AI] Modelo ${model} carregado com sucesso!`);
      } catch (error) {
        console.error(`[Local AI] Erro ao carregar modelo ${model}:`, error);
        
        // Fornecer mensagem de erro mais clara e útil
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        // Sugerir alternativas se o download falhar
        if (errorMessage.includes('Timeout') || errorMessage.includes('rede') || errorMessage.includes('NetworkError')) {
          throw new Error(
            `Não foi possível baixar o modelo local "${model}".\n\n` +
            `Possíveis soluções:\n` +
            `1. Verifique sua conexão com a internet\n` +
            `2. Tente novamente em alguns minutos\n` +
            `3. Use um modelo menor (Qwen 2.5 0.5B)\n` +
            `4. Use as APIs gratuitas (DialoGPT ou BlenderBot) que não precisam de download\n\n` +
            `Detalhes do erro: ${errorMessage}`
          );
        } else if (errorMessage.includes('memória') || errorMessage.includes('memory')) {
          throw new Error(
            `Memória insuficiente para carregar o modelo "${model}".\n\n` +
            `Soluções:\n` +
            `1. Feche outras abas do navegador\n` +
            `2. Reinicie o navegador\n` +
            `3. Use um modelo menor (Qwen 2.5 0.5B em vez de Phi-3)\n` +
            `4. Use as APIs gratuitas (DialoGPT ou BlenderBot)\n\n` +
            `Detalhes: ${errorMessage}`
          );
        } else {
          throw new Error(
            `Erro ao carregar modelo local "${model}".\n\n` +
            `Sugestões:\n` +
            `1. Verifique sua conexão com a internet\n` +
            `2. Tente novamente\n` +
            `3. Use as APIs gratuitas (DialoGPT ou BlenderBot) que funcionam online\n\n` +
            `Detalhes: ${errorMessage}`
          );
        }
      }
    }

    const finalPrompt = prompt + '\n[Assistente]:';

    // Gerar resposta
    const response = await localAI.generate(model, finalPrompt, {
      max_tokens: options.maxTokens || 512,
      temperature: options.temperature || 0.7,
    });

    return response;
  }

  // ---- Stream Handler ----
  private async handleStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    return fullText;
  }

  // ---- Embeddings ----
  async embed(providerId: string, modelId: string, texts: string[]): Promise<number[][]> {
    const provider = this.providers[providerId];
    if (!provider) throw new Error(`Provider ${providerId} not configured`);
    
    const apiKey = decryptKey(provider.apiKey);

    if (providerId === 'ollama') {
      return this.embedOllama(modelId, texts);
    }

    if (providerId === 'google') {
      return this.embedGemini(apiKey, modelId, texts);
    }

    if (providerId === 'local') {
      return this.embedLocal(modelId, texts);
    }

    // OpenAI compatible embedding
    const response = await fetch(`${provider.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: modelId, input: texts }),
    });

    if (!response.ok) {
      throw new Error(`Embedding Error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  private async embedOllama(model: string, texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch('http://localhost:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });
      const data = await response.json();
      results.push(data.embedding);
    }
    return results;
  }

  private async embedGemini(apiKey: string, model: string, texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            content: { parts: [{ text }] },
          }),
        }
      );
      const data = await response.json();
      results.push(data.embedding.values);
    }
    return results;
  }

  // ---- Local Embeddings (Transformers.js) ----
  private async embedLocal(model: string, texts: string[]): Promise<number[][]> {
    const { localAI } = await import('./local-ai');
    
    if (!localAI.isModelLoaded(model)) {
      throw new Error(`Modelo de embeddings local "${model}" não carregado. Vá em Configurações > IA Local para baixá-lo.`);
    }

    return localAI.embed(model, texts);
  }

  // ---- Validation ----
  async validateProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = this.providers[providerId];
      if (!provider) return { success: false, error: 'Provider not found' };

      // Local AI não precisa de API key - sempre configurar como disponível
      if (providerId === 'local') {
        // Provider local sempre está disponível (não requer validação externa)
        provider.status = 'configured';
        provider.lastValidated = new Date().toISOString();
        this.saveProviders();
        return { success: true };
      }

      const apiKey = decryptKey(provider.apiKey);
      if (!apiKey && providerId !== 'ollama') {
        return { success: false, error: 'API key not set' };
      }

      // Try a simple request
      if (providerId === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } else if (providerId === 'ollama') {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) throw new Error('Ollama not running');
      } else {
        const response = await fetch(`${provider.baseUrl}/models`, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }

      provider.status = 'configured';
      provider.lastValidated = new Date().toISOString();
      this.saveProviders();
      return { success: true };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error };
    }
  }
}

// Singleton instance
export const aiAdapter = new AIProviderAdapter();

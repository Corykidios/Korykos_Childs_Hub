/**
 * Local AI Provider - Transformers.js + Free APIs
 * Roda modelos de IA diretamente no navegador/celular sem API key
 * Suporta tanto IA local (offline) quanto APIs gratuitas (online)
 */

import { pipeline, env } from '@huggingface/transformers';

// Configurar para usar cache do navegador
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configurações globais para melhor compatibilidade (se disponível)
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1; // Usar apenas 1 thread para melhor compatibilidade com mobile
}

// APIs gratuitas que não precisam de API key
export const FREE_APIS = [
  {
    id: 'huggingface-free',
    name: 'Hugging Face (Gratuito)',
    description: 'API gratuita do Hugging Face - sem API key',
    baseUrl: 'https://api-inference.huggingface.co/models',
    models: [
      { id: 'microsoft/DialoGPT-large', name: 'DialoGPT Large', type: 'chat' },
      { id: 'facebook/blenderbot-400M-distill', name: 'BlenderBot 400M', type: 'chat' },
    ],
  },
];

export interface LocalModel {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'text-generation' | 'text2text-generation' | 'feature-extraction';
  downloaded: boolean;
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'Xenova/distilgpt2',
    name: 'DistilGPT-2',
    description: 'Modelo muito leve e rápido, ideal para celular',
    size: '~82MB',
    type: 'text-generation',
    downloaded: false,
  },
  {
    id: 'Xenova/LaMini-Flan-T5-248M',
    name: 'LaMini Flan-T5 248M',
    description: 'Modelo pequeno com boa qualidade',
    size: '~250MB',
    type: 'text2text-generation',
    downloaded: false,
  },
  {
    id: 'Xenova/gpt2',
    name: 'GPT-2',
    description: 'Modelo maior, melhor qualidade',
    size: '~450MB',
    type: 'text-generation',
    downloaded: false,
  },
  {
    id: 'Xenova/all-MiniLM-L6-v2',
    name: 'MiniLM Embeddings',
    description: 'Para embeddings e busca vetorial',
    size: '~80MB',
    type: 'feature-extraction',
    downloaded: false,
  },
];

class LocalAIProvider {
  private generators: Map<string, any> = new Map();
  private downloadProgress: Map<string, number> = new Map();
  private listeners: Set<(progress: { model: string; progress: number }) => void> = new Set();

  /**
   * Adicionar listener para progresso de download
   */
  onProgress(callback: (progress: { model: string; progress: number }) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Baixar e carregar modelo
   */
  async loadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    if (this.generators.has(modelId)) {
      console.log(`[Local AI] Modelo ${modelId} já está carregado na memória`);
      return; // Já carregado
    }

    const model = LOCAL_MODELS.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Modelo ${modelId} não encontrado na lista de modelos disponíveis`);
    }

    console.log(`[Local AI] Iniciando download do modelo ${modelId}...`);
    console.log(`[Local AI] Tipo: ${model.type}, Tamanho estimado: ${model.size}`);

    try {
      // Configurar timeout maior para downloads grandes (10 minutos)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: O download do modelo demorou mais de 10 minutos. Verifique sua conexão e tente novamente.')), 600000);
      });

      const loadPromise = pipeline(model.type, modelId, {
        // Forçar uso do cache do navegador se disponível
        cache_dir: undefined,
        // Configurações para melhor compatibilidade
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (progress: any) => {
          console.log('[Local AI] Progresso do download:', progress);
          
          if (progress.status === 'progress' && progress.progress) {
            const percent = Math.round(progress.progress);
            this.downloadProgress.set(modelId, percent);
            onProgress?.(percent);
            this.notifyListeners(modelId, percent);
          } else if (progress.status === 'initiate') {
            console.log(`[Local AI] Iniciando download de: ${progress.file}`);
          } else if (progress.status === 'ready') {
            console.log(`[Local AI] Arquivo pronto: ${progress.file}`);
          }
        },
      });

      // Aguardar com timeout
      const generator = await Promise.race([loadPromise, timeoutPromise]);

      this.generators.set(modelId, generator);
      model.downloaded = true;
      this.downloadProgress.set(modelId, 100);
      this.notifyListeners(modelId, 100);
      console.log(`[Local AI] Modelo ${modelId} carregado com sucesso!`);
    } catch (error) {
      console.error('[Local AI] Erro detalhado ao carregar modelo:', error);
      
      // Fornecer mensagens de erro mais específicas
      if (error instanceof Error) {
        if (error.message.includes('Timeout')) {
          throw new Error(`Timeout: O download do modelo ${model.name} demorou muito. Tente novamente ou use uma conexão mais rápida.`);
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          throw new Error(`Modelo ${modelId} não encontrado no Hugging Face. O modelo pode ter sido removido ou renomeado.`);
        } else if (error.message.includes('CORS') || error.message.includes('NetworkError')) {
          throw new Error(`Erro de rede ao baixar ${model.name}. Verifique sua conexão com a internet e tente novamente.`);
        } else if (error.message.includes('memory') || error.message.includes('allocation')) {
          throw new Error(`Memória insuficiente para carregar ${model.name}. Tente fechar outras abas ou use um modelo menor.`);
        } else {
          throw new Error(`Erro ao carregar modelo ${model.name}: ${error.message}`);
        }
      }
      
      throw new Error(`Erro desconhecido ao carregar modelo ${model.name}`);
    }
  }

  /**
   * Gerar texto com modelo local
   */
  async generate(
    modelId: string,
    prompt: string,
    options: {
      max_tokens?: number;
      temperature?: number;
      top_p?: number;
    } = {}
  ): Promise<string> {
    const generator = this.generators.get(modelId);
    if (!generator) {
      throw new Error(`Modelo ${modelId} não carregado. Chame loadModel primeiro.`);
    }

    const output = await generator(prompt, {
      max_new_tokens: options.max_tokens || 256,
      temperature: options.temperature || 0.7,
      top_p: options.top_p || 0.9,
      do_sample: true,
    });

    return output[0]?.generated_text || '';
  }

  /**
   * Gerar embeddings com modelo local
   */
  async embed(modelId: string, texts: string[]): Promise<number[][]> {
    const generator = this.generators.get(modelId);
    if (!generator) {
      throw new Error(`Modelo ${modelId} não carregado. Chame loadModel primeiro.`);
    }

    const embeddings: number[][] = [];
    for (const text of texts) {
      const output = await generator(text, {
        pooling: 'mean',
        normalize: true,
      });
      embeddings.push(Array.from(output.data));
    }

    return embeddings;
  }

  /**
   * Verificar se modelo está carregado
   */
  isModelLoaded(modelId: string): boolean {
    return this.generators.has(modelId);
  }

  /**
   * Obter progresso de download
   */
  getDownloadProgress(modelId: string): number {
    return this.downloadProgress.get(modelId) || 0;
  }

  /**
   * Descarregar modelo para liberar memória
   */
  unloadModel(modelId: string): void {
    this.generators.delete(modelId);
    this.downloadProgress.delete(modelId);
    const model = LOCAL_MODELS.find(m => m.id === modelId);
    if (model) {
      model.downloaded = false;
    }
  }

  /**
   * Usar API gratuita online (sem API key)
   */
  async useFreeAPI(
    apiUrl: string,
    prompt: string,
    options: { max_tokens?: number; temperature?: number } = {}
  ): Promise<string> {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: options.max_tokens || 256,
            temperature: options.temperature || 0.7,
          },
        }),
      });

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
      console.error('Erro ao usar API gratuita:', error);
      throw error;
    }
  }

  /**
   * Notificar listeners sobre progresso
   */
  private notifyListeners(modelId: string, progress: number) {
    this.listeners.forEach(callback => {
      callback({ model: modelId, progress });
    });
  }
}

// Instância singleton
export const localAI = new LocalAIProvider();

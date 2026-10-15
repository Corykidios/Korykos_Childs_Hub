// ============================================
// OpenNotebook AI - Main Application Store
// ============================================

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Notebook, Source, Conversation, ChatMessage, Note,
  AIModel, Citation, SourceChunk, AnalysisType, AppSettings
} from '../../types';
import { aiAdapter, PROVIDER_DEFINITIONS } from '../services/ai/adapter';
import { processSourceContent, searchChunks, buildContextFromChunks, generateSimpleEmbedding } from '../services/rag/pipeline';
import { encryptKey } from '../utils/crypto';
import { supabase } from '../services/supabase/client';
import * as db from '../services/supabase/service';

interface AppState {
  // Navigation
  currentPage: 'dashboard' | 'notebook' | 'settings' | 'onboarding';
  currentNotebookId: string | null;
  currentConversationId: string | null;
  
  // Data
  notebooks: Notebook[];
  settings: AppSettings;
  
  // UI State
  sidebarOpen: boolean;
  isStreaming: boolean;
  isLoading: boolean;
  toastMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  
  // Actions
  setPage: (page: AppState['currentPage'], notebookId?: string) => void;
  toggleSidebar: () => void;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
  clearToast: () => void;
  
  // Notebook Actions
  createNotebook: (name: string, description?: string) => string;
  deleteNotebook: (id: string) => void;
  updateNotebook: (id: string, updates: Partial<Notebook>) => void;
  
  // Source Actions
  addSource: (notebookId: string, name: string, type: Source['type'], content: string) => void;
  removeSource: (notebookId: string, sourceId: string) => void;
  toggleSource: (notebookId: string, sourceId: string) => void;
  processSource: (notebookId: string, sourceId: string) => Promise<void>;
  
  // Chat Actions
  createConversation: (notebookId: string) => string;
  deleteConversation: (notebookId: string, conversationId: string) => void;
  sendMessage: (notebookId: string, conversationId: string, content: string) => Promise<void>;
  regenerateResponse: (notebookId: string, conversationId: string, messageId: string) => Promise<void>;
  pinMessage: (notebookId: string, conversationId: string, messageId: string) => void;
  
  // Note Actions
  createNote: (notebookId: string, title: string, content: string) => void;
  updateNote: (notebookId: string, noteId: string, updates: Partial<Note>) => void;
  deleteNote: (notebookId: string, noteId: string) => void;
  
  // Analysis Actions
  runAnalysis: (notebookId: string, type: AnalysisType) => Promise<string>;
  
  // Settings Actions
  setProviderKey: (providerId: string, apiKey: string) => void;
  removeProviderKey: (providerId: string) => void;
  validateProvider: (providerId: string) => Promise<boolean>;
  setDefaultModel: (provider: string, model: string) => void;
  completeOnboarding: () => void;
  
  // Persistence
  loadState: () => Promise<void>;
  saveState: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultProvider: '',
  defaultModel: '',
  providers: {},
  onboardingComplete: false,
};

const NOTEBOOK_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6'];
const NOTEBOOK_ICONS = ['📚', '🔬', '💼', '🎓', '📊', '🧠', '📝', '🌐', '⚡', '🎯'];

// Função auxiliar para salvar no Supabase em background
async function saveToSupabase(table: string, data: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[Supabase] Usuário não autenticado, pulando sync');
      return;
    }

    console.log(`[Supabase] Salvando ${table} no Supabase...`);

    if (table === 'notebooks') {
      await db.createNotebook({
        id: data.id,
        user_id: user.id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        settings: data.settings,
      });
    }

    console.log(`[Supabase] ${table} salvo com sucesso!`);
  } catch (error) {
    console.error(`[Supabase] Erro ao salvar ${table}:`, error);
  }
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentPage: 'dashboard',
  currentNotebookId: null,
  currentConversationId: null,
  notebooks: [],
  settings: { ...DEFAULT_SETTINGS },
  sidebarOpen: true,
  isStreaming: false,
  isLoading: false,
  toastMessage: null,

  // Navigation
  setPage: (page, notebookId) => set({ 
    currentPage: page, 
    currentNotebookId: notebookId || get().currentNotebookId,
    currentConversationId: page === 'notebook' ? get().currentConversationId : null,
  }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  showToast: (type, text) => {
    set({ toastMessage: { type, text } });
    setTimeout(() => set({ toastMessage: null }), 4000);
  },
  clearToast: () => set({ toastMessage: null }),

  // Notebook Actions
  createNotebook: (name, description = '') => {
    const id = uuidv4();
    const notebook: Notebook = {
      id,
      name,
      description,
      icon: NOTEBOOK_ICONS[Math.floor(Math.random() * NOTEBOOK_ICONS.length)],
      color: NOTEBOOK_COLORS[Math.floor(Math.random() * NOTEBOOK_COLORS.length)],
      sources: [],
      conversations: [],
      notes: [],
      settings: {
        defaultModel: get().settings.defaultModel,
        defaultProvider: get().settings.defaultProvider,
        mode: 'sources',
        chunkSize: 512,
        chunkOverlap: 50,
        topK: 5,
        temperature: 0.7,
        systemPrompt: 'Você é um assistente de pesquisa útil. Responda com base nas fontes fornecidas. Cite as fontes usando [Fonte X].',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({ notebooks: [...s.notebooks, notebook] }));
    get().saveState();
    
    // Salvar no Supabase em background (não bloqueia a UI)
    saveToSupabase('notebooks', notebook);
    
    return id;
  },

  deleteNotebook: async (id) => {
    set(s => ({ 
      notebooks: s.notebooks.filter(n => n.id !== id),
      currentNotebookId: s.currentNotebookId === id ? null : s.currentNotebookId,
    }));
    get().saveState();
    
    // Deletar no Supabase
    try {
      await db.deleteNotebook(id);
      console.log('[Supabase] Notebook deletado com sucesso!');
    } catch (error) {
      console.error('[Supabase] Erro ao deletar notebook:', error);
    }
  },

  updateNotebook: (id, updates) => {
    set(s => ({
      notebooks: s.notebooks.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n),
    }));
    get().saveState();
  },

  // Source Actions
  addSource: (notebookId, name, type, content) => {
    const sourceId = uuidv4();
    const source: Source = {
      id: sourceId,
      notebookId,
      name,
      type,
      content,
      chunks: [],
      status: 'pending',
      metadata: { wordCount: content.split(/\s+/).length },
      enabled: true,
      tags: [],
      createdAt: Date.now(),
    };
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, sources: [...n.sources, source], updatedAt: Date.now() }
          : n
      ),
    }));
    get().saveState();
    
    // Salvar no Supabase
    saveToSupabase('sources', source);
    
    // Auto-process
    get().processSource(notebookId, sourceId);
  },

  removeSource: (notebookId, sourceId) => {
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, sources: n.sources.filter(s => s.id !== sourceId), updatedAt: Date.now() }
          : n
      ),
    }));
    get().saveState();
  },

  toggleSource: (notebookId, sourceId) => {
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, sources: n.sources.map(src => src.id === sourceId ? { ...src, enabled: !src.enabled } : src), updatedAt: Date.now() }
          : n
      ),
    }));
    get().saveState();
  },

  processSource: async (notebookId, sourceId) => {
    const state = get();
    const notebook = state.notebooks.find(n => n.id === notebookId);
    const source = notebook?.sources.find(s => s.id === sourceId);
    if (!source) return;

    // Update status to processing
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, sources: n.sources.map(src => src.id === sourceId ? { ...src, status: 'processing' as const } : src), updatedAt: Date.now() }
          : n
      ),
    }));

    try {
      // Chunk the content
      const chunks = processSourceContent(source.content, sourceId, 512, 50);
      
      // Generate embeddings (use simple fallback for demo)
      const chunksWithEmbeddings: SourceChunk[] = chunks.map(chunk => ({
        ...chunk,
        embedding: generateSimpleEmbedding(chunk.text),
      }));

      // Update source with processed chunks
      set(s => ({
        notebooks: s.notebooks.map(n => 
          n.id === notebookId 
            ? { 
                ...n, 
                sources: n.sources.map(src => src.id === sourceId 
                  ? { ...src, chunks: chunksWithEmbeddings, status: 'ready' as const, processedAt: Date.now() }
                  : src
                ), 
                updatedAt: Date.now() 
              }
            : n
        ),
      }));
      get().saveState();
    } catch (error) {
      set(s => ({
        notebooks: s.notebooks.map(n => 
          n.id === notebookId 
            ? { ...n, sources: n.sources.map(src => src.id === sourceId ? { ...src, status: 'error' as const } : src), updatedAt: Date.now() }
            : n
        ),
      }));
      get().saveState();
    }
  },

  // Chat Actions
  createConversation: (notebookId) => {
    const id = uuidv4();
    const conversation: Conversation = {
      id,
      notebookId,
      title: 'Nova Conversa',
      messages: [],
      model: get().settings.defaultModel,
      provider: get().settings.defaultProvider,
      mode: 'sources',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, conversations: [...n.conversations, conversation], updatedAt: Date.now() }
          : n
      ),
      currentConversationId: id,
    }));
    get().saveState();
    
    // Salvar no Supabase
    saveToSupabase('conversations', conversation);
    
    return id;
  },

  deleteConversation: (notebookId, conversationId) => {
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, conversations: n.conversations.filter(c => c.id !== conversationId), updatedAt: Date.now() }
          : n
      ),
      currentConversationId: s.currentConversationId === conversationId ? null : s.currentConversationId,
    }));
    get().saveState();
  },

  sendMessage: async (notebookId, conversationId, content) => {
    const state = get();
    const notebook = state.notebooks.find(n => n.id === notebookId);
    const conversation = notebook?.conversations.find(c => c.id === conversationId);
    if (!notebook || !conversation) return;

    const provider = conversation.provider || state.settings.defaultProvider;
    const model = conversation.model || state.settings.defaultModel;

    if (!provider || !model) {
      get().showToast('error', 'Configure um provedor e modelo nas configurações');
      return;
    }

    // Notificar usuário se estiver usando modelo local (pode demorar para carregar)
    if (provider === 'local' && !model.startsWith('huggingface:')) {
      get().showToast('info', 'Carregando modelo local... Isso pode demorar alguns minutos na primeira vez.');
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      model,
      provider,
      timestamp: Date.now(),
      isStreaming: true,
    };

    set(s => ({
      isStreaming: true,
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { 
              ...n, 
              conversations: n.conversations.map(c => 
                c.id === conversationId 
                  ? { 
                      ...c, 
                      messages: [...c.messages, userMsg, assistantMsg],
                      title: c.messages.length === 0 ? content.slice(0, 50) : c.title,
                      updatedAt: Date.now() 
                    }
                  : c
              ), 
              updatedAt: Date.now() 
            }
          : n
      ),
    }));

    try {
      // Build context from sources (RAG)
      const allChunks: SourceChunk[] = [];
      const sourceList: { id: string; name: string; enabled: boolean }[] = [];
      
      for (const source of notebook.sources) {
        if (source.enabled && source.status === 'ready') {
          allChunks.push(...source.chunks);
          sourceList.push({ id: source.id, name: source.name, enabled: source.enabled });
        }
      }

      // Search relevant chunks
      const queryEmbedding = generateSimpleEmbedding(content);
      const relevantChunks = searchChunks(content, allChunks, queryEmbedding, notebook.settings.topK, sourceList);
      const { context, citations } = buildContextFromChunks(relevantChunks);

      // Build messages for the API
      const chatHistory = conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      let systemPrompt = notebook.settings.systemPrompt;
      
      // Aplicar configurações de conversa
      const conversationConfig = notebook.settings.conversationConfig;
      if (conversationConfig) {
        // Adicionar modo da conversa
        if (conversationConfig.mode === 'learning_guide') {
          systemPrompt += `\n\nMODO: Guia de Aprendizagem\nVocê está atuando como um guia educacional. Explique conceitos de forma clara e didática, use exemplos práticos, faça analogias quando possível e verifique o entendimento do usuário. Priorize o aprendizado efetivo.`;
        } else if (conversationConfig.mode === 'socratic_discovery') {
          systemPrompt += `\n\nMODO: Descoberta Socrática\nVocê está atuando como um mentor socrático. NUNCA dê respostas diretas. Em vez disso:`;
          
          if (conversationConfig.socraticConfig?.askQuestions) {
            systemPrompt += `\n- Faça perguntas que levem o usuário a descobrir a resposta por conta própria`;
            systemPrompt += `\n- Use o método socrático: questione premissas, explore implicações, peça exemplos`;
            systemPrompt += `\n- Nunca diga "a resposta é X", mas sim "o que você acha que seria X?" ou "como você chegaria a X?"`;
          }
          
          if (conversationConfig.socraticConfig?.identifyGaps) {
            systemPrompt += `\n- Identifique lacunas nas fontes fornecidas: o que NÃO está coberto?`;
            systemPrompt += `\n- Pergunte ao usuário: "Você percebeu que suas fontes não abordam X?"`;
            systemPrompt += `\n- Liste no final da resposta: "🔍 LACUNAS IDENTIFICADAS:" seguido do que falta`;
          }
          
          if (conversationConfig.socraticConfig?.suggestResearch) {
            systemPrompt += `\n- Sugira o que o usuário deveria pesquisar para complementar`;
            systemPrompt += `\n- Recomende tópicos específicos, autores, ou tipos de fonte`;
            systemPrompt += `\n- Liste no final da resposta: "📚 SUGESTÕES DE PESQUISA:" seguido de recomendações`;
          }
          
          systemPrompt += `\n\nIMPORTANTE: Seu objetivo é fazer o usuário PENSAR e DESCOBRIR, não apenas receber informações. Transforme aprendizado passivo em ativo.`;
        } else if (conversationConfig.mode === 'custom') {
          // Adicionar configurações personalizadas
          if (conversationConfig.role) {
            systemPrompt += `\n\nPAPEL: ${conversationConfig.role}`;
          }
          if (conversationConfig.tone) {
            systemPrompt += `\n\nTOM: ${conversationConfig.tone}`;
          }
          if (conversationConfig.customInstructions) {
            systemPrompt += `\n\nINSTRUÇÕES PERSONALIZADAS:\n${conversationConfig.customInstructions}`;
          }
        }
        
        // Adicionar tamanho da resposta
        if (conversationConfig.responseLength === 'short') {
          systemPrompt += `\n\nTAMANHO DA RESPOSTA: Seja conciso e direto. Respostas curtas e objetivas.`;
        } else if (conversationConfig.responseLength === 'long') {
          systemPrompt += `\n\nTAMANHO DA RESPOSTA: Seja detalhado e completo. Respostas longas e abrangentes.`;
        }
      }
      
      if (conversation.mode === 'sources' && context) {
        systemPrompt += `\n\nFONTES DISPONÍVEIS:\n${context}\n\nINSTRUÇÕES: Responda APENAS com base nas fontes acima. Use [Fonte X] para citar. Se a informação não estiver nas fontes, diga que não encontrou.`;
      } else if (context) {
        systemPrompt += `\n\nFONTES DE REFERÊNCIA:\n${context}\n\nUse as fontes como referência, mas pode complementar com seu conhecimento.`;
      }

      // Call AI
      const response = await aiAdapter.chat(
        provider,
        model,
        [...chatHistory, { role: 'user', content }],
        {
          temperature: notebook.settings.temperature,
          systemPrompt,
          stream: true,
          onChunk: (chunk) => {
            // Update streaming message
            set(s => ({
              notebooks: s.notebooks.map(n => 
                n.id === notebookId 
                  ? { 
                      ...n, 
                      conversations: n.conversations.map(c => 
                        c.id === conversationId 
                          ? { 
                              ...c, 
                              messages: c.messages.map(m => 
                                m.id === assistantMsg.id 
                                  ? { ...m, content: m.content + chunk }
                                  : m
                              ),
                              updatedAt: Date.now() 
                            }
                          : c
                      ), 
                    }
                  : n
              ),
            }));
          },
        }
      );

      // Finalize message
      set(s => ({
        isStreaming: false,
        notebooks: s.notebooks.map(n => 
          n.id === notebookId 
            ? { 
                ...n, 
                conversations: n.conversations.map(c => 
                  c.id === conversationId 
                    ? { 
                        ...c, 
                        messages: c.messages.map(m => 
                          m.id === assistantMsg.id 
                            ? { ...m, content: response, isStreaming: false, citations }
                            : m
                        ),
                        updatedAt: Date.now() 
                      }
                    : c
                ), 
                updatedAt: Date.now() 
              }
            : n
        ),
      }));
      get().saveState();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      set(s => ({
        isStreaming: false,
        notebooks: s.notebooks.map(n => 
          n.id === notebookId 
            ? { 
                ...n, 
                conversations: n.conversations.map(c => 
                  c.id === conversationId 
                    ? { 
                        ...c, 
                        messages: c.messages.map(m => 
                          m.id === assistantMsg.id 
                            ? { ...m, content: `⚠️ Erro: ${errorMsg}`, isStreaming: false }
                            : m
                        ),
                        updatedAt: Date.now() 
                      }
                    : c
                ), 
                updatedAt: Date.now() 
              }
            : n
        ),
      }));
      get().saveState();
      get().showToast('error', `Erro na IA: ${errorMsg}`);
    }
  },

  regenerateResponse: async (notebookId, conversationId, messageId) => {
    const state = get();
    const notebook = state.notebooks.find(n => n.id === notebookId);
    const conversation = notebook?.conversations.find(c => c.id === conversationId);
    if (!notebook || !conversation) return;

    const msgIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex < 1) return;

    const userMessage = conversation.messages[msgIndex - 1];
    
    // Remove the old response and regenerate
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { 
              ...n, 
              conversations: n.conversations.map(c => 
                c.id === conversationId 
                  ? { ...c, messages: c.messages.slice(0, msgIndex), updatedAt: Date.now() }
                  : c
              ), 
              updatedAt: Date.now() 
            }
          : n
      ),
    }));

    await get().sendMessage(notebookId, conversationId, userMessage.content);
  },

  pinMessage: (notebookId, conversationId, messageId) => {
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { 
              ...n, 
              conversations: n.conversations.map(c => 
                c.id === conversationId 
                  ? { 
                      ...c, 
                      messages: c.messages.map(m => 
                        m.id === messageId ? { ...m, pinned: !m.pinned } : m
                      ),
                      updatedAt: Date.now() 
                    }
                  : c
              ), 
              updatedAt: Date.now() 
            }
          : n
      ),
    }));
    get().saveState();
  },

  // Note Actions
  createNote: (notebookId, title, content) => {
    const note: Note = {
      id: uuidv4(),
      notebookId,
      title,
      content,
      sourceIds: [],
      isAiGenerated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, notes: [...n.notes, note], updatedAt: Date.now() }
          : n
      ),
    }));
    get().saveState();
    
    // Salvar no Supabase
    saveToSupabase('notes', note);
  },

  updateNote: (notebookId, noteId, updates) => {
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { 
              ...n, 
              notes: n.notes.map(note => 
                note.id === noteId ? { ...note, ...updates, updatedAt: Date.now() } : note
              ), 
              updatedAt: Date.now() 
            }
          : n
      ),
    }));
    get().saveState();
  },

  deleteNote: (notebookId, noteId) => {
    set(s => ({
      notebooks: s.notebooks.map(n => 
        n.id === notebookId 
          ? { ...n, notes: n.notes.filter(note => note.id !== noteId), updatedAt: Date.now() }
          : n
      ),
    }));
    get().saveState();
  },

  // Analysis Actions
  runAnalysis: async (notebookId, type) => {
    const state = get();
    const notebook = state.notebooks.find(n => n.id === notebookId);
    if (!notebook) return '';

    const provider = state.settings.defaultProvider;
    const model = state.settings.defaultModel;
    if (!provider || !model) {
      get().showToast('error', 'Configure um provedor nas configurações');
      return '';
    }

    // Gather all source content
    const sourceContent = notebook.sources
      .filter(s => s.enabled && s.status === 'ready')
      .map(s => `[${s.name}]\n${s.content.slice(0, 2000)}`)
      .join('\n\n---\n\n');

    if (!sourceContent) {
      get().showToast('error', 'Adicione fontes ao notebook primeiro');
      return '';
    }

    const prompts: Record<AnalysisType, string> = {
      summary: `Crie um resumo executivo completo e estruturado das seguintes fontes. Use markdown com seções claras:\n\n${sourceContent}`,
      flashcards: `Crie flashcards de estudo baseados nestas fontes. Formato:\n**Pergunta:** ...\n**Resposta:** ...\n\nFontes:\n${sourceContent}`,
      faq: `Gere uma lista de FAQ (perguntas frequentes) com respostas baseadas nestas fontes:\n\n${sourceContent}`,
      mindmap: `Crie um mapa mental em formato de texto estruturado (usando indentação e bullets) representando as conexões entre os conceitos das fontes:\n\n${sourceContent}`,
      comparison: `Crie uma tabela comparativa analisando as diferentes perspectivas e informações encontradas nas fontes:\n\n${sourceContent}`,
      timeline: `Organize os eventos e informações das fontes em uma cronologia estruturada:\n\n${sourceContent}`,
      insights: `Identifique insights, conexões não óbvias e padrões entre as fontes:\n\n${sourceContent}`,
      article: `Escreva um artigo completo e bem estruturado sintetizando as informações das fontes. Use markdown:\n\n${sourceContent}`,
    };

    set({ isStreaming: true });

    try {
      const result = await aiAdapter.chat(provider, model, [
        { role: 'user', content: prompts[type] }
      ], { temperature: 0.7 });

      set({ isStreaming: false });
      return result;
    } catch (error) {
      set({ isStreaming: false });
      const errorMsg = error instanceof Error ? error.message : 'Erro na análise';
      get().showToast('error', errorMsg);
      return '';
    }
  },

  // Settings Actions
  setProviderKey: (providerId, apiKey) => {
    const encrypted = encryptKey(apiKey);
    aiAdapter.setProvider(providerId, { apiKey: encrypted });
    
    set((s: AppState) => ({
      settings: {
        ...s.settings,
        providers: {
          ...s.settings.providers,
          [providerId]: {
            id: providerId,
            name: PROVIDER_DEFINITIONS[providerId]?.name || providerId,
            icon: PROVIDER_DEFINITIONS[providerId]?.icon || '🤖',
            baseUrl: PROVIDER_DEFINITIONS[providerId]?.baseUrl || '',
            apiKey: encrypted,
            models: PROVIDER_DEFINITIONS[providerId]?.models || [],
            status: 'configured' as const,
          },
        },
        defaultProvider: s.settings.defaultProvider || providerId,
        defaultModel: s.settings.defaultModel || PROVIDER_DEFINITIONS[providerId]?.models[0]?.id || '',
      },
    }));
    get().saveState();
  },

  removeProviderKey: (providerId) => {
    aiAdapter.removeProvider(providerId);
    set(s => {
      const newProviders = { ...s.settings.providers };
      delete newProviders[providerId];
      return {
        settings: { ...s.settings, providers: newProviders },
      };
    });
    get().saveState();
  },

  validateProvider: async (providerId) => {
    const result = await aiAdapter.validateProvider(providerId);
    if (result.success) {
      get().showToast('success', `${PROVIDER_DEFINITIONS[providerId]?.name} conectado com sucesso!`);
    } else {
      get().showToast('error', `Falha na validação: ${result.error}`);
    }
    return result.success;
  },

  setDefaultModel: (provider, model) => {
    set(s => ({
      settings: { ...s.settings, defaultProvider: provider, defaultModel: model },
    }));
    get().saveState();
  },

  completeOnboarding: () => {
    set(s => ({
      settings: { ...s.settings, onboardingComplete: true },
      currentPage: 'dashboard',
    }));
    get().saveState();
  },

  // Persistence
  loadState: async () => {
    try {
      // Carregar do localStorage
      const notebooks = localStorage.getItem('onb_notebooks');
      const settings = localStorage.getItem('onb_settings');
      
      if (notebooks) {
        set({ notebooks: JSON.parse(notebooks) });
      }
      
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        
        // Garantir que o provider "local" esteja sempre configurado com modelos atualizados
        if (!parsedSettings.providers?.local || parsedSettings.providers.local.status !== 'configured') {
          parsedSettings.providers = {
            ...parsedSettings.providers,
            local: {
              id: 'local',
              name: 'IA Local & Gratuita',
              icon: '📱',
              baseUrl: 'local',
              apiKey: '',
              models: [
                { id: 'Xenova/distilgpt2', name: 'DistilGPT-2 (Local)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
                { id: 'Xenova/LaMini-Flan-T5-248M', name: 'LaMini Flan-T5 (Local)', provider: 'local', type: 'chat', maxTokens: 512, contextWindow: 512 },
                { id: 'Xenova/gpt2', name: 'GPT-2 (Local)', provider: 'local', type: 'chat', maxTokens: 512, contextWindow: 1024 },
                { id: 'Xenova/all-MiniLM-L6-v2', name: 'MiniLM Embeddings (Local)', provider: 'local', type: 'embedding', maxTokens: 512, contextWindow: 512 },
                { id: 'huggingface:microsoft/DialoGPT-large', name: 'DialoGPT (Gratuito)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
                { id: 'huggingface:facebook/blenderbot-400M-distill', name: 'BlenderBot (Gratuito)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
              ],
              status: 'configured',
              lastValidated: new Date().toISOString(),
            },
          };
        } else {
          // Sempre atualizar os modelos para garantir que estão usando os confiáveis
          parsedSettings.providers.local.models = [
            { id: 'Xenova/distilgpt2', name: 'DistilGPT-2 (Local)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
            { id: 'Xenova/LaMini-Flan-T5-248M', name: 'LaMini Flan-T5 (Local)', provider: 'local', type: 'chat', maxTokens: 512, contextWindow: 512 },
            { id: 'Xenova/gpt2', name: 'GPT-2 (Local)', provider: 'local', type: 'chat', maxTokens: 512, contextWindow: 1024 },
            { id: 'Xenova/all-MiniLM-L6-v2', name: 'MiniLM Embeddings (Local)', provider: 'local', type: 'embedding', maxTokens: 512, contextWindow: 512 },
            { id: 'huggingface:microsoft/DialoGPT-large', name: 'DialoGPT (Gratuito)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
            { id: 'huggingface:facebook/blenderbot-400M-distill', name: 'BlenderBot (Gratuito)', provider: 'local', type: 'chat', maxTokens: 256, contextWindow: 1024 },
          ];
        }
        
        set({ settings: parsedSettings });
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  },

  saveState: () => {
    try {
      const state = get();
      localStorage.setItem('onb_notebooks', JSON.stringify(state.notebooks));
      localStorage.setItem('onb_settings', JSON.stringify(state.settings));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  },
}));

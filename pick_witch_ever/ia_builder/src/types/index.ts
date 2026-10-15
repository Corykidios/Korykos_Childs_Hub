// ============================================
// OpenNotebook AI - Type Definitions
// ============================================

export interface AIProviderConfig {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
  apiKey: string;
  models: AIModel[];
  status: 'configured' | 'unconfigured' | 'error';
  lastValidated?: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'embedding';
  maxTokens: number;
  contextWindow: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  provider?: string;
  timestamp: number;
  citations?: Citation[];
  isStreaming?: boolean;
  pinned?: boolean;
}

export interface Citation {
  id: string;
  sourceId: string;
  sourceName: string;
  chunkIndex: number;
  text: string;
  score: number;
  page?: number;
  section?: string;
}

export interface Source {
  id: string;
  notebookId: string;
  name: string;
  type: SourceType;
  content: string;
  chunks: SourceChunk[];
  status: SourceStatus;
  metadata: SourceMetadata;
  enabled: boolean;
  tags: string[];
  createdAt: number;
  processedAt?: number;
}

export type SourceType = 'pdf' | 'txt' | 'md' | 'docx' | 'url' | 'youtube' | 'audio' | 'pasted' | 'rss';

export type SourceStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface SourceChunk {
  id: string;
  sourceId: string;
  index: number;
  text: string;
  embedding?: number[];
  metadata: {
    page?: number;
    section?: string;
    startChar: number;
    endChar: number;
  };
}

export interface SourceMetadata {
  size?: number;
  pages?: number;
  url?: string;
  author?: string;
  language?: string;
  wordCount?: number;
}

export interface Notebook {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sources: Source[];
  conversations: Conversation[];
  notes: Note[];
  settings: NotebookSettings;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  notebookId: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  provider: string;
  mode: 'sources' | 'creative' | 'hybrid';
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  sourceIds: string[];
  isAiGenerated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookSettings {
  defaultModel: string;
  defaultProvider: string;
  mode: 'sources' | 'creative' | 'hybrid';
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  temperature: number;
  systemPrompt: string;
  conversationConfig?: ConversationConfig;
}

export type ConversationMode = 'default' | 'learning_guide' | 'socratic_discovery' | 'custom';
export type ResponseLength = 'short' | 'default' | 'long';

export interface ConversationConfig {
  mode: ConversationMode;
  responseLength: ResponseLength;
  customInstructions?: string;
  role?: string;
  tone?: string;
  socraticConfig?: {
    askQuestions: boolean;
    identifyGaps: boolean;
    suggestResearch: boolean;
  };
}

export interface ProviderRegistry {
  [key: string]: AIProviderConfig;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultProvider: string;
  defaultModel: string;
  providers: ProviderRegistry;
  onboardingComplete: boolean;
}

export type AnalysisType = 
  | 'summary'
  | 'flashcards'
  | 'faq'
  | 'mindmap'
  | 'comparison'
  | 'timeline'
  | 'insights'
  | 'article';

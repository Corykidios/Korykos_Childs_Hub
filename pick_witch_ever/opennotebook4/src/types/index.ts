export type SourceType = 'pdf' | 'web' | 'youtube' | 'text' | 'audio';

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  content: string;
  tokenCount: number;
  selected: boolean;
  addedAt: number;
  url?: string;
  pageCount?: number;
  sourceGuide?: string;
}

export interface Citation {
  id: string;
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
  pageNumber?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: number;
}

export type StudioType = 
  | 'audio' 
  | 'slides' 
  | 'video' 
  | 'mindmap' 
  | 'report' 
  | 'flashcards' 
  | 'quiz' 
  | 'infographic' 
  | 'table' 
  | 'note';

export interface StudioArtifact {
  id: string;
  type: StudioType;
  title: string;
  createdAt: number;
  data: any;
}

export type ReportFormat = 
  | 'create_your_own' 
  | 'briefing' 
  | 'study_guide' 
  | 'blog_post' 
  | string;

export type ReportDepth = 'concise' | 'standard' | 'extensive';

export interface ReportSuggestion {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

export interface ReportGenerationConfig {
  topic: string;
  selectedSourceIds: string[];
  format: ReportFormat;
  depth?: ReportDepth;
  customPrompt?: string;
  formatTitle?: string;
}

export type InfographicOrientation = 'landscape' | 'portrait' | 'square';
export type InfographicStyle =
  | 'auto'
  | 'kawaii'
  | 'clay'
  | 'sketch_note'
  | 'anime'
  | 'editorial'
  | 'minimalist'
  | 'vintage'
  | '3d_render'
  | 'watercolor';
export type InfographicDetail = 'concise' | 'standard' | 'detailed';

export interface InfographicGenerationConfig {
  language: string;
  orientation: InfographicOrientation;
  style: InfographicStyle;
  detail: InfographicDetail;
  selectedSourceIds: string[];
  customPrompt: string;
}

export interface InfographicData {
  title: string;
  subtitle?: string;
  imagePrompt?: string;
  imageUrl?: string;
  heroStat?: {
    value: string;
    label: string;
    description?: string;
  };
  metrics?: Array<{
    label: string;
    value: string;
    description?: string;
    change?: string;
  }>;
  processFlow?: Array<{
    step: string;
    title: string;
    summary: string;
  }>;
  breakdown?: Array<{
    category: string;
    percentage: number;
    description?: string;
  }>;
  keyInsights?: string[];
  takeaway?: string;
  orientation?: InfographicOrientation;
  style?: InfographicStyle;
  detail?: InfographicDetail;
  customPrompt?: string;
  sourcesCited?: string[];
}

// Audio Overview Types (NotebookLM)
export type AudioFormat = 'deep_dive' | 'brief' | 'critique' | 'debate';
export type AudioLength = 'short' | 'default' | 'long';

export interface AudioGenerationConfig {
  format: AudioFormat;
  length: AudioLength;
  language: string;
  selectedSourceIds: string[];
  customPrompt: string;
}

export interface AudioDialogueTurn {
  speaker: string;
  avatar?: string;
  text: string;
}

export interface AudioOverviewData {
  podcastDialogue: AudioDialogueTurn[];
  language?: string;
  format?: AudioFormat;
  length?: AudioLength;
  topic?: string;
  sourcesCited?: string[];
}

// Slide Deck Types (NotebookLM)
export type SlideFormat = 'detailed_deck' | 'presenter_slides';
export type SlideLength = 'short' | 'default';

export interface SlideGenerationConfig {
  format: SlideFormat;
  length: SlideLength;
  language: string;
  selectedSourceIds: string[];
  customPrompt: string;
}

export interface SlideItem {
  title: string;
  subtitle?: string;
  points: string[];
  notes?: string;
  statCallout?: {
    value: string;
    label: string;
  };
  imagePrompt?: string;
}

export interface SlideDeckData {
  slides: SlideItem[];
  language?: string;
  format?: SlideFormat;
  length?: SlideLength;
  topic?: string;
  customPrompt?: string;
}

// Video Overview Types (NotebookLM)
export type VideoFormat = 'short' | 'explainer';

export interface VideoGenerationConfig {
  format: VideoFormat;
  language: string;
  selectedSourceIds: string[];
  focusTopic: string;
  customTopic?: string;
}

export interface VideoSceneItem {
  title: string;
  narration: string;
  visualPrompt: string;
  duration: number;
  onScreenText?: string;
}

export interface VideoOverviewData {
  scenes: VideoSceneItem[];
  format?: VideoFormat;
  focusTopic?: string;
  language?: string;
  title?: string;
}

export interface Notebook {
  id: string;
  title: string;
  emoji: string;
  sources: Source[];
  messages: ChatMessage[];
  artifacts: StudioArtifact[];
  updatedAt: number;
  createdAt: number;
  isShared?: boolean;
}

export type LLMProvider = 
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'grok'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'moonshotai'
  | 'zai'
  | 'qwen'
  | 'huggingface'
  | 'xiaomi_mimo';

export type ImageProvider = 'openai' | 'google' | 'openrouter' | 'comfyui';
export type VideoProvider = 'openai' | 'google' | 'openrouter' | 'comfyui';
export type AppTheme = 'dark' | 'light';

export interface AppSettings {
  theme?: AppTheme;
  llmProvider: LLMProvider;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  ollamaUrl: string;
  lmStudioUrl: string;
  
  searchProvider: 'ddgs' | 'firecrawl' | 'tavily' | 'brave' | 'exa' | 'perplexity';
  searchApiKey: string;
  firecrawlUrl: string;
  searchDepth: 'fast' | 'deep';

  audioProvider: 'edge-tts' | 'elevenlabs' | 'openai';
  audioApiKey: string;

  imageProvider: ImageProvider;
  imageApiKey: string;
  imageModel: string;
  imageBaseUrl?: string;
  imageComfyUiUrl: string;

  videoProvider: VideoProvider;
  videoApiKey: string;
  videoModel: string;
  videoBaseUrl?: string;
  videoComfyUiUrl: string;
}

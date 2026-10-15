import { Source, ChatMessage, Citation, StudioType, AppSettings, ReportSuggestion } from '../types';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWebAPI(
  query: string,
  provider = 'ddgs',
  apiKey = ''
): Promise<SearchResultItem[]> {
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, provider, apiKey }),
    });
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error('searchWebAPI error:', e);
    return [];
  }
}

export async function scrapeUrlAPI(url: string): Promise<{ title: string; content: string; tokenCount: number }> {
  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    return {
      title: data.title || url,
      content: data.content || '',
      tokenCount: data.tokenCount || 100,
    };
  } catch (e: any) {
    return {
      title: url,
      content: `# Web Content from ${url}\n\nUnable to fetch page: ${e.message}`,
      tokenCount: 50,
    };
  }
}

export async function extractYoutubeAPI(url: string): Promise<{ title: string; content: string; tokenCount: number }> {
  try {
    const res = await fetch('/api/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    return {
      title: data.title || url,
      content: data.content || '',
      tokenCount: data.tokenCount || 100,
    };
  } catch (e: any) {
    return {
      title: url,
      content: `# Video from ${url}\n\nError extracting metadata: ${e.message}`,
      tokenCount: 50,
    };
  }
}

export async function parsePdfFileAPI(file: File): Promise<{ text: string; pages: number; tokenCount: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64 }),
        });
        const data = await res.json();
        resolve({
          text: data.text || `[Document content extracted from ${file.name}]`,
          pages: data.pages || 1,
          tokenCount: data.tokenCount || Math.ceil((data.text?.length || 100) / 4),
        });
      } catch (err) {
        resolve({
          text: `[Document: ${file.name} - parsed with fallback reader]`,
          pages: 1,
          tokenCount: 150,
        });
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

export interface ChatApiParams {
  messages: ChatMessage[];
  sources: Source[];
  settings: AppSettings;
  chatStyle?: 'Default' | 'Concise' | 'Detailed';
}

export async function sendChatMessageAPI(
  params: ChatApiParams
): Promise<{ text: string; citations: Citation[] }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: params.settings.llmProvider,
        apiKey: params.settings.llmApiKey,
        baseUrl: params.settings.llmBaseUrl,
        model: params.settings.llmModel,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        sources: params.sources.filter((s) => s.selected).map((s) => ({
          id: s.id,
          title: s.title,
          content: s.content,
        })),
        chatStyle: params.chatStyle || 'Default',
      }),
    });
    const data = await res.json();
    return {
      text: data.text || data.error || (res.ok ? 'I reviewed your active sources, but could not produce a response for this query. Please try rephrasing.' : `Server error (${res.status})`),
      citations: data.citations || [],
    };
  } catch (e: any) {
    return {
      text: `Error connecting to chat provider: ${e.message}`,
      citations: [],
    };
  }
}

export async function generateArtifactAPI(
  type: StudioType,
  sources: Source[],
  language = 'English',
  settings: AppSettings,
  topic?: string,
  quizConfig?: any,
  flashcardConfig?: any,
  reportConfig?: any,
  infographicConfig?: any,
  audioConfig?: any,
  slideConfig?: any,
  videoConfig?: any
): Promise<any> {
  try {
    const res = await fetch('/api/generate-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        sources: (sources || []).map((s) => ({
          id: s.id,
          title: s.title,
          content: s.content,
        })),
        language,
        topic,
        quizConfig,
        flashcardConfig,
        reportConfig,
        infographicConfig,
        audioConfig,
        slideConfig,
        videoConfig,
        provider: settings.llmProvider,
        apiKey: settings.llmApiKey,
        baseUrl: settings.llmBaseUrl,
        model: settings.llmModel,
        imageProvider: settings.imageProvider,
        imageApiKey: settings.imageApiKey || (settings.imageProvider === 'google' && settings.llmProvider === 'gemini' ? settings.llmApiKey : settings.imageProvider === 'openai' && settings.llmProvider === 'openai' ? settings.llmApiKey : ''),
        imageModel: settings.imageModel,
        imageBaseUrl: settings.imageBaseUrl,
        imageComfyUiUrl: settings.imageComfyUiUrl,
      }),
    });
    const data = await res.json();
    return data.data || {};
  } catch (e) {
    console.error('generateArtifactAPI error:', e);
    return {};
  }
}

export async function generateImageAPI(
  prompt: string,
  orientation: string,
  settings: AppSettings
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        orientation,
        imageProvider: settings.imageProvider,
        imageApiKey: settings.imageApiKey || (settings.imageProvider === 'google' && settings.llmProvider === 'gemini' ? settings.llmApiKey : settings.imageProvider === 'openai' && settings.llmProvider === 'openai' ? settings.llmApiKey : ''),
        imageModel: settings.imageModel,
        imageBaseUrl: settings.imageBaseUrl,
        imageComfyUiUrl: settings.imageComfyUiUrl,
      }),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function generateSourceGuideAPI(
  title: string,
  content: string,
  settings?: AppSettings
): Promise<string> {
  try {
    const res = await fetch('/api/source-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content: content.slice(0, 16000),
        provider: settings?.llmProvider,
        apiKey: settings?.llmApiKey,
        model: settings?.llmModel,
      }),
    });
    const data = await res.json();
    return data.guide || '';
  } catch (e) {
    console.error('generateSourceGuideAPI error:', e);
    return '';
  }
}

export async function getReportSuggestionsAPI(
  sources: Source[],
  settings?: AppSettings
): Promise<ReportSuggestion[]> {
  try {
    const res = await fetch('/api/suggest-report-formats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: (sources || []).map((s) => ({
          id: s.id,
          title: s.title,
          content: s.content?.slice(0, 3500) || '',
        })),
        provider: settings?.llmProvider,
        apiKey: settings?.llmApiKey,
        baseUrl: settings?.llmBaseUrl,
        model: settings?.llmModel,
      }),
    });
    const data = await res.json();
    return data.suggestions || [];
  } catch (e) {
    console.error('getReportSuggestionsAPI error:', e);
    return [];
  }
}

export interface DeepResearchProgressLog {
  stage: 'planning' | 'searching' | 'reading' | 'shortlisting' | 'synthesizing' | 'complete';
  message: string;
  timestamp: number;
}

export interface DeepResearchStats {
  totalFound?: number;
  totalRead?: number;
  shortlistedCount?: number;
  totalTokens?: number;
}

export interface DeepResearchSourceItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  content: string;
  tokenCount: number;
}

export interface DeepResearchResult {
  query: string;
  totalFound: number;
  totalRead: number;
  shortlistedCount: number;
  totalTokens: number;
  logs: DeepResearchProgressLog[];
  report: {
    title: string;
    content: string;
    tokenCount: number;
    summary: string;
  };
  shortlistedSources: DeepResearchSourceItem[];
}

export async function runDeepResearchAPI(
  query: string,
  scope = 'Web',
  settings?: AppSettings,
  onProgress?: (log: DeepResearchProgressLog, stats?: DeepResearchStats) => void
): Promise<DeepResearchResult> {
  try {
    const res = await fetch('/api/deep-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        scope,
        provider: settings?.searchProvider || 'duckduckgo',
        apiKey: settings?.searchApiKey || '',
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Deep Research server returned ${res.status}`);
    }

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: DeepResearchResult | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventType = 'message';
          let eventData = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);
              if (eventType === 'progress' && onProgress) {
                onProgress(parsed.log, parsed.stats);
              } else if (eventType === 'complete') {
                finalResult = parsed;
              } else if (eventType === 'error') {
                throw new Error(parsed.error);
              }
            } catch (err) {
              console.error('Error parsing SSE event:', err);
            }
          }
        }
      }

      if (finalResult) {
        return finalResult;
      }
    }

    // Fallback if reader not supported or didn't complete
    const resFallback = await fetch('/api/deep-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        scope,
        provider: settings?.searchProvider || 'duckduckgo',
        apiKey: settings?.searchApiKey || '',
        stream: false,
      }),
    });
    const data = await resFallback.json();
    if (!data.success) throw new Error(data.error || 'Deep research failed');
    return data;
  } catch (e: any) {
    console.error('runDeepResearchAPI error:', e);
    throw e;
  }
}


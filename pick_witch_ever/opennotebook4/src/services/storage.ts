import { AppSettings, Notebook } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  llmProvider: 'gemini',
  llmApiKey: '',
  llmModel: 'gemini-2.5-flash',
  ollamaUrl: 'http://localhost:11434',
  lmStudioUrl: 'http://localhost:1234/v1',
  llmBaseUrl: '',

  searchProvider: 'ddgs',
  searchApiKey: '',
  firecrawlUrl: 'http://localhost:3002',
  searchDepth: 'fast',

  audioProvider: 'edge-tts',
  audioApiKey: '',

  imageProvider: 'google',
  imageApiKey: '',
  imageModel: 'gemini-3.1-flash-image',
  imageBaseUrl: '',
  imageComfyUiUrl: 'http://localhost:8188',

  videoProvider: 'google',
  videoApiKey: '',
  videoModel: 'veo-3.1-generate-preview',
  videoBaseUrl: '',
  videoComfyUiUrl: 'http://localhost:8188',
};

export const INITIAL_NOTEBOOKS: Notebook[] = [
  {
    id: 'nb-1',
    title: 'Untitled notebook',
    emoji: '📙',
    sources: [],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-09-12').getTime(),
    updatedAt: new Date('2026-09-12').getTime(),
  },
  {
    id: 'nb-2',
    title: 'Google Network Security Traffic Alert',
    emoji: '🚫',
    sources: [
      {
        id: 's-sec-1',
        title: 'Network Traffic Anomaly Report.pdf',
        type: 'pdf',
        content: 'Analysis of automated network packets and DDoS anomaly detection thresholds.',
        tokenCount: 4200,
        selected: true,
        addedAt: Date.now(),
      }
    ],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-09-09').getTime(),
    updatedAt: new Date('2026-09-09').getTime(),
  },
  {
    id: 'nb-3',
    title: 'Automated Traffic Network Security...',
    emoji: '🚫',
    sources: [
      {
        id: 's-sec-2',
        title: 'Automated Traffic Filter Rules.txt',
        type: 'text',
        content: 'Traffic classification heuristic rules and firewall policy enforcement.',
        tokenCount: 2900,
        selected: true,
        addedAt: Date.now(),
      }
    ],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-09-09').getTime(),
    updatedAt: new Date('2026-09-09').getTime(),
  },
  {
    id: 'nb-4',
    title: 'Magnetic and Heating Effects of Electricity',
    emoji: '⚡',
    isShared: true,
    sources: Array.from({ length: 12 }).map((_, i) => ({
      id: `s-mag-${i}`,
      title: `Electromagnetism Lesson Chapter ${i + 1}.pdf`,
      type: 'pdf',
      content: 'Current-induced magnetic fields, Faraday law of induction, and Joule heating equations.',
      tokenCount: 3500,
      selected: true,
      addedAt: Date.now(),
    })),
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-09-07').getTime(),
    updatedAt: new Date('2026-09-07').getTime(),
  },
  {
    id: 'nb-5',
    title: 'Exploring Forces: Pushes, Pulls, and...',
    emoji: '💪',
    sources: Array.from({ length: 8 }).map((_, i) => ({
      id: `s-force-${i}`,
      title: `Classical Mechanics Module ${i + 1}.pdf`,
      type: 'pdf',
      content: 'Newton laws of motion, contact vs non-contact forces, friction and inertia.',
      tokenCount: 2800,
      selected: true,
      addedAt: Date.now(),
    })),
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-08-25').getTime(),
    updatedAt: new Date('2026-08-25').getTime(),
  },
  {
    id: 'nb-6',
    title: 'From Reactive Creation to Proactiv...',
    emoji: '🤖',
    sources: [
      {
        id: 's-proact-1',
        title: 'Proactive AI Systems Architecture.md',
        type: 'text',
        content: 'Transitioning from query-response LLM bots to autonomous proactive assistants.',
        tokenCount: 5100,
        selected: true,
        addedAt: Date.now(),
      }
    ],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-08-30').getTime(),
    updatedAt: new Date('2026-08-30').getTime(),
  },
  {
    id: 'nb-7',
    title: 'Wipro earthian: Sustainability and...',
    emoji: '♻️',
    sources: Array.from({ length: 22 }).map((_, i) => ({
      id: `s-wipro-${i}`,
      title: `Ecological Sustainability Field Study ${i + 1}.pdf`,
      type: 'pdf',
      content: 'Water management, waste circularity, renewable energy, and biodiversity preservation.',
      tokenCount: 4100,
      selected: true,
      addedAt: Date.now(),
    })),
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-08-20').getTime(),
    updatedAt: new Date('2026-08-20').getTime(),
  },
  {
    id: 'nb-8',
    title: 'Sight: AI Vision Assistant for the...',
    emoji: '🕶️',
    sources: Array.from({ length: 3 }).map((_, i) => ({
      id: `s-sight-${i}`,
      title: `Computer Vision Spatial Audio Paper ${i + 1}.pdf`,
      type: 'pdf',
      content: 'Real-time object detection, scene narration, and assistive wearable interfaces.',
      tokenCount: 6200,
      selected: true,
      addedAt: Date.now(),
    })),
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-07-30').getTime(),
    updatedAt: new Date('2026-07-30').getTime(),
  },
  {
    id: 'nb-9',
    title: 'Reinforcement Learning: An...',
    emoji: '🤖',
    sources: [
      {
        id: 's-rl-1',
        title: 'Sutton & Barto RL Chapter 1.pdf',
        type: 'pdf',
        content: 'Markov Decision Processes, Value Iteration, Q-Learning, and Policy Gradients.',
        tokenCount: 9400,
        selected: true,
        addedAt: Date.now(),
      }
    ],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-06-07').getTime(),
    updatedAt: new Date('2026-06-07').getTime(),
  },
  {
    id: 'nb-10',
    title: 'Salwan Public School: Legacy, Philosophy,...',
    emoji: '🏫',
    sources: [
      {
        id: 's-school-1',
        title: 'Institutional Heritage & Pedagogy.pdf',
        type: 'pdf',
        content: 'Educational ethos, holistic pedagogy, and academic excellence milestones.',
        tokenCount: 3800,
        selected: true,
        addedAt: Date.now(),
      }
    ],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-04-16').getTime(),
    updatedAt: new Date('2026-04-16').getTime(),
  },
  {
    id: 'nb-11',
    title: 'The Meta OpenEnv RL Hackathon Guide',
    emoji: '🔄',
    sources: Array.from({ length: 4 }).map((_, i) => ({
      id: `s-meta-${i}`,
      title: `OpenEnv Setup & Evaluation Benchmark ${i + 1}.md`,
      type: 'text',
      content: 'Docker environment setup, agent reward functions, and submission criteria.',
      tokenCount: 4500,
      selected: true,
      addedAt: Date.now(),
    })),
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-04-25').getTime(),
    updatedAt: new Date('2026-04-25').getTime(),
  },
  {
    id: 'nb-12',
    title: "Milestones of Women's Equality an...",
    emoji: '✊',
    sources: Array.from({ length: 11 }).map((_, i) => ({
      id: `s-fem-${i}`,
      title: `Historical Suffrage & Constitutional Rights ${i + 1}.pdf`,
      type: 'pdf',
      content: 'Equal rights amendments, voting suffrage movements, and legal equity milestones.',
      tokenCount: 5300,
      selected: true,
      addedAt: Date.now(),
    })),
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-03-05').getTime(),
    updatedAt: new Date('2026-03-05').getTime(),
  },
  {
    id: 'nb-13',
    title: 'Devotional Paths to the Divine',
    emoji: '🙏',
    sources: [
      {
        id: 's-div-1',
        title: 'Bhakti & Sufi Traditions Analysis.pdf',
        type: 'pdf',
        content: 'Philosophical synthesis of medieval mysticism, poetry, and syncretic devotion.',
        tokenCount: 4600,
        selected: true,
        addedAt: Date.now(),
      }
    ],
    messages: [],
    artifacts: [],
    createdAt: new Date('2026-02-25').getTime(),
    updatedAt: new Date('2026-02-25').getTime(),
  },
];

export const getStoredNotebooks = (): Notebook[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('opennotebook_notebooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((nb) => nb && typeof nb === 'object' && typeof nb.id === 'string');
        }
      }
    }
  } catch (e) {
    console.error('Failed to load notebooks', e);
  }
  return INITIAL_NOTEBOOKS;
};

export const saveStoredNotebooks = (notebooks: Notebook[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const safeList = Array.isArray(notebooks) ? notebooks.filter(Boolean) : INITIAL_NOTEBOOKS;
      localStorage.setItem('opennotebook_notebooks', JSON.stringify(safeList));
    }
  } catch (e) {
    console.error('Failed to save notebooks', e);
  }
};

export const getStoredSettings = (): AppSettings => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('opennotebook_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return { ...DEFAULT_SETTINGS };
};

export const saveStoredSettings = (settings: AppSettings) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('opennotebook_settings', JSON.stringify(settings));
    }
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

export interface StorageUsage {
  usedBytes: number;
  usedFormatted: string;
  notebookCount: number;
  sourceCount: number;
  artifactCount: number;
}

export const getStorageUsageEstimate = (): StorageUsage => {
  try {
    let usedBytes = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        try {
          const key = localStorage.key(i);
          if (key) {
            const item = localStorage.getItem(key);
            usedBytes += (key.length + (item ? item.length : 0)) * 2;
          }
        } catch (e) {
          // ignore individual key read errors
        }
      }
    }

    const notebooks = getStoredNotebooks();
    const safeNotebooks = Array.isArray(notebooks) ? notebooks.filter(Boolean) : INITIAL_NOTEBOOKS;
    const sourceCount = safeNotebooks.reduce((acc, nb) => acc + (Array.isArray(nb?.sources) ? nb.sources.length : 0), 0);
    const artifactCount = safeNotebooks.reduce((acc, nb) => acc + (Array.isArray(nb?.artifacts) ? nb.artifacts.length : 0), 0);

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return {
      usedBytes,
      usedFormatted: formatSize(usedBytes),
      notebookCount: safeNotebooks.length,
      sourceCount,
      artifactCount,
    };
  } catch (err) {
    console.error('Error calculating storage usage estimate:', err);
    return {
      usedBytes: 0,
      usedFormatted: '0 B',
      notebookCount: 0,
      sourceCount: 0,
      artifactCount: 0,
    };
  }
};

export const exportNotebooksData = (): string => {
  const notebooks = getStoredNotebooks();
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    appName: 'NotebookLM Open Source',
    notebooks,
  };
  return JSON.stringify(payload, null, 2);
};

export const importNotebooksData = (jsonStr: string): { success: boolean; count: number; error?: string } => {
  try {
    const parsed = JSON.parse(jsonStr);
    const candidateList = Array.isArray(parsed) ? parsed : parsed.notebooks;
    if (!Array.isArray(candidateList) || candidateList.length === 0) {
      return { success: false, count: 0, error: 'Invalid file format: No notebooks found in JSON.' };
    }

    const validNotebooks: Notebook[] = candidateList.filter((nb: any) => nb && typeof nb.id === 'string' && typeof nb.title === 'string');
    if (validNotebooks.length === 0) {
      return { success: false, count: 0, error: 'No valid notebook entities detected.' };
    }

    const existing = getStoredNotebooks();
    const existingIds = new Set(existing.map((n) => n.id));
    
    const merged = [...existing];
    let addedCount = 0;
    for (const nb of validNotebooks) {
      if (existingIds.has(nb.id)) {
        merged.unshift({
          ...nb,
          id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: `${nb.title} (Imported)`,
          updatedAt: Date.now(),
        });
        addedCount++;
      } else {
        merged.unshift(nb);
        existingIds.add(nb.id);
        addedCount++;
      }
    }

    saveStoredNotebooks(merged);
    return { success: true, count: addedCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Failed to parse JSON file' };
  }
};

export const resetNotebooksToDefaults = (): void => {
  saveStoredNotebooks(INITIAL_NOTEBOOKS);
};


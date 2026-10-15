import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Radio, 
  Presentation, 
  Video, 
  Network, 
  FileText, 
  Layers, 
  HelpCircle, 
  BarChart3, 
  Table, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  FileDown,
  Volume2,
  Copy, 
  ExternalLink, 
  Search,
  FilePlus,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  Shuffle,
  LayoutGrid,
  BookOpen,
  Edit3,
  Eye,
  Printer,
  Bookmark,
  List,
  Loader2,
  Image as ImageIcon,
  Wand2,
  Maximize2,
  Smartphone,
  Tv,
  Clapperboard
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { StudioArtifact, StudioType, AppSettings } from '../types';
import { MindMapCanvas } from './MindMapCanvas';
import { printReportAsPdf, downloadReportAsPdfFile } from '../utils/pdfExport';
import { generateImageAPI } from '../services/api';
import { ExportDropdown, ExportOption } from './ExportDropdown';
import {
  exportAudioAsWav,
  exportAudioVtt,
  exportAudioSrt,
  exportAudioDialogueMarkdown,
  exportSlidesMarkdown,
  exportSlidesJson,
  exportSlidesHtmlPresentation,
  exportSpeakerNotesTxt,
  exportFlashcardsAnkiTsv,
  exportFlashcardsCsv,
  exportFlashcardsMarkdown,
  exportFlashcardsJson,
  exportQuizMarkdown,
  exportQuizJson,
  exportQuizCsv,
  printQuizSheet,
  exportVideoStoryboardTxt,
  exportVideoScriptMarkdown,
  exportVideoPromptsJson,
  exportVideoShotlistCsv,
  exportTableCsv,
  exportTableTsv,
  exportTableJson,
  exportTableMarkdown,
  exportReportMarkdown,
  exportReportTxt,
  exportReportHtml,
  exportInfographicSummaryMarkdown,
  exportInfographicPromptsJson,
} from '../utils/exportUtils';
import { FileCode, Music } from 'lucide-react';

interface StudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: StudioArtifact | null;
  targetType: StudioType | null;
  language?: string;
  sourceCount: number;
  notebookTitle?: string;
  onUpdateArtifact?: (updated: StudioArtifact) => void;
  onRequestCreateMindMap?: () => void;
  onRequestCreateQuiz?: () => void;
  onRequestCreateFlashcards?: () => void;
  onRequestCreateReport?: () => void;
  onRequestCreateInfographic?: () => void;
  onRequestCreateAudio?: () => void;
  onRequestCreateSlides?: () => void;
  onRequestCreateVideo?: () => void;
  onSaveToNote?: (title: string, content: string) => void;
  settings?: AppSettings;
}

export const StudioModal: React.FC<StudioModalProps> = ({
  isOpen,
  onClose,
  artifact,
  targetType,
  language = 'English',
  sourceCount,
  notebookTitle,
  onUpdateArtifact,
  onRequestCreateMindMap,
  onRequestCreateQuiz,
  onRequestCreateFlashcards,
  onRequestCreateReport,
  onRequestCreateInfographic,
  onRequestCreateAudio,
  onRequestCreateSlides,
  onRequestCreateVideo,
  onSaveToNote,
  settings,
}) => {
  const currentType = artifact ? artifact.type : targetType;
  
  // Audio Player & Speech Synthesis State
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeDialogueIndex, setActiveDialogueIndex] = useState<number>(-1);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1x' | '1.25x' | '1.5x'>('1x');
  
  // Slide Deck State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(true);
  const [copiedSlidePrompt, setCopiedSlidePrompt] = useState(false);

  // Video Overview State
  const [currentScene, setCurrentScene] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [copiedScenePrompt, setCopiedScenePrompt] = useState<number | null>(null);

  // Flashcards State (NotebookLM evaluation & redo system)
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardResults, setCardResults] = useState<Record<number, 'correct' | 'incorrect'>>({});
  const [customDeckIndices, setCustomDeckIndices] = useState<number[] | null>(null);
  const [isDeckFinished, setIsDeckFinished] = useState(false);
  const [flashcardViewMode, setFlashcardViewMode] = useState<'study' | 'grid'>('study');
  const [cardOrder, setCardOrder] = useState<number[]>([]);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, any>>({});
  const [selfGrades, setSelfGrades] = useState<Record<number, boolean>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});
  const [quizReviewMode, setQuizReviewMode] = useState(false);

  // Table Search State
  const [tableSearch, setTableSearch] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportMode, setReportMode] = useState<'reader' | 'document' | 'edit'>('reader');
  const [savedReportSuccess, setSavedReportSuccess] = useState(false);
  const [savedToNoteSuccess, setSavedToNoteSuccess] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const reportPrintContentRef = useRef<HTMLDivElement>(null);

  // Infographic State
  const [copiedInfographic, setCopiedInfographic] = useState(false);
  const [savedInfographicSuccess, setSavedInfographicSuccess] = useState(false);
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [infographicView, setInfographicView] = useState<'visual' | 'canvas'>('canvas');
  const [imageZoom, setImageZoom] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);

  // Note State
  const [noteTitle, setNoteTitle] = useState(artifact?.title || 'Untitled Note');
  const [noteContent, setNoteContent] = useState(artifact?.data?.content || '');
  const [noteMode, setNoteMode] = useState<'preview' | 'edit'>('preview');
  const [copiedNote, setCopiedNote] = useState(false);
  const [savedNoteSuccess, setSavedNoteSuccess] = useState(false);

  // Reset state on open or type change
  useEffect(() => {
    if (!isOpen) return;
    setIsPlaying(false);
    setActiveDialogueIndex(-1);
    setPlaybackProgress(0);
    setCurrentSlide(0);
    setShowSpeakerNotes(true);
    setCopiedSlidePrompt(false);
    setCurrentScene(0);
    setIsVideoPlaying(false);
    setCopiedScenePrompt(null);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setCardResults({});
    setCustomDeckIndices(null);
    setIsDeckFinished(false);
    setQuizAnswers({});
    setSelfGrades({});
    setSubmittedQuiz(false);
    setCurrentQuizIndex(0);
    setCheckedAnswers({});
    setQuizReviewMode(false);
    setTableSearch('');
    setCopiedReport(false);
    setReportText(artifact?.data?.content || '');
    setReportMode('reader');
    setIsExportingPdf(false);
    setSavedReportSuccess(false);
    setSavedToNoteSuccess(false);
    setShowToc(true);
    setCopiedInfographic(false);
    setSavedInfographicSuccess(false);
    setNoteTitle(artifact?.title || 'Untitled Note');
    setNoteContent(artifact?.data?.content || '');
    setNoteMode(artifact?.data?.content ? 'preview' : 'edit');
    setCopiedNote(false);
    setSavedNoteSuccess(false);

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, currentType, artifact]);

  // Fallback sample data if artifact data is empty
  const sampleSlides = [
    {
      title: '1. Executive Summary & Overview',
      points: [
        'Massive context windows (1.5M+ tokens) fundamentally obsolete fragmented RAG retrieval.',
        'High-density multimodal reasoning enables unified text, audio, and visual synthesis.',
        'Local BYOK architecture ensures privacy while maintaining frontier capabilities.',
      ],
      notes: 'Presenter: Emphasize that full-context loading eliminates retrieval boundary misses.',
    },
    {
      title: '2. Grounded Citation Engine',
      points: [
        'Exact paragraph and character coordinate mapping ensures 100% auditable references.',
        'Reduces hallucination rates by cross-verifying generated tokens against ingested sources.',
        'Supports live switching between sources to observe changes in output grounding.',
      ],
      notes: 'Presenter: Show how clicking citations opens the exact page excerpt.',
    },
    {
      title: '3. Multimodal Studio Deliverables',
      points: [
        'Dual-host conversational Audio Overview with natural fillers and banter.',
        'One-click interactive quizzes, dynamic flashcards, and structured data tables.',
        'Seamless export to Markdown, PDF, and CSV for external workflows.',
      ],
      notes: 'Presenter: Conclude with demo of the 2-speaker audio podcast generation.',
    },
  ];

  const sampleFlashcards = [
    {
      q: 'What is the primary advantage of long-context models over traditional RAG?',
      a: 'Long-context models (1.5M+ tokens) load entire document corpuses into working memory simultaneously, eliminating chunking boundaries, retrieval misses, and vector database latency.',
    },
    {
      q: 'How does NotebookLM achieve verifiable source grounding?',
      a: 'By parsing source documents into structured index offsets and prompting the LLM to emit strict in-line citation markers [1], [2] linked directly to original excerpts.',
    },
    {
      q: 'What makes the Audio Overview feature feel remarkably natural?',
      a: 'It prompts two distinct personas (an inquisitive explainer and a synthesizing expert) with natural conversational fillers voiced by dual-speaker TTS.',
    },
    {
      q: 'What is Firecrawl and how does it assist web ingestion?',
      a: 'Firecrawl renders dynamic JavaScript pages in headless Chromium, strips ads and navigation clutter, and outputs clean LLM-ready Markdown.',
    },
  ];

  const sampleQuiz = [
    {
      type: 'multiple_choice',
      question: 'Which architecture enables open-source NotebookLM to support 1M+ token contexts?',
      options: [
        'Chunking every PDF into 200-token vector embeddings',
        'Direct full-context injection into frontier model context windows',
        'Summarizing each page individually and discarding original text',
        'Running offline speech-to-text without memory',
      ],
      correct: 1,
      explanation: 'Modern frontier models natively accept 1M-2M tokens, allowing full source documents to be provided directly without vector loss.',
    },
    {
      type: 'fill_blank',
      question: 'In modern retrieval and LLM pipelines, ______ eliminates centralized operational costs by having users supply their own API keys.',
      blankAnswer: 'BYOK',
      acceptableAnswers: ['BYOK', 'Bring Your Own Key', 'bring your own key'],
      explanation: 'BYOK (Bring Your Own Key) ensures privacy and lets users pay directly for their token usage.',
    },
    {
      type: 'multiple_select',
      question: 'Which of the following are core capabilities of the OpenNotebook Studio? (Select all that apply)',
      options: [
        'Interactive Mind Maps with expandable subtopics',
        'Customizable multi-format Quizzes',
        'Direct source-grounded citations',
        'Centralized closed-source paywall locking data',
      ],
      correctAnswers: [0, 1, 2],
      explanation: 'OpenNotebook provides Mind Maps, custom Quizzes, and source-grounded synthesis while remaining fully open and private.',
    },
    {
      type: 'short_answer',
      question: 'Explain how Firecrawl improves web document ingestion for research synthesis compared to raw HTML fetching.',
      modelAnswer: 'Firecrawl renders JavaScript in headless Chromium, removes navigational boilerplate, ads, and cookies, and converts the clean page into LLM-ready markdown.',
      keyPoints: [
        'Executes dynamic JavaScript via headless browser',
        'Strips ads, scripts, headers, and clutter',
        'Outputs clean markdown formatted for model context'
      ],
      explanation: 'Clean markdown maximizes token efficiency and minimizes hallucination during source synthesis.',
    },
  ];

  const sampleMindMap = {
    title: 'Consolidated Informational Sources',
    children: [
      {
        title: 'Fusion Energy Development (CFS)',
        children: [
          { title: 'HTS Magnet R&D', summary: 'High-temperature superconducting magnets enabling compact fusion tokamaks [1].' },
          { title: 'SPARC Tokamak', summary: 'Net-energy demonstration magnetic confinement device [1].' },
          { title: 'ARC Pilot Plant', summary: 'Commercial scale pilot power plant design and grid integration [2].' },
        ],
      },
      {
        title: 'Middle School Academic Planner',
        children: [
          {
            title: 'English & History',
            children: [
              { title: 'Major Somnath Sharma (PVC)', summary: 'First Param Vir Chakra recipient at Battle of Badgam [1].' },
              { title: 'Battle of Badgam', summary: 'Critical defense of Srinagar airfield in 1947 [1].' },
              { title: "Somebody's Mother Poem", summary: 'Classic literary work emphasizing empathy and civic care [2].' },
              { title: 'Patriotism & Leadership', summary: 'Core curriculum theme in secondary social education [2].' },
            ],
          },
          {
            title: 'Language Skills',
            children: [
              { title: 'Prepositions of Time/Place', summary: 'Syntactic positional markers in English grammar [1].' },
              { title: 'Descriptive Paragraph Writing', summary: 'Sensory vocabulary and structured exposition techniques [2].' },
              { title: 'Sensory Details & Adjectives', summary: 'Expressive adjectives reinforcing narrative richness [2].' },
            ],
          },
          {
            title: 'Mathematics',
            children: [
              { title: 'Algebraic Expressions', summary: 'Linear equations, coefficients, and operations [3].' },
              { title: 'Geometric Properties', summary: 'Theorems on congruence and angles [3].' },
            ],
          },
        ],
      },
    ],
  };

  const samplePodcastDialogue = [
    {
      speaker: 'Sarah',
      avatar: 'bg-purple-600',
      text: "Welcome back to the Deep Dive! Today we're exploring the ingested source documents. And honestly, Michael, the depth and evidence here is really compelling.",
    },
    {
      speaker: 'Michael',
      avatar: 'bg-blue-600',
      text: "Yeah, it really is. Because the ingested material establishes clear empirical findings while retaining exact paragraph coordinate mapping for verifiable citations.",
    },
    {
      speaker: 'Sarah',
      avatar: 'bg-purple-600',
      text: "Right! And because it's completely BYOK, anyone can run this locally, plug in Gemini or Ollama, and have this exact studio running on their machine.",
    },
    {
      speaker: 'Michael',
      avatar: 'bg-blue-600',
      text: "Exactly. Plus, with speech synthesis, you get this seamless two-host banter right here in the browser.",
    },
  ];

  const sampleScenes = [
    {
      title: 'Scene 1: Introduction & Scope',
      narration: 'Welcome to this visual overview of the ingested research. Let us examine the foundational principles driving this workspace.',
      visualPrompt: 'Cinematic wide shot of modern holographic workspace with floating documents and knowledge graphs, 4K resolution.',
      duration: 5,
    },
    {
      title: 'Scene 2: Core Evidence & Analysis',
      narration: 'The ingested documentation establishes consistent findings across all evaluated benchmarks.',
      visualPrompt: 'Dynamic camera pan over glowing data nodes connecting into a structured knowledge graph, soft studio lighting.',
      duration: 8,
    },
    {
      title: 'Scene 3: Strategic Outcomes',
      narration: 'With complete grounding and multi-modal studio tools, these insights are ready for immediate action.',
      visualPrompt: 'Clean minimalist title card with elegant typography and subtle particle motion, dark theme aesthetic.',
      duration: 5,
    },
  ];

  const sampleColumns = ['Dimension / Parameter', 'Grounded Source Evidence', 'Analytical Impact', 'Status'];
  const sampleRows = [
    ['Context Retention', '1.5M+ Token Context Window', 'Eliminates vector chunk retrieval misses', 'Active'],
    ['Source Grounding', 'Paragraph Coordinate Mapping', 'Reduces hallucination rate by 94%', 'Verified'],
    ['Multi-Modal Delivery', '9 Studio Artifact Modalities', 'Accelerates knowledge transfer across formats', 'Ready'],
    ['Self-Hosting & BYOK', '100% Local Browser Key Storage', 'Zero third-party telemetry or GPU hosting costs', 'Enabled'],
  ];

  const sampleMetrics = [
    { label: 'Grounding Accuracy', value: '99.4%', change: '+14%', description: 'Verified against source paragraph offsets' },
    { label: 'Context Processing', value: '1.5M Tokens', description: 'Ingested into active workspace memory' },
    { label: 'Artifact Modalities', value: '9 Formats', description: 'Audio, Slides, Video, Mind Maps, Quizzes, etc.' },
    { label: 'Citation Provenance', value: '100% Auditable', description: 'Zero ungrounded hallucination rate' },
  ];

  const sampleBreakdown = [
    { category: 'Core Findings', percentage: 42 },
    { category: 'Methodology & Data', percentage: 28 },
    { category: 'Strategic Implications', percentage: 18 },
    { category: 'Actionable Deliverables', percentage: 12 },
  ];

  // Pick actual generated data or fallbacks
  const dialogue = artifact?.data?.podcastDialogue || samplePodcastDialogue;
  const slides = artifact?.data?.slides || sampleSlides;
  // Flashcards Data & Synchronization
  const rawFlashcards = (artifact?.data?.flashcards && Array.isArray(artifact.data.flashcards) && artifact.data.flashcards.length > 0)
    ? artifact.data.flashcards
    : sampleFlashcards;

  // Initialize cardOrder and reset state when artifact changes
  useEffect(() => {
    if (!isOpen || currentType !== 'flashcards') return;
    const len = rawFlashcards.length;
    setCardOrder(Array.from({ length: len }, (_, i) => i));
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setCardResults({});
    setCustomDeckIndices(null);
    setIsDeckFinished(false);
    setFlashcardViewMode('study');
  }, [isOpen, artifact?.id, currentType, rawFlashcards.length]);

  // Maintain ordered cards based on cardOrder (handles shuffling)
  const orderedCards = useMemo(() => {
    if (cardOrder.length === rawFlashcards.length) {
      return cardOrder.map((origIdx) => ({
        ...rawFlashcards[origIdx],
        originalIndex: origIdx,
      }));
    }
    return rawFlashcards.map((c: any, i: number) => ({ ...c, originalIndex: i }));
  }, [rawFlashcards, cardOrder]);

  // Evaluation counts
  const correctCount = useMemo(() => {
    return Object.values(cardResults).filter((v) => v === 'correct').length;
  }, [cardResults]);

  const incorrectCount = useMemo(() => {
    return Object.values(cardResults).filter((v) => v === 'incorrect').length;
  }, [cardResults]);

  // Active cards based on custom deck (e.g. Redo Incorrect) or all ordered cards
  const effectiveCards = useMemo(() => {
    if (customDeckIndices !== null) {
      return customDeckIndices.map((origIdx) => ({
        ...rawFlashcards[origIdx],
        originalIndex: origIdx,
      }));
    }
    return orderedCards;
  }, [customDeckIndices, rawFlashcards, orderedCards]);

  const handleShuffleCards = () => {
    setCardOrder((prev) => {
      const list = prev.length === rawFlashcards.length ? [...prev] : Array.from({ length: rawFlashcards.length }, (_, i) => i);
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    });
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsDeckFinished(false);
  };

  const handleGradeCard = (origIdx: number, grade: 'correct' | 'incorrect') => {
    setCardResults((prev) => ({
      ...prev,
      [origIdx]: grade,
    }));

    if (currentCardIndex < effectiveCards.length - 1) {
      setIsFlipped(false);
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      setIsFlipped(false);
      setIsDeckFinished(true);
    }
  };

  const handleRedoIncorrect = () => {
    const wrongIndices = Object.keys(cardResults)
      .filter((k) => cardResults[Number(k)] === 'incorrect')
      .map(Number);

    if (wrongIndices.length === 0) return;

    // Reset results for these cards so they can be re-evaluated
    setCardResults((prev) => {
      const updated = { ...prev };
      wrongIndices.forEach((idx) => {
        delete updated[idx];
      });
      return updated;
    });

    setCustomDeckIndices(wrongIndices);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsDeckFinished(false);
  };

  const handleRedoAll = () => {
    setCardResults({});
    setCustomDeckIndices(null);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsDeckFinished(false);
  };

  // Keyboard navigation for Flashcards
  useEffect(() => {
    if (!isOpen || currentType !== 'flashcards' || flashcardViewMode !== 'study' || effectiveCards.length === 0 || isDeckFinished) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const safeCardIdx = Math.min(currentCardIndex, effectiveCards.length - 1);
      const activeCard = effectiveCards[safeCardIdx];
      const origIdx = activeCard?.originalIndex ?? safeCardIdx;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'Digit1' || e.code === 'KeyX') {
        // Got it wrong / Incorrect
        e.preventDefault();
        handleGradeCard(origIdx, 'incorrect');
      } else if (e.code === 'Digit2' || e.code === 'KeyC') {
        // Got it right / Correct
        e.preventDefault();
        handleGradeCard(origIdx, 'correct');
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault();
        setIsFlipped(false);
        if (currentCardIndex < effectiveCards.length - 1) {
          setCurrentCardIndex((prev) => prev + 1);
        } else {
          setIsDeckFinished(true);
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentCardIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentType, flashcardViewMode, currentCardIndex, effectiveCards, isDeckFinished]);
  const quiz = artifact?.data?.quiz || sampleQuiz;
  const mindMap = artifact?.data?.mindMap || sampleMindMap;
  const scenes = artifact?.data?.scenes || sampleScenes;
  const reportContent = artifact?.data?.content || `# Research Dossier: ${artifact?.title || 'Synthesis'}\n\n**Prepared by:** OpenNotebookLM Research Core\n**Sources Analyzed:** ${sourceCount || 1} document(s)\n\n## 1. Executive Summary\nThis executive briefing examines the ingested source documents to extract verifiable insights, operational themes, and strategic implications.\n\n## 2. Key Empirical Findings\n- **Primary Evidence:** The analysis confirms high consistency across all evaluated data points.\n- **Operational Dynamics:** Direct grounding removes ambiguity and provides end-to-end citation provenance.\n- **Contextual Integrity:** Full-corpus processing preserves relationships across multi-page sections.\n\n## 3. Conclusions & Strategic Next Steps\nThe findings recommend leveraging multi-modal synthesis for downstream execution, including presentation slide decks and structured evaluation matrices.`;
  const metrics = artifact?.data?.metrics || sampleMetrics;
  const breakdown = artifact?.data?.breakdown || sampleBreakdown;
  const tableColumns = artifact?.data?.columns || sampleColumns;
  const tableRows = artifact?.data?.rows || sampleRows;

  // Speech Synthesis Implementation
  const speakLine = (index: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsPlaying(false);
      return;
    }
    if (index >= dialogue.length) {
      setIsPlaying(false);
      setActiveDialogueIndex(-1);
      setPlaybackProgress(100);
      return;
    }

    window.speechSynthesis.cancel();
    setActiveDialogueIndex(index);
    setPlaybackProgress(Math.round(((index + 1) / dialogue.length) * 100));

    const line = dialogue[index];
    const utterance = new SpeechSynthesisUtterance(line.text);
    const rateVal = playbackSpeed === '1x' ? 1.0 : playbackSpeed === '1.25x' ? 1.25 : 1.5;
    utterance.rate = rateVal;
    utterance.pitch = line.speaker === 'Sarah' ? 1.15 : 0.85;

    utterance.onend = () => {
      speakLine(index + 1);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      const startIdx = activeDialogueIndex >= 0 && activeDialogueIndex < dialogue.length ? activeDialogueIndex : 0;
      speakLine(startIdx);
    }
  };

  const handleResetAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setActiveDialogueIndex(0);
    setPlaybackProgress(0);
  };

  const handleDownloadScript = () => {
    const text = dialogue.map((d: any) => `${d.speaker.toUpperCase()}:\n${d.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audio_Overview_${artifact?.title || 'Podcast'}.txt`;
    a.click();
  };

  // Video Narration Playback via Web Speech
  const speakScene = (index: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsVideoPlaying(false);
      return;
    }
    if (index >= scenes.length) {
      setIsVideoPlaying(false);
      setCurrentScene(0);
      return;
    }

    window.speechSynthesis.cancel();
    setCurrentScene(index);

    const scene = scenes[index];
    const utterance = new SpeechSynthesisUtterance(scene.narration);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (index < scenes.length - 1) {
        speakScene(index + 1);
      } else {
        setIsVideoPlaying(false);
      }
    };
    utterance.onerror = () => {
      setIsVideoPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVideoPlay = () => {
    if (isVideoPlaying) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsVideoPlaying(false);
    } else {
      setIsVideoPlaying(true);
      speakScene(currentScene);
    }
  };

  const handleResetVideo = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsVideoPlaying(false);
    setCurrentScene(0);
  };

  const handleExportCSV = () => {
    const headerLine = tableColumns.join(',');
    const rowLines = tableRows.map((r: string[]) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(','));
    const csvContent = [headerLine, ...rowLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact?.title || 'Data_Table'}.csv`;
    a.click();
  };

  const handleDownloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const effectiveReportContent = reportText || artifact?.data?.content || reportContent;

  const handleCopyReport = () => {
    navigator.clipboard.writeText(effectiveReportContent);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleSaveReportEdits = () => {
    if (!artifact || !onUpdateArtifact) return;
    const updated: StudioArtifact = {
      ...artifact,
      data: {
        ...artifact.data,
        content: effectiveReportContent,
      },
    };
    onUpdateArtifact(updated);
    setSavedReportSuccess(true);
    setTimeout(() => setSavedReportSuccess(false), 2000);
  };

  const handleSaveReportToNotes = () => {
    if (!onSaveToNote) return;
    onSaveToNote(artifact?.title || 'Synthesized Report', effectiveReportContent);
    setSavedToNoteSuccess(true);
    setTimeout(() => setSavedToNoteSuccess(false), 2000);
  };

  const handlePrintReport = () => {
    printReportAsPdf({
      title: artifact?.title || 'Report',
      formatTitle: reportFormatLabel,
      notebookTitle: notebookTitle || artifact?.data?.notebookTitle,
      sourceCount: sourceCount || 1,
      wordCount: reportMetrics.words,
      readTime: reportMetrics.readTime,
      contentElement: reportPrintContentRef.current,
      markdownContent: effectiveReportContent,
    });
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await downloadReportAsPdfFile({
        title: artifact?.title || 'Report',
        formatTitle: reportFormatLabel,
        notebookTitle: notebookTitle || artifact?.data?.notebookTitle,
        sourceCount: sourceCount || 1,
        wordCount: reportMetrics.words,
        readTime: reportMetrics.readTime,
        contentElement: reportPrintContentRef.current,
        markdownContent: effectiveReportContent,
      });
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyInfographic = () => {
    const info = artifact?.data;
    const infoTitle = info?.title || artifact?.title || 'Infographic';
    const text = [
      `# ${infoTitle}`,
      info?.subtitle ? `> ${info.subtitle}` : '',
      info?.heroStat ? `\nHeadline: ${info.heroStat.value} — ${info.heroStat.label} (${info.heroStat.description})` : '',
      '\nKey Metrics:',
      ...(info?.metrics || []).map((m: any) => `• ${m.label}: ${m.value} (${m.description || ''})`),
      info?.processFlow?.length ? '\nProcess Flow:\n' + info.processFlow.map((p: any) => `${p.step}. ${p.title}: ${p.summary}`).join('\n') : '',
      info?.breakdown?.length ? '\nThematic Breakdown:\n' + info.breakdown.map((b: any) => `• ${b.category}: ${b.percentage}%`).join('\n') : '',
      info?.keyInsights?.length ? '\nKey Insights:\n' + info.keyInsights.map((k: string) => `• ${k}`).join('\n') : '',
      info?.takeaway ? `\nTakeaway: ${info.takeaway}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedInfographic(true);
    setTimeout(() => setCopiedInfographic(false), 2000);
  };

  const handleSaveInfographicToNotes = () => {
    if (!onSaveToNote) return;
    const info = artifact?.data;
    const infoTitle = info?.title || artifact?.title || 'Infographic';
    const text = [
      `# ${infoTitle}`,
      info?.subtitle ? `> ${info.subtitle}` : '',
      info?.heroStat ? `\n### Primary Headline: ${info.heroStat.value}\n**${info.heroStat.label}:** ${info.heroStat.description}` : '',
      '\n### Key Quantitative Metrics',
      ...(info?.metrics || []).map((m: any) => `- **${m.label}:** ${m.value} — *${m.description || ''}*`),
      info?.processFlow?.length ? '\n### Process & Milestones\n' + info.processFlow.map((p: any) => `${p.step}. **${p.title}:** ${p.summary}`).join('\n') : '',
      info?.breakdown?.length ? '\n### Thematic Distribution\n' + info.breakdown.map((b: any) => `- **${b.category}:** ${b.percentage}% — ${b.description || ''}`).join('\n') : '',
      info?.keyInsights?.length ? '\n### Key Empirical Insights\n' + info.keyInsights.map((k: string) => `- ${k}`).join('\n') : '',
      info?.takeaway ? `\n> **Core Takeaway:** ${info.takeaway}` : '',
    ].filter(Boolean).join('\n');

    onSaveToNote(infoTitle, text);
    setSavedInfographicSuccess(true);
    setTimeout(() => setSavedInfographicSuccess(false), 2000);
  };

  const handlePrintInfographic = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyPrompt = () => {
    const p = artifact?.data?.imagePrompt;
    if (!p) return;
    navigator.clipboard.writeText(p);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleGenerateInfographicImage = async () => {
    const prompt = artifact?.data?.imagePrompt;
    if (!prompt || !settings) return;
    setIsGeneratingImage(true);
    try {
      const res = await generateImageAPI(
        prompt,
        artifact?.data?.orientation || 'landscape',
        settings
      );
      if (res.success && res.imageUrl && onUpdateArtifact && artifact) {
        const updated: StudioArtifact = {
          ...artifact,
          data: {
            ...artifact.data,
            imageUrl: res.imageUrl,
          },
        };
        onUpdateArtifact(updated);
        setInfographicView('visual');
      } else if (res.error) {
        alert(`Image Generation Notice: ${res.error}\n\nTip: You can configure your Image Provider API key in Settings, or copy this prompt directly into Imagen 3 / DALL-E / FLUX!`);
      }
    } catch (e: any) {
      alert(`Error generating image: ${e.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const reportHeadings = useMemo(() => {
    if (!effectiveReportContent) return [];
    const lines = effectiveReportContent.split('\n');
    const list: Array<{ id: string; text: string; level: number }> = [];
    lines.forEach((line: string) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2].replace(/[*_~`]/g, '').trim();
        const id = rawText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        list.push({ id, text: rawText, level });
      }
    });
    return list;
  }, [effectiveReportContent]);

  const reportMetrics = useMemo(() => {
    if (!effectiveReportContent) return { words: 0, readTime: 1 };
    const words = effectiveReportContent.trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.round(words / 200));
    return { words, readTime };
  }, [effectiveReportContent]);

  const reportFormatLabel = useMemo(() => {
    const fmt = artifact?.data?.format;
    const map: Record<string, string> = {
      create_your_own: 'Custom Report',
      briefing: 'Briefing Doc',
      study_guide: 'Study Guide',
      blog_post: 'Blog Post',
      faq: 'FAQ Document',
      timeline: 'Chronology & Timeline',
      critique: 'Critical Analysis',
      dossier: 'Research Dossier',
    };
    return (
      (fmt && map[fmt]) ||
      artifact?.data?.formatTitle ||
      (artifact?.title ? artifact.title.split(':')[0] : 'Research Report')
    );
  }, [artifact]);

  // Filtered rows for Data Table
  const filteredRows = tableRows.filter((r: string[]) =>
    tableSearch.trim() === '' || r.some((cell) => cell.toLowerCase().includes(tableSearch.toLowerCase()))
  );

  // Escape key listener to close StudioModal gracefully
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showImagePromptModal && !imageZoom) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, showImagePromptModal, imageZoom]);

  if (!isOpen || !currentType) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#383e4e] text-gray-900 dark:text-[#e3e3e3] rounded-2xl w-full ${
        currentType === 'mindmap' ? 'max-w-6xl h-[88vh]' : 'max-w-4xl max-h-[90vh]'
      } overflow-hidden shadow-2xl flex flex-col transition-all duration-200`}>
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-white dark:bg-[#252a35] border border-gray-200 dark:border-[#333a49] shadow-xs">
              {currentType === 'audio' && <Radio className="w-4 h-4 text-purple-500 dark:text-purple-400" />}
              {currentType === 'slides' && <Presentation className="w-4 h-4 text-blue-500 dark:text-blue-400" />}
              {currentType === 'video' && <Video className="w-4 h-4 text-rose-500 dark:text-rose-400" />}
              {currentType === 'mindmap' && (
                <svg className="w-4 h-4 text-purple-500 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="10" width="4" height="4" rx="1" />
                  <rect x="17" y="4" width="4" height="4" rx="1" />
                  <rect x="17" y="16" width="4" height="4" rx="1" />
                  <path d="M7 12h5v-6h5" />
                  <path d="M12 12v6h5" />
                </svg>
              )}
              {currentType === 'report' && <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
              {currentType === 'flashcards' && <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
              {currentType === 'quiz' && <HelpCircle className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />}
              {currentType === 'infographic' && <BarChart3 className="w-4 h-4 text-pink-500 dark:text-pink-400" />}
              {currentType === 'table' && <Table className="w-4 h-4 text-teal-500 dark:text-teal-400" />}
              {currentType === 'note' && <FilePlus className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />}
            </span>
            <div>
              <h2 className="text-base font-medium text-gray-900 dark:text-white">
                {currentType === 'audio'
                  ? `Audio Overview (${language})`
                  : currentType === 'note'
                  ? (artifact?.title || 'Studio Note')
                  : currentType === 'mindmap'
                  ? (artifact?.title || 'Mind Map')
                  : `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Studio`}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-[#8a919e]">
                {currentType === 'note'
                  ? 'Saved Studio Note • Personal Knowledge Base'
                  : currentType === 'mindmap'
                  ? 'Interactive Knowledge Hierarchy • Google NotebookLM Canvas'
                  : `Grounded in ${sourceCount || 1} active source document(s) • Multi-Modal Studio`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className={`flex-1 ${currentType === 'mindmap' ? 'p-0 overflow-hidden relative' : 'p-6 overflow-y-auto'}`}>
          {/* 1. AUDIO OVERVIEW VIEW */}
          {currentType === 'audio' && (() => {
            const audioFormat = artifact?.data?.format || 'deep_dive';
            const audioLength = artifact?.data?.length || 'default';
            const audioFormatTitles: Record<string, string> = {
              deep_dive: 'Deep Dive Podcast',
              brief: 'Brief Overview',
              critique: 'Critical Review',
              debate: 'Structured Debate',
            };
            const audioHostDescriptions: Record<string, string> = {
              deep_dive: `2 Hosts: Sarah & Michael (${language}) • Live Web Speech TTS`,
              brief: `1 Host: Alex (${language}) • Concise Executive Briefing`,
              critique: `2 Analysts: Dr. Marcus & Elena (${language}) • Constructive Review`,
              debate: `2 Debaters: Jordan & Taylor (${language}) • Opposing Perspectives`,
            };
            const formatBadges: Record<string, string> = {
              deep_dive: 'Deep Dive',
              brief: 'Brief',
              critique: 'Critique',
              debate: 'Debate',
            };

            return (
              <div className="flex flex-col gap-6 max-w-2xl mx-auto">
                {/* Audio Wave Player Card */}
                <div className="bg-white dark:bg-gradient-to-br dark:from-[#272b38] dark:to-[#1c202a] border border-gray-200 dark:border-[#383e4e] rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-500/40 flex items-center justify-center shrink-0">
                        <Radio className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {audioFormatTitles[audioFormat] || 'Deep Dive Podcast'}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/40 text-[10px] font-semibold">
                            {formatBadges[audioFormat] || 'Deep Dive'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#202532] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#363e50] text-[10px] capitalize">
                            {audioLength}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[#9aa0a6] mt-0.5">
                          {audioHostDescriptions[audioFormat] || `2 Hosts (${language}) • Live Web Speech TTS`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onRequestCreateAudio && (
                        <button
                          type="button"
                          onClick={onRequestCreateAudio}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-500/40 text-purple-700 dark:text-purple-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Customize a new audio overview"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>New Audio</span>
                        </button>
                      )}
                      <button
                        onClick={() => setPlaybackSpeed(playbackSpeed === '1x' ? '1.25x' : playbackSpeed === '1.25x' ? '1.5x' : '1x')}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-[#1e222b] text-[11px] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#383e4e] cursor-pointer"
                      >
                        {playbackSpeed}
                      </button>
                      <ExportDropdown
                        items={[
                          {
                            id: 'wav',
                            label: 'Studio Audio Track',
                            extension: '.wav',
                            icon: Music,
                            description: 'Playable stereo podcast audio track',
                            badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                            onClick: async () => {
                              await exportAudioAsWav(
                                dialogue,
                                artifact?.title || 'Podcast',
                                settings?.audioApiKey
                              );
                            },
                          },
                          {
                            id: 'vtt',
                            label: 'WebVTT Subtitles',
                            extension: '.vtt',
                            icon: FileText,
                            description: 'Timed video & podcast captions',
                            badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                            onClick: () => {
                              exportAudioVtt(dialogue, artifact?.title || 'Podcast');
                            },
                          },
                          {
                            id: 'srt',
                            label: 'SubRip Subtitles',
                            extension: '.srt',
                            icon: FileText,
                            description: 'Standard media subtitle format',
                            badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                            onClick: () => {
                              exportAudioSrt(dialogue, artifact?.title || 'Podcast');
                            },
                          },
                          {
                            id: 'md',
                            label: 'Dialogue Transcript',
                            extension: '.md',
                            icon: FileCode,
                            description: 'Formatted markdown with timestamps',
                            badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
                            onClick: () => {
                              exportAudioDialogueMarkdown(dialogue, artifact?.title || 'Podcast', {
                                format: audioFormat,
                                length: audioLength,
                                language,
                              });
                            },
                          },
                          {
                            id: 'txt',
                            label: 'Podcast Script',
                            extension: '.txt',
                            icon: Download,
                            description: 'Plain text speaker dialogue',
                            badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                            onClick: handleDownloadScript,
                          },
                        ]}
                        buttonLabel="Export Audio"
                      />
                    </div>
                  </div>

                  {/* Animated Waveform Visualizer */}
                  <div className="h-16 bg-purple-50/50 dark:bg-[#161920] border border-purple-100 dark:border-transparent rounded-xl px-4 flex items-center justify-center gap-1.5 overflow-hidden">
                    {Array.from({ length: 42 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-300 ${
                          i < (playbackProgress / 100) * 42
                            ? 'bg-purple-600 dark:bg-purple-400'
                            : 'bg-purple-200 dark:bg-[#2d3342]'
                        } ${isPlaying ? 'animate-pulse' : ''}`}
                        style={{
                          height: isPlaying
                            ? `${Math.max(12, Math.sin(i * 0.4 + playbackProgress) * 45 + 15)}px`
                            : `${Math.max(8, (i % 5) * 6 + 10)}px`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-gray-500 dark:text-[#8a919e] font-mono">
                      {activeDialogueIndex >= 0 ? `Turn ${activeDialogueIndex + 1}/${dialogue.length}` : 'Ready'}
                    </span>
                    <div className="flex-1 bg-gray-200 dark:bg-[#2e3442] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-600 dark:bg-purple-400 h-full transition-all duration-300"
                        style={{ width: `${playbackProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-[#8a919e] font-mono">{playbackProgress}%</span>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-1">
                    <button
                      onClick={handleResetAudio}
                      title="Restart from beginning"
                      className="p-2 text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleTogglePlay}
                      className="w-12 h-12 rounded-full bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>
                  </div>
                </div>

                {/* Summary / Key Takeaways if available */}
                {(artifact?.data?.summary || (artifact?.data?.keyTakeaways && artifact.data.keyTakeaways.length > 0)) && (
                  <div className="p-4 rounded-xl bg-purple-50/40 dark:bg-[#1d222d] border border-purple-100 dark:border-[#2f3544] space-y-2.5">
                    {artifact?.data?.summary && (
                      <div>
                        <h4 className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                          Episode Summary
                        </h4>
                        <p className="text-xs text-gray-700 dark:text-[#c4c7c5] leading-relaxed">
                          {artifact.data.summary}
                        </p>
                      </div>
                    )}
                    {artifact?.data?.keyTakeaways && artifact.data.keyTakeaways.length > 0 && (
                      <div className="pt-2 border-t border-purple-100 dark:border-[#2a303d]">
                        <h4 className="text-[11px] font-semibold text-gray-600 dark:text-[#8a919e] uppercase tracking-wider mb-1.5">
                          Key Highlights
                        </h4>
                        <ul className="space-y-1">
                          {artifact.data.keyTakeaways.map((item: string, i: number) => (
                            <li key={i} className="text-xs text-gray-700 dark:text-[#b8bcc6] flex items-start gap-2">
                              <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Transcript Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a919e] uppercase tracking-wider">
                    Interactive Transcript
                  </h4>
                  <div className="space-y-3">
                    {dialogue.map((d: any, idx: number) => {
                      const isActive = activeDialogueIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setIsPlaying(true);
                            speakLine(idx);
                          }}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isActive
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-500 shadow-md ring-1 ring-purple-400/50'
                              : 'bg-white dark:bg-[#232733] border-gray-200 dark:border-[#313747] hover:border-purple-300 dark:hover:border-[#454e63]'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full ${d.avatar || 'bg-purple-600'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                            {d.speaker?.[0] || 'H'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">{d.speaker}</span>
                              {isActive && isPlaying && (
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                                  <Volume2 className="w-3 h-3 animate-bounce" /> Speaking
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-[#c4c7c5] leading-relaxed">{d.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            );
          })()}

          {/* 2. SLIDE DECK VIEW */}
          {currentType === 'slides' && (() => {
            const slideFormat = artifact?.data?.format || 'detailed_deck';
            const slideLength = artifact?.data?.length || 'default';
            const curSlide = slides[currentSlide] || slides[0] || { title: 'Slide', points: [] };

            return (
              <div className="flex flex-col gap-5 max-w-3xl mx-auto">
                {/* Slides Toolbar */}
                <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 dark:bg-[#1b1f28] border border-gray-200 dark:border-[#2f3544] p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40 text-xs font-medium">
                      {slideFormat === 'presenter_slides' ? 'Presenter Slides' : 'Detailed Deck'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white dark:bg-[#242935] text-gray-600 dark:text-[#9aa0a6] border border-gray-200 dark:border-[#383e4e] text-xs font-mono">
                      {slides.length} Slides ({slideLength})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onRequestCreateSlides && (
                      <button
                        type="button"
                        onClick={onRequestCreateSlides}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/40 text-blue-700 dark:text-blue-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Customize a new slide deck"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                        <span>New Slide Deck</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                        showSpeakerNotes
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-200'
                          : 'bg-white dark:bg-[#252a35] border-gray-200 dark:border-[#383e4e] text-gray-600 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span>🎙️ Speaker Notes: {showSpeakerNotes ? 'On' : 'Off'}</span>
                    </button>

                    <ExportDropdown
                      items={[
                        {
                          id: 'html',
                          label: 'Presentation Slideshow',
                          extension: '.html',
                          icon: Presentation,
                          description: 'Standalone interactive presentation',
                          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                          onClick: () => {
                            exportSlidesHtmlPresentation(slides, artifact?.title || 'Slide_Deck');
                          },
                        },
                        {
                          id: 'md',
                          label: 'Slide Deck Markdown',
                          extension: '.md',
                          icon: FileText,
                          description: 'Full slides with notes & callouts',
                          badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                          onClick: () => {
                            exportSlidesMarkdown(slides, artifact?.title || 'Slide_Deck');
                          },
                        },
                        {
                          id: 'json',
                          label: 'Slides JSON Schema',
                          extension: '.json',
                          icon: FileCode,
                          description: 'Structured slides & speaker data',
                          badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                          onClick: () => {
                            exportSlidesJson(slides, artifact?.title || 'Slide_Deck', {
                              format: slideFormat,
                              length: slideLength,
                            });
                          },
                        },
                        {
                          id: 'notes',
                          label: 'Speaker Notes Script',
                          extension: '.txt',
                          icon: Download,
                          description: 'Teleprompter rehearsal talk tracks',
                          badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                          onClick: () => {
                            exportSpeakerNotesTxt(slides, artifact?.title || 'Slide_Deck');
                          },
                        },
                      ]}
                      buttonLabel="Export Deck"
                    />
                  </div>
                </div>

                {/* Main 16:9 Slide Canvas */}
                <div className="aspect-[16/9] w-full bg-white dark:bg-[#161921] border border-gray-200 dark:border-[#383e4e] rounded-2xl p-8 flex flex-col justify-between shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="text-xs font-mono text-gray-600 dark:text-[#8a919e] bg-gray-100 dark:bg-[#232732] px-2.5 py-1 rounded-full border border-gray-200 dark:border-[#313747]">
                      Slide {currentSlide + 1} of {slides.length}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                      {curSlide?.title}
                    </h3>
                    {curSlide?.subtitle && (
                      <p className="text-xs text-blue-600 dark:text-blue-300 font-medium mt-1 mb-3">
                        {curSlide.subtitle}
                      </p>
                    )}

                    {/* Stat Callout Banner if present */}
                    {curSlide?.statCallout && (
                      <div className="my-3 p-3.5 rounded-xl bg-blue-50 dark:bg-gradient-to-r dark:from-blue-950/60 dark:to-indigo-950/50 border border-blue-200 dark:border-blue-500/40 flex items-center gap-4">
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight shrink-0">
                          {curSlide.statCallout.value}
                        </span>
                        <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                          {curSlide.statCallout.label}
                        </span>
                      </div>
                    )}

                    <ul className="space-y-3 mt-3">
                      {curSlide?.points?.map((pt: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-[#d1d5db] leading-relaxed">
                          <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 mt-2 shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Speaker Notes Drawer */}
                  {showSpeakerNotes && curSlide?.notes && (
                    <div className="pt-3 border-t border-blue-100 dark:border-[#292e3a] text-xs text-gray-600 dark:text-[#9aa0a6] bg-blue-50/50 dark:bg-[#11131a]/80 p-3 rounded-xl flex items-start gap-2.5 mt-3">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0">🎙️ Presenter Script:</span>
                      <span className="italic leading-relaxed">{curSlide.notes}</span>
                    </div>
                  )}
                </div>

                {/* Slide Visual Prompt Accordion */}
                {curSlide?.visualPrompt && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#171a22] border border-gray-200 dark:border-[#2f3544] flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider block mb-0.5">🎬 Slide Graphic Generation Prompt</span>
                      <p className="text-[11px] text-gray-500 dark:text-[#9aa0a6] truncate">{curSlide.visualPrompt}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(curSlide.visualPrompt || '');
                        setCopiedSlidePrompt(true);
                        setTimeout(() => setCopiedSlidePrompt(false), 2000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#222733] hover:bg-gray-100 dark:hover:bg-[#2c3240] border border-gray-200 dark:border-[#343b4c] text-[11px] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                    >
                      {copiedSlidePrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSlidePrompt ? 'Copied' : 'Copy Prompt'}</span>
                    </button>
                  </div>
                )}

                {/* Slide Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#252a35] hover:bg-gray-100 dark:hover:bg-[#2d3340] border border-gray-200 dark:border-[#383e4e] text-xs font-medium text-gray-800 dark:text-white flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <div className="flex gap-1.5">
                    {slides.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`h-2.5 rounded-full transition-all cursor-pointer ${currentSlide === idx ? 'bg-blue-500 dark:bg-blue-400 w-6' : 'bg-gray-300 dark:bg-[#383e4e] w-2.5'}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                    disabled={currentSlide === slides.length - 1}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#252a35] hover:bg-gray-100 dark:hover:bg-[#2d3340] border border-gray-200 dark:border-[#383e4e] text-xs font-medium text-gray-800 dark:text-white flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            );
          })()}

          {/* 3. FLASHCARDS VIEW (NotebookLM Evaluation & Redo System) */}
          {currentType === 'flashcards' && (() => {
            const safeCardIdx = effectiveCards.length > 0 ? Math.min(currentCardIndex, effectiveCards.length - 1) : 0;
            const activeCard = effectiveCards[safeCardIdx] || effectiveCards[0] || rawFlashcards[0] || { q: '', a: '' };
            const activeOrigIdx = activeCard?.originalIndex ?? safeCardIdx;
            const currentResult = cardResults[activeOrigIdx];
            const isReviewingIncorrect = customDeckIndices !== null;

            return (
              <div className="flex flex-col gap-5 max-w-4xl mx-auto py-2">
                {/* Deck Toolbar & Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {flashcardViewMode === 'study' && !isDeckFinished && effectiveCards.length > 0
                        ? `Card ${safeCardIdx + 1} of ${effectiveCards.length}`
                        : `${effectiveCards.length} Cards`}
                    </span>

                    {/* Mode Tag if Reviewing Incorrect */}
                    {isReviewingIncorrect && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-[10px] font-semibold flex items-center gap-1.5">
                        <span>Reviewing Incorrect</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomDeckIndices(null);
                            setCurrentCardIndex(0);
                            setIsFlipped(false);
                            setIsDeckFinished(false);
                          }}
                          className="hover:text-rose-900 dark:hover:text-white underline cursor-pointer"
                        >
                          Exit
                        </button>
                      </span>
                    )}

                    {/* Score Badges */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{correctCount} Correct</span>
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1">
                        <X className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>{incorrectCount} Incorrect</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions & Filters */}
                  <div className="flex items-center gap-2">
                    {/* Redo Incorrect Button (NotebookLM) */}
                    {incorrectCount > 0 && !isDeckFinished && (
                      <button
                        type="button"
                        onClick={handleRedoIncorrect}
                        title="Redo cards marked as incorrect"
                        className="px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                        <span>Redo Incorrect ({incorrectCount})</span>
                      </button>
                    )}

                    {/* Redo All Button */}
                    {!isDeckFinished && (
                      <button
                        type="button"
                        onClick={handleRedoAll}
                        title="Restart entire deck from beginning"
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202530] hover:bg-gray-100 dark:hover:bg-[#282f3d] border border-gray-200 dark:border-[#2f3645] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Redo All</span>
                      </button>
                    )}

                    {/* Shuffle Button */}
                    <button
                      type="button"
                      onClick={handleShuffleCards}
                      title="Shuffle cards order"
                      className="p-1.5 rounded-lg bg-white dark:bg-[#202530] hover:bg-gray-100 dark:hover:bg-[#282f3d] border border-gray-200 dark:border-[#2f3645] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer shadow-xs"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>

                    {/* View Mode Toggle: Study vs Grid */}
                    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-[#202530] border border-gray-200 dark:border-[#2f3645] p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setFlashcardViewMode('study')}
                        title="Interactive Flip Card mode"
                        className={`p-1.5 rounded-md transition-all cursor-pointer ${
                          flashcardViewMode === 'study'
                            ? 'bg-white dark:bg-[#2d3444] text-gray-900 dark:text-white shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlashcardViewMode('grid')}
                        title="Grid View (All Cards)"
                        className={`p-1.5 rounded-md transition-all cursor-pointer ${
                          flashcardViewMode === 'grid'
                            ? 'bg-white dark:bg-[#2d3444] text-gray-900 dark:text-white shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <ExportDropdown
                      items={[
                        {
                          id: 'anki',
                          label: 'Anki / Quizlet Deck',
                          extension: '.tsv',
                          icon: Layers,
                          description: 'Tab-delimited native Anki import',
                          badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                          onClick: () => {
                            exportFlashcardsAnkiTsv(effectiveCards, artifact?.title || 'Flashcards');
                          },
                        },
                        {
                          id: 'md',
                          label: 'Study Guide Deck',
                          extension: '.md',
                          icon: FileText,
                          description: 'Markdown with spoiler reveal answers',
                          badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                          onClick: () => {
                            exportFlashcardsMarkdown(effectiveCards, artifact?.title || 'Flashcards');
                          },
                        },
                        {
                          id: 'csv',
                          label: 'Flashcards CSV',
                          extension: '.csv',
                          icon: Table,
                          description: 'Spreadsheet question & answer table',
                          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                          onClick: () => {
                            exportFlashcardsCsv(effectiveCards, artifact?.title || 'Flashcards');
                          },
                        },
                        {
                          id: 'json',
                          label: 'Flashcards JSON',
                          extension: '.json',
                          icon: FileCode,
                          description: 'Raw flashcard questions array',
                          badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                          onClick: () => {
                            exportFlashcardsJson(effectiveCards, artifact?.title || 'Flashcards');
                          },
                        },
                      ]}
                      buttonLabel="Export Cards"
                    />
                  </div>
                </div>


                {/* Deck Progress Bar */}
                <div className="w-full bg-[#1b1f28] rounded-full h-1.5 overflow-hidden border border-[#2a303e]">
                  <div
                    className="bg-linear-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        effectiveCards.length > 0 && !isDeckFinished
                          ? ((safeCardIdx + 1) / effectiveCards.length) * 100
                          : isDeckFinished
                          ? 100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                {/* 1. STUDY FLIP CARD MODE */}
                {flashcardViewMode === 'study' && (
                  <div className="flex flex-col items-center gap-5 max-w-xl mx-auto w-full">
                    {isDeckFinished || effectiveCards.length === 0 ? (
                      /* Deck Completed / Evaluation Summary Screen (NotebookLM) */
                      <div className="w-full py-10 px-6 rounded-2xl bg-white dark:bg-[#1d222c] border border-gray-200 dark:border-[#2f3645] text-center flex flex-col items-center gap-4 shadow-xl">
                        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-0.5">
                          <Award className="w-7 h-7" />
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            {incorrectCount === 0 && correctCount > 0
                              ? 'Perfect Score! 🎉'
                              : 'Deck Review Completed!'}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-[#9aa0a6] mt-1 max-w-md leading-relaxed">
                            {incorrectCount > 0
                              ? `You got ${correctCount} out of ${effectiveCards.length} cards right. Redo the ${incorrectCount} card${incorrectCount > 1 ? 's' : ''} you got wrong to lock them into memory!`
                              : `Outstanding! You got all ${effectiveCards.length} cards right in this review round.`}
                          </p>
                        </div>

                        {/* Score Breakdown Cards */}
                        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-1">
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex flex-col items-center">
                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</span>
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300/80">Got it right</span>
                          </div>
                          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 flex flex-col items-center">
                            <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{incorrectCount}</span>
                            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300/80">Got it wrong</span>
                          </div>
                        </div>

                        {/* Primary Action Buttons (Redo incorrect vs Redo all) */}
                        <div className="flex flex-wrap items-center justify-center gap-3 mt-3 w-full">
                          {incorrectCount > 0 && (
                            <button
                              type="button"
                              onClick={handleRedoIncorrect}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-xs font-semibold text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>Redo Incorrect Cards ({incorrectCount})</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleRedoAll}
                            className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                              incorrectCount === 0
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                                : 'bg-gray-100 dark:bg-[#282f3d] hover:bg-gray-200 dark:hover:bg-[#323b4c] text-gray-900 dark:text-white border border-gray-200 dark:border-[#384255]'
                            }`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Redo All Flashcards ({rawFlashcards.length})</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Interactive Flip Card */}
                        <div
                          onClick={() => setIsFlipped(!isFlipped)}
                          className="w-full min-h-[300px] p-7 rounded-2xl bg-white dark:bg-gradient-to-b dark:from-[#222734] dark:to-[#1c202a] border border-gray-200 dark:border-[#343c4f] hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-all cursor-pointer flex flex-col justify-between shadow-xl relative select-none group"
                        >
                          {/* Card Header Info */}
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-semibold uppercase tracking-wider text-[10px]">
                                {activeCard?.category || 'Core Concept'}
                              </span>
                              {activeCard?.sourceTitle && (
                                <span className="text-gray-500 dark:text-[#8a919e] truncate max-w-[200px]" title={activeCard.sourceTitle}>
                                  • {activeCard.sourceTitle}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {currentResult === 'correct' && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-medium text-[10px] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Got it right
                                </span>
                              )}
                              {currentResult === 'incorrect' && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400 font-medium text-[10px] flex items-center gap-1">
                                  <X className="w-3 h-3" /> Got it wrong
                                </span>
                              )}
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {isFlipped ? 'Answer' : 'Question'}
                              </span>
                            </div>
                          </div>

                          {/* Card Body Content */}
                          <div className="my-auto py-6 text-center px-4">
                            <p className="text-lg font-medium text-gray-900 dark:text-white leading-relaxed">
                              {isFlipped ? (activeCard?.a || activeCard?.answer) : (activeCard?.q || activeCard?.question)}
                            </p>
                          </div>

                          {/* Card Footer Hint */}
                          <div className="text-[11px] text-gray-500 dark:text-[#8a919e] text-center flex items-center justify-center gap-1.5">
                            <span>↻</span>
                            <span>Click card or press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2b3342] text-[10px] text-gray-700 dark:text-gray-300 font-mono">Space</kbd> to flip</span>
                          </div>
                        </div>

                        {/* Evaluation Options (NotebookLM 2-Option System: Incorrect vs Correct) */}
                        <div className="flex items-center gap-3 w-full">
                          {/* Previous Card */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsFlipped(false);
                              setCurrentCardIndex(Math.max(0, safeCardIdx - 1));
                            }}
                            disabled={safeCardIdx === 0}
                            title="Previous card (←)"
                            className="p-3 rounded-xl bg-white dark:bg-[#222733] border border-gray-200 dark:border-[#343c4f] text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#2c3344] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-xs"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          {/* 1. Got it wrong (Incorrect) */}
                          <button
                            type="button"
                            onClick={() => handleGradeCard(activeOrigIdx, 'incorrect')}
                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                              currentResult === 'incorrect'
                                ? 'bg-rose-600 dark:bg-rose-900/80 border-2 border-rose-500 text-white ring-2 ring-rose-500/20'
                                : 'bg-rose-50 dark:bg-[#222733] hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white border border-rose-200 dark:border-[#343c4f] hover:border-rose-400'
                            }`}
                          >
                            <X className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            <span>Got it wrong</span>
                            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-rose-100 dark:bg-[#181b22] text-[10px] text-rose-700 dark:text-rose-400 font-mono">1</kbd>
                          </button>

                          {/* 2. Got it right (Correct) */}
                          <button
                            type="button"
                            onClick={() => handleGradeCard(activeOrigIdx, 'correct')}
                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                              currentResult === 'correct'
                                ? 'bg-emerald-600 dark:bg-emerald-800/90 border-2 border-emerald-500 text-white ring-2 ring-emerald-500/20'
                                : 'bg-emerald-50 dark:bg-[#222733] hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white border border-emerald-200 dark:border-[#343c4f] hover:border-emerald-400'
                            }`}
                          >
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Got it right</span>
                            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-[#181b22] text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">2</kbd>
                          </button>

                          {/* Next / Skip Card */}
                          <button
                            type="button"
                            onClick={() => {
                              setIsFlipped(false);
                              if (safeCardIdx < effectiveCards.length - 1) {
                                setCurrentCardIndex(safeCardIdx + 1);
                              } else {
                                setIsDeckFinished(true);
                              }
                            }}
                            title="Next card (→)"
                            className="p-3 rounded-xl bg-white dark:bg-[#222733] border border-gray-200 dark:border-[#343c4f] text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-[#2c3344] transition-colors cursor-pointer shadow-xs"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Keyboard Shortcuts Pill */}
                        <div className="text-[11px] text-gray-400 dark:text-[#6b7280] flex flex-wrap items-center justify-center gap-2.5">
                          <span>Shortcuts:</span>
                          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-[#1e232e] text-[10px] text-gray-600 dark:text-gray-400 font-mono">Space</kbd> flip</span>
                          <span>•</span>
                          <span><kbd className="px-1 py-0.5 rounded bg-rose-50 dark:bg-[#1e232e] text-[10px] text-rose-600 dark:text-rose-400 font-mono">1</kbd> or <kbd className="px-1 py-0.5 rounded bg-rose-50 dark:bg-[#1e232e] text-[10px] text-rose-600 dark:text-rose-400 font-mono">X</kbd> Wrong</span>
                          <span>•</span>
                          <span><kbd className="px-1 py-0.5 rounded bg-emerald-50 dark:bg-[#1e232e] text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">2</kbd> or <kbd className="px-1 py-0.5 rounded bg-emerald-50 dark:bg-[#1e232e] text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">C</kbd> Right</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 2. GRID OVERVIEW MODE */}
                {flashcardViewMode === 'grid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-w-5xl mx-auto w-full">
                    {rawFlashcards.map((card: any, idx: number) => {
                      const origIdx = card.originalIndex ?? idx;
                      const res = cardResults[origIdx];

                      return (
                        <div
                          key={origIdx}
                          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                            res === 'correct'
                              ? 'bg-emerald-50/70 dark:bg-[#18231e] border-emerald-300 dark:border-emerald-600/40'
                              : res === 'incorrect'
                              ? 'bg-rose-50/70 dark:bg-[#25191b] border-rose-300 dark:border-rose-600/40'
                              : 'bg-white dark:bg-[#1e232e] border-gray-200 dark:border-[#2e3545] hover:border-gray-300 dark:hover:border-[#404a5e] shadow-xs'
                          }`}
                        >
                          <div className="space-y-2.5">
                            {/* Card Header */}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono text-[10px] text-gray-500 dark:text-[#8a919e]">
                                #{origIdx + 1}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {res === 'correct' && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" /> Right
                                  </span>
                                )}
                                {res === 'incorrect' && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 text-[10px] font-medium flex items-center gap-0.5">
                                    <X className="w-2.5 h-2.5" /> Wrong
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-[#272e3d] text-indigo-700 dark:text-indigo-300 text-[10px] font-medium">
                                  {card.category || 'Concept'}
                                </span>
                              </div>
                            </div>

                            {/* Question */}
                            <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">
                              {card.q || card.question}
                            </p>

                            {/* Answer */}
                            <div className="pt-2 border-t border-gray-100 dark:border-[#2a3140] text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                              {card.a || card.answer}
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="pt-3 mt-3 border-t border-gray-100 dark:border-[#2a3140] flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => {
                                setFlashcardViewMode('study');
                                setCurrentCardIndex(idx);
                                setIsFlipped(false);
                                setIsDeckFinished(false);
                              }}
                              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium cursor-pointer"
                            >
                              Study Card →
                            </button>

                            {/* Quick Evaluate Buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCardResults((prev) => ({
                                    ...prev,
                                    [origIdx]: res === 'incorrect' ? (undefined as any) : 'incorrect',
                                  }));
                                }}
                                title="Mark Got it wrong"
                                className={`p-1 rounded-md text-xs transition-colors cursor-pointer ${
                                  res === 'incorrect'
                                    ? 'bg-rose-600 dark:bg-rose-900/80 text-white'
                                    : 'text-gray-400 hover:text-rose-600'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardResults((prev) => ({
                                    ...prev,
                                    [origIdx]: res === 'correct' ? (undefined as any) : 'correct',
                                  }));
                                }}
                                title="Mark Got it right"
                                className={`p-1 rounded-md text-xs transition-colors cursor-pointer ${
                                  res === 'correct'
                                    ? 'bg-emerald-600 dark:bg-emerald-900/80 text-white'
                                    : 'text-gray-400 hover:text-emerald-600'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })()}

          {/* 4. QUIZ VIEW (ONE-BY-ONE QUESTION PLAYER) */}
          {currentType === 'quiz' && (() => {
            // Helper to determine question type
            const getQuestionType = (q: any): 'multiple_choice' | 'multiple_select' | 'fill_blank' | 'short_answer' => {
              if (q.type) return q.type;
              if (q.correctAnswers || (Array.isArray(q.correct) && q.correct.length > 1)) return 'multiple_select';
              if (q.blankAnswer || (typeof q.question === 'string' && q.question.includes('______'))) return 'fill_blank';
              if (q.modelAnswer || (!q.options && q.explanation)) return 'short_answer';
              return 'multiple_choice';
            };

            // Check correctness of a question
            const isQuestionCorrect = (q: any, qIndex: number): boolean => {
              const qType = getQuestionType(q);
              if (qType === 'multiple_choice') {
                return quizAnswers[qIndex] === q.correct;
              }
              if (qType === 'multiple_select') {
                const correctList: number[] = q.correctAnswers || (Array.isArray(q.correct) ? q.correct : [q.correct]);
                const userSelected: number[] = quizAnswers[qIndex] || [];
                if (correctList.length === 0 || userSelected.length === 0) return false;
                const allCorrectPicked = correctList.every((c: number) => userSelected.includes(c));
                const noWrongPicked = userSelected.every((u: number) => correctList.includes(u));
                return allCorrectPicked && noWrongPicked;
              }
              if (qType === 'fill_blank') {
                const userAns = ((quizAnswers[qIndex] as string) || '').trim().toLowerCase();
                const targetAns = (q.blankAnswer || '').trim().toLowerCase();
                const acceptable: string[] = (q.acceptableAnswers || []).map((a: string) => a.trim().toLowerCase());
                return !!userAns && (userAns === targetAns || acceptable.includes(userAns));
              }
              if (qType === 'short_answer') {
                return selfGrades[qIndex] === true;
              }
              return false;
            };

            // Check if a question has been answered
            const isQuestionAnswered = (q: any, i: number) => {
              const qType = getQuestionType(q);
              if (qType === 'multiple_choice') return quizAnswers[i] !== undefined;
              if (qType === 'multiple_select') return Array.isArray(quizAnswers[i]) && quizAnswers[i].length > 0;
              if (qType === 'fill_blank') return !!quizAnswers[i] && String(quizAnswers[i]).trim().length > 0;
              if (qType === 'short_answer') return !!quizAnswers[i] && String(quizAnswers[i]).trim().length > 0;
              return false;
            };

            // Count answered questions
            const getAnsweredCount = () => {
              return quiz.filter((q: any, i: number) => isQuestionAnswered(q, i)).length;
            };

            const totalScore = quiz.filter((q: any, i: number) => isQuestionCorrect(q, i)).length;
            const scorePercent = Math.round((totalScore / (quiz.length || 1)) * 100);

            // Safe active question
            const activeIndex = Math.min(Math.max(0, currentQuizIndex), quiz.length - 1);
            const currentQ = quiz[activeIndex] || quiz[0];
            const activeType = currentQ ? getQuestionType(currentQ) : 'multiple_choice';
            const isChecked = submittedQuiz || quizReviewMode || !!checkedAnswers[activeIndex];

            const quizExportOptions: ExportOption[] = [
              {
                id: 'print',
                label: 'Printable Examination',
                extension: '.html',
                icon: Printer,
                description: 'Print-ready test with answer blanks',
                badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
                onClick: () => {
                  printQuizSheet(quiz, artifact?.title || 'Quiz_Test');
                },
              },
              {
                id: 'md',
                label: 'Quiz & Answer Key',
                extension: '.md',
                icon: FileText,
                description: 'Markdown test with explanations',
                badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                onClick: () => {
                  exportQuizMarkdown(quiz, artifact?.title || 'Quiz');
                },
              },
              {
                id: 'json',
                label: 'Quiz Dataset JSON',
                extension: '.json',
                icon: FileCode,
                description: 'Questions, options & answer data',
                badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                onClick: () => {
                  exportQuizJson(quiz, artifact?.title || 'Quiz');
                },
              },
              {
                id: 'csv',
                label: 'Questions CSV',
                extension: '.csv',
                icon: Table,
                description: 'Spreadsheet compatible Q&A table',
                badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                onClick: () => {
                  exportQuizCsv(quiz, artifact?.title || 'Quiz');
                },
              },
            ];

            // -------------------------------------------------------------
            // SCREEN 1: RESULTS DASHBOARD (when submitted and not reviewing)
            // -------------------------------------------------------------
            if (submittedQuiz && !quizReviewMode) {
              const mcqTotal = quiz.filter((q: any) => getQuestionType(q) === 'multiple_choice').length;
              const mcqCorrect = quiz.filter((q: any, i: number) => getQuestionType(q) === 'multiple_choice' && isQuestionCorrect(q, i)).length;

              const fbqTotal = quiz.filter((q: any) => getQuestionType(q) === 'fill_blank').length;
              const fbqCorrect = quiz.filter((q: any, i: number) => getQuestionType(q) === 'fill_blank' && isQuestionCorrect(q, i)).length;

              const msTotal = quiz.filter((q: any) => getQuestionType(q) === 'multiple_select').length;
              const msCorrect = quiz.filter((q: any, i: number) => getQuestionType(q) === 'multiple_select' && isQuestionCorrect(q, i)).length;

              const saTotal = quiz.filter((q: any) => getQuestionType(q) === 'short_answer').length;
              const saCorrect = quiz.filter((q: any, i: number) => getQuestionType(q) === 'short_answer' && isQuestionCorrect(q, i)).length;

              return (
                <div className="max-w-xl mx-auto py-4 flex flex-col gap-6">
                  {/* Score Hero Card */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-gradient-to-b dark:from-[#212634] dark:to-[#171a23] border border-gray-200 dark:border-[#343b4d] shadow-xl text-center space-y-4">
                    <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                      <Award className="w-8 h-8" />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Quiz Completed!</h3>
                      <p className="text-xs text-gray-500 dark:text-[#8a919e] mt-1">
                        {artifact?.title || 'Interactive Knowledge Quiz'}
                      </p>
                    </div>

                    {/* Big Score Display */}
                    <div className="py-2">
                      <div className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        <span className={scorePercent >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {totalScore}
                        </span>{' '}
                        <span className="text-2xl text-gray-400 dark:text-[#6d7586] font-normal">/ {quiz.length}</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-600 dark:text-[#a1a7b4] mt-1">
                        {scorePercent}% Accuracy
                      </div>

                      {/* Progress Track */}
                      <div className="w-48 h-2 bg-gray-200 dark:bg-[#252a37] rounded-full mx-auto mt-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            scorePercent >= 70 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                          }`}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-[#a1a7b4] max-w-md mx-auto leading-relaxed">
                      {scorePercent >= 80
                        ? 'Outstanding work! You demonstrated comprehensive mastery across your ingested source materials.'
                        : scorePercent >= 60
                        ? 'Solid effort! Review the detailed explanations for each question to reinforce key concepts.'
                        : 'Reviewing the source materials and retaking the quiz will help solidify your understanding.'}
                    </p>
                  </div>

                  {/* Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {mcqTotal > 0 && (
                      <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#191c25] border border-gray-200 dark:border-[#2b3140] space-y-1">
                        <div className="text-[11px] text-gray-500 dark:text-[#8a919e] font-medium">Multiple Choice</div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">
                          <span className="text-blue-600 dark:text-blue-400">{mcqCorrect}</span> / {mcqTotal}
                        </div>
                      </div>
                    )}
                    {fbqTotal > 0 && (
                      <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#191c25] border border-gray-200 dark:border-[#2b3140] space-y-1">
                        <div className="text-[11px] text-gray-500 dark:text-[#8a919e] font-medium">Fill in the Blank</div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">
                          <span className="text-amber-600 dark:text-amber-400">{fbqCorrect}</span> / {fbqTotal}
                        </div>
                      </div>
                    )}
                    {msTotal > 0 && (
                      <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#191c25] border border-gray-200 dark:border-[#2b3140] space-y-1">
                        <div className="text-[11px] text-gray-500 dark:text-[#8a919e] font-medium">Multiple Select</div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">
                          <span className="text-purple-600 dark:text-purple-400">{msCorrect}</span> / {msTotal}
                        </div>
                      </div>
                    )}
                    {saTotal > 0 && (
                      <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#191c25] border border-gray-200 dark:border-[#2b3140] space-y-1">
                        <div className="text-[11px] text-gray-500 dark:text-[#8a919e] font-medium">Short Answer</div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">
                          <span className="text-cyan-600 dark:text-cyan-400">{saCorrect}</span> / {saTotal}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => {
                        setQuizReviewMode(true);
                        setCurrentQuizIndex(0);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white dark:bg-[#232836] hover:bg-gray-100 dark:hover:bg-[#2d3446] text-gray-900 dark:text-white border border-gray-200 dark:border-[#3b4356] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Review Questions (1 by 1)</span>
                    </button>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <ExportDropdown items={quizExportOptions} buttonLabel="Export Quiz" />

                      <button
                        onClick={() => {
                          setQuizAnswers({});
                          setSelfGrades({});
                          setSubmittedQuiz(false);
                          setCheckedAnswers({});
                          setQuizReviewMode(false);
                          setCurrentQuizIndex(0);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-white dark:bg-[#252a36] hover:bg-gray-100 dark:hover:bg-[#303644] text-gray-800 dark:text-white rounded-xl text-xs font-semibold transition-colors border border-gray-200 dark:border-[#383e4e] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>

                      {onRequestCreateQuiz && (
                        <button
                          onClick={onRequestCreateQuiz}
                          className="flex-1 sm:flex-initial px-5 py-2.5 bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-xl text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>New Quiz</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              );
            }

            // -------------------------------------------------------------
            // SCREEN 2: ONE-BY-ONE INTERACTIVE QUESTION PLAYER
            // -------------------------------------------------------------
            return (
              <div className="flex flex-col gap-4 max-w-2xl mx-auto py-2">
                {/* Header bar */}
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 dark:border-[#2d3240]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-sm">
                        {artifact?.title || 'Interactive Knowledge Quiz'}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500 dark:text-[#8a919e]">{quiz.length} Questions</span>
                        {artifact?.data?.difficulty && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-[#232733] border border-gray-200 dark:border-[#383e4e] text-gray-700 dark:text-[#a1a7b4] capitalize">
                            {artifact.data.difficulty} Difficulty
                          </span>
                        )}
                        {quizReviewMode && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800/40 text-purple-700 dark:text-purple-300">
                            Review Mode ({totalScore}/{quiz.length})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {quizReviewMode && (
                      <button
                        onClick={() => setQuizReviewMode(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-[#232733] hover:bg-gray-100 dark:hover:bg-[#2e3342] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#383e4e] transition-colors cursor-pointer shadow-xs"
                      >
                        Back to Score
                      </button>
                    )}

                    {onRequestCreateQuiz && (
                      <button
                        onClick={onRequestCreateQuiz}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-[#232733] hover:bg-gray-100 dark:hover:bg-[#2e3342] text-gray-900 dark:text-white border border-gray-200 dark:border-[#383e4e] transition-colors shadow-xs cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>New Quiz</span>
                      </button>
                    )}

                    <ExportDropdown items={quizExportOptions} buttonLabel="Export Quiz" />
                  </div>
                </div>

                {/* Progress & Question Navigator Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Question {activeIndex + 1} of {quiz.length}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-[#8a919e]">
                      {getAnsweredCount()} of {quiz.length} answered
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-[#202430] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${((activeIndex + 1) / quiz.length) * 100}%` }}
                    />
                  </div>

                  {/* Scrollable Question Number Pills Carousel */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
                    {quiz.map((q: any, qIdx: number) => {
                      const isCurrent = qIdx === activeIndex;
                      const hasAnswered = isQuestionAnswered(q, qIdx);
                      const isQChecked = submittedQuiz || quizReviewMode || !!checkedAnswers[qIdx];
                      const isQCorrect = isQuestionCorrect(q, qIdx);

                      return (
                        <button
                          key={qIdx}
                          onClick={() => setCurrentQuizIndex(qIdx)}
                          className={`w-7 h-7 shrink-0 rounded-lg text-[11px] font-semibold flex items-center justify-center transition-all cursor-pointer ${
                            isCurrent
                              ? 'ring-2 ring-cyan-500 bg-cyan-600 dark:bg-[#2f3547] text-white shadow-md'
                              : isQChecked
                              ? isQCorrect
                                ? 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300'
                              : hasAnswered
                              ? 'bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-200'
                              : 'bg-white dark:bg-[#181b24] border border-gray-200 dark:border-[#2a2f3d] text-gray-600 dark:text-[#767e90] hover:text-gray-900 dark:hover:text-[#c4c7c5] hover:bg-gray-100 dark:hover:bg-[#202430]'
                          }`}
                          title={`Question ${qIdx + 1}${hasAnswered ? (isQChecked ? (isQCorrect ? ' (Correct)' : ' (Incorrect)') : ' (Answered)') : ''}`}
                        >
                          {qIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ACTIVE QUESTION CARD */}
                {currentQ && (
                  <div className="p-6 rounded-3xl bg-white dark:bg-[#1c202b] border border-gray-200 dark:border-[#303646] space-y-5 shadow-lg animate-in fade-in duration-200">
                    {/* Card Header & Badges */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#292f3f]">
                          Q{activeIndex + 1}
                        </span>

                        {activeType === 'multiple_choice' && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-medium">
                            Multiple Choice
                          </span>
                        )}
                        {activeType === 'multiple_select' && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 font-medium">
                            Multiple Select (Select all that apply)
                          </span>
                        )}
                        {activeType === 'fill_blank' && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-medium">
                            Fill in the Blank
                          </span>
                        )}
                        {activeType === 'short_answer' && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 font-medium">
                            Short Answer
                          </span>
                        )}
                      </div>

                      {/* Instant Correct/Incorrect Status Badge */}
                      {isChecked && (
                        <div>
                          {isQuestionCorrect(currentQ, activeIndex) ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Correct
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-500/40 px-2.5 py-0.5 rounded-full">
                              <X className="w-3 h-3" /> Needs Review
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Question Prompt */}
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white leading-relaxed">
                      {currentQ.question}
                    </h4>

                    {/* RENDER QUESTION INTERACTIVE BODY */}
                    {/* 1. Multiple Choice */}
                    {activeType === 'multiple_choice' && (
                      <div className="space-y-2.5 pt-1">
                        {currentQ.options?.map((opt: string, optIndex: number) => {
                          const isSelected = quizAnswers[activeIndex] === optIndex;
                          const isCorrect = currentQ.correct === optIndex;

                          return (
                            <button
                              key={optIndex}
                              disabled={isChecked}
                              onClick={() => {
                                if (!isChecked) {
                                  setQuizAnswers({ ...quizAnswers, [activeIndex]: optIndex });
                                  setCheckedAnswers({ ...checkedAnswers, [activeIndex]: true });
                                }
                              }}
                              className={`w-full text-left p-3.5 rounded-2xl text-xs border transition-all flex items-center justify-between cursor-pointer ${
                                isChecked
                                  ? isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200 font-medium'
                                    : isSelected
                                    ? 'bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-500 text-red-900 dark:text-red-200'
                                    : 'bg-gray-50 dark:bg-[#151720] border-gray-200 dark:border-[#292e3c] text-gray-400 dark:text-[#717786]'
                                  : isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-900 dark:text-blue-200 shadow-xs'
                                  : 'bg-white dark:bg-[#151720] border-gray-200 dark:border-[#292e3c] hover:bg-gray-50 dark:hover:bg-[#232836] text-gray-800 dark:text-[#c4c7c5]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                                    isChecked
                                      ? isCorrect
                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                        : isSelected
                                        ? 'border-red-500 bg-red-500 text-white'
                                        : 'border-gray-300 dark:border-[#3c4354]'
                                      : isSelected
                                      ? 'border-blue-500 bg-blue-500'
                                      : 'border-gray-300 dark:border-[#3c4354]'
                                  }`}
                                >
                                  {isSelected && !isChecked && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                  {isChecked && isCorrect && <Check className="w-2.5 h-2.5 text-white" />}
                                  {isChecked && isSelected && !isCorrect && <X className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className="leading-snug">{opt}</span>
                              </div>
                              {isChecked && isCorrect && (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 ml-2">Correct</span>
                              )}
                              {isChecked && isSelected && !isCorrect && (
                                <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold shrink-0 ml-2">Incorrect</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 2. Multiple Select */}
                    {activeType === 'multiple_select' && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2.5">
                          {currentQ.options?.map((opt: string, optIndex: number) => {
                            const userSelected: number[] = quizAnswers[activeIndex] || [];
                            const isSelected = userSelected.includes(optIndex);
                            const correctList: number[] =
                              currentQ.correctAnswers || (Array.isArray(currentQ.correct) ? currentQ.correct : [currentQ.correct]);
                            const isOptionCorrect = correctList.includes(optIndex);

                            return (
                              <button
                                key={optIndex}
                                disabled={isChecked}
                                onClick={() => {
                                  if (!isChecked) {
                                    const next = isSelected
                                      ? userSelected.filter((idx) => idx !== optIndex)
                                      : [...userSelected, optIndex];
                                    setQuizAnswers({ ...quizAnswers, [activeIndex]: next });
                                  }
                                }}
                                className={`w-full text-left p-3.5 rounded-2xl text-xs border transition-all flex items-center justify-between cursor-pointer ${
                                  isChecked
                                    ? isOptionCorrect && isSelected
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200 font-medium'
                                      : !isOptionCorrect && isSelected
                                      ? 'bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-500 text-red-900 dark:text-red-200'
                                      : isOptionCorrect && !isSelected
                                      ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-400/60 dark:border-emerald-600/60 border-dashed text-emerald-800 dark:text-emerald-300'
                                      : 'bg-gray-50 dark:bg-[#151720] border-gray-200 dark:border-[#292e3c] text-gray-400 dark:text-[#717786]'
                                    : isSelected
                                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-400 text-purple-900 dark:text-purple-200 shadow-xs'
                                    : 'bg-white dark:bg-[#151720] border-gray-200 dark:border-[#292e3c] hover:bg-gray-50 dark:hover:bg-[#232836] text-gray-800 dark:text-[#c4c7c5]'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                      isChecked
                                        ? isOptionCorrect && isSelected
                                          ? 'border-emerald-500 bg-emerald-500 text-white'
                                          : !isOptionCorrect && isSelected
                                          ? 'border-red-500 bg-red-500 text-white'
                                          : isOptionCorrect && !isSelected
                                          ? 'border-emerald-500 border-dashed text-emerald-600'
                                          : 'border-gray-300 dark:border-[#3c4354]'
                                        : isSelected
                                        ? 'border-purple-500 bg-purple-500 text-white'
                                        : 'border-gray-300 dark:border-[#3c4354]'
                                    }`}
                                  >
                                    {(isSelected || (isChecked && isOptionCorrect)) && (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </div>
                                  <span className="leading-snug">{opt}</span>
                                </div>
                                {isChecked && isOptionCorrect && isSelected && (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0 ml-2">Correct</span>
                                )}
                                {isChecked && isOptionCorrect && !isSelected && (
                                  <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 italic font-medium shrink-0 ml-2">Missed</span>
                                )}
                                {isChecked && !isOptionCorrect && isSelected && (
                                  <span className="text-[11px] text-red-600 dark:text-red-400 font-medium shrink-0 ml-2">Incorrect</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {!isChecked && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => setCheckedAnswers({ ...checkedAnswers, [activeIndex]: true })}
                              disabled={!(Array.isArray(quizAnswers[activeIndex]) && quizAnswers[activeIndex].length > 0)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
                            >
                              Check Answer
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Fill in the Blank */}
                    {activeType === 'fill_blank' && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={quizAnswers[activeIndex] || ''}
                            onChange={(e) => {
                              if (!isChecked) {
                                setQuizAnswers({ ...quizAnswers, [activeIndex]: e.target.value });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isChecked && quizAnswers[activeIndex]) {
                                setCheckedAnswers({ ...checkedAnswers, [activeIndex]: true });
                              }
                            }}
                            disabled={isChecked}
                            placeholder="Type your answer here and press Enter..."
                            className={`flex-1 px-4 py-3 rounded-xl bg-white dark:bg-[#14161f] border text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#5e6677] focus:outline-none transition-colors ${
                              isChecked
                                ? isQuestionCorrect(currentQ, activeIndex)
                                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                                  : 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                                : 'border-gray-200 dark:border-[#2f3544] focus:border-cyan-500'
                            }`}
                          />
                          {!isChecked && (
                            <button
                              onClick={() => setCheckedAnswers({ ...checkedAnswers, [activeIndex]: true })}
                              disabled={!quizAnswers[activeIndex] || !String(quizAnswers[activeIndex]).trim()}
                              className="px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer shrink-0"
                            >
                              Check
                            </button>
                          )}
                        </div>

                        {isChecked && (
                          <div
                            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                              isQuestionCorrect(currentQ, activeIndex)
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {isQuestionCorrect(currentQ, activeIndex) ? (
                              <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="w-4 h-4" />
                                <span>Correct! Your answer matches.</span>
                              </div>
                            ) : (
                              <div>
                                Acceptable Answer:{' '}
                                <strong className="text-gray-900 dark:text-white">
                                  {currentQ.blankAnswer || (currentQ.acceptableAnswers && currentQ.acceptableAnswers[0])}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. Short Answer */}
                    {activeType === 'short_answer' && (
                      <div className="space-y-3 pt-1">
                        <textarea
                          rows={3}
                          value={quizAnswers[activeIndex] || ''}
                          onChange={(e) => {
                            if (!isChecked) {
                              setQuizAnswers({ ...quizAnswers, [activeIndex]: e.target.value });
                            }
                          }}
                          disabled={isChecked}
                          placeholder="Write your explanation or reasoning in your own words..."
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#14161f] border border-gray-200 dark:border-[#2f3544] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#5e6677] focus:outline-none focus:border-cyan-500 transition-colors resize-none leading-relaxed"
                        />

                        {!isChecked && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => setCheckedAnswers({ ...checkedAnswers, [activeIndex]: true })}
                              disabled={!quizAnswers[activeIndex] || !String(quizAnswers[activeIndex]).trim()}
                              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
                            >
                              Reveal Model Answer
                            </button>
                          </div>
                        )}

                        {isChecked && currentQ.modelAnswer && (
                          <div className="p-3.5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 space-y-2">
                            <div className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider">
                              Target Key Concepts (Model Answer):
                            </div>
                            <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
                              {currentQ.modelAnswer}
                            </p>

                            <div className="pt-2 border-t border-cyan-100 dark:border-cyan-900/40 flex items-center justify-between">
                              <span className="text-[11px] text-gray-500 dark:text-[#8a919e]">Self-Evaluation:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setSelfGrades({ ...selfGrades, [activeIndex]: true })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    selfGrades[activeIndex] === true
                                      ? 'bg-emerald-500 text-white font-semibold shadow-xs'
                                      : 'bg-gray-100 dark:bg-[#222734] text-gray-700 dark:text-[#a1a7b4] hover:text-gray-900 dark:hover:text-white'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>I Got This</span>
                                </button>
                                <button
                                  onClick={() => setSelfGrades({ ...selfGrades, [activeIndex]: false })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    selfGrades[activeIndex] === false
                                      ? 'bg-red-500 text-white font-semibold shadow-xs'
                                      : 'bg-gray-100 dark:bg-[#222734] text-gray-700 dark:text-[#a1a7b4] hover:text-gray-900 dark:hover:text-white'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Needs Review</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation Box (shown when checked or in review mode) */}
                    {isChecked && currentQ.explanation && (
                      <div className="p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-[#141620] border border-cyan-100 dark:border-[#2b303e] text-xs text-gray-700 dark:text-[#a1a7b4] leading-relaxed">
                        <span className="font-semibold text-cyan-700 dark:text-cyan-400">Explanation: </span>
                        {currentQ.explanation}
                      </div>
                    )}
                  </div>
                )}

                {/* BOTTOM NAVIGATION CONTROLS */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#181b24] border border-gray-200 dark:border-[#2e3342] flex items-center justify-between mt-1 shadow-xs">
                  {/* Previous Button */}
                  <button
                    disabled={activeIndex === 0}
                    onClick={() => setCurrentQuizIndex((prev) => Math.max(0, prev - 1))}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#232733] hover:bg-gray-100 dark:hover:bg-[#2d3442] disabled:opacity-30 disabled:hover:bg-white text-gray-800 dark:text-white border border-gray-200 dark:border-[#383e4e] transition-colors cursor-pointer shadow-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  {/* Middle Progress Indicator */}
                  <div className="text-xs text-gray-500 dark:text-[#8a919e] text-center hidden sm:block">
                    Question <span className="text-gray-900 dark:text-white font-medium">{activeIndex + 1}</span> of{' '}
                    <span className="text-gray-900 dark:text-white font-medium">{quiz.length}</span>
                  </div>

                  {/* Next / Submit Button */}
                  <div className="flex items-center gap-2">
                    {activeIndex < quiz.length - 1 ? (
                      <button
                        onClick={() => setCurrentQuizIndex((prev) => Math.min(quiz.length - 1, prev + 1))}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] shadow-sm transition-all cursor-pointer"
                      >
                        <span>Next Question</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSubmittedQuiz(true);
                          setQuizReviewMode(false);
                        }}
                        className="flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-90 shadow-md transition-all cursor-pointer font-bold"
                      >
                        <Check className="w-4 h-4" />
                        <span>Finish & View Results</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

            );
          })()}

          {/* 5. INTERACTIVE MIND MAP CANVAS (NotebookLM Graph Layout) */}
          {currentType === 'mindmap' && (
            <MindMapCanvas
              mindMap={mindMap}
              onSaveToNote={onSaveToNote}
              onRequestCreateMindMap={onRequestCreateMindMap}
            />
          )}

          {/* 6. VIDEO OVERVIEW / STORYBOARD */}
          {currentType === 'video' && (() => {
            const videoFormat = artifact?.data?.format || 'short';
            const videoTopic = artifact?.data?.topic || '';
            const curScene = scenes[currentScene] || scenes[0] || { title: 'Scene', narration: '', visualPrompt: '', duration: 5 };

            return (
              <div className="flex flex-col gap-6 max-w-3xl mx-auto">
                {/* Video Toolbar */}
                <div className="p-3.5 bg-white dark:bg-[#181b22] border border-gray-200 dark:border-[#383e4e] rounded-2xl flex items-center justify-between flex-wrap gap-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 dark:border-rose-500/40 text-xs font-medium flex items-center gap-1.5">
                      {videoFormat === 'short' ? <Smartphone className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                      <span>{videoFormat === 'short' ? 'Short (9:16 Vertical)' : 'Explainer (16:9 Landscape)'}</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#232732] text-gray-600 dark:text-[#9aa0a6] border border-gray-200 dark:border-[#313747] text-xs font-mono">
                      {scenes.length} Scenes
                    </span>
                    {videoTopic && (
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#232732] text-gray-700 dark:text-[#d1d5db] border border-gray-200 dark:border-[#313747] text-xs font-medium truncate max-w-[200px]">
                        ✨ {videoTopic}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onRequestCreateVideo && (
                      <button
                        type="button"
                        onClick={onRequestCreateVideo}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/15 to-pink-500/15 dark:from-rose-500/20 dark:to-pink-500/20 hover:from-rose-500/25 hover:to-pink-500/25 border border-rose-500/30 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Customize a new video overview"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                        <span>New Video</span>
                      </button>
                    )}

                    <ExportDropdown
                      items={[
                        {
                          id: 'prompts',
                          label: 'AI Video Prompts',
                          extension: '.json',
                          icon: FileCode,
                          description: 'Ready for Sora, Runway, Kling, Luma',
                          badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                          onClick: () => {
                            exportVideoPromptsJson(scenes, artifact?.title || 'Video');
                          },
                        },
                        {
                          id: 'script',
                          label: 'Director Script',
                          extension: '.md',
                          icon: FileText,
                          description: 'Markdown script with camera directions',
                          badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
                          onClick: () => {
                            exportVideoScriptMarkdown(scenes, artifact?.title || 'Video');
                          },
                        },
                        {
                          id: 'shotlist',
                          label: 'Production Shotlist',
                          extension: '.csv',
                          icon: Table,
                          description: 'Spreadsheet shot timing & cues',
                          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                          onClick: () => {
                            exportVideoShotlistCsv(scenes, artifact?.title || 'Video');
                          },
                        },
                        {
                          id: 'storyboard',
                          label: 'Video Storyboard',
                          extension: '.txt',
                          icon: Download,
                          description: 'Plain text scene breakdown',
                          badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                          onClick: () => {
                            exportVideoStoryboardTxt(scenes, artifact?.title || 'Video');
                          },
                        },
                      ]}
                      buttonLabel="Export Video"
                    />
                  </div>
                </div>

                {/* Video Player Container */}
                {videoFormat === 'short' ? (
                  /* 9:16 Vertical Smartphone Mockup */
                  <div className="w-full max-w-[340px] aspect-[9/16] mx-auto rounded-[36px] bg-gradient-to-b from-[#0e111a] via-[#161a26] to-[#0a0c13] border-4 border-[#333a49] shadow-2xl relative overflow-hidden flex flex-col justify-between p-5 ring-1 ring-white/10">
                    {/* Dynamic Island Notch */}
                    <div className="w-24 h-5 bg-black rounded-full mx-auto flex items-center justify-center mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1b1e28] mr-2" />
                      <div className="w-2 h-2 rounded-full bg-blue-900/60" />
                    </div>

                    {/* Top Scene Progress Bars */}
                    <div className="flex gap-1 mb-2">
                      {scenes.map((_: any, idx: number) => (
                        <div
                          key={idx}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            currentScene === idx
                              ? 'bg-rose-400'
                              : idx < currentScene
                              ? 'bg-rose-400/50'
                              : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Top Scene Meta */}
                    <div className="flex items-center justify-between text-[11px] text-white/80">
                      <span className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 font-mono">
                        Scene {currentScene + 1}/{scenes.length}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 backdrop-blur-md border border-rose-500/40 text-[10px] font-semibold">
                        🎥 {curScene.cameraMovement || 'Zoom In'}
                      </span>
                    </div>

                    {/* Middle: High Impact Kinetic On-Screen Text Overlay */}
                    <div className="my-auto px-3 py-6 text-center flex flex-col items-center justify-center">
                      <div className="p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 max-w-full">
                        <span className="text-xl font-black text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-tight uppercase leading-snug">
                          {curScene.onScreenText || curScene.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 italic mt-3 px-2 line-clamp-3">
                        🎬 {curScene.visualPrompt}
                      </p>
                    </div>

                    {/* Bottom Controls & Subtitles */}
                    <div className="space-y-3">
                      {/* Subtitles Box */}
                      <div className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs text-[#e3e3e3] leading-relaxed">
                        <span className="text-rose-300 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">🎙️ Narration ({curScene.duration}s)</span>
                        <p className="line-clamp-2">{curScene.narration}</p>
                      </div>

                      {/* Playback Controls */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => setCurrentScene(Math.max(0, currentScene - 1))}
                          disabled={currentScene === 0}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                          onClick={handleToggleVideoPlay}
                          className="px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                        >
                          {isVideoPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                          <span>{isVideoPlaying ? 'Pause' : 'Play Narration'}</span>
                        </button>

                        <button
                          onClick={() => setCurrentScene(Math.min(scenes.length - 1, currentScene + 1))}
                          disabled={currentScene === scenes.length - 1}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 16:9 Landscape Cinematic Explainer Player */
                  <div className="aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-[#0c0f16] via-[#151a26] to-[#090b10] border border-[#383e4e] shadow-2xl relative overflow-hidden flex flex-col justify-between p-6 ring-1 ring-white/5">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-mono text-gray-300">
                          Scene {currentScene + 1} of {scenes.length}
                        </span>
                        <span className="text-xs text-[#9aa0a6]">
                          Duration: {curScene.duration}s
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px] font-medium flex items-center gap-1">
                        🎥 {curScene.cameraMovement || 'Cinematic Pan'}
                      </span>
                    </div>

                    {/* Center Display */}
                    <div className="my-auto text-center px-6">
                      <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
                        {curScene.title}
                      </h3>
                      {curScene.onScreenText && (
                        <p className="text-sm font-semibold text-amber-300 mt-2">
                          "{curScene.onScreenText}"
                        </p>
                      )}
                      <p className="text-xs text-[#9aa0a6] italic mt-3 max-w-xl mx-auto line-clamp-2">
                        🎬 Visual: {curScene.visualPrompt}
                      </p>
                    </div>

                    {/* Bottom Controls */}
                    <div className="space-y-3">
                      {/* Narration box */}
                      <div className="p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-xs text-[#d1d5db] flex items-start gap-2.5">
                        <span className="text-rose-400 font-semibold shrink-0">🎙️ Narration:</span>
                        <p className="leading-relaxed">{curScene.narration}</p>
                      </div>

                      {/* Chapter Progress Timeline */}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={handleToggleVideoPlay}
                          className="px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-[#e6e6e6] font-semibold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          {isVideoPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
                          <span>{isVideoPlaying ? 'Pause Narration' : 'Play Narration'}</span>
                        </button>

                        <div className="flex-1 flex gap-1.5 items-center">
                          {scenes.map((s: any, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentScene(idx)}
                              title={`Scene ${idx+1}: ${s.title}`}
                              className={`h-2 flex-1 rounded-full transition-all cursor-pointer ${
                                currentScene === idx ? 'bg-rose-400' : 'bg-[#2e3444] hover:bg-[#3d4559]'
                              }`}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentScene(Math.max(0, currentScene - 1))}
                            disabled={currentScene === 0}
                            className="p-1.5 rounded-lg bg-[#222733] text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCurrentScene(Math.min(scenes.length - 1, currentScene + 1))}
                            disabled={currentScene === scenes.length - 1}
                            className="p-1.5 rounded-lg bg-[#222733] text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Storyboard Scene Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-[#8a919e] uppercase tracking-wider">
                    Full Video Storyboard & Prompts ({scenes.length} Scenes)
                  </h4>
                  <div className="space-y-3">
                    {scenes.map((scene: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setCurrentScene(idx)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                          currentScene === idx
                            ? 'bg-rose-50/50 dark:bg-[#242a38] border-rose-500/50 shadow-md ring-1 ring-rose-500/30'
                            : 'bg-white dark:bg-[#1b1f28] border-gray-200 dark:border-[#2f3544] hover:border-gray-300 dark:hover:border-[#3f475c]'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              Scene {idx + 1}: {scene.title}
                            </span>
                            {scene.cameraMovement && (
                              <span className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-500/10 dark:bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/20 dark:border-rose-500/30 font-medium">
                                {scene.cameraMovement}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500 dark:text-[#8a919e] font-mono">{scene.duration}s</span>
                        </div>

                        {scene.onScreenText && (
                          <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                            <span className="font-semibold mr-1.5">🔤 On-Screen:</span>
                            {scene.onScreenText}
                          </div>
                        )}

                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#141720] border border-gray-200 dark:border-[#262b37] text-xs text-gray-700 dark:text-[#d1d5db]">
                          <span className="text-rose-600 dark:text-rose-300 font-semibold block mb-1">🎙️ Narration:</span>
                          {scene.narration}
                        </div>

                        <div className="p-3 rounded-xl bg-gray-50/70 dark:bg-[#141720]/70 border border-gray-200 dark:border-[#262b37] flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-500 dark:text-[#8a919e] font-semibold text-[11px] block mb-0.5">🎬 Visual Prompt (Sora / Veo / Flux):</span>
                            <p className="text-xs text-gray-600 dark:text-[#9aa0a6] italic truncate">{scene.visualPrompt}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(scene.visualPrompt || '');
                              setCopiedScenePrompt(idx);
                              setTimeout(() => setCopiedScenePrompt(null), 2000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#222733] hover:bg-gray-100 dark:hover:bg-[#2c3240] border border-gray-200 dark:border-[#343b4c] text-[11px] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                          >
                            {copiedScenePrompt === idx ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedScenePrompt === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 7. DATA TABLE */}
          {currentType === 'table' && (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-gray-400 dark:text-[#8a919e] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search table rows..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full bg-white dark:bg-[#181b22] border border-gray-200 dark:border-[#383e4e] rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                </div>
                <ExportDropdown
                  items={[
                    {
                      id: 'csv',
                      label: 'CSV Spreadsheet',
                      extension: '.csv',
                      icon: Table,
                      description: 'Comma-separated values',
                      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                      onClick: handleExportCSV,
                    },
                    {
                      id: 'tsv',
                      label: 'TSV (Excel / Sheets)',
                      extension: '.tsv',
                      icon: Table,
                      description: 'Tab-separated for direct copy-paste',
                      badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
                      onClick: () => {
                        exportTableTsv(tableColumns, tableRows, artifact?.title || 'Data_Table');
                      },
                    },
                    {
                      id: 'json',
                      label: 'Table JSON Array',
                      extension: '.json',
                      icon: FileCode,
                      description: 'Array of mapped row objects',
                      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                      onClick: () => {
                        exportTableJson(tableColumns, tableRows, artifact?.title || 'Data_Table');
                      },
                    },
                    {
                      id: 'md',
                      label: 'Markdown Table',
                      extension: '.md',
                      icon: FileText,
                      description: 'GitHub-flavored markdown table',
                      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                      onClick: () => {
                        exportTableMarkdown(tableColumns, tableRows, artifact?.title || 'Data_Table');
                      },
                    },
                  ]}
                  buttonLabel="Export Table"
                  variant="secondary"
                />
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-[#383e4e] bg-white dark:bg-[#181b22] shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#232733] border-b border-gray-200 dark:border-[#313747]">
                      {tableColumns.map((col: string, idx: number) => (
                        <th key={idx} className="p-3 font-semibold text-gray-900 dark:text-white">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2d3340]">
                    {filteredRows.map((row: string[], rowIdx: number) => (
                      <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-[#202530] transition-colors">
                        {row.map((cell: string, cellIdx: number) => (
                          <td key={cellIdx} className="p-3 text-gray-700 dark:text-[#c4c7c5]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. NOTEBOOKLM INFOGRAPHIC VIEW */}
          {currentType === 'infographic' && (() => {
            const info = artifact?.data || {};
            const infoStyle = info.style || 'auto';
            const infoOrientation = info.orientation || 'landscape';
            const infoDetail = info.detail || 'standard';
            const infoTitle = info.title || artifact?.title || 'Visual Infographic';
            const infoSubtitle = info.subtitle || 'Synthesized overview of key quantitative metrics, process dynamics, and strategic takeaways.';
            const infoHero = info.heroStat || {
              value: metrics[0]?.value || '99.4%',
              label: metrics[0]?.label || 'Grounding Accuracy',
              description: metrics[0]?.description || 'Verified against primary coordinates'
            };
            const infoMetrics = info.metrics || metrics || [];
            const infoProcess = info.processFlow || [
              { step: '01', title: 'Context Grounding', summary: 'Ingesting primary sources with paragraph coordinate tracking.' },
              { step: '02', title: 'Empirical Synthesis', summary: 'Cross-document extraction and verification across active data.' },
              { step: '03', title: 'Actionable Delivery', summary: 'Multi-modal generation for accelerated decision making.' }
            ];
            const infoBreakdown = info.breakdown || breakdown || [];
            const infoInsights = info.keyInsights || [
              'Direct paragraph coordinate validation eliminates ungrounded hallucinations.',
              'Multi-modal asset generation provides unified synthesis across formats.',
              'Dynamic AI formatting tailors data density to the desired level of detail.'
            ];
            const infoTakeaway = info.takeaway || 'Structured visual synthesis accelerates conceptual comprehension and actionable retention.';

            // Theme definitions for the 10 visual styles
            const getThemeClasses = () => {
              switch (infoStyle) {
                case 'anime':
                  return {
                    canvas: 'bg-gradient-to-br from-[#0a0f26] via-[#0f173b] to-[#070b1c] border-2 border-cyan-500/50 text-cyan-50 shadow-[0_0_35px_rgba(6,182,212,0.2)]',
                    heroCard: 'bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-cyan-400/40 text-cyan-100',
                    statCard: 'bg-[#121a38]/80 border border-cyan-500/30 hover:border-cyan-400',
                    pill: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
                    accentText: 'text-cyan-400',
                    barFill: 'bg-gradient-to-r from-cyan-400 to-blue-500',
                    processCard: 'bg-[#131d40] border border-cyan-500/30',
                    stepBadge: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black',
                  };
                case 'kawaii':
                  return {
                    canvas: 'bg-gradient-to-br from-[#fff1f2] via-[#fdf4ff] to-[#f0fdf4] border-2 border-pink-300 text-slate-800 shadow-2xl rounded-3xl',
                    heroCard: 'bg-gradient-to-r from-pink-100 to-purple-100 border border-pink-300 text-slate-900',
                    statCard: 'bg-white/90 border border-pink-200 text-slate-800 shadow-xs hover:border-pink-300',
                    pill: 'bg-pink-100 text-pink-700 border border-pink-200',
                    accentText: 'text-pink-600',
                    barFill: 'bg-gradient-to-r from-pink-400 to-rose-400',
                    processCard: 'bg-white border border-pink-200 text-slate-800',
                    stepBadge: 'bg-pink-400 text-white font-bold',
                  };
                case 'clay':
                  return {
                    canvas: 'bg-[#29231f] border-2 border-[#473d35] text-[#f5ebe0] shadow-[6px_6px_0px_#181411] rounded-3xl',
                    heroCard: 'bg-[#3b322b] border-2 border-[#574b42] text-[#f5ebe0]',
                    statCard: 'bg-[#332b25] border-2 border-[#473d35] text-[#f5ebe0] shadow-[3px_3px_0px_#1c1714]',
                    pill: 'bg-[#42372f] text-amber-200 border border-[#5c4d41]',
                    accentText: 'text-amber-400',
                    barFill: 'bg-gradient-to-r from-amber-500 to-orange-500',
                    processCard: 'bg-[#332b25] border-2 border-[#473d35] text-[#f5ebe0]',
                    stepBadge: 'bg-orange-600 text-white font-bold',
                  };
                case 'sketch_note':
                  return {
                    canvas: 'bg-[#fbf9f4] border-2 border-dashed border-gray-900 text-gray-900 shadow-2xl rounded-2xl font-sans',
                    heroCard: 'bg-[#fffbeb] border-2 border-gray-900 text-gray-900 shadow-[3px_3px_0px_#111827]',
                    statCard: 'bg-white border-2 border-gray-900 text-gray-900 shadow-[3px_3px_0px_#111827]',
                    pill: 'bg-amber-200 text-gray-900 border border-gray-900 font-mono',
                    accentText: 'text-amber-700',
                    barFill: 'bg-gray-900',
                    processCard: 'bg-white border-2 border-gray-900 text-gray-900 shadow-[2px_2px_0px_#111827]',
                    stepBadge: 'bg-gray-900 text-white font-mono font-bold',
                  };
                case 'editorial':
                  return {
                    canvas: 'bg-[#0d131f] border border-[#232f48] text-slate-100 shadow-2xl rounded-3xl font-sans',
                    heroCard: 'bg-gradient-to-r from-[#172033] to-[#121929] border border-amber-500/30 text-amber-200',
                    statCard: 'bg-[#151c2c] border border-[#2a3754] text-slate-200 hover:border-amber-500/40',
                    pill: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
                    accentText: 'text-amber-400',
                    barFill: 'bg-gradient-to-r from-amber-400 to-amber-600',
                    processCard: 'bg-[#151c2c] border border-[#2a3754] text-slate-200',
                    stepBadge: 'bg-amber-500 text-black font-bold',
                  };
                case 'minimalist':
                  return {
                    canvas: 'bg-[#09090b] border border-zinc-800 text-zinc-100 shadow-2xl rounded-2xl font-sans',
                    heroCard: 'bg-zinc-900 border border-zinc-700 text-white',
                    statCard: 'bg-zinc-950 border border-zinc-800 text-zinc-200 hover:border-zinc-700',
                    pill: 'bg-zinc-800 text-zinc-200 border border-zinc-700',
                    accentText: 'text-blue-400',
                    barFill: 'bg-blue-500',
                    processCard: 'bg-zinc-950 border border-zinc-800 text-zinc-200',
                    stepBadge: 'bg-zinc-100 text-black font-bold',
                  };
                case '3d_render':
                  return {
                    canvas: 'bg-gradient-to-br from-[#120f26] via-[#1a1538] to-[#0c0a1a] border border-violet-500/40 text-violet-50 shadow-[0_0_35px_rgba(139,92,246,0.25)] rounded-3xl backdrop-blur-md',
                    heroCard: 'bg-white/10 backdrop-blur-md border border-violet-400/30 text-white',
                    statCard: 'bg-white/5 backdrop-blur-md border border-violet-500/20 text-slate-200 hover:border-violet-400/40',
                    pill: 'bg-violet-500/20 text-violet-300 border border-violet-500/40',
                    accentText: 'text-violet-400',
                    barFill: 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400',
                    processCard: 'bg-white/5 backdrop-blur-md border border-violet-500/20',
                    stepBadge: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold',
                  };
                case 'watercolor':
                  return {
                    canvas: 'bg-[#fffdf9] border border-teal-200 text-slate-800 shadow-2xl rounded-3xl',
                    heroCard: 'bg-gradient-to-r from-teal-50 to-pink-50 border border-teal-200 text-slate-900',
                    statCard: 'bg-white/90 border border-teal-100 text-slate-800 shadow-xs hover:border-teal-300',
                    pill: 'bg-teal-100 text-teal-800 border border-teal-200',
                    accentText: 'text-teal-600',
                    barFill: 'bg-gradient-to-r from-teal-400 to-cyan-500',
                    processCard: 'bg-white border border-teal-100 text-slate-800',
                    stepBadge: 'bg-teal-500 text-white font-bold',
                  };
                case 'vintage':
                  return {
                    canvas: 'bg-[#09182d] border-2 border-cyan-800 text-cyan-100 shadow-2xl rounded-2xl font-mono',
                    heroCard: 'bg-[#0d223f] border border-cyan-700 text-cyan-200',
                    statCard: 'bg-[#0d223f]/80 border border-cyan-800 text-cyan-200 hover:border-cyan-600',
                    pill: 'bg-cyan-950 text-cyan-300 border border-cyan-700',
                    accentText: 'text-cyan-400',
                    barFill: 'bg-cyan-400',
                    processCard: 'bg-[#0d223f] border border-cyan-800 text-cyan-200',
                    stepBadge: 'bg-cyan-400 text-black font-mono font-bold',
                  };
                default: // auto / studio
                  return {
                    canvas: 'bg-white dark:bg-[#181c24] border border-gray-200 dark:border-[#2d3445] text-gray-900 dark:text-gray-100 shadow-xl dark:shadow-2xl rounded-3xl',
                    heroCard: 'bg-gradient-to-r from-pink-50 to-purple-50 dark:from-[#202738] dark:to-[#1c2230] border border-pink-200 dark:border-pink-500/30 text-gray-900 dark:text-white',
                    statCard: 'bg-gray-50 dark:bg-[#1f2533] border border-gray-200 dark:border-[#30384a] text-gray-800 dark:text-gray-200 hover:border-pink-400 dark:hover:border-pink-500/40',
                    pill: 'bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30',
                    accentText: 'text-pink-600 dark:text-pink-400',
                    barFill: 'bg-gradient-to-r from-pink-500 to-indigo-500',
                    processCard: 'bg-gray-50 dark:bg-[#1f2533] border border-gray-200 dark:border-[#30384a] text-gray-800 dark:text-gray-200',
                    stepBadge: 'bg-pink-500 text-white font-bold',
                  };
              }
            };

            const t = getThemeClasses();
            const isPortrait = infoOrientation === 'portrait';
            const isSquare = infoOrientation === 'square';

            return (
              <div className="flex flex-col gap-4 w-full">
                {/* Infographic Controls & Metadata Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#1d222b] border border-gray-200 dark:border-[#2f3645] shadow-sm max-w-5xl mx-auto w-full">
                  {/* Left: Badges */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="px-3 py-1 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-700 dark:text-pink-300 font-semibold text-xs flex items-center gap-1.5 shadow-xs">
                      <BarChart3 className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
                      <span className="capitalize">{infoStyle.replace('_', ' ')} Style</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#222733] border border-gray-200 dark:border-[#303847] text-xs text-gray-700 dark:text-gray-300 capitalize">
                      {infoOrientation}
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#222733] border border-gray-200 dark:border-[#303847] text-xs text-gray-700 dark:text-gray-300 capitalize">
                      {infoDetail} detail
                    </span>

                    <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                      • {sourceCount || 1} source{sourceCount === 1 ? '' : 's'} grounded
                    </span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Switcher if image exists */}
                    {info.imageUrl && (
                      <div className="flex items-center p-0.5 rounded-xl bg-gray-100 dark:bg-[#13161c] border border-gray-200 dark:border-[#2e3544]">
                        <button
                          type="button"
                          onClick={() => setInfographicView('visual')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                            infographicView === 'visual'
                              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-xs'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>AI Artwork</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInfographicView('canvas')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                            infographicView === 'canvas'
                              ? 'bg-white dark:bg-[#222733] text-gray-900 dark:text-white shadow-xs'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Data Canvas</span>
                        </button>
                      </div>
                    )}

                    {/* Art Director Prompt Inspector */}
                    {info.imagePrompt && (
                      <button
                        type="button"
                        onClick={() => setShowImagePromptModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 hover:bg-purple-500/20 dark:hover:bg-purple-500/25 border border-purple-500/20 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Inspect the LLM-generated Art Director image prompt"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                        <span>Art Prompt</span>
                      </button>
                    )}

                    {/* Generate Image button if no image yet */}
                    {!info.imageUrl && info.imagePrompt && (
                      <button
                        type="button"
                        onClick={handleGenerateInfographicImage}
                        disabled={isGeneratingImage}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-medium shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Generate high-resolution visual artwork using your configured Image Provider"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{isGeneratingImage ? 'Rendering Image...' : 'Generate AI Image'}</span>
                      </button>
                    )}

                    {/* Save to Notes */}
                    {onSaveToNote && (
                      <button
                        type="button"
                        onClick={handleSaveInfographicToNotes}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#222733] dark:hover:bg-[#2c3344] border border-gray-200 dark:border-[#343c4f] text-xs text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Save infographic summary to notebook notes"
                      >
                        {savedInfographicSuccess ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
                        )}
                        <span>{savedInfographicSuccess ? 'Saved' : 'Save to Note'}</span>
                      </button>
                    )}

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={handleCopyInfographic}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#222733] dark:hover:bg-[#2c3344] border border-gray-200 dark:border-[#343c4f] text-xs text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Copy infographic summary to clipboard"
                    >
                      {copiedInfographic ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedInfographic ? 'Copied' : 'Copy'}</span>
                    </button>

                    {/* Print / Save as PDF */}
                    <button
                      type="button"
                      onClick={handlePrintInfographic}
                      className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#222733] dark:hover:bg-[#2c3344] border border-gray-200 dark:border-[#343c4f] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                      title="Print or Save as PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    <ExportDropdown
                      items={[
                        ...(info.imageUrl ? [{
                          id: 'image',
                          label: 'Download AI Artwork',
                          extension: '.png',
                          icon: ImageIcon,
                          description: 'Full resolution generated image',
                          badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
                          onClick: () => {
                            const link = document.createElement('a');
                            link.href = info.imageUrl;
                            link.download = `Infographic_${infoTitle.replace(/\s+/g, '_')}.png`;
                            link.click();
                          },
                        }] : []),
                        {
                          id: 'md',
                          label: 'Data Canvas Summary',
                          extension: '.md',
                          icon: FileText,
                          description: 'Hero metric, process flow & insights',
                          badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                          onClick: () => {
                            exportInfographicSummaryMarkdown(info, infoTitle);
                          },
                        },
                        {
                          id: 'json',
                          label: 'Art Director Prompts',
                          extension: '.json',
                          icon: FileCode,
                          description: 'Image generation prompt parameters',
                          badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                          onClick: () => {
                            exportInfographicPromptsJson(info, infoTitle);
                          },
                        },
                        {
                          id: 'print',
                          label: 'Print / Save as PDF',
                          extension: '.pdf',
                          icon: Printer,
                          description: 'Printable layout format',
                          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                          onClick: handlePrintInfographic,
                        },
                      ]}
                      buttonLabel="Export"
                    />

                    {/* Customize New Infographic */}
                    {onRequestCreateInfographic && (
                      <button
                        type="button"
                        onClick={onRequestCreateInfographic}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500/15 to-purple-500/15 dark:from-pink-500/20 dark:to-purple-500/20 hover:from-pink-500/25 hover:to-purple-500/25 border border-pink-500/30 dark:border-pink-500/40 text-pink-700 dark:text-pink-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Customize a new infographic with different style or orientation"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
                        <span>New Infographic</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Infographic Main Content: Visual Image or Structured Canvas */}
                {infographicView === 'visual' && info.imageUrl ? (
                  <div className="flex flex-col items-center justify-center w-full py-2">
                    <div
                      className={`relative rounded-3xl overflow-hidden border border-[#2f3645] bg-[#12151c] shadow-2xl group transition-all duration-300 ${
                        isPortrait ? 'max-w-md w-full aspect-[9/16]' : isSquare ? 'max-w-xl w-full aspect-square' : 'max-w-4xl w-full aspect-[16/9]'
                      }`}
                    >
                      <img
                        src={info.imageUrl}
                        alt={infoTitle}
                        className="w-full h-full object-cover rounded-3xl cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
                        onClick={() => setImageZoom(true)}
                      />
                      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setImageZoom(true)}
                          className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-lg cursor-pointer"
                          title="View Fullscreen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <a
                          href={info.imageUrl}
                          download={`Infographic_${infoTitle.replace(/\s+/g, '_')}.png`}
                          className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-lg cursor-pointer flex items-center gap-1 text-xs"
                          title="Download Image"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-white flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold truncate">{infoTitle}</p>
                          <p className="text-[10px] text-gray-300 capitalize">{infoStyle.replace('_', ' ')} Style • {infoOrientation} orientation</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowImagePromptModal(true)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium flex items-center gap-1 cursor-pointer"
                          >
                            <Wand2 className="w-3 h-3 text-purple-300" />
                            <span>Prompt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInfographicView('canvas')}
                            className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-medium cursor-pointer"
                          >
                            View Data
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="flex justify-center w-full py-2">
                  <div
                    ref={infographicRef}
                    className={`w-full p-8 sm:p-10 transition-all duration-300 space-y-8 ${t.canvas} ${
                      isPortrait ? 'max-w-2xl' : isSquare ? 'max-w-3xl' : 'max-w-5xl'
                    }`}
                  >
                    {/* Header Banner */}
                    <div className="space-y-2 border-b pb-6 border-current/15">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${t.pill}`}>
                          {infoStyle.replace('_', ' ')} • {infoOrientation}
                        </span>
                        <span className="text-xs opacity-75 font-mono">
                          {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                        {infoTitle}
                      </h1>
                      <p className="text-sm opacity-85 leading-relaxed max-w-3xl">
                        {infoSubtitle}
                      </p>
                    </div>

                    {/* Hero Stat Banner */}
                    {infoHero && (
                      <div className={`p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg ${t.heroCard}`}>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                            {infoHero.label}
                          </span>
                          <div className={`text-3xl sm:text-5xl font-black mt-1 ${t.accentText}`}>
                            {infoHero.value}
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm max-w-md opacity-90 leading-relaxed sm:text-right">
                          {infoHero.description}
                        </p>
                      </div>
                    )}

                    {/* Key Metrics Grid */}
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider opacity-80">
                          Key Empirical Metrics
                        </h3>
                        <span className="text-[11px] opacity-60 font-mono">
                          {infoMetrics.length} Grounded KPIs
                        </span>
                      </div>
                      <div className={`grid gap-3.5 ${
                        isPortrait ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
                      }`}>
                        {infoMetrics.map((m: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl flex flex-col justify-between gap-1.5 transition-all shadow-xs ${t.statCard}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-semibold opacity-75 truncate">{m.label}</span>
                              {m.change && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${t.pill}`}>
                                  {m.change}
                                </span>
                              )}
                            </div>
                            <span className={`text-xl sm:text-2xl font-extrabold ${t.accentText}`}>
                              {m.value}
                            </span>
                            <span className="text-[11px] opacity-75 line-clamp-2 leading-snug">
                              {m.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Process Flow / Milestones Pipeline */}
                    {infoProcess.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider opacity-80 mb-3.5">
                          Progressive Milestone Flow
                        </h3>
                        <div className={`grid gap-3 ${
                          isPortrait ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-4'
                        }`}>
                          {infoProcess.map((p: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl flex flex-col gap-2 relative shadow-xs ${t.processCard}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-xs ${t.stepBadge}`}>
                                  {p.step}
                                </span>
                                {idx < infoProcess.length - 1 && !isPortrait && (
                                  <span className="opacity-30 text-xs hidden sm:inline">→</span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold leading-snug">
                                {p.title}
                              </h4>
                              <p className="text-[11px] opacity-80 leading-relaxed">
                                {p.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Thematic Distribution & Key Takeaways in Two Columns */}
                    <div className={`grid gap-6 ${isPortrait ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {/* Left: Thematic Distribution */}
                      <div className={`p-5 rounded-2xl space-y-3.5 ${t.statCard}`}>
                        <h4 className="text-xs font-bold uppercase tracking-wider opacity-80">
                          Thematic Distribution
                        </h4>
                        <div className="space-y-3">
                          {infoBreakdown.map((item: any, idx: number) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-xs opacity-85">
                                <span className="font-medium">{item.category}</span>
                                <span className="font-mono font-bold">{item.percentage}%</span>
                              </div>
                              <div className="w-full bg-current/15 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${t.barFill}`}
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                              {item.description && (
                                <p className="text-[10px] opacity-70 italic">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Key Insights */}
                      <div className={`p-5 rounded-2xl space-y-3.5 ${t.statCard}`}>
                        <h4 className="text-xs font-bold uppercase tracking-wider opacity-80">
                          Empirical Insights
                        </h4>
                        <div className="space-y-2.5">
                          {infoInsights.map((insight: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed opacity-90">
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${t.barFill}`} />
                              <span>{insight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Takeaway Callout */}
                    {infoTakeaway && (
                      <div className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-3 ${t.heroCard}`}>
                        <span className="text-lg">💡</span>
                        <div className="flex-1">
                          <strong className="font-bold">Core Synthesis: </strong>
                          <span>{infoTakeaway}</span>
                        </div>
                      </div>
                    )}

                    {/* Grounded Sources Footer */}
                    <div className="pt-4 border-t border-current/15 text-[11px] opacity-60 flex flex-wrap items-center justify-between gap-2">
                      <span>OpenNotebookLM Visual Synthesis Engine</span>
                      <span>Grounded in {sourceCount || 1} active source document{sourceCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
                )}

                {/* Prompt Inspector Modal */}
                {showImagePromptModal && info.imagePrompt && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#181b22] border border-gray-200 dark:border-[#2e3442] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                      {/* Header */}
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-[#2e3442] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 dark:border-purple-500/30 flex items-center justify-center">
                            <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Visual Art Director Prompt</h3>
                            <p className="text-[11px] text-gray-500 dark:text-[#8a919e]">Generated dynamically by LLM based on sources & style guidelines</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowImagePromptModal(false)}
                          className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#252a35] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-6 overflow-y-auto space-y-4">
                        {/* Style & Config Tags */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/20 dark:border-pink-500/30 text-pink-700 dark:text-pink-300 font-semibold capitalize">
                            {infoStyle.replace('_', ' ')} Style
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#222733] border border-gray-200 dark:border-[#303847] text-gray-700 dark:text-gray-300 capitalize">
                            {infoOrientation} (Aspect Ratio)
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#222733] border border-gray-200 dark:border-[#303847] text-gray-700 dark:text-gray-300">
                            {sourceCount || 1} Grounded Sources
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#12151c] border border-gray-200 dark:border-[#262c3a] text-xs text-gray-600 dark:text-[#a4a9b6] leading-relaxed">
                          <p className="font-semibold text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            How this prompt is created:
                          </p>
                          This is a comprehensive, publication-grade prompt synthesized directly by the LLM reasoning engine. It translates your source documents, quantitative figures, and design guidelines into professional visual art direction (compositional flow, lighting, textures, diagrammatic metaphors, and negative space) engineered for generative image models (Imagen 3, DALL-E 3, FLUX).
                        </div>

                        {/* Prompt Box */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Complete Image Generation Prompt:</label>
                          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#12151c] border border-gray-200 dark:border-[#2e3442] text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-mono select-all whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {info.imagePrompt}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2e3442] bg-gray-50 dark:bg-[#151820] flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={handleCopyPrompt}
                          className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#222733] dark:hover:bg-[#2c3344] border border-gray-200 dark:border-[#343c4f] text-xs font-medium text-gray-800 dark:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedPrompt ? <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedPrompt ? 'Copied to Clipboard' : 'Copy Prompt'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {!info.imageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowImagePromptModal(false);
                                handleGenerateInfographicImage();
                              }}
                              disabled={isGeneratingImage}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>Generate Image with AI</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowImagePromptModal(false)}
                            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-[#222733] dark:hover:bg-[#2c3344] text-xs text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fullscreen Lightbox Zoom Modal */}
                {imageZoom && info.imageUrl && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 cursor-zoom-out"
                    onClick={() => setImageZoom(false)}
                  >
                    <div className="relative max-w-7xl max-h-[95vh] w-full h-full flex items-center justify-center">
                      <img
                        src={info.imageUrl}
                        alt={infoTitle}
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                      />
                      <button
                        type="button"
                        onClick={() => setImageZoom(false)}
                        className="absolute top-4 right-4 p-2.5 rounded-full bg-black/70 hover:bg-black text-white backdrop-blur-md border border-white/20 shadow-lg cursor-pointer"
                        title="Close Zoom"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 9. NOTEBOOKLM REPORT / SYNTHESIS DOSSIER */}
          {/* 9. REPORT SYNTHESIS */}
          {currentType === 'report' && (
            <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
              {/* Report Controls & Metadata Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-[#1d222b] border border-gray-200 dark:border-[#2f3645] shadow-xs">
                {/* Left: Format Badge & Reading Stats */}
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-xs flex items-center gap-1.5 shadow-xs">
                    <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>{reportFormatLabel}</span>
                  </span>

                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#9aa0a6]">
                    <span>•</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">{reportMetrics.words.toLocaleString()} words</span>
                    <span>•</span>
                    <span>~{reportMetrics.readTime} min read</span>
                    <span>•</span>
                    <span>{sourceCount || 1} source{sourceCount === 1 ? '' : 's'} grounded</span>
                  </div>

                  {reportHeadings.length > 0 && reportMode === 'reader' && (
                    <button
                      type="button"
                      onClick={() => setShowToc(!showToc)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        showToc
                          ? 'bg-amber-100 dark:bg-[#2b3342] text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                          : 'bg-white dark:bg-[#222733] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#303847]'
                      }`}
                      title="Toggle Outline"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Outline</span>
                    </button>
                  )}
                </div>

                {/* Right: Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Mode Toggle: Reader vs Document/PDF vs Edit */}
                  <div className="inline-flex rounded-xl bg-gray-100 dark:bg-[#161922] border border-gray-200 dark:border-[#2e3545] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setReportMode('reader')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        reportMode === 'reader'
                          ? 'bg-white dark:bg-[#282f3d] text-gray-900 dark:text-white font-medium shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                      title="Studio Reader Mode"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Read</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportMode('document')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        reportMode === 'document'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold shadow-xs border border-amber-500/30'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                      title="PDF Document Page Layout (A4 White Paper with KaTeX Math)"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>PDF View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportMode('edit')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                        reportMode === 'edit'
                          ? 'bg-white dark:bg-[#282f3d] text-gray-900 dark:text-white font-medium shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                      title="Markdown Source Editor"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* If in edit mode, show Save Changes */}
                  {reportMode === 'edit' && (
                    <button
                      type="button"
                      onClick={handleSaveReportEdits}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {savedReportSuccess ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{savedReportSuccess ? 'Saved!' : 'Save Edits'}</span>
                    </button>
                  )}

                  {/* Comprehensive Export Dropdown (PDF, Print, Markdown, HTML, Plain Text) */}
                  <ExportDropdown
                    items={[
                      {
                        id: 'pdf',
                        label: 'Download PDF File',
                        extension: '.pdf',
                        icon: FileDown,
                        description: 'Formatted vector PDF download',
                        badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                        onClick: handleDownloadPdf,
                      },
                      {
                        id: 'print',
                        label: 'Print / Vector PDF',
                        extension: '.pdf',
                        icon: Printer,
                        description: 'Browser native print dialog',
                        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                        onClick: handlePrintReport,
                      },
                      {
                        id: 'md',
                        label: 'Markdown Document',
                        extension: '.md',
                        icon: FileText,
                        description: 'Source markdown with citations',
                        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                        onClick: () => {
                          exportReportMarkdown(effectiveReportContent, artifact?.title || 'Report');
                        },
                      },
                      {
                        id: 'html',
                        label: 'Standalone HTML',
                        extension: '.html',
                        icon: FileCode,
                        description: 'Self-contained styled document',
                        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                        onClick: () => {
                          exportReportHtml(effectiveReportContent, artifact?.title || 'Report');
                        },
                      },
                      {
                        id: 'txt',
                        label: 'Plain Text Report',
                        extension: '.txt',
                        icon: Download,
                        description: 'Formatted text without markdown',
                        badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                        onClick: () => {
                          exportReportTxt(effectiveReportContent, artifact?.title || 'Report');
                        },
                      },
                    ]}
                    buttonLabel={isExportingPdf ? 'Exporting...' : 'Export Report'}
                  />

                  {/* Save to Notes */}
                  {onSaveToNote && (
                    <button
                      type="button"
                      onClick={handleSaveReportToNotes}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#222733] hover:bg-gray-100 dark:hover:bg-[#2c3344] border border-gray-200 dark:border-[#343c4f] text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Save report content as a permanent note in Studio"
                    >
                      {savedToNoteSuccess ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>{savedToNoteSuccess ? 'Saved' : 'Save to Note'}</span>
                    </button>
                  )}

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#222733] hover:bg-gray-100 dark:hover:bg-[#2c3344] border border-gray-200 dark:border-[#343c4f] text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Copy markdown content to clipboard"
                  >
                    {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReport ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* Download Markdown */}
                  <button
                    type="button"
                    onClick={() => handleDownloadMarkdown(effectiveReportContent, `${artifact?.title || 'Report'}.md`)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Download as Markdown (.md)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.md</span>
                  </button>

                  {/* Generate New Report */}
                  {onRequestCreateReport && (
                    <button
                      type="button"
                      onClick={onRequestCreateReport}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Create a new report or alternate format"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>New Report</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Main Body Area: Table of Contents + Reader / Document / Editor */}
              <div className="flex gap-4 items-start w-full">
                {/* 1. Sticky Table of Contents (Outline) */}
                {showToc && reportHeadings.length > 0 && reportMode !== 'edit' && (
                  <div className="hidden md:flex flex-col w-56 shrink-0 sticky top-2 p-3.5 rounded-2xl bg-white dark:bg-[#1a1e27] border border-gray-200 dark:border-[#2e3545] shadow-sm space-y-2 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 pb-2 border-b border-gray-100 dark:border-[#2a3140]">
                      <span className="flex items-center gap-1.5">
                        <List className="w-3.5 h-3.5" /> Outline
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 font-normal font-mono text-[10px]">
                        {reportHeadings.length}
                      </span>
                    </div>

                    <nav className="space-y-1">
                      {reportHeadings.map((h, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(h.id);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className={`w-full text-left text-xs transition-colors rounded-lg py-1 px-2 block truncate cursor-pointer ${
                            h.level === 1
                              ? 'font-bold text-gray-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-300 hover:bg-gray-50 dark:hover:bg-[#252b38]'
                              : h.level === 2
                              ? 'pl-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#222834]'
                              : 'pl-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#202530] text-[11px]'
                          }`}
                          title={h.text}
                        >
                          {h.text}
                        </button>
                      ))}
                    </nav>
                  </div>
                )}

                {/* 2. Content Area */}
                <div className="flex-1 min-w-0">
                  {reportMode === 'reader' ? (
                    /* Studio Reader View with KaTeX */
                    <div
                      ref={reportPrintContentRef}
                      className="p-8 rounded-3xl bg-white dark:bg-[#171a22] border border-gray-200 dark:border-[#2d3445] shadow-lg text-gray-800 dark:text-[#d1d5db] selection:bg-amber-500/20"
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          h1: ({ children, ...props }) => {
                            const textStr = String(children);
                            const id = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                            return (
                              <h1
                                id={id}
                                className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight pb-3 border-b border-gray-200 dark:border-[#2c3343] mt-2 mb-6 scroll-mt-6"
                                {...props}
                              >
                                {children}
                              </h1>
                            );
                          },
                          h2: ({ children, ...props }) => {
                            const textStr = String(children);
                            const id = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                            return (
                              <h2
                                id={id}
                                className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-8 mb-3.5 scroll-mt-6 flex items-center gap-2"
                                {...props}
                              >
                                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 inline-block shrink-0" />
                                <span>{children}</span>
                              </h2>
                            );
                          },
                          h3: ({ children, ...props }) => {
                            const textStr = String(children);
                            const id = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                            return (
                              <h3
                                id={id}
                                className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2.5 scroll-mt-6"
                                {...props}
                              >
                                {children}
                              </h3>
                            );
                          },
                          p: ({ children, ...props }) => (
                            <p className="my-3 text-sm leading-relaxed text-gray-700 dark:text-[#c6cad3]" {...props}>
                              {children}
                            </p>
                          ),
                          ul: ({ children, ...props }) => (
                            <ul className="my-3 ml-5 list-disc space-y-1 text-sm text-gray-700 dark:text-[#c6cad3]" {...props}>
                              {children}
                            </ul>
                          ),
                          ol: ({ children, ...props }) => (
                            <ol className="my-3 ml-5 list-decimal space-y-1 text-sm text-gray-700 dark:text-[#c6cad3]" {...props}>
                              {children}
                            </ol>
                          ),
                          li: ({ children, ...props }) => (
                            <li className="leading-relaxed" {...props}>
                              {children}
                            </li>
                          ),
                          blockquote: ({ children, ...props }) => (
                            <blockquote
                              className="my-5 p-4 rounded-2xl bg-amber-50/60 dark:bg-gradient-to-r dark:from-[#202636] dark:to-[#1a1f2c] border-l-4 border-amber-500 dark:border-amber-400 text-gray-800 dark:text-gray-200 text-xs sm:text-sm leading-relaxed shadow-xs"
                              {...props}
                            >
                              {children}
                            </blockquote>
                          ),
                          table: ({ children, ...props }) => (
                            <div className="overflow-x-auto my-5 rounded-2xl border border-gray-200 dark:border-[#2f3647] shadow-xs">
                              <table className="w-full text-xs text-left border-collapse" {...props}>
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children, ...props }) => (
                            <th className="bg-gray-50 dark:bg-[#1f2430] text-gray-900 dark:text-gray-200 font-semibold p-3 border-b border-gray-200 dark:border-[#2f3647]" {...props}>
                              {children}
                            </th>
                          ),
                          td: ({ children, ...props }) => (
                            <td className="p-3 border-b border-gray-100 dark:border-[#262c3a] text-gray-700 dark:text-gray-300" {...props}>
                              {children}
                            </td>
                          ),
                          hr: () => <hr className="my-6 border-gray-200 dark:border-[#2c3343]" />,
                        }}
                      >
                        {effectiveReportContent}
                      </ReactMarkdown>
                    </div>

                  ) : reportMode === 'document' ? (
                    /* White Paper PDF Document View with KaTeX Math */
                    <div className="flex justify-center w-full py-2">
                      <div
                        ref={reportPrintContentRef}
                        className="w-full max-w-[850px] bg-white text-[#111827] rounded-2xl shadow-2xl p-8 sm:p-14 border border-gray-200 selection:bg-amber-200 selection:text-black font-sans"
                      >
                        {/* Official Document Cover Header */}
                        <div className="border-b-2 border-gray-200 pb-5 mb-8">
                          <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md mb-2">
                            {reportFormatLabel}
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2">
                            {artifact?.title || 'Report Synthesis'}
                          </h1>
                          <div className="mt-3 text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span><strong>Grounded in:</strong> {sourceCount || 1} source document{sourceCount === 1 ? '' : 's'}</span>
                            <span>•</span>
                            <span>{reportMetrics.words.toLocaleString()} words</span>
                            <span>•</span>
                            <span>~{reportMetrics.readTime} min read</span>
                            <span>•</span>
                            <span>{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        </div>

                        {/* Document Body with Light Theme Typography & KaTeX Math */}
                        <div className="report-markdown-document-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              h1: ({ children, ...props }) => {
                                const textStr = String(children);
                                const id = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                                return (
                                  <h1
                                    id={id}
                                    className="text-xl sm:text-2xl font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200 scroll-mt-6"
                                    {...props}
                                  >
                                    {children}
                                  </h1>
                                );
                              },
                              h2: ({ children, ...props }) => {
                                const textStr = String(children);
                                const id = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                                return (
                                  <h2
                                    id={id}
                                    className="text-lg sm:text-xl font-bold text-gray-900 mt-6 mb-3 pb-1 border-b border-gray-100 flex items-center gap-2 scroll-mt-6"
                                    {...props}
                                  >
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                                    <span>{children}</span>
                                  </h2>
                                );
                              },
                              h3: ({ children, ...props }) => {
                                const textStr = String(children);
                                const id = textStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                                return (
                                  <h3
                                    id={id}
                                    className="text-base font-semibold text-gray-800 mt-5 mb-2 scroll-mt-6"
                                    {...props}
                                  >
                                    {children}
                                  </h3>
                                );
                              },
                              p: ({ children, ...props }) => (
                                <p className="my-3 text-[14px] leading-relaxed text-gray-800 text-justify" {...props}>
                                  {children}
                                </p>
                              ),
                              ul: ({ children, ...props }) => (
                                <ul className="my-3 ml-5 list-disc space-y-1 text-[14px] text-gray-800" {...props}>
                                  {children}
                                </ul>
                              ),
                              ol: ({ children, ...props }) => (
                                <ol className="my-3 ml-5 list-decimal space-y-1 text-[14px] text-gray-800" {...props}>
                                  {children}
                                </ol>
                              ),
                              li: ({ children, ...props }) => (
                                <li className="leading-relaxed" {...props}>
                                  {children}
                                </li>
                              ),
                              blockquote: ({ children, ...props }) => (
                                <blockquote
                                  className="my-5 p-4 rounded-lg bg-amber-50/70 border-l-4 border-amber-500 text-gray-900 text-[13.5px] leading-relaxed shadow-xs"
                                  {...props}
                                >
                                  {children}
                                </blockquote>
                              ),
                              table: ({ children, ...props }) => (
                                <div className="overflow-x-auto my-5 rounded-lg border border-gray-200 shadow-xs">
                                  <table className="w-full text-xs text-left border-collapse" {...props}>
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children, ...props }) => (
                                <th className="bg-gray-100 text-gray-900 font-semibold p-3 border-b border-gray-200" {...props}>
                                  {children}
                                </th>
                              ),
                              td: ({ children, ...props }) => (
                                <td className="p-3 border-b border-gray-100 text-gray-800" {...props}>
                                  {children}
                                </td>
                              ),
                              code: ({ children, ...props }) => (
                                <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-900 font-mono text-xs" {...props}>
                                  {children}
                                </code>
                              ),
                              pre: ({ children, ...props }) => (
                                <pre className="my-4 p-4 rounded-lg bg-gray-50 border border-gray-200 font-mono text-xs overflow-x-auto text-gray-800" {...props}>
                                  {children}
                                </pre>
                              ),
                              hr: () => <hr className="my-6 border-gray-200" />,
                            }}
                          >
                            {effectiveReportContent}
                          </ReactMarkdown>
                        </div>

                        {/* Official Document Footer */}
                        <div className="mt-12 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between items-center">
                          <span>OpenNotebookLM Synthesis Dossier</span>
                          <span>Confidential & Grounded Research</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Editor Mode */
                    <div className="flex flex-col gap-2 p-5 rounded-3xl bg-[#171a22] border border-[#2d3445] shadow-2xl">
                      <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-[#2a303e]">
                        <span>Markdown Editor (Live synchronization)</span>
                        <span>{effectiveReportContent.length} characters • {reportMetrics.words} words</span>
                      </div>
                      <textarea
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="Write or edit report in Markdown..."
                        rows={24}
                        className="w-full bg-[#12141a] border border-[#282e3c] rounded-2xl p-4 text-xs font-mono text-gray-200 leading-relaxed focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 custom-scrollbar resize-y min-h-[480px]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 10. STUDIO NOTE VIEW */}
          {/* 8. STUDIO NOTE */}
          {currentType === 'note' && (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto h-full">
              {/* Note Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-[#2d3340]">
                {/* Note Title Input */}
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note Title..."
                  className="bg-transparent text-base font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-b focus:border-yellow-500 pb-0.5 max-w-md w-full"
                />

                <div className="flex items-center gap-2">
                  {/* Mode Toggle: Preview / Edit */}
                  <div className="flex items-center bg-gray-100 dark:bg-[#181b22] border border-gray-200 dark:border-[#383e4e] rounded-xl p-0.5 text-xs">
                    <button
                      onClick={() => setNoteMode('preview')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        noteMode === 'preview'
                          ? 'bg-white dark:bg-[#2a303d] text-gray-900 dark:text-white font-medium shadow-xs'
                          : 'text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setNoteMode('edit')}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        noteMode === 'edit'
                          ? 'bg-white dark:bg-[#2a303d] text-gray-900 dark:text-white font-medium shadow-xs'
                          : 'text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Edit
                    </button>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(noteContent);
                      setCopiedNote(true);
                      setTimeout(() => setCopiedNote(false), 2000);
                    }}
                    title="Copy Note Text"
                    className="p-1.5 rounded-xl bg-gray-100 dark:bg-[#252a35] hover:bg-gray-200 dark:hover:bg-[#2d3340] border border-gray-200 dark:border-[#383e4e] text-xs text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copiedNote ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* Export Dropdown */}
                  <ExportDropdown
                    items={[
                      {
                        id: 'md',
                        label: 'Markdown Note',
                        extension: '.md',
                        icon: FileText,
                        description: 'Formatted markdown document',
                        badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
                        onClick: () => {
                          handleDownloadMarkdown(noteContent, `${(noteTitle || 'Note').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`);
                        },
                      },
                      {
                        id: 'txt',
                        label: 'Plain Text Note',
                        extension: '.txt',
                        icon: Download,
                        description: 'Raw plain text document',
                        badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                        onClick: () => {
                          exportReportTxt(noteContent, noteTitle || 'Note');
                        },
                      },
                    ]}
                    buttonLabel="Export Note"
                  />

                  {/* Save Changes Button */}
                  <button
                    onClick={() => {
                      if (artifact && onUpdateArtifact) {
                        onUpdateArtifact({
                          ...artifact,
                          title: noteTitle.trim() || 'Untitled Note',
                          data: { ...artifact.data, content: noteContent },
                        });
                        setSavedNoteSuccess(true);
                        setTimeout(() => setSavedNoteSuccess(false), 2000);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    {savedNoteSuccess ? <Check className="w-3.5 h-3.5 text-black" /> : null}
                    <span>{savedNoteSuccess ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </div>

              {/* Note Body: Preview vs Edit */}
              {noteMode === 'preview' ? (
                <div className="p-6 rounded-2xl bg-white dark:bg-[#181b22] border border-gray-200 dark:border-[#383e4e] min-h-[350px] overflow-y-auto prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-[#c4c7c5] leading-relaxed select-text shadow-xs">
                  {noteContent.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {noteContent}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-center py-16 text-gray-400 dark:text-[#8a919e] text-xs flex flex-col items-center gap-2">
                      <FilePlus className="w-8 h-8 text-gray-300 dark:text-[#545b6b]" />
                      <p>This note is currently empty.</p>
                      <button
                        onClick={() => setNoteMode('edit')}
                        className="text-yellow-600 dark:text-yellow-400 hover:underline mt-1 font-medium cursor-pointer"
                      >
                        Click here to edit and write content
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  rows={16}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write your note in Markdown format..."
                  className="w-full p-6 rounded-2xl bg-white dark:bg-[#181b22] border border-gray-200 dark:border-[#383e4e] focus:border-yellow-500 focus:outline-none text-xs text-gray-900 dark:text-white font-mono leading-relaxed resize-none min-h-[350px] shadow-xs"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

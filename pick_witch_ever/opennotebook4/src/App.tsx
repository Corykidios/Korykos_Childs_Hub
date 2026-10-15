import React, { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { Header } from './components/Header';
import { SourcesPanel } from './components/SourcesPanel';
import { ChatPanel } from './components/ChatPanel';
import { StudioPanel } from './components/StudioPanel';
import { AddSourceModal } from './components/AddSourceModal';
import { SettingsModal } from './components/SettingsModal';
import { StudioModal } from './components/StudioModal';
import { NoteModal } from './components/NoteModal';
import { SourcePreviewModal } from './components/SourcePreviewModal';
import { ResearchModal } from './components/ResearchModal';
import { DeepResearchModal } from './components/DeepResearchModal';
import { MindMapCreateModal } from './components/MindMapCreateModal';
import { QuizCreateModal, QuizGenerationConfig } from './components/QuizCreateModal';
import { FlashcardsCreateModal, FlashcardsGenerationConfig } from './components/FlashcardsCreateModal';
import { ReportCreateModal } from './components/ReportCreateModal';
import { InfographicCreateModal } from './components/InfographicCreateModal';
import { AudioCreateModal } from './components/AudioCreateModal';
import { SlideCreateModal } from './components/SlideCreateModal';
import { VideoCreateModal } from './components/VideoCreateModal';
import { 
  Notebook, 
  Source, 
  ChatMessage, 
  StudioArtifact, 
  StudioType, 
  AppSettings, 
  AppTheme,
  Citation, 
  ReportGenerationConfig, 
  InfographicGenerationConfig,
  AudioGenerationConfig,
  SlideGenerationConfig,
  VideoGenerationConfig
} from './types';
import { 
  getStoredSettings, 
  saveStoredSettings, 
  getStoredNotebooks, 
  saveStoredNotebooks 
} from './services/storage';
import { 
  searchWebAPI, 
  scrapeUrlAPI, 
  sendChatMessageAPI, 
  generateArtifactAPI 
} from './services/api';

const EMOJIS = ['📙', '⚡', '💪', '🤖', '♻️', '🕶️', '🏫', '🔄', '✊', '🙏', '🔬', '💡', '🚀', '🧠', '📘'];

export const App: React.FC = () => {
  // Navigation View: 'home' | 'notebook'
  const [currentView, setCurrentView] = useState<'home' | 'notebook'>('home');

  // Notebooks Collection
  const [notebooks, setNotebooks] = useState<Notebook[]>(getStoredNotebooks);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Panel Collapsing State
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);

  // Modals State
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<Source | null>(null);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [researchParams, setResearchParams] = useState<{
    query: string;
    scope: 'Web' | 'Academic' | 'YouTube';
    depth: 'fast' | 'deep';
  }>({
    query: '',
    scope: 'Web',
    depth: 'fast',
  });

  // Deep Research Modal State
  const [isDeepResearchOpen, setIsDeepResearchOpen] = useState(false);
  const [deepResearchParams, setDeepResearchParams] = useState<{
    query: string;
    scope: 'Web' | 'Academic' | 'YouTube';
  }>({
    query: '',
    scope: 'Web',
  });

  // Studio Viewer / Generator State
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<StudioArtifact | null>(null);
  const [targetStudioType, setTargetStudioType] = useState<StudioType | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [mindMapModalOpen, setMindMapModalOpen] = useState(false);
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [flashcardsModalOpen, setFlashcardsModalOpen] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [infographicModalOpen, setInfographicModalOpen] = useState(false);
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [isGeneratingSlide, setIsGeneratingSlide] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Save notebooks on change
  useEffect(() => {
    saveStoredNotebooks(notebooks);
  }, [notebooks]);

  // Active theme management & document synchronization
  const currentTheme = settings.theme || 'dark';

  useEffect(() => {
    if (currentTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [currentTheme]);

  const handleToggleTheme = () => {
    const nextTheme: AppTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const updated: AppSettings = { ...settings, theme: nextTheme };
    setSettings(updated);
    saveStoredSettings(updated);
  };

  // Active Notebook reference
  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0];

  // Helper to update active notebook
  const updateActiveNotebook = (updater: (nb: Notebook) => Notebook) => {
    if (!activeNotebookId) return;
    setNotebooks((prev) =>
      prev.map((nb) => (nb.id === activeNotebookId ? updater({ ...nb, updatedAt: Date.now() }) : nb))
    );
  };

  // Open Notebook from Home
  const handleOpenNotebook = (id: string) => {
    setActiveNotebookId(id);
    setCurrentView('notebook');
  };

  // Create New Notebook
  const handleCreateNotebook = () => {
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const newNb: Notebook = {
      id: `nb-${Date.now()}`,
      title: 'Untitled notebook',
      emoji: randomEmoji,
      sources: [],
      messages: [],
      artifacts: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotebooks((prev) => [newNb, ...prev]);
    setActiveNotebookId(newNb.id);
    setCurrentView('notebook');
  };

  // Duplicate Notebook
  const handleDuplicateNotebook = (id: string) => {
    const target = notebooks.find((nb) => nb.id === id);
    if (!target) return;
    const dup: Notebook = {
      ...target,
      id: `nb-${Date.now()}`,
      title: `${target.title} (Copy)`,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    setNotebooks((prev) => [dup, ...prev]);
  };

  // Delete Notebook
  const handleDeleteNotebook = (id: string) => {
    if (confirm('Are you sure you want to delete this notebook?')) {
      setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
      if (activeNotebookId === id) {
        setCurrentView('home');
      }
    }
  };

  // Rename Notebook Title
  const handleTitleChange = (newTitle: string) => {
    updateActiveNotebook((nb) => ({ ...nb, title: newTitle }));
  };

  // Persist Settings
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
  };

  // Source Management in Active Notebook
  const handleAddSources = (newSources: Source[]) => {
    updateActiveNotebook((nb) => ({
      ...nb,
      sources: [...nb.sources, ...newSources],
    }));
  };

  const handleToggleSource = (id: string) => {
    updateActiveNotebook((nb) => ({
      ...nb,
      sources: nb.sources.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    }));
  };

  const handleToggleAllSources = (select: boolean) => {
    updateActiveNotebook((nb) => ({
      ...nb,
      sources: nb.sources.map((s) => ({ ...s, selected: select })),
    }));
  };

  const handleDeleteSource = (id: string) => {
    updateActiveNotebook((nb) => ({
      ...nb,
      sources: nb.sources.filter((s) => s.id !== id),
    }));
  };

  const handleUpdateSource = (updated: Source) => {
    setPreviewSource(updated);
    updateActiveNotebook((nb) => ({
      ...nb,
      sources: nb.sources.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  const handleOpenDeepResearch = (query: string, scope: 'Web' | 'Academic' | 'YouTube' = 'Web') => {
    setDeepResearchParams({ query, scope });
    setIsDeepResearchOpen(true);
  };

  // Search & Web Research Submit -> Opens ResearchModal or DeepResearchModal
  const handleSearchSubmit = (query: string, scope: 'Web' | 'Academic' | 'YouTube', depth: 'fast' | 'deep') => {
    if (depth === 'deep') {
      handleOpenDeepResearch(query, scope);
      return;
    }
    setResearchParams({ query, scope, depth });
    setIsResearchModalOpen(true);
  };

  // Chat Send Message
  const handleSendMessage = async (text: string, style: 'Default' | 'Concise' | 'Detailed' = 'Default') => {
    if (!activeNotebook) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...activeNotebook.messages, userMsg];

    updateActiveNotebook((nb) => ({
      ...nb,
      messages: updatedMessages,
    }));

    setIsAiLoading(true);

    try {
      const result = await sendChatMessageAPI({
        messages: updatedMessages,
        sources: activeNotebook.sources,
        settings,
        chatStyle: style,
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: result.text,
        citations: result.citations,
        timestamp: Date.now(),
      };

      updateActiveNotebook((nb) => ({
        ...nb,
        messages: [...nb.messages, assistantMsg],
      }));
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Error processing query: ${err.message}`,
        timestamp: Date.now(),
      };
      updateActiveNotebook((nb) => ({
        ...nb,
        messages: [...nb.messages, fallbackMsg],
      }));
    } finally {
      setIsAiLoading(false);
    }
  };

  // Studio Trigger
  const handleSelectStudioTool = async (type: StudioType, lang?: string) => {
    // If Mind Map is chosen, open dedicated creation modal to allow topic & source selection!
    if (type === 'mindmap') {
      setMindMapModalOpen(true);
      return;
    }

    // If Quiz is chosen, open dedicated creation modal to configure questions & sources!
    if (type === 'quiz') {
      setQuizModalOpen(true);
      return;
    }

    // If Flashcards is chosen, open dedicated creation modal to configure cards & sources!
    if (type === 'flashcards') {
      setFlashcardsModalOpen(true);
      return;
    }

    // If Report is chosen, open dedicated creation modal to configure format, depth & sources!
    if (type === 'report') {
      setReportModalOpen(true);
      return;
    }

    // If Infographic is chosen, open dedicated customization modal!
    if (type === 'infographic') {
      setInfographicModalOpen(true);
      return;
    }

    // If Audio Overview is chosen, open dedicated customization modal!
    if (type === 'audio') {
      setAudioModalOpen(true);
      return;
    }

    // If Slide Deck is chosen, open dedicated customization modal!
    if (type === 'slides') {
      setSlideModalOpen(true);
      return;
    }

    // If Video Overview is chosen, open dedicated customization modal!
    if (type === 'video') {
      setVideoModalOpen(true);
      return;
    }

    const selectedLang = lang || 'English';
    setSelectedLanguage(selectedLang);
    setTargetStudioType(type);
    setSelectedArtifact(null);
    setStudioModalOpen(true);

    try {
      const activeSources = (activeNotebook.sources || []).filter((s) => s.selected);
      const targetSources = activeSources.length > 0 ? activeSources : (activeNotebook.sources || []);
      const artifactData = await generateArtifactAPI(
        type, 
        targetSources, 
        selectedLang, 
        settings
      );

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Studio`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));
    } catch (err) {
      console.error('Error generating artifact:', err);
    }
  };

  const handleGenerateMindMap = async (topic: string, selectedSourceIds: string[]) => {
    setIsGeneratingMindMap(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'mindmap',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        selectedLanguage,
        settings,
        topic
      );

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'mindmap',
        title: topic ? `Mind Map: ${topic.slice(0, 30)}` : 'Mind Map',
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('mindmap');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setMindMapModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating mind map:', err);
    } finally {
      setIsGeneratingMindMap(false);
    }
  };

  const handleGenerateQuiz = async (config: QuizGenerationConfig) => {
    setIsGeneratingQuiz(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'quiz',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        selectedLanguage,
        settings,
        config.topic,
        config
      );

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'quiz',
        title: config.topic
          ? `Quiz: ${config.topic.slice(0, 30)}`
          : `Quiz (${config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)})`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('quiz');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setQuizModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating quiz:', err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleGenerateFlashcards = async (config: FlashcardsGenerationConfig) => {
    setIsGeneratingFlashcards(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'flashcards',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        selectedLanguage,
        settings,
        config.topic,
        undefined,
        config
      );

      const cardCount = artifactData?.flashcards?.length || 0;
      const countSuffix = cardCount > 0 ? ` (${cardCount} cards)` : '';
      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'flashcards',
        title: config.topic
          ? `Flashcards: ${config.topic.slice(0, 24)}${countSuffix}`
          : `Flashcards Deck${countSuffix}`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('flashcards');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setFlashcardsModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating flashcards:', err);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleGenerateReport = async (config: ReportGenerationConfig) => {
    setIsGeneratingReport(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'report',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        selectedLanguage,
        settings,
        config.topic,
        undefined,
        undefined,
        config
      );

      const formatLabelMap: Record<string, string> = {
        create_your_own: 'Custom Report',
        briefing: 'Briefing Doc',
        study_guide: 'Study Guide',
        blog_post: 'Blog Post',
        faq: 'FAQ',
        timeline: 'Timeline',
        critique: 'Critical Analysis',
        dossier: 'Research Dossier',
      };
      const formatTitle = config.formatTitle || formatLabelMap[config.format] || 'Report';

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'report',
        title: `${formatTitle}: ${activeNotebook?.title || 'Synthesis'}`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('report');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setReportModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGenerateInfographic = async (config: InfographicGenerationConfig) => {
    setIsGeneratingInfographic(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'infographic',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        config.language,
        settings,
        config.customPrompt,
        undefined,
        undefined,
        undefined,
        config
      );

      const styleLabel = config.style !== 'auto' ? ` (${config.style.charAt(0).toUpperCase() + config.style.slice(1).replace('_', ' ')})` : '';
      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'infographic',
        title: artifactData.title || `Infographic${styleLabel}: ${activeNotebook?.title || 'Visual Overview'}`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('infographic');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setInfographicModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating infographic:', err);
    } finally {
      setIsGeneratingInfographic(false);
    }
  };

  const handleGenerateAudio = async (config: AudioGenerationConfig) => {
    setIsGeneratingAudio(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'audio',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        config.language,
        settings,
        config.customPrompt,
        undefined,
        undefined,
        undefined,
        undefined,
        config
      );

      const formatLabelMap: Record<string, string> = {
        deep_dive: 'Deep Dive',
        brief: 'Brief Overview',
        critique: 'Critique',
        debate: 'Debate',
      };
      const formatTitle = formatLabelMap[config.format] || 'Audio Overview';

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'audio',
        title: config.customPrompt 
          ? `${formatTitle}: ${config.customPrompt.slice(0, 26)}`
          : `${formatTitle} (${config.language})`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('audio');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setAudioModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating audio:', err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateSlides = async (config: SlideGenerationConfig) => {
    setIsGeneratingSlide(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'slides',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        config.language,
        settings,
        config.customPrompt,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        config
      );

      const formatTitle = config.format === 'presenter_slides' ? 'Presenter Slides' : 'Detailed Deck';
      const countSuffix = artifactData?.slides?.length ? ` (${artifactData.slides.length} slides)` : '';

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'slides',
        title: config.customPrompt 
          ? `${formatTitle}: ${config.customPrompt.slice(0, 24)}${countSuffix}`
          : `${formatTitle}: ${activeNotebook?.title || 'Synthesis'}${countSuffix}`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('slides');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setSlideModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating slides:', err);
    } finally {
      setIsGeneratingSlide(false);
    }
  };

  const handleGenerateVideo = async (config: VideoGenerationConfig) => {
    setIsGeneratingVideo(true);
    try {
      const chosenSources = (activeNotebook?.sources || []).filter((s) =>
        config.selectedSourceIds.includes(s.id)
      );

      const artifactData = await generateArtifactAPI(
        'video',
        chosenSources.length > 0 ? chosenSources : (activeNotebook?.sources || []),
        config.language,
        settings,
        config.focusTopic,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        config
      );

      const formatTitle = config.format === 'short' ? 'Short Video (9:16)' : 'Explainer Video (16:9)';

      const newArt: StudioArtifact = {
        id: `art-${Date.now()}`,
        type: 'video',
        title: config.focusTopic 
          ? `${formatTitle}: ${config.focusTopic.slice(0, 26)}`
          : `${formatTitle}: ${activeNotebook?.title || 'Overview'}`,
        createdAt: Date.now(),
        data: artifactData,
      };

      setSelectedArtifact(newArt);
      setTargetStudioType('video');
      updateActiveNotebook((nb) => ({
        ...nb,
        artifacts: [newArt, ...nb.artifacts],
      }));

      setVideoModalOpen(false);
      setStudioModalOpen(true);
    } catch (err) {
      console.error('Error generating video:', err);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleOpenArtifact = (art: StudioArtifact) => {
    setSelectedArtifact(art);
    setTargetStudioType(art.type);
    setStudioModalOpen(true);
  };

  const handleDeleteArtifact = (id: string) => {
    updateActiveNotebook((nb) => ({
      ...nb,
      artifacts: nb.artifacts.filter((a) => a.id !== id),
    }));
  };

  const handleSaveNote = (title: string, content: string) => {
    const newArt: StudioArtifact = {
      id: `art-note-${Date.now()}`,
      type: 'note',
      title,
      createdAt: Date.now(),
      data: { content },
    };
    updateActiveNotebook((nb) => ({
      ...nb,
      artifacts: [newArt, ...nb.artifacts],
    }));
  };

  const handleUpdateArtifact = (updated: StudioArtifact) => {
    setSelectedArtifact(updated);
    updateActiveNotebook((nb) => ({
      ...nb,
      artifacts: nb.artifacts.map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  const handleCitationClick = (citation: Citation) => {
    const matchingSource = activeNotebook?.sources.find((s) => s.id === citation.sourceId);
    if (matchingSource) {
      setPreviewSource(matchingSource);
    }
  };

  // Render Home Page if currentView === 'home'
  if (currentView === 'home') {
    return (
      <>
        <HomePage
          notebooks={notebooks}
          onOpenNotebook={handleOpenNotebook}
          onCreateNotebook={handleCreateNotebook}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onDeleteNotebook={handleDeleteNotebook}
          onDuplicateNotebook={handleDuplicateNotebook}
          theme={currentTheme}
          onToggleTheme={handleToggleTheme}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSave={handleSaveSettings}
        />
      </>
    );
  }

  // Render Studio Workspace View if currentView === 'notebook'
  return (
    <div className="h-screen w-screen flex flex-col bg-[#f0f4f9] dark:bg-[#0f1117] text-[#1f1f1f] dark:text-[#e3e3e3] font-sans select-none overflow-hidden transition-colors">
      {/* Global Header */}
      <Header
        title={activeNotebook?.title || 'Untitled notebook'}
        onTitleChange={handleTitleChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCreateNewNotebook={handleCreateNotebook}
        onBackToHome={() => setCurrentView('home')}
        theme={currentTheme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main 3-Column Studio Workspace */}
      <main className="flex-1 px-4 pb-3 pt-0 flex gap-3 h-[calc(100vh-56px)] overflow-hidden transition-all duration-300">
        {/* Left Column: Sources Panel */}
        <section
          className={`h-full transition-all duration-300 ease-in-out ${
            isSourcesCollapsed
              ? 'w-0 opacity-0 overflow-hidden pointer-events-none -ml-3'
              : 'w-[290px] shrink-0 opacity-100'
          }`}
        >
          <SourcesPanel
            sources={activeNotebook?.sources || []}
            onOpenAddModal={() => setIsAddSourceOpen(true)}
            onToggleSource={handleToggleSource}
            onToggleAllSources={handleToggleAllSources}
            onDeleteSource={handleDeleteSource}
            onSearchSubmit={handleSearchSubmit}
            onOpenDeepResearch={handleOpenDeepResearch}
            onAddSources={handleAddSources}
            searchProvider={settings.searchProvider}
            searchApiKey={settings.searchApiKey}
            onPreviewSource={(src) => setPreviewSource(src)}
            onCollapse={() => setIsSourcesCollapsed(true)}
          />
        </section>

        {/* Center Column: Chat & Canvas (Flex-1) */}
        <section className="flex-1 h-full min-w-0 transition-all duration-300">
          <ChatPanel
            messages={activeNotebook?.messages || []}
            sources={activeNotebook?.sources || []}
            onSendMessage={handleSendMessage}
            onClearChat={() => updateActiveNotebook((nb) => ({ ...nb, messages: [] }))}
            onCitationClick={handleCitationClick}
            onSaveToNote={handleSaveNote}
            isLoading={isAiLoading}
            isSourcesCollapsed={isSourcesCollapsed}
            onExpandSources={() => setIsSourcesCollapsed(false)}
            isStudioCollapsed={isStudioCollapsed}
            onExpandStudio={() => setIsStudioCollapsed(false)}
          />
        </section>

        {/* Right Column: Studio Panel */}
        <section
          className={`h-full transition-all duration-300 ease-in-out ${
            isStudioCollapsed
              ? 'w-0 opacity-0 overflow-hidden pointer-events-none -mr-3'
              : 'w-[380px] shrink-0 opacity-100'
          }`}
        >
          <StudioPanel
            artifacts={activeNotebook?.artifacts || []}
            onSelectStudioTool={handleSelectStudioTool}
            onOpenArtifact={handleOpenArtifact}
            onDeleteArtifact={handleDeleteArtifact}
            onAddNote={() => setIsNoteOpen(true)}
            onCollapse={() => setIsStudioCollapsed(true)}
          />
        </section>
      </main>

      {/* Interactive Modals */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onAddSources={handleAddSources}
        searchProvider={settings.searchProvider}
      />

      <ResearchModal
        isOpen={isResearchModalOpen}
        onClose={() => setIsResearchModalOpen(false)}
        initialQuery={researchParams.query}
        initialScope={researchParams.scope}
        initialDepth={researchParams.depth}
        searchProvider={settings.searchProvider}
        searchApiKey={settings.searchApiKey}
        onAddSources={handleAddSources}
        onOpenDeepResearch={handleOpenDeepResearch}
      />

      <DeepResearchModal
        isOpen={isDeepResearchOpen}
        onClose={() => setIsDeepResearchOpen(false)}
        initialQuery={deepResearchParams.query}
        initialScope={deepResearchParams.scope}
        settings={settings}
        onAddSources={handleAddSources}
        onSaveReportArtifact={handleSaveNote}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <StudioModal
        isOpen={studioModalOpen}
        onClose={() => setStudioModalOpen(false)}
        artifact={selectedArtifact}
        targetType={targetStudioType}
        language={selectedLanguage}
        sourceCount={(activeNotebook?.sources || []).filter((s) => s.selected).length}
        notebookTitle={activeNotebook?.title}
        onUpdateArtifact={handleUpdateArtifact}
        onRequestCreateMindMap={() => {
          setStudioModalOpen(false);
          setMindMapModalOpen(true);
        }}
        onRequestCreateQuiz={() => {
          setStudioModalOpen(false);
          setQuizModalOpen(true);
        }}
        onRequestCreateFlashcards={() => {
          setStudioModalOpen(false);
          setFlashcardsModalOpen(true);
        }}
        onRequestCreateReport={() => {
          setStudioModalOpen(false);
          setReportModalOpen(true);
        }}
        onRequestCreateInfographic={() => {
          setStudioModalOpen(false);
          setInfographicModalOpen(true);
        }}
        onRequestCreateAudio={() => {
          setStudioModalOpen(false);
          setAudioModalOpen(true);
        }}
        onRequestCreateSlides={() => {
          setStudioModalOpen(false);
          setSlideModalOpen(true);
        }}
        onRequestCreateVideo={() => {
          setStudioModalOpen(false);
          setVideoModalOpen(true);
        }}
        onSaveToNote={handleSaveNote}
        settings={settings}
      />

      <MindMapCreateModal
        isOpen={mindMapModalOpen}
        onClose={() => setMindMapModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateMindMap}
        isGenerating={isGeneratingMindMap}
      />

      <QuizCreateModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateQuiz}
        isGenerating={isGeneratingQuiz}
      />

      <FlashcardsCreateModal
        isOpen={flashcardsModalOpen}
        onClose={() => setFlashcardsModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateFlashcards}
        isGenerating={isGeneratingFlashcards}
      />

      <ReportCreateModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateReport}
        isGenerating={isGeneratingReport}
      />

      <InfographicCreateModal
        isOpen={infographicModalOpen}
        onClose={() => setInfographicModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateInfographic}
        isGenerating={isGeneratingInfographic}
        defaultLanguage={selectedLanguage}
      />

      <AudioCreateModal
        isOpen={audioModalOpen}
        onClose={() => setAudioModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateAudio}
        isGenerating={isGeneratingAudio}
        defaultLanguage={selectedLanguage}
      />

      <SlideCreateModal
        isOpen={slideModalOpen}
        onClose={() => setSlideModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateSlides}
        isGenerating={isGeneratingSlide}
        defaultLanguage={selectedLanguage}
      />

      <VideoCreateModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        sources={activeNotebook?.sources || []}
        onGenerate={handleGenerateVideo}
        isGenerating={isGeneratingVideo}
        defaultLanguage={selectedLanguage}
      />

      <NoteModal
        isOpen={isNoteOpen}
        onClose={() => setIsNoteOpen(false)}
        onSaveNote={handleSaveNote}
      />

      <SourcePreviewModal
        source={previewSource}
        onClose={() => setPreviewSource(null)}
        onUpdateSource={handleUpdateSource}
        settings={settings}
      />
    </div>
  );
};

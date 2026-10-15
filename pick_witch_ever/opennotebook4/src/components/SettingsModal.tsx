import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Key, 
  Cpu, 
  Search, 
  Mic, 
  Image as ImageIcon, 
  Video, 
  Save, 
  Check, 
  ShieldCheck, 
  ExternalLink,
  RotateCcw,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sliders,
  Server,
  Sun,
  Moon,
  HardDrive,
  Download,
  Upload,
  Database,
  Trash2
} from 'lucide-react';
import { AppSettings, LLMProvider, ImageProvider, VideoProvider } from '../types';
import { LLM_PROVIDERS } from '../services/llmProviders';
import { IMAGE_PROVIDERS, VIDEO_PROVIDERS } from '../services/mediaProviders';
import { 
  DEFAULT_SETTINGS,
  exportNotebooksData, 
  importNotebooksData, 
  resetNotebooksToDefaults, 
  getStorageUsageEstimate, 
  StorageUsage 
} from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModalContent: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
  }));
  const [activeCategory, setActiveCategory] = useState<'llm' | 'search' | 'audio' | 'image' | 'video' | 'appearance' | 'data'>('llm');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageUsage | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Synchronize formData with incoming settings on modal open
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...DEFAULT_SETTINGS,
        ...(settings || {}),
        ...prev,
      }));
    }
  }, [isOpen, settings]);

  // Live Model Fetching State for LLM
  const [liveLlmModels, setLiveLlmModels] = useState<string[]>([]);
  const [isLoadingLlmModels, setIsLoadingLlmModels] = useState(false);
  const [llmFetchError, setLlmFetchError] = useState<string | null>(null);
  const [llmSearchQuery, setLlmSearchQuery] = useState('');

  // Live Model Fetching State for Image
  const [liveImageModels, setLiveImageModels] = useState<string[]>([]);
  const [isLoadingImageModels, setIsLoadingImageModels] = useState(false);
  const [imageFetchError, setImageFetchError] = useState<string | null>(null);

  // Live Model Fetching State for Video
  const [liveVideoModels, setLiveVideoModels] = useState<string[]>([]);
  const [isLoadingVideoModels, setIsLoadingVideoModels] = useState(false);
  const [videoFetchError, setVideoFetchError] = useState<string | null>(null);

  const currentLlmMeta = (formData.llmProvider && LLM_PROVIDERS[formData.llmProvider]) || LLM_PROVIDERS.gemini;
  const currentImageMeta = (formData.imageProvider && IMAGE_PROVIDERS[formData.imageProvider]) || IMAGE_PROVIDERS.google;
  const currentVideoMeta = (formData.videoProvider && VIDEO_PROVIDERS[formData.videoProvider]) || VIDEO_PROVIDERS.google;

  // 1. Fetch LLM Models
  const fetchLlmModels = useCallback(async (
    provider: LLMProvider, 
    key: string, 
    baseUrl?: string,
    ollama?: string,
    lmStudio?: string
  ) => {
    setIsLoadingLlmModels(true);
    setLlmFetchError(null);

    try {
      const resp = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: key,
          baseUrl,
          ollamaUrl: ollama,
          lmStudioUrl: lmStudio,
        }),
      });

      const data = await resp.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        setLiveLlmModels(data.models);
        if (!data.models.includes(formData.llmModel)) {
          setFormData((prev) => ({ ...prev, llmModel: data.models[0] }));
        }
      } else {
        throw new Error(data.error || 'No models returned');
      }
    } catch (err: any) {
      setLlmFetchError(err.message);
      setLiveLlmModels([]);
    } finally {
      setIsLoadingLlmModels(false);
    }
  }, [formData.llmModel]);

  // 2. Fetch Image Models
  const fetchImageModels = useCallback(async (
    provider: ImageProvider,
    key: string,
    comfyUrl?: string
  ) => {
    setIsLoadingImageModels(true);
    setImageFetchError(null);

    try {
      const resp = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType: 'image',
          provider,
          apiKey: key,
          comfyUiUrl: comfyUrl,
        }),
      });

      const data = await resp.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        setLiveImageModels(data.models);
        if (!data.models.includes(formData.imageModel)) {
          setFormData((prev) => ({ ...prev, imageModel: data.models[0] }));
        }
      }
    } catch (err: any) {
      setImageFetchError(err.message);
    } finally {
      setIsLoadingImageModels(false);
    }
  }, [formData.imageModel]);

  // 3. Fetch Video Models
  const fetchVideoModels = useCallback(async (
    provider: VideoProvider,
    key: string,
    comfyUrl?: string
  ) => {
    setIsLoadingVideoModels(true);
    setVideoFetchError(null);

    try {
      const resp = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType: 'video',
          provider,
          apiKey: key,
          comfyUiUrl: comfyUrl,
        }),
      });

      const data = await resp.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        setLiveVideoModels(data.models);
        if (!data.models.includes(formData.videoModel)) {
          setFormData((prev) => ({ ...prev, videoModel: data.models[0] }));
        }
      }
    } catch (err: any) {
      setVideoFetchError(err.message);
    } finally {
      setIsLoadingVideoModels(false);
    }
  }, [formData.videoModel]);

  // Trigger live fetches on modal open / changes
  useEffect(() => {
    if (!isOpen) return;

    // LLM auto-fetch
    const canLlmFetch = Boolean(currentLlmMeta?.isLocal || (formData.llmProvider && ['openrouter', 'huggingface'].includes(formData.llmProvider)) || formData.llmApiKey);
    if (canLlmFetch && formData.llmProvider) {
      fetchLlmModels(formData.llmProvider, formData.llmApiKey || '', formData.llmBaseUrl || currentLlmMeta?.defaultBaseUrl, formData.ollamaUrl, formData.lmStudioUrl);
    }

    // Image auto-fetch
    if (formData.imageProvider) {
      fetchImageModels(formData.imageProvider, formData.imageApiKey || '', formData.imageComfyUiUrl);
    }

    // Video auto-fetch
    if (formData.videoProvider) {
      fetchVideoModels(formData.videoProvider, formData.videoApiKey || '', formData.videoComfyUiUrl);
    }
  }, [isOpen, formData.llmProvider, formData.imageProvider, formData.videoProvider]);

  if (!isOpen) return null;

  const handleLlmProviderChange = (providerId: LLMProvider) => {
    const meta = LLM_PROVIDERS[providerId] || LLM_PROVIDERS.gemini;
    setFormData((prev) => ({
      ...prev,
      llmProvider: providerId,
      llmModel: meta?.defaultModel || 'gemini-2.5-flash',
      llmBaseUrl: meta?.defaultBaseUrl || '',
    }));
    setLlmSearchQuery('');
    fetchLlmModels(providerId, formData.llmApiKey || '', meta?.defaultBaseUrl, formData.ollamaUrl, formData.lmStudioUrl);
  };

  const handleImageProviderChange = (providerId: ImageProvider) => {
    const meta = IMAGE_PROVIDERS[providerId] || IMAGE_PROVIDERS.google;
    setFormData((prev) => ({
      ...prev,
      imageProvider: providerId,
      imageModel: meta?.defaultModel || 'gemini-3.1-flash-image',
      imageBaseUrl: meta?.defaultBaseUrl || '',
    }));
    fetchImageModels(providerId, formData.imageApiKey || '', formData.imageComfyUiUrl);
  };

  const handleVideoProviderChange = (providerId: VideoProvider) => {
    const meta = VIDEO_PROVIDERS[providerId] || VIDEO_PROVIDERS.google;
    setFormData((prev) => ({
      ...prev,
      videoProvider: providerId,
      videoModel: meta?.defaultModel || 'veo-3.1-generate-preview',
      videoBaseUrl: meta?.defaultBaseUrl || '',
    }));
    fetchVideoModels(providerId, formData.videoApiKey || '', formData.videoComfyUiUrl);
  };

  // Escape key listener & storage stats initialization
  useEffect(() => {
    if (isOpen) {
      try {
        setStorageStats(getStorageUsageEstimate());
      } catch (err) {
        console.error('Failed to get storage stats', err);
      }
      setImportStatus(null);
      setResetConfirm(false);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleExportBackup = () => {
    const json = exportNotebooksData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NotebookLM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const res = importNotebooksData(content);
      if (res.success) {
        setImportStatus(`Successfully restored ${res.count} notebook(s)!`);
        setStorageStats(getStorageUsageEstimate());
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setImportStatus(`Error: ${res.error || 'Invalid file format'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    resetNotebooksToDefaults();
    setStorageStats(getStorageUsageEstimate());
    setImportStatus('Notebooks reset to default collection! Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleSave = () => {
    onSave(formData);
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 800);
  };

  const filteredLlmModels = liveLlmModels.filter((m) =>
    m.toLowerCase().includes(llmSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#333a49] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-medium text-gray-900 dark:text-white">
                Model & Provider Settings (BYOK)
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-[#8a919e]">
                Live model inspection & credentials configuration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2f3b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-[#2d3340] px-6 bg-gray-50/70 dark:bg-[#181b22]/90 overflow-x-auto">
          <button
            onClick={() => setActiveCategory('llm')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'llm'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>LLM Engine (14)</span>
          </button>

          <button
            onClick={() => setActiveCategory('image')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'image'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image Generation</span>
          </button>

          <button
            onClick={() => setActiveCategory('video')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'video'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Generation</span>
          </button>

          <button
            onClick={() => setActiveCategory('search')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'search'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search & Ingestion</span>
          </button>

          <button
            onClick={() => setActiveCategory('audio')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'audio'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio (TTS)</span>
          </button>

          <button
            onClick={() => setActiveCategory('appearance')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'appearance'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveCategory('data')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeCategory === 'data'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Data & Storage</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* ======================= LLM TAB ======================= */}
          {activeCategory === 'llm' && (
            <div className="space-y-5">
              {/* Privacy Banner */}
              <div className="p-3 rounded-xl bg-[#232733] border border-[#313747] flex items-start gap-2.5 text-xs text-[#9aa0a6]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Zero server telemetry. API calls are authenticated directly using client-side requests or routed via your local daemon.
                </p>
              </div>

              {/* Provider Grid */}
              <div>
                <label className="text-xs font-medium text-[#c4c7c5] flex items-center justify-between mb-2">
                  <span>Select LLM Provider</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {currentLlmMeta?.badge || 'Frontier'}
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(Object.keys(LLM_PROVIDERS) as LLMProvider[]).map((pKey) => {
                    const p = LLM_PROVIDERS[pKey];
                    const isSelected = formData.llmProvider === pKey;
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => handleLlmProviderChange(pKey)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[66px] ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                            : 'bg-[#181b22] border-[#2e3442] hover:bg-[#232734] text-[#c4c7c5]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold truncate">{p.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-[#8a919e] truncate">{p.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Credentials Input */}
              {currentLlmMeta.isLocal ? (
                <div className="p-4 rounded-xl bg-[#181b22] border border-[#2e3442] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      100% Local / Zero API Key Required
                    </span>
                    <a
                      href={currentLlmMeta.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {currentLlmMeta.name} Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                      Local Server Endpoint URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={(formData.llmProvider === 'ollama' ? formData.ollamaUrl : formData.lmStudioUrl) || ''}
                        onChange={(e) => {
                          if (formData.llmProvider === 'ollama') {
                            setFormData({ ...formData, ollamaUrl: e.target.value });
                          } else {
                            setFormData({ ...formData, lmStudioUrl: e.target.value });
                          }
                        }}
                        className="w-full bg-[#1e222b] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => fetchLlmModels(formData.llmProvider, formData.llmApiKey || '', formData.llmBaseUrl || currentLlmMeta?.defaultBaseUrl, formData.ollamaUrl, formData.lmStudioUrl)}
                        disabled={isLoadingLlmModels}
                        className="px-4 py-2 bg-[#252a35] hover:bg-[#2d3342] border border-[#383e4e] rounded-xl text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isLoadingLlmModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Fetch</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#c4c7c5]">
                      {currentLlmMeta?.name || 'LLM'} API Key
                    </label>
                    <a
                      href={currentLlmMeta?.docUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Get API Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={formData.llmApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, llmApiKey: e.target.value })}
                      placeholder={`Enter ${currentLlmMeta?.name || 'API'} key (${currentLlmMeta?.keyHint || ''})`}
                      className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => fetchLlmModels(formData.llmProvider, formData.llmApiKey || '', formData.llmBaseUrl || currentLlmMeta?.defaultBaseUrl, formData.ollamaUrl, formData.lmStudioUrl)}
                      disabled={isLoadingLlmModels}
                      className="px-4 py-2 bg-[#252a35] hover:bg-[#2d3342] border border-[#383e4e] rounded-xl text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isLoadingLlmModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Fetch Models</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Live Model List */}
              <div className="p-4 rounded-xl bg-[#181b22] border border-[#2e3442] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#c4c7c5] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Live Model Selection</span>
                    {liveLlmModels.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                        {liveLlmModels.length} models fetched live
                      </span>
                    )}
                  </label>
                  {isLoadingLlmModels && (
                    <span className="text-xs text-blue-400 flex items-center gap-1.5 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Querying live models...
                    </span>
                  )}
                </div>

                {llmFetchError && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">Could not fetch live models:</p>
                      <p className="text-[11px] opacity-90 truncate">{llmFetchError}</p>
                    </div>
                  </div>
                )}

                {liveLlmModels.length > 0 ? (
                  <div className="space-y-2">
                    {liveLlmModels.length > 6 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#8a919e] absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Filter models (e.g. flash, sonnet, gpt-4o)..."
                          value={llmSearchQuery}
                          onChange={(e) => setLlmSearchQuery(e.target.value)}
                          className="w-full bg-[#1e222b] border border-[#383e4e] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8a919e] focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    )}
                    <div className="max-h-40 overflow-y-auto border border-[#333a49] rounded-xl divide-y divide-[#2a2f3d] bg-[#1a1d26]">
                      {filteredLlmModels.map((m) => {
                        const isSelected = formData.llmModel === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setFormData({ ...formData, llmModel: m })}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                              isSelected ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-[#c4c7c5] hover:bg-[#242936]'
                            }`}
                          >
                            <span className="font-mono truncate">{m}</span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  !isLoadingLlmModels && (
                    <div className="space-y-3">
                      <div className="text-xs text-[#8a919e] p-3 rounded-lg bg-[#1e222b] border border-[#2d3340] flex items-center justify-between">
                        <span>Enter API key above and click "Fetch Models" to load models from this provider.</span>
                      </div>
                      {currentLlmMeta?.models && currentLlmMeta.models.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] text-[#8a919e] block font-medium">
                            Recommended {currentLlmMeta?.name || 'LLM'} Models:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(currentLlmMeta?.models || []).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setFormData((prev) => ({ ...prev, llmModel: m.id }))}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                                  formData.llmModel === m.id
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium shadow-xs'
                                    : 'bg-[#1a1d26] border-[#2e3442] text-[#9aa0a6] hover:text-white hover:border-[#3d4556]'
                                }`}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                <div>
                  <label className="text-[11px] font-medium text-[#9aa0a6] block mb-1">
                    Active / Custom Model Identifier
                  </label>
                  <input
                    type="text"
                    value={formData.llmModel || ''}
                    onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                    className="w-full bg-[#1e222b] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================= IMAGE TAB ======================= */}
          {activeCategory === 'image' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-[#232733] border border-[#313747] text-xs text-[#c4c7c5] flex items-start gap-2.5">
                <ImageIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Used for generating slide presentation graphics, visual infographics, and notebook asset illustrations.
                </p>
              </div>

              {/* Image Providers Grid (OpenAI, Google, OpenRouter, ComfyUI) */}
              <div>
                <label className="text-xs font-medium text-[#c4c7c5] flex items-center justify-between mb-2">
                  <span>Image Generation Provider</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {currentImageMeta.badge}
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(IMAGE_PROVIDERS) as ImageProvider[]).map((pKey) => {
                    const p = IMAGE_PROVIDERS[pKey];
                    const isSelected = formData.imageProvider === pKey;
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => handleImageProviderChange(pKey)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[72px] ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                            : 'bg-[#181b22] border-[#2e3442] hover:bg-[#232734] text-[#c4c7c5]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold truncate">{p.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-[#8a919e] truncate">{p.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ComfyUI Local Endpoint or Cloud API Key */}
              {formData.imageProvider === 'comfyui' ? (
                <div className="p-4 rounded-xl bg-[#181b22] border border-[#2e3442] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ComfyUI (Local GPU - FLUX, SDXL, SD 3.5)
                    </span>
                    <a
                      href="https://github.com/comfyanonymous/ComfyUI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      ComfyUI Repo <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                      ComfyUI Server Endpoint
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.imageComfyUiUrl || ''}
                        onChange={(e) => setFormData({ ...formData, imageComfyUiUrl: e.target.value })}
                        placeholder="http://localhost:8188"
                        className="w-full bg-[#1e222b] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => fetchImageModels('comfyui', '', formData.imageComfyUiUrl)}
                        className="px-4 py-2 bg-[#252a35] hover:bg-[#2d3342] border border-[#383e4e] rounded-xl text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isLoadingImageModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Scan Checkpoints</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#c4c7c5]">
                      {currentImageMeta?.name || 'Image'} API Key
                    </label>
                    <a
                      href={currentImageMeta?.docUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={formData.imageApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, imageApiKey: e.target.value })}
                      placeholder={`Enter ${currentImageMeta?.name || 'API'} key (${currentImageMeta?.keyHint || ''})`}
                      className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => fetchImageModels(formData.imageProvider, formData.imageApiKey || '')}
                      className="px-4 py-2 bg-[#252a35] hover:bg-[#2d3342] border border-[#383e4e] rounded-xl text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isLoadingImageModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Fetch Models</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Image Model Selector */}
              <div className="p-4 rounded-xl bg-[#181b22] border border-[#2e3442] space-y-3">
                <label className="text-xs font-medium text-[#c4c7c5] block">
                  Available Image Models ({currentImageMeta?.name || 'Image'})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(liveImageModels.length > 0 ? liveImageModels : (currentImageMeta?.models || []).map((m) => m.id)).map((mId) => {
                    const isSelected = formData.imageModel === mId;
                    return (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageModel: mId })}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium' : 'bg-[#1a1d26] border-[#313745] hover:bg-[#252a35] text-[#c4c7c5]'
                        }`}
                      >
                        <span className="text-xs font-mono truncate">{mId}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#9aa0a6] block mb-1">
                    Custom Image Model Identifier / Workflow
                  </label>
                  <input
                    type="text"
                    value={formData.imageModel || ''}
                    onChange={(e) => setFormData({ ...formData, imageModel: e.target.value })}
                    className="w-full bg-[#1e222b] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================= VIDEO TAB ======================= */}
          {activeCategory === 'video' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-[#232733] border border-[#313747] text-xs text-[#c4c7c5] flex items-start gap-2.5">
                <Video className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>
                  Used for synthesizing animated Video Overviews, visual scene transitions, and dynamic summaries.
                </p>
              </div>

              {/* Video Providers Grid (Google Veo, OpenAI Sora, OpenRouter, ComfyUI) */}
              <div>
                <label className="text-xs font-medium text-[#c4c7c5] flex items-center justify-between mb-2">
                  <span>Video Generation Provider</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    {currentVideoMeta.badge}
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(VIDEO_PROVIDERS) as VideoProvider[]).map((pKey) => {
                    const p = VIDEO_PROVIDERS[pKey];
                    const isSelected = formData.videoProvider === pKey;
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => handleVideoProviderChange(pKey)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-[72px] ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/30'
                            : 'bg-[#181b22] border-[#2e3442] hover:bg-[#232734] text-[#c4c7c5]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-semibold truncate">{p.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-[#8a919e] truncate">{p.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ComfyUI Video or Cloud API Key */}
              {formData.videoProvider === 'comfyui' ? (
                <div className="p-4 rounded-xl bg-[#181b22] border border-[#2e3442] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ComfyUI Video (Wan 2.1, HunyuanVideo, CogVideoX)
                    </span>
                    <a
                      href="https://github.com/comfyanonymous/ComfyUI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      ComfyUI Video Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                      ComfyUI Server Endpoint
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.videoComfyUiUrl || ''}
                        onChange={(e) => setFormData({ ...formData, videoComfyUiUrl: e.target.value })}
                        placeholder="http://localhost:8188"
                        className="w-full bg-[#1e222b] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => fetchVideoModels('comfyui', '', formData.videoComfyUiUrl)}
                        className="px-4 py-2 bg-[#252a35] hover:bg-[#2d3342] border border-[#383e4e] rounded-xl text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isLoadingVideoModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Scan Models</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#c4c7c5]">
                      {currentVideoMeta?.name || 'Video'} API Key
                    </label>
                    <a
                      href={currentVideoMeta?.docUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={formData.videoApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, videoApiKey: e.target.value })}
                      placeholder={`Enter ${currentVideoMeta?.name || 'API'} key (${currentVideoMeta?.keyHint || ''})`}
                      className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => fetchVideoModels(formData.videoProvider, formData.videoApiKey || '')}
                      className="px-4 py-2 bg-[#252a35] hover:bg-[#2d3342] border border-[#383e4e] rounded-xl text-xs font-medium text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isLoadingVideoModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Fetch Models</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Video Model Selector */}
              <div className="p-4 rounded-xl bg-[#181b22] border border-[#2e3442] space-y-3">
                <label className="text-xs font-medium text-[#c4c7c5] block">
                  Available Video Models ({currentVideoMeta?.name || 'Video'})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(liveVideoModels.length > 0 ? liveVideoModels : (currentVideoMeta?.models || []).map((m) => m.id)).map((mId) => {
                    const isSelected = formData.videoModel === mId;
                    return (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => setFormData({ ...formData, videoModel: mId })}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-medium' : 'bg-[#1a1d26] border-[#313745] hover:bg-[#252a35] text-[#c4c7c5]'
                        }`}
                      >
                        <span className="text-xs font-mono truncate">{mId}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#9aa0a6] block mb-1">
                    Custom Video Model Identifier / Workflow
                  </label>
                  <input
                    type="text"
                    value={formData.videoModel || ''}
                    onChange={(e) => setFormData({ ...formData, videoModel: e.target.value })}
                    className="w-full bg-[#1e222b] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================= SEARCH TAB ======================= */}
          {activeCategory === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#c4c7c5] block mb-1.5">
                  Web Search & Ingestion Provider
                </label>
                <select
                  value={formData.searchProvider}
                  onChange={(e) => setFormData({ ...formData, searchProvider: e.target.value as any })}
                  className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="ddgs">DuckDuckGo (Free - No API key required)</option>
                  <option value="firecrawl">Firecrawl (Local Docker or Cloud - Clean Markdown)</option>
                  <option value="tavily">Tavily Search (AI-agent RAG search)</option>
                  <option value="brave">Brave Search API</option>
                  <option value="exa">Exa.ai (Neural research & link extraction)</option>
                  <option value="perplexity">Perplexity Sonar</option>
                </select>
              </div>

              {formData.searchProvider === 'firecrawl' && (
                <div>
                  <label className="text-xs font-medium text-[#c4c7c5] block mb-1.5">
                    Firecrawl Instance Endpoint
                  </label>
                  <input
                    type="text"
                    value={formData.firecrawlUrl || ''}
                    onChange={(e) => setFormData({ ...formData, firecrawlUrl: e.target.value })}
                    placeholder="http://localhost:3002 (Local) or https://api.firecrawl.dev"
                    className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 font-mono"
                  />
                  <p className="text-[11px] text-[#8a919e] mt-1">
                    To self-host locally: <code className="text-blue-300">git clone .../firecrawl && docker compose up</code>
                  </p>
                </div>
              )}

              {formData.searchProvider !== 'ddgs' && (
                <div>
                  <label className="text-xs font-medium text-[#c4c7c5] block mb-1.5">
                    {(formData.searchProvider || 'search').toUpperCase()} API Key
                  </label>
                  <input
                    type="password"
                    value={formData.searchApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, searchApiKey: e.target.value })}
                    placeholder={`Enter ${formData.searchProvider || 'provider'} API key (leave blank if local)`}
                    className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* ======================= AUDIO TAB ======================= */}
          {activeCategory === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#c4c7c5] block mb-1.5">
                  Audio Overview TTS Engine
                </label>
                <select
                  value={formData.audioProvider}
                  onChange={(e) => setFormData({ ...formData, audioProvider: e.target.value as any })}
                  className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="edge-tts">Edge-TTS (100% Free, multi-speaker conversational)</option>
                  <option value="elevenlabs">ElevenLabs (Highest realism, BYOK)</option>
                  <option value="openai">OpenAI TTS (Alloy & Echo)</option>
                </select>
              </div>

              {formData.audioProvider !== 'edge-tts' && (
                <div>
                  <label className="text-xs font-medium text-[#c4c7c5] block mb-1.5">
                    {(formData.audioProvider || 'audio').toUpperCase()} API Key
                  </label>
                  <input
                    type="password"
                    value={formData.audioApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, audioApiKey: e.target.value })}
                    placeholder={`Enter ${formData.audioProvider || 'provider'} API key`}
                    className="w-full bg-[#181b22] border border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}

              <div className="p-3 bg-[#252a35] rounded-xl border border-[#333a49] text-xs text-[#9aa0a6] space-y-1">
                <p className="text-white font-medium">Dual-Host Podcast Persona:</p>
                <p>• Host 1 (Explainer / Inquisitive): Sarah (en-US-JennyNeural)</p>
                <p>• Host 2 (Synthesizer / Deep Diver): Michael (en-US-GuyNeural)</p>
              </div>
            </div>
          )}

          {/* ======================= APPEARANCE TAB ======================= */}
          {activeCategory === 'appearance' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#c4c7c5] block mb-1">
                  Interface Theme
                </label>
                <p className="text-xs text-gray-500 dark:text-[#8a919e] mb-4">
                  Select your preferred color scheme matching Google NotebookLM's exact aesthetic.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Light Mode Card */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: 'light' })}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col gap-3 cursor-pointer ${
                      (formData.theme || 'dark') === 'light'
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-[#333a49] bg-white dark:bg-[#252a35] hover:border-gray-300 dark:hover:border-[#434b5c]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                          <Sun className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white block">Light Mode</span>
                          <span className="text-[11px] text-gray-500 dark:text-[#8a919e]">NotebookLM Canvas</span>
                        </div>
                      </div>
                      {(formData.theme || 'dark') === 'light' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-[#9aa0a6] leading-relaxed">
                      Clean white panels with delicate pastel tool cards on a soft Google canvas (#f0f4f9).
                    </p>
                    {/* Visual miniature preview */}
                    <div className="h-12 w-full rounded-lg bg-[#f0f4f9] border border-[#dadce0] p-1.5 flex gap-1.5">
                      <div className="w-1/4 h-full bg-white rounded border border-[#dadce0]" />
                      <div className="flex-1 h-full bg-white rounded border border-[#dadce0]" />
                      <div className="w-1/3 h-full bg-white rounded border border-[#dadce0]" />
                    </div>
                  </button>

                  {/* Dark Mode Card */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: 'dark' })}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col gap-3 cursor-pointer ${
                      (formData.theme || 'dark') === 'dark'
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-[#333a49] bg-white dark:bg-[#252a35] hover:border-gray-300 dark:hover:border-[#434b5c]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                          <Moon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white block">Dark Mode</span>
                          <span className="text-[11px] text-gray-500 dark:text-[#8a919e]">Deep Slate Canvas</span>
                        </div>
                      </div>
                      {(formData.theme || 'dark') === 'dark' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-[#9aa0a6] leading-relaxed">
                      Deep slate aesthetic (#0e1117) with subtle dark gray borders and glowing accents.
                    </p>
                    {/* Visual miniature preview */}
                    <div className="h-12 w-full rounded-lg bg-[#0e1117] border border-[#2d3340] p-1.5 flex gap-1.5">
                      <div className="w-1/4 h-full bg-[#1e222b] rounded border border-[#2d3340]" />
                      <div className="flex-1 h-full bg-[#1e222b] rounded border border-[#2d3340]" />
                      <div className="w-1/3 h-full bg-[#1e222b] rounded border border-[#2d3340]" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================= DATA & STORAGE TAB ======================= */}
          {activeCategory === 'data' && (
            <div className="space-y-6">
              {/* Local Storage Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-[#1f2533] border border-blue-200 dark:border-[#313c54] flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
                <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-900 dark:text-white">100% Local-First Storage</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    All your notebooks, uploaded documents, chat history, and studio artifacts are stored entirely in your local browser storage. No data ever leaves your computer without your explicit AI provider configuration.
                  </p>
                </div>
              </div>

              {/* Live Storage Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#232733] border border-gray-200 dark:border-[#313747] text-center">
                  <span className="text-[11px] text-gray-500 dark:text-[#9aa0a6] block mb-1">Notebooks</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                    {storageStats?.notebookCount ?? '...'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#232733] border border-gray-200 dark:border-[#313747] text-center">
                  <span className="text-[11px] text-gray-500 dark:text-[#9aa0a6] block mb-1">Sources</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                    {storageStats?.sourceCount ?? '...'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#232733] border border-gray-200 dark:border-[#313747] text-center">
                  <span className="text-[11px] text-gray-500 dark:text-[#9aa0a6] block mb-1">Artifacts</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                    {storageStats?.artifactCount ?? '...'}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#232733] border border-gray-200 dark:border-[#313747] text-center">
                  <span className="text-[11px] text-gray-500 dark:text-[#9aa0a6] block mb-1">Storage Used</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {storageStats?.usedFormatted ?? '...'}
                  </span>
                </div>
              </div>

              {importStatus && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  importStatus.startsWith('Error')
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}

              {/* Backup & Restore Operations */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-[#c4c7c5] uppercase tracking-wider">
                  Backup & Export
                </h4>
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#232733] border border-gray-200 dark:border-[#313747] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white block">Export Complete Backup</span>
                    <p className="text-xs text-gray-500 dark:text-[#9aa0a6]">
                      Download all notebooks, source contents, chat logs, and studio artifacts as a portable JSON file.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-[#181b22] hover:bg-gray-100 dark:hover:bg-[#2d3342] border border-gray-300 dark:border-[#3d4559] text-xs font-medium text-gray-800 dark:text-white flex items-center gap-2 shrink-0 transition-colors shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#232733] border border-gray-200 dark:border-[#313747] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white block">Restore from Backup</span>
                    <p className="text-xs text-gray-500 dark:text-[#9aa0a6]">
                      Restore notebooks and documents from a previously exported NotebookLM JSON backup file.
                    </p>
                  </div>
                  <label className="px-4 py-2 rounded-xl bg-white dark:bg-[#181b22] hover:bg-gray-100 dark:hover:bg-[#2d3342] border border-gray-300 dark:border-[#3d4559] text-xs font-medium text-gray-800 dark:text-white flex items-center gap-2 shrink-0 transition-colors shadow-xs cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>Select Backup File</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Factory Reset */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-[#c4c7c5] uppercase tracking-wider">
                  Reset Data
                </h4>
                <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-rose-800 dark:text-rose-200 block">Reset to Default Notebooks</span>
                    <p className="text-xs text-rose-600/80 dark:text-rose-300/70">
                      Restores the original sample notebooks and clears all custom notebooks created in this browser.
                    </p>
                  </div>
                  {resetConfirm ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setResetConfirm(false)}
                        className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-sm cursor-pointer"
                      >
                        Confirm Reset
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setResetConfirm(true)}
                      className="px-4 py-2 rounded-xl bg-white dark:bg-[#181b22] hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-300 dark:border-rose-900 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2 shrink-0 transition-colors shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Notebooks</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22] flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-[#8a919e] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            Active: <strong className="text-gray-800 dark:text-white">{currentLlmMeta?.name || 'Gemini'}</strong> • Image: <strong className="text-gray-800 dark:text-white">{currentImageMeta?.name || 'Google'}</strong> • Video: <strong className="text-gray-800 dark:text-white">{currentVideoMeta?.name || 'Google'}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            >
              {savedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savedFeedback ? 'Saved!' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SettingsErrorBoundaryProps {
  children: React.ReactNode;
  onClose: () => void;
}

interface SettingsErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SettingsErrorBoundary extends React.Component<SettingsErrorBoundaryProps, SettingsErrorBoundaryState> {
  public state: SettingsErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): SettingsErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('SettingsModal error caught:', error, info);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('opennotebook_settings');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e222b] border border-rose-300 dark:border-rose-900/60 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Settings encountered an issue</h3>
                <p className="text-xs text-gray-500 dark:text-[#8a919e]">A setting or cache entry caused a render error.</p>
              </div>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#151820] text-xs font-mono text-rose-500 overflow-x-auto whitespace-pre-wrap max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-[#9aa0a6] hover:bg-gray-100 dark:hover:bg-[#252a35] cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm"
              >
                Reset Settings to Defaults
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <SettingsErrorBoundary onClose={props.onClose}>
      <SettingsModalContent {...props} />
    </SettingsErrorBoundary>
  );
};

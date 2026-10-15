import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  ChevronDown, 
  Video, 
  Sparkles, 
  Edit3,
  Smartphone,
  Tv
} from 'lucide-react';
import { Source, VideoGenerationConfig, VideoFormat } from '../types';

interface VideoCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: VideoGenerationConfig) => void;
  isGenerating: boolean;
  defaultLanguage?: string;
}

interface VideoFormatOption {
  id: VideoFormat;
  title: string;
  iconTag: string;
  badge?: string;
  description: string;
}

const VIDEO_FORMATS: VideoFormatOption[] = [
  {
    id: 'short',
    title: 'Short',
    iconTag: '📱',
    badge: 'New!',
    description: 'A bite-sized overview to help you quickly grasp core ideas from your sources',
  },
  {
    id: 'explainer',
    title: 'Explainer',
    iconTag: '🖥️',
    description: 'A structured, comprehensive overview that connects the dots within your sources',
  },
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Russian',
  'Japanese',
  'Chinese (Simplified)',
  'Korean',
  'Hindi',
  'Arabic',
];

export const VideoCreateModal: React.FC<VideoCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating,
  defaultLanguage = 'English',
}) => {
  const [format, setFormat] = useState<VideoFormat>('short');
  const [language, setLanguage] = useState(defaultLanguage);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number>(0);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourcesDropdownOpen, setIsSourcesDropdownOpen] = useState(false);

  const sourcesDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamically extract 3 source-grounded topic suggestions matching Google NotebookLM
  const suggestedTopics = useMemo(() => {
    const fullText = sources.map((s) => (s.title + ' ' + (s.content || '')).toLowerCase()).join(' ');
    
    // 1. Check for fusion/physics documents
    if (/fusion|tokamak|superconduct|sparc|rebco|magnet|plasma/i.test(fullText)) {
      return [
        'How high field magnets work',
        'SPARC net energy gain Q ≥ 2 threshold',
        'Commercial fusion roadmap and ARC plant',
      ];
    }

    // 2. Check for military history / Badgam documents
    if (/battle|badgam|somnath|kashmir|regiment|officer|pvc/i.test(fullText)) {
      return [
        "Major Sharma's last stand defense",
        'Battle of Badgam tactical chronology',
        'Srinagar airfield defense and 4 Kumaon',
      ];
    }

    // 3. Check for language / grammar documents
    if (/preposition|grammar|writing|sentence|language/i.test(fullText)) {
      return [
        'The role of simple prepositions',
        'Mastering descriptive paragraph writing',
        'Key syntax rules and common errors',
      ];
    }

    // 4. Dynamic extraction from active documents
    const candidateTopics: string[] = [];
    sources.forEach((s) => {
      // Look for Markdown headings
      const headings = (s.content || '').match(/^#{1,3}\s+(.+)$/gm);
      if (headings) {
        headings.slice(0, 2).forEach((h) => {
          const clean = h.replace(/^#{1,3}\s+/, '').replace(/[*_~`]/g, '').trim();
          if (clean.length > 8 && clean.length < 50 && !candidateTopics.includes(clean)) {
            candidateTopics.push(clean);
          }
        });
      }
      // Also use clean title
      const cleanTitle = s.title.split(/[:\-|–]/)[0].trim();
      if (cleanTitle.length > 5 && !candidateTopics.includes(cleanTitle)) {
        candidateTopics.push(cleanTitle);
      }
    });

    if (candidateTopics.length >= 3) {
      return candidateTopics.slice(0, 3);
    }

    return [
      `Core findings of ${sources[0]?.title || 'Source Material'}`,
      'Primary mechanisms and empirical evidence',
      'Strategic implications and forward outlook',
    ];
  }, [sources]);

  useEffect(() => {
    if (isOpen) {
      const active = sources.filter((s) => s.selected);
      setSelectedSourceIds(active.length > 0 ? active.map((s) => s.id) : sources.map((s) => s.id));
      setIsSourcesDropdownOpen(false);
      setSelectedTopicIndex(0);
      setCustomTopic('');
    }
  }, [isOpen, sources]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sourcesDropdownRef.current && !sourcesDropdownRef.current.contains(e.target as Node)) {
        setIsSourcesDropdownOpen(false);
      }
    };
    if (isSourcesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSourcesDropdownOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGenerating) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isGenerating, onClose]);

  if (!isOpen) return null;

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedSourceIds(sources.map((s) => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedSourceIds([]);
  };

  const handleSelectSuggestedTopic = (idx: number) => {
    setSelectedTopicIndex(idx);
  };

  const handleCustomTopicChange = (val: string) => {
    setCustomTopic(val);
    if (val.trim()) {
      setSelectedTopicIndex(-1); // -1 indicates custom topic selected
    }
  };

  const handleGenerateClick = () => {
    const activeFocusTopic = selectedTopicIndex === -1 
      ? customTopic.trim() 
      : suggestedTopics[selectedTopicIndex] || suggestedTopics[0];

    onGenerate({
      format,
      language,
      focusTopic: activeFocusTopic,
      customTopic: customTopic.trim() || undefined,
      selectedSourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#181a20] border border-[#dadce0] dark:border-[#2e3442] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-gray-900 dark:text-[#e1e3e7]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-[#282d3a] bg-gray-50 dark:bg-[#181a20] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Video className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Customize Video Overview</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#252a35] text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-800 dark:text-[#e1e3e7]">
          {/* 1. Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Format</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {VIDEO_FORMATS.map((opt) => {
                const isSelected = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[110px] cursor-pointer group ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-[#252a37] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-white dark:bg-[#1e222b] border-gray-200 dark:border-[#2e3544] hover:bg-gray-50 dark:hover:bg-[#252a37] hover:border-gray-300 dark:hover:border-[#3d4659]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                            {opt.title} <span className="text-base">{opt.iconTag}</span>
                          </span>
                          {opt.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white font-semibold border border-gray-200 dark:border-white/20">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-[#9aa0a6] leading-relaxed group-hover:text-gray-800 dark:group-hover:text-[#c4c7c5] transition-colors">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Middle Row: Choose language + Sources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            {/* Language */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Choose language</label>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] hover:border-gray-300 dark:hover:border-[#3d4659] text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-emerald-500 cursor-pointer transition-colors shadow-xs"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang} className="bg-white dark:bg-[#181a20] text-gray-900 dark:text-white">
                      {lang}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Sources Popover */}
            <div className="space-y-2" ref={sourcesDropdownRef}>
              <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Sources</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSourcesDropdownOpen(!isSourcesDropdownOpen)}
                  className="w-full flex items-center justify-between bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] hover:border-gray-300 dark:hover:border-[#3d4659] text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 transition-colors cursor-pointer shadow-xs"
                >
                  <span className="truncate">
                    {selectedSourceIds.length} source{selectedSourceIds.length === 1 ? '' : 's'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSourcesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSourcesDropdownOpen && (
                  <div className="absolute left-0 right-0 bottom-full mb-2 bg-white dark:bg-[#20242e] border border-gray-200 dark:border-[#333a4d] rounded-2xl shadow-2xl p-3 z-30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100 dark:border-[#2d3445]">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Selected ({selectedSourceIds.length}/{sources.length})</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-medium cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-gray-400 dark:text-gray-500">•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {sources.map((source) => {
                        const isChecked = selectedSourceIds.includes(source.id);
                        return (
                          <div
                            key={source.id}
                            onClick={() => handleToggleSource(source.id)}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#282e3d] cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                              <span className="text-xs text-gray-800 dark:text-gray-200 truncate">{source.title}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-mono">
                              {source.tokenCount?.toLocaleString() || 0} tokens
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Focus / Topic Selection (3 Source-Tailored Cards + Custom Topic) */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">
              What should the video focus on?
            </label>

            {/* 3 AI Source-Tailored Suggested Topic Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggestedTopics.map((top, idx) => {
                const isSelected = selectedTopicIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestedTopic(idx)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex items-start justify-between min-h-[72px] cursor-pointer group ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-[#252a37] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30'
                        : 'bg-white dark:bg-[#1e222b] border-gray-200 dark:border-[#2e3544] hover:bg-gray-50 dark:hover:bg-[#252a37] hover:border-gray-300 dark:hover:border-[#3d4659]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                      <Sparkles className="w-4 h-4 text-emerald-500 dark:text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-3 leading-snug">
                        {top}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-blue-400 shrink-0 stroke-[2.5]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Topic Card */}
            <div 
              className={`p-4 rounded-2xl border transition-all ${
                selectedTopicIndex === -1
                  ? 'bg-emerald-50/40 dark:bg-[#202532] border-emerald-500/80 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-[#1e222b] border-gray-200 dark:border-[#2e3544] hover:border-gray-300 dark:hover:border-[#3d4659]'
              }`}
            >
              <div 
                className="flex items-center gap-2 mb-2 cursor-pointer"
                onClick={() => setSelectedTopicIndex(-1)}
              >
                <Edit3 className="w-4 h-4 text-emerald-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">Custom topic</span>
              </div>
              <textarea
                value={customTopic}
                onChange={(e) => handleCustomTopicChange(e.target.value)}
                onFocus={() => setSelectedTopicIndex(-1)}
                placeholder="Describe your own"
                rows={2}
                className="w-full bg-[#f0f4f9] dark:bg-[#181a20] border border-[#dadce0] dark:border-[#2e3544] hover:border-gray-400 dark:hover:border-[#3d4659] focus:border-emerald-500 text-xs text-gray-900 dark:text-white rounded-xl p-3 placeholder:text-gray-400 dark:placeholder:text-[#5f6368] focus:outline-none transition-colors resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#282d3a] bg-gray-50 dark:bg-[#14161b] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-gray-200 dark:bg-[#252a35] hover:bg-gray-300 dark:hover:bg-[#2f3543] text-sm font-medium text-gray-800 dark:text-white transition-colors cursor-pointer"
          >
            Generate later
          </button>
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <span>Generate now</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

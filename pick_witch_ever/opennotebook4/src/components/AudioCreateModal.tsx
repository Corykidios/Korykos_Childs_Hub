import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Check, 
  ChevronDown, 
  Sparkles,
  Radio
} from 'lucide-react';
import { Source, AudioGenerationConfig, AudioFormat, AudioLength } from '../types';

interface AudioCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: AudioGenerationConfig) => void;
  isGenerating: boolean;
  defaultLanguage?: string;
}

interface FormatOption {
  id: AudioFormat;
  title: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: 'deep_dive',
    title: 'Deep Dive',
    description: 'A lively conversation between two hosts, unpacking and connecting topics in your sources',
  },
  {
    id: 'brief',
    title: 'Brief',
    description: 'A bite-sized overview to help you grasp the core ideas from your sources quickly',
  },
  {
    id: 'critique',
    title: 'Critique',
    description: 'An expert review of your sources, offering constructive feedback to help you improve your material',
  },
  {
    id: 'debate',
    title: 'Debate',
    description: 'A thoughtful debate between two hosts, illuminating different perspectives on your sources',
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

export const AudioCreateModal: React.FC<AudioCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating,
  defaultLanguage = 'English',
}) => {
  const [format, setFormat] = useState<AudioFormat>('deep_dive');
  const [language, setLanguage] = useState(defaultLanguage);
  const [length, setLength] = useState<AudioLength>('default');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourcesDropdownOpen, setIsSourcesDropdownOpen] = useState(false);

  const sourcesDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selected sources when modal opens
  useEffect(() => {
    if (isOpen) {
      const active = sources.filter((s) => s.selected);
      setSelectedSourceIds(active.length > 0 ? active.map((s) => s.id) : sources.map((s) => s.id));
      setIsSourcesDropdownOpen(false);
    }
  }, [isOpen, sources]);

  // Close sources dropdown on outside click
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

  const handleGenerateClick = () => {
    onGenerate({
      format,
      language,
      length,
      selectedSourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      customPrompt: customPrompt.trim(),
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
            <Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Customize Audio Overview</h2>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[140px] cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-[#252a37] border-blue-500/80 shadow-md ring-1 ring-blue-500/30'
                        : 'bg-white dark:bg-[#1e222b] border-gray-200 dark:border-[#2e3544] hover:bg-gray-50 dark:hover:bg-[#252a37] hover:border-gray-300 dark:hover:border-[#3d4659]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">{opt.title}</h4>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
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

          {/* 2. Middle Row: Choose language + Length + Sources */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Language */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Choose language</label>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] hover:border-gray-300 dark:hover:border-[#3d4659] text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors shadow-xs"
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

            {/* Length */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Length</label>
              <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] w-full">
                {(['short', 'default', 'long'] as AudioLength[]).map((len) => {
                  const isSelected = length === len;
                  return (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setLength(len)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium capitalize transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-[#2a303d] text-gray-900 dark:text-white shadow-xs font-semibold'
                          : 'text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {len}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sources dropdown selector */}
            <div className="space-y-2 relative" ref={sourcesDropdownRef}>
              <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Sources to include</label>
              <button
                type="button"
                onClick={() => setIsSourcesDropdownOpen(!isSourcesDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] hover:border-gray-300 dark:hover:border-[#3d4659] text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors shadow-xs"
              >
                <span className="truncate">
                  {selectedSourceIds.length === 0 || selectedSourceIds.length === sources.length
                    ? `All sources (${sources.length})`
                    : `${selectedSourceIds.length} of ${sources.length} sources`}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
              </button>

              {isSourcesDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 bottom-full mb-2 bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] rounded-2xl p-3 shadow-2xl max-h-60 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-[#2a2f3b] text-xs">
                    <span className="text-gray-500 dark:text-[#8a919e]">Select sources for context</span>
                    <button
                      type="button"
                      onClick={selectedSourceIds.length === sources.length ? handleDeselectAll : handleSelectAll}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      {selectedSourceIds.length === sources.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {sources.map((source) => {
                      const isChecked = selectedSourceIds.includes(source.id);
                      return (
                        <div
                          key={source.id}
                          onClick={() => handleToggleSource(source.id)}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#252a35] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded accent-blue-600 cursor-pointer"
                          />
                          <span className="text-xs text-gray-800 dark:text-[#e1e3e7] truncate flex-1">{source.title}</span>
                          <span className="text-[10px] text-gray-400 dark:text-[#8a919e] font-mono">
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

          {/* 3. Focus Guidance Prompt Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">
              What should the AI hosts focus on in this episode?
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={`Things to try\n• Focus on a specific source (“only cover the article about Italy”)\n• Focus on a specific topic (“just discuss the novel’s main character”)\n• Target a specific audience (“explain to someone new to biology”)`}
              rows={4}
              className="w-full bg-[#f0f4f9] dark:bg-[#181a20] border border-[#dadce0] dark:border-[#2e3544] hover:border-gray-400 dark:hover:border-[#3d4659] focus:border-blue-500 text-sm text-gray-900 dark:text-white rounded-2xl p-4 placeholder:text-gray-400 dark:placeholder:text-[#5f6368] focus:outline-none transition-colors resize-none leading-relaxed"
            />
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
            className="px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

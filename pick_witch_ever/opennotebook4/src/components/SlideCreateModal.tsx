import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Check, 
  ChevronDown, 
  Presentation
} from 'lucide-react';
import { Source, SlideGenerationConfig, SlideFormat, SlideLength } from '../types';

interface SlideCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: SlideGenerationConfig) => void;
  isGenerating: boolean;
  defaultLanguage?: string;
}

interface SlideFormatOption {
  id: SlideFormat;
  title: string;
  description: string;
}

const SLIDE_FORMATS: SlideFormatOption[] = [
  {
    id: 'detailed_deck',
    title: 'Detailed Deck',
    description: 'A comprehensive deck with full text and details, perfect for emailing or reading on its own.',
  },
  {
    id: 'presenter_slides',
    title: 'Presenter Slides',
    description: 'Clean, visual slides with key talking points to support you while you speak.',
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

export const SlideCreateModal: React.FC<SlideCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating,
  defaultLanguage = 'English',
}) => {
  const [format, setFormat] = useState<SlideFormat>('detailed_deck');
  const [language, setLanguage] = useState(defaultLanguage);
  const [length, setLength] = useState<SlideLength>('default');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourcesDropdownOpen, setIsSourcesDropdownOpen] = useState(false);

  const sourcesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const active = sources.filter((s) => s.selected);
      setSelectedSourceIds(active.length > 0 ? active.map((s) => s.id) : sources.map((s) => s.id));
      setIsSourcesDropdownOpen(false);
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
        className="bg-white dark:bg-[#181a20] border border-[#dadce0] dark:border-[#2e3442] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-gray-900 dark:text-[#e1e3e7]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-[#282d3a] bg-gray-50 dark:bg-[#181a20] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Presentation className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Customize Slide Deck</h2>
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
              {SLIDE_FORMATS.map((opt) => {
                const isSelected = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[110px] cursor-pointer group ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-[#252a37] border-amber-500/80 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-white dark:bg-[#1e222b] border-gray-200 dark:border-[#2e3544] hover:bg-gray-50 dark:hover:bg-[#252a37] hover:border-gray-300 dark:hover:border-[#3d4659]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">{opt.title}</h4>
                        {isSelected && (
                          <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
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
                  className="w-full appearance-none bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#2e3544] hover:border-gray-300 dark:hover:border-[#3d4659] text-gray-900 dark:text-white text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-amber-500 cursor-pointer transition-colors shadow-xs"
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
                {(['short', 'default'] as SlideLength[]).map((len) => {
                  const isSelected = length === len;
                  return (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setLength(len)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium capitalize transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-[#2b3140] text-gray-900 dark:text-white shadow-xs font-semibold'
                          : 'text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{len === 'default' ? 'Default' : 'Short'}</span>
                    </button>
                  );
                })}
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
                          className="text-amber-600 dark:text-amber-400 hover:text-amber-500 font-medium cursor-pointer"
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
                                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-amber-500 focus:ring-0 cursor-pointer"
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

          {/* 3. Prompt Guidance Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">
              Describe the slide deck you want to create
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add a high-level outline, or guide the audience, style, and focus: &quot;Create a deck for beginners using a bold and playful style with a focus on step-by-step instructions.&quot;"
              rows={4}
              className="w-full bg-[#f0f4f9] dark:bg-[#181a20] border border-[#dadce0] dark:border-[#2e3544] hover:border-gray-400 dark:hover:border-[#3d4659] focus:border-amber-500 text-sm text-gray-900 dark:text-white rounded-2xl p-4 placeholder:text-gray-400 dark:placeholder:text-[#5f6368] focus:outline-none transition-colors resize-none leading-relaxed"
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
            className="px-6 py-2.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

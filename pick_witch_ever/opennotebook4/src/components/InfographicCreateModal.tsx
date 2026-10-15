import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  RefreshCw, 
  BarChart3, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Source, InfographicGenerationConfig, InfographicOrientation, InfographicStyle, InfographicDetail } from '../types';

interface InfographicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: InfographicGenerationConfig) => void;
  isGenerating: boolean;
  defaultLanguage?: string;
}

interface StyleOption {
  id: InfographicStyle;
  label: string;
  renderThumbnail: () => React.ReactNode;
}

export const InfographicCreateModal: React.FC<InfographicCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating,
  defaultLanguage = 'English',
}) => {
  const [language, setLanguage] = useState(defaultLanguage);
  const [orientation, setOrientation] = useState<InfographicOrientation>('landscape');
  const [style, setStyle] = useState<InfographicStyle>('auto');
  const [detail, setDetail] = useState<InfographicDetail>('standard');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [isSourcesDropdownOpen, setIsSourcesDropdownOpen] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
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

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

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
      language,
      orientation,
      style,
      detail,
      selectedSourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      customPrompt: customPrompt.trim(),
    });
  };

  // 10 Visual Style Cards matching Google NotebookLM template
  const styleOptions: StyleOption[] = [
    {
      id: 'auto',
      label: 'Auto-select',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#e8edff] flex items-center justify-center relative overflow-hidden">
          <div className="w-10 h-10 rounded-full bg-[#d6e0ff] flex items-center justify-center shadow-inner">
            <RefreshCw className="w-6 h-6 text-[#1a40b8] stroke-[2.2]" />
          </div>
        </div>
      ),
    },
    {
      id: 'kawaii',
      label: 'Kawaii',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#fdf2f8] flex items-center justify-center relative overflow-hidden">
          {/* Hearts & sparkles background */}
          <div className="absolute top-1.5 left-2 text-[#f472b6] text-[9px]">♥</div>
          <div className="absolute top-2 right-3 text-[#f472b6] text-[8px]">♥</div>
          <div className="absolute bottom-2 left-3 text-[#f472b6] text-[10px]">♥</div>
          <div className="absolute top-3 left-6 text-[#fbbf24] text-[8px]">✦</div>
          <div className="absolute bottom-3 right-4 text-[#fbbf24] text-[9px]">✦</div>
          
          {/* Cute Kawaii Rocket */}
          <svg viewBox="0 0 64 64" className="w-14 h-14 drop-shadow-sm">
            {/* Rocket body */}
            <path d="M32 6 C20 18 18 36 20 48 L44 48 C46 36 44 18 32 6 Z" fill="#d1fae5" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
            {/* Nosecone */}
            <path d="M32 6 C26 12 25 20 25 20 L39 20 C39 20 38 12 32 6 Z" fill="#fbcfe8" stroke="#1f2937" strokeWidth="2" />
            {/* Wings */}
            <path d="M20 38 C14 42 12 49 14 53 C18 52 20 47 21 46 Z" fill="#fbcfe8" stroke="#1f2937" strokeWidth="2" />
            <path d="M44 38 C50 42 52 49 50 53 C46 52 44 47 43 46 Z" fill="#fbcfe8" stroke="#1f2937" strokeWidth="2" />
            {/* Eyes */}
            <ellipse cx="28" cy="30" rx="2" ry="2.8" fill="#111827" />
            <ellipse cx="36" cy="30" rx="2" ry="2.8" fill="#111827" />
            <circle cx="27.3" cy="28.8" r="0.8" fill="#ffffff" />
            <circle cx="35.3" cy="28.8" r="0.8" fill="#ffffff" />
            {/* Cheeks */}
            <ellipse cx="25" cy="33" rx="2" ry="1.2" fill="#f472b6" opacity="0.75" />
            <ellipse cx="39" cy="33" rx="2" ry="1.2" fill="#f472b6" opacity="0.75" />
            {/* Smile */}
            <path d="M30 32 Q32 35 34 32" fill="none" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      ),
    },
    {
      id: 'clay',
      label: 'Clay',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#e8ded1] flex items-center justify-center relative overflow-hidden">
          {/* 3D clay styled rocket */}
          <svg viewBox="0 0 64 64" className="w-14 h-14 filter drop-shadow-md">
            <ellipse cx="32" cy="54" rx="14" ry="4" fill="#cfbeaa" />
            {/* Clay rocket body */}
            <path d="M32 10 C22 20 22 40 24 48 L40 48 C42 40 42 20 32 10 Z" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5" />
            {/* Red Clay Nosecone */}
            <path d="M32 10 C27 16 26 23 26 23 L38 23 C38 23 37 16 32 10 Z" fill="#dc2626" stroke="#b91c1c" strokeWidth="1.5" />
            {/* Porthole */}
            <circle cx="32" cy="31" r="5" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx="32" cy="31" r="3.2" fill="#0284c7" />
            {/* Clay Fins */}
            <path d="M24 38 C17 40 16 48 18 51 C22 50 24 45 24.5 44 Z" fill="#ea580c" />
            <path d="M40 38 C47 40 48 48 46 51 C42 50 40 45 39.5 44 Z" fill="#ea580c" />
          </svg>
        </div>
      ),
    },
    {
      id: 'sketch_note',
      label: 'Sketch Note',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center relative overflow-hidden">
          {/* Hand-drawn sketchy lines */}
          <svg viewBox="0 0 64 64" className="w-14 h-14">
            {/* Sparkles */}
            <path d="M12 20 L16 24 M14 28 L17 26 M48 18 L52 22 M50 26 L47 24" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
            {/* Motion dashes */}
            <path d="M22 52 L18 57 M32 53 L32 59 M42 52 L46 57" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
            {/* Sketch rocket */}
            <path d="M32 8 C22 18 20 36 22 47 L42 47 C44 36 42 18 32 8 Z" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeDasharray="30 1" />
            <path d="M24 20 L40 20" fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="32" cy="32" r="4.5" fill="none" stroke="#0f172a" strokeWidth="1.8" />
            <path d="M22 36 C16 40 14 47 16 50 C20 49 22 44 22.5 43 Z" fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M42 36 C48 40 50 47 48 50 C44 49 42 44 41.5 43 Z" fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      ),
    },
    {
      id: 'anime',
      label: 'Anime',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#0b1021] flex items-center justify-center relative overflow-hidden">
          {/* Anime speed lines */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px]" />
          <svg viewBox="0 0 64 64" className="w-14 h-14 filter drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
            {/* Thruster blast flame */}
            <path d="M24 46 L32 62 L40 46 Z" fill="#f97316" />
            <path d="M27 46 L32 58 L37 46 Z" fill="#facc15" />
            <path d="M29 46 L32 54 L35 46 Z" fill="#ffffff" />
            {/* Angular mecha rocket */}
            <path d="M32 6 L22 28 L25 46 L39 46 L42 28 Z" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="1.5" />
            <path d="M32 6 L26 24 L38 24 Z" fill="#ffffff" />
            <path d="M22 32 L12 44 L24 44 Z" fill="#ea580c" stroke="#f97316" strokeWidth="1" />
            <path d="M42 32 L52 44 L40 44 Z" fill="#ea580c" stroke="#f97316" strokeWidth="1" />
            <rect x="29" y="32" width="6" height="4" rx="1" fill="#38bdf8" />
          </svg>
        </div>
      ),
    },
    {
      id: 'editorial',
      label: 'Editorial',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#0f172a] flex items-center justify-center relative p-2 overflow-hidden">
          <div className="w-full h-full border border-slate-700 rounded-lg p-1.5 flex flex-col justify-between bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-700 pb-1">
              <span className="text-[7px] font-bold text-amber-400 uppercase tracking-wider">Metrics</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-end gap-1 h-6 pt-1">
              <div className="w-2 bg-blue-500 rounded-t-xs h-[45%]" />
              <div className="w-2 bg-indigo-500 rounded-t-xs h-[75%]" />
              <div className="w-2 bg-amber-400 rounded-t-xs h-[60%]" />
              <div className="w-2 bg-emerald-400 rounded-t-xs h-[95%]" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'minimalist',
      label: 'Minimalist',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#18181b] flex items-center justify-center relative overflow-hidden">
          <svg viewBox="0 0 64 64" className="w-12 h-12">
            <circle cx="32" cy="32" r="22" fill="none" stroke="#52525b" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="32" cy="32" r="14" fill="none" stroke="#f4f4f5" strokeWidth="2" />
            <line x1="32" y1="10" x2="32" y2="54" stroke="#38bdf8" strokeWidth="1.8" />
            <circle cx="32" cy="32" r="3" fill="#38bdf8" />
          </svg>
        </div>
      ),
    },
    {
      id: '3d_render',
      label: '3D Render',
      renderThumbnail: () => (
        <div className="w-full h-full bg-gradient-to-br from-[#1e1b4b] to-[#0f172a] flex items-center justify-center relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 shadow-[0_4px_16px_rgba(6,182,212,0.5)] rotate-12 flex items-center justify-center border border-cyan-300/30">
            <div className="w-5 h-5 rounded-lg bg-white/30 backdrop-blur-xs border border-white/50" />
          </div>
        </div>
      ),
    },
    {
      id: 'watercolor',
      label: 'Watercolor',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#fffdfa] flex items-center justify-center relative overflow-hidden">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ec4899] via-[#8b5cf6] to-[#06b6d4] opacity-80 blur-[6px]" />
          <svg viewBox="0 0 64 64" className="w-10 h-10 absolute">
            <circle cx="32" cy="32" r="16" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M26 32 Q32 24 38 32 Q32 40 26 32" fill="none" stroke="#334155" strokeWidth="1.5" />
          </svg>
        </div>
      ),
    },
    {
      id: 'vintage',
      label: 'Vintage',
      renderThumbnail: () => (
        <div className="w-full h-full bg-[#1e293b] flex items-center justify-center relative overflow-hidden">
          {/* Blueprint grid */}
          <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:8px_8px]" />
          <svg viewBox="0 0 64 64" className="w-12 h-12 relative">
            <rect x="16" y="16" width="32" height="32" fill="none" stroke="#7dd3fc" strokeWidth="1.5" />
            <line x1="16" y1="16" x2="48" y2="48" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="16" y1="48" x2="48" y2="16" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="32" cy="32" r="8" fill="none" stroke="#bae6fd" strokeWidth="1.2" />
          </svg>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#191b1a] border border-[#dadce0] dark:border-[#2e322a] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-gray-900 dark:text-[#e8e9e6]">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-gray-100 dark:border-[#282c26] bg-gray-50 dark:bg-[#191b1a]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center text-pink-500 dark:text-pink-400">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#e8e9e6] tracking-tight">
              Customize Infographic
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252824] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-sm">
          {/* Row 1: Language & Orientation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Choose language */}
            <div>
              <label className="block text-xs sm:text-[13px] font-medium text-gray-700 dark:text-[#d0d3cb] mb-2">
                Choose language
              </label>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-white dark:bg-[#1f221f] border border-gray-200 dark:border-[#343831] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-9 shadow-xs"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Italian">Italian</option>
                  <option value="Korean">Korean</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Russian">Russian</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Choose orientation */}
            <div>
              <label className="block text-xs sm:text-[13px] font-medium text-gray-700 dark:text-[#d0d3cb] mb-2">
                Choose orientation
              </label>
              <div className="inline-flex bg-gray-100 dark:bg-[#1f221f] border border-gray-200 dark:border-[#343831] rounded-full p-1 gap-1 w-full sm:w-auto">
                {(['landscape', 'portrait', 'square'] as InfographicOrientation[]).map((ori) => {
                  const isSelected = orientation === ori;
                  const label = ori.charAt(0).toUpperCase() + ori.slice(1);
                  return (
                    <button
                      key={ori}
                      type="button"
                      onClick={() => setOrientation(ori)}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-white dark:bg-[#2b3028] text-gray-900 dark:text-white border border-gray-200 dark:border-[#444b3f] shadow-xs font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Choose visual style */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs sm:text-[13px] font-medium text-gray-700 dark:text-[#d0d3cb]">
                Choose visual style
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252824] transition-colors cursor-pointer"
                  title="Previous styles"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252824] transition-colors cursor-pointer"
                  title="Next styles"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Carousel */}
            <div
              ref={carouselRef}
              className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar scroll-smooth snap-x"
            >
              {styleOptions.map((opt) => {
                const isSelected = style === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStyle(opt.id)}
                    className="flex flex-col items-center shrink-0 group cursor-pointer snap-start text-left focus:outline-none"
                  >
                    <div
                      className={`w-[130px] h-[86px] rounded-2xl overflow-hidden relative transition-all duration-200 border-2 ${
                        isSelected
                          ? 'border-[#4285f4] ring-2 ring-[#4285f4]/30 shadow-lg scale-[1.02]'
                          : 'border-gray-200 dark:border-[#30352d] hover:border-gray-300 dark:hover:border-[#484f42]'
                      }`}
                    >
                      {opt.renderThumbnail()}

                      {/* Selected checkmark circle badge at top-right corner */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1b233a] border border-[#4285f4] flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span
                      className={`mt-1.5 text-xs font-medium transition-colors ${
                        isSelected ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Level of detail & Sources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {/* Level of detail */}
            <div>
              <label className="block text-xs sm:text-[13px] font-medium text-gray-700 dark:text-[#d0d3cb] mb-2">
                Level of detail
              </label>
              <div className="inline-flex bg-gray-100 dark:bg-[#1f221f] border border-gray-200 dark:border-[#343831] rounded-full p-1 gap-1 w-full sm:w-auto">
                {(['concise', 'standard', 'detailed'] as InfographicDetail[]).map((lvl) => {
                  const isSelected = detail === lvl;
                  const label = lvl.charAt(0).toUpperCase() + lvl.slice(1);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDetail(lvl)}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-white dark:bg-[#2b3028] text-gray-900 dark:text-white border border-gray-200 dark:border-[#444b3f] shadow-xs font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      <span>{label}</span>
                      {lvl === 'detailed' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-200 dark:bg-[#383e33] text-gray-700 dark:text-gray-300 ml-0.5 tracking-wider uppercase">
                          BETA
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sources dropdown */}
            <div className="relative" ref={sourcesDropdownRef}>
              <label className="block text-xs sm:text-[13px] font-medium text-gray-700 dark:text-[#d0d3cb] mb-2">
                Sources
              </label>
              <button
                type="button"
                onClick={() => setIsSourcesDropdownOpen(!isSourcesDropdownOpen)}
                className="bg-white dark:bg-[#1f221f] border border-gray-200 dark:border-[#343831] hover:border-gray-300 dark:hover:border-[#4a5045] px-4 py-2 rounded-full text-xs text-gray-900 dark:text-white font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer w-full sm:w-auto min-w-[140px] shadow-xs"
              >
                <span>
                  {selectedSourceIds.length} source{selectedSourceIds.length === 1 ? '' : 's'}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                    isSourcesDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Sources interactive popover */}
              {isSourcesDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-[#1f221f] border border-gray-200 dark:border-[#363a32] rounded-2xl shadow-2xl p-3 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-[#2d3129] text-[11px]">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Included Sources</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-gray-400 dark:text-gray-600">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {sources.map((s) => {
                      const checked = selectedSourceIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#282c25] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleSource(s.id)}
                            className="mt-0.5 rounded accent-blue-500 cursor-pointer"
                          />
                          <span className="text-gray-800 dark:text-gray-300 line-clamp-1 flex-1 leading-snug">
                            {s.title}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Describe the infographic you want to create */}
          <div>
            <label className="block text-xs sm:text-[13px] font-medium text-gray-700 dark:text-[#d0d3cb] mb-2">
              Describe the infographic you want to create
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder='Guide the style, color, or focus: "Use a blue color theme and highlight the 3 key stats."'
              rows={3}
              className="w-full bg-[#f0f4f9] dark:bg-[#181a19] border border-[#dadce0] dark:border-[#31362d] focus:border-blue-500 rounded-2xl p-3.5 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer (BYOK Policy: NO artificial AI usage quota bar) */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#282c26] flex items-center justify-end gap-3 shrink-0 bg-gray-50 dark:bg-[#161817]">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252824] transition-colors cursor-pointer disabled:opacity-50"
          >
            Generate later
          </button>
          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerating || sources.length === 0}
            className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-[#4285f4] hover:bg-[#3367d6] transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Generate now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

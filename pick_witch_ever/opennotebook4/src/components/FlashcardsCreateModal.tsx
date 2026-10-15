import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronDown, Check, Loader2, Layers, Sparkles, Sliders, BookOpen } from 'lucide-react';
import { Source } from '../types';

export type FlashcardVolumeOption = 'auto' | 'standard' | 'extensive' | 'fewer';
export type FlashcardFocusOption = 'all' | 'key_terms' | 'qa_conceptual';

export interface FlashcardsGenerationConfig {
  topic: string;
  selectedSourceIds: string[];
  cardVolume: FlashcardVolumeOption;
  focus: FlashcardFocusOption;
  estimatedCount?: number;
}

interface FlashcardsCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: FlashcardsGenerationConfig) => void;
  isGenerating?: boolean;
}

export const FlashcardsCreateModal: React.FC<FlashcardsCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating = false,
}) => {
  const [cardVolume, setCardVolume] = useState<FlashcardVolumeOption>('auto');
  const [focus, setFocus] = useState<FlashcardFocusOption>('all');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [showSourcesDropdown, setShowSourcesDropdown] = useState(false);
  const [topic, setTopic] = useState('');

  // Sync selected sources on modal open
  useEffect(() => {
    if (isOpen) {
      const activeIds = sources.filter((s) => s.selected).map((s) => s.id);
      setSelectedSourceIds(activeIds.length > 0 ? activeIds : sources.map((s) => s.id));
      setTopic('');
      setShowSourcesDropdown(false);
    }
  }, [isOpen, sources]);

  // Compute live estimate based on selected sources and card volume
  const estimate = useMemo(() => {
    const chosenSources = sources.filter((s) => selectedSourceIds.includes(s.id));
    const totalChars = chosenSources.reduce(
      (acc, s) => acc + (s.content ? String(s.content).trim().length : 0),
      0
    );
    const sourceCount = chosenSources.length;

    if (cardVolume === 'fewer') {
      return {
        count: 12,
        label: '~10–14 cards',
        subtitle: 'Quick review deck',
        totalChars,
        sourceCount,
      };
    }
    if (cardVolume === 'standard') {
      return {
        count: 20,
        label: '~18–24 cards',
        subtitle: 'Core concepts deck',
        totalChars,
        sourceCount,
      };
    }
    if (cardVolume === 'extensive') {
      return {
        count: 45,
        label: '~35–50+ cards',
        subtitle: 'Granular comprehensive coverage',
        totalChars,
        sourceCount,
      };
    }

    // 'auto' mode: dynamically adapts based on text volume and depth
    if (totalChars < 3000) {
      return {
        count: 15,
        label: '~12–16 cards',
        subtitle: 'Scaled to compact source material',
        totalChars,
        sourceCount,
      };
    } else if (totalChars < 9000) {
      return {
        count: 25,
        label: '~22–28 cards',
        subtitle: 'Scaled to moderate content depth',
        totalChars,
        sourceCount,
      };
    } else if (totalChars < 25000) {
      return {
        count: 38,
        label: '~35–42 cards',
        subtitle: 'Scaled to rich multi-page sources',
        totalChars,
        sourceCount,
      };
    } else {
      return {
        count: 50,
        label: '~45–60 cards',
        subtitle: 'Scaled to comprehensive large corpus',
        totalChars,
        sourceCount,
      };
    }
  }, [sources, selectedSourceIds, cardVolume]);

  if (!isOpen) return null;

  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const handleToggleAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  };

  const suggestedPrompts = [
    'Create comprehensive flashcards for exam preparation',
    'Focus heavily on terminology, formulas, and fundamental definitions',
    'Focus on causal mechanisms, historical dates, and key empirical evidence',
    'Generate high-yield cards highlighting critical takeaways from each section',
  ];

  const handleGenerateClick = () => {
    if (isGenerating || selectedSourceIds.length === 0) return;
    onGenerate({
      topic: topic.trim(),
      selectedSourceIds,
      cardVolume,
      focus,
      estimatedCount: estimate.count,
    });
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div
        className="bg-white dark:bg-[#181a20] border border-[#dadce0] dark:border-[#2e3340] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 text-gray-900 dark:text-[#e1e3e7]"
        onClick={() => {
          if (showSourcesDropdown) setShowSourcesDropdown(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#252a36] bg-gray-50 dark:bg-[#181a20]">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">Flashcards</h2>
              <p className="text-[11px] text-gray-500 dark:text-[#8a919e]">
                Synthesize source-grounded flashcards for active recall study
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a36] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
          {/* Row 1: Deck Volume / Number of Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                Deck Size / Quantity
              </label>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                {estimate.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: 'auto' as FlashcardVolumeOption,
                  label: 'Auto (Dynamic)',
                  badge: 'Recommended',
                  desc: 'Scales with content depth',
                },
                {
                  id: 'fewer' as FlashcardVolumeOption,
                  label: 'Quick Review',
                  desc: '~10–14 cards',
                },
                {
                  id: 'standard' as FlashcardVolumeOption,
                  label: 'Standard',
                  desc: '~18–24 cards',
                },
                {
                  id: 'extensive' as FlashcardVolumeOption,
                  label: 'Extensive',
                  desc: '~35–50+ cards',
                },
              ].map((item) => {
                const isSelected = cardVolume === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCardVolume(item.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-[#222836] border-indigo-500/60 shadow-sm ring-1 ring-indigo-500/40'
                        : 'bg-white dark:bg-[#1a1d24] border-gray-200 dark:border-[#2e3340] hover:border-gray-300 dark:hover:border-[#3e4656] text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-950 dark:text-white' : 'text-gray-800 dark:text-gray-300'}`}>
                          {item.label}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-[#8a919e] mt-1 leading-tight">{item.desc}</p>
                    </div>

                    {item.badge && (
                      <span className="inline-block mt-2 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-500/40 text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 w-max">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Volume Scaling Info Note */}
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1d222d] border border-gray-200 dark:border-[#2e3545] flex items-center justify-between text-[11px] text-gray-600 dark:text-[#9aa0a6]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  {cardVolume === 'auto'
                    ? `NotebookLM adapts deck size to source depth: ${estimate.subtitle}.`
                    : `Fixed volume mode selected: ${estimate.subtitle}.`}
                </span>
              </div>
              <span className="text-gray-600 dark:text-[#c4c7c5] font-mono text-[10px] shrink-0 ml-2">
                {estimate.totalChars.toLocaleString()} chars
              </span>
            </div>
          </div>

          {/* Row 2: Study Focus */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
              Study Focus
            </label>
            <div className="inline-flex rounded-full bg-gray-100 dark:bg-[#1e222b] border border-gray-200 dark:border-[#313847] p-1 gap-1 w-full sm:w-auto">
              {[
                { id: 'all' as FlashcardFocusOption, label: 'All Key Concepts & Evidence' },
                { id: 'key_terms' as FlashcardFocusOption, label: 'Terms & Definitions' },
                { id: 'qa_conceptual' as FlashcardFocusOption, label: 'Conceptual Q&A' },
              ].map((item) => {
                const isSelected = focus === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFocus(item.id)}
                    className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Sources Dropdown Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
              Sources
            </label>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowSourcesDropdown(!showSourcesDropdown)}
                className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#383e4e] hover:border-gray-300 dark:hover:border-[#4d5568] text-xs text-gray-900 dark:text-white font-medium flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <span>{selectedSourceIds.length} sources selected</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 dark:text-[#9aa0a6] transition-transform ${
                    showSourcesDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Sources Dropdown Popover */}
              {showSourcesDropdown && (
                <div className="absolute left-0 top-full mt-2 w-80 max-h-64 overflow-y-auto bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#383e4e] rounded-xl shadow-2xl p-2.5 z-30 divide-y divide-gray-100 dark:divide-[#2a2f3d]">
                  <div className="flex items-center justify-between pb-2 px-1">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-[#8a919e] uppercase tracking-wider">
                      Select Sources
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAllSources}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer"
                    >
                      {selectedSourceIds.length === sources.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="pt-2 space-y-1">
                    {sources.map((src) => {
                      const isChecked = selectedSourceIds.includes(src.id);
                      return (
                        <div
                          key={src.id}
                          onClick={() => handleToggleSource(src.id)}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252a36] cursor-pointer transition-colors"
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isChecked
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-gray-300 dark:border-[#4a5264] bg-white dark:bg-transparent'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs text-gray-900 dark:text-[#d3d6dc] truncate flex-1">
                            {src.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Custom Focus / Topic / Instructions */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
              Custom Focus / Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Focus on key historical dates, core formulas, or Chapter 3 arguments"
              className="w-full bg-[#f0f4f9] dark:bg-[#13151a] border border-[#dadce0] dark:border-[#2a2f3d] focus:border-indigo-500 focus:outline-hidden rounded-xl p-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none transition-colors"
            />
          </div>

          {/* Row 5: Suggested Prompts */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Suggested Prompts:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setTopic(sug)}
                  className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#202530] hover:bg-gray-200 dark:hover:bg-[#282f3d] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-[#2e3544] transition-colors cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-[#252a36] bg-gray-50 dark:bg-[#181a20]">
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Target deck:{' '}
            <span className="text-gray-900 dark:text-white font-medium">{estimate.label}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a36] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={isGenerating || selectedSourceIds.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Deck...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Flashcards</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

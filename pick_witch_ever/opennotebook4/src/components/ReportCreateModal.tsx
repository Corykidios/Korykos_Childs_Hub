import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Pencil,
  Check,
  Loader2,
  ChevronDown,
  BookOpen,
  Sliders,
} from 'lucide-react';
import { Source, ReportFormat, ReportDepth, ReportGenerationConfig, ReportSuggestion } from '../types';
import { getReportSuggestionsAPI } from '../services/api';

interface ReportCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: ReportGenerationConfig) => void;
  isGenerating?: boolean;
}

interface FormatItem {
  id: string;
  title: string;
  description: string;
  isDefault: boolean;
  hasPencil: boolean;
  defaultPrompt: string;
}

export const ReportCreateModal: React.FC<ReportCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating = false,
}) => {
  // Active selected format
  const [selectedFormatId, setSelectedFormatId] = useState<string>('briefing');
  const [selectedFormatTitle, setSelectedFormatTitle] = useState<string>('Briefing Doc');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [depth, setDepth] = useState<ReportDepth>('standard');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [showSourcesDropdown, setShowSourcesDropdown] = useState<boolean>(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);

  // Dynamic AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<ReportSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);

  // Top 4 Default Formats from Google NotebookLM
  const defaultFormats: FormatItem[] = [
    {
      id: 'create_your_own',
      title: 'Create Your Own',
      description: 'Craft reports your way by specifying structure, style, tone, and more',
      isDefault: true,
      hasPencil: false,
      defaultPrompt: '',
    },
    {
      id: 'briefing',
      title: 'Briefing Doc',
      description: 'Overview of your sources featuring key insights and quotes',
      isDefault: true,
      hasPencil: true,
      defaultPrompt: 'Create an executive briefing doc summarizing the core insights, empirical evidence, and strategic takeaways with direct source quotes and citations.',
    },
    {
      id: 'study_guide',
      title: 'Study Guide',
      description: 'Short-answer quiz, suggested essay questions, and glossary of key terms',
      isDefault: true,
      hasPencil: true,
      defaultPrompt: 'Create a comprehensive study guide featuring a glossary of key terms, deep-dive conceptual explanations, review questions with answers, and essay prompts.',
    },
    {
      id: 'blog_post',
      title: 'Blog Post',
      description: 'Insightful takeaways distilled into a highly readable article',
      isDefault: true,
      hasPencil: true,
      defaultPrompt: 'Distill the key takeaways and discoveries from the sources into an engaging, highly readable, publication-ready blog post with clear sections and memorable insights.',
    },
  ];

  // Fetch or regenerate AI suggestions when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeIds = sources.filter((s) => s.selected).map((s) => s.id);
      setSelectedSourceIds(activeIds.length > 0 ? activeIds : sources.map((s) => s.id));
      setSelectedFormatId('briefing');
      setSelectedFormatTitle('Briefing Doc');
      setCustomPrompt('');
      setIsEditingPrompt(false);
      setShowSourcesDropdown(false);

      // Load AI suggestions tailored to current sources
      if (sources.length > 0) {
        setIsLoadingSuggestions(true);
        getReportSuggestionsAPI(sources)
          .then((suggestions) => {
            if (suggestions && suggestions.length >= 4) {
              setAiSuggestions(suggestions.slice(0, 4));
            } else {
              // Fallback heuristic suggestions
              setAiSuggestions(getFallbackSuggestions(sources));
            }
          })
          .catch(() => {
            setAiSuggestions(getFallbackSuggestions(sources));
          })
          .finally(() => {
            setIsLoadingSuggestions(false);
          });
      }
    }
  }, [isOpen, sources]);

  // Helper for smart local suggestions
  const getFallbackSuggestions = (srcList: Source[]): ReportSuggestion[] => {
    const fullText = srcList.map((s) => (s.title + ' ' + (s.content || '')).toLowerCase()).join(' ');
    const titles = srcList.map((s) => s.title).filter(Boolean);
    const primary = titles[0] ? titles[0].replace(/\.[^/.]+$/, '').split(/[:\-|–]/)[0].trim() : 'Primary Subject';

    const hasTech = /superconduct|tokamak|sparc|fusion|magnet|quantum|algorithm|qubit|neural|physics|energy/i.test(fullText);
    const hasHistory = /battle|badgam|somnath|regiment|kashmir|war|military|officer|pvc|sharma|century|history/i.test(fullText);

    if (hasTech && hasHistory) {
      return [
        {
          id: 'tech_roadmap',
          title: 'Technology Roadmap',
          description: 'A comprehensive multi-year development strategy for high-temperature superconductors, fusion magnets, and commercial infrastructure.',
          prompt: 'Create a multi-year Technology Roadmap analyzing commercial milestones, engineering milestones, and scaling phases from the sources.',
        },
        {
          id: 'investment_case',
          title: 'Investment Case Analysis',
          description: 'A substantive evaluation of the commercial viability, capital infrastructure, and strategic valuation of fusion energy technologies.',
          prompt: 'Conduct a substantive Investment Case Analysis examining capital efficiency, competitive advantages, and commercial hurdles grounded in the sources.',
        },
        {
          id: 'concept_breakdown',
          title: 'Concept Breakdown',
          description: 'A simplified explanation of how high-temperature superconductors enable compact high-field magnets and operational confinement.',
          prompt: 'Draft an accessible Concept Breakdown explaining the core physics and engineering mechanisms in clear terms with direct citations.',
        },
        {
          id: 'narrative_outline',
          title: 'Historical Narrative Outline',
          description: 'A structured breakdown of the Battle of Badgam and the military career and citation of Major Somnath Sharma (PVC).',
          prompt: 'Synthesize a structured Historical Narrative Outline examining the chronology, troop deployment, tactical decisions, and bravery documented in the sources.',
        },
      ];
    }

    if (hasTech) {
      return [
        {
          id: 'tech_roadmap',
          title: 'Technology Roadmap',
          description: `A comprehensive multi-year development strategy and operational milestone timeline for ${primary}.`,
          prompt: `Draft an actionable Technology Roadmap evaluating engineering phases, technology readiness levels (TRLs), and deployment targets for ${primary}.`,
        },
        {
          id: 'system_architecture',
          title: 'System Architecture Blueprint',
          description: 'An in-depth technical analysis examining governing mechanics, component dependencies, and design trade-offs.',
          prompt: 'Synthesize a System Architecture Blueprint detailing technical specifications, subsystem interactions, and boundary conditions.',
        },
        {
          id: 'concept_breakdown',
          title: 'Concept Breakdown',
          description: `A clear, pedagogical deconstruction of the primary mechanisms and governing principles in ${primary}.`,
          prompt: `Provide a structured Concept Breakdown explaining the foundational concepts, definitions, and formulas cited in the text.`,
        },
        {
          id: 'feasibility_assessment',
          title: 'Feasibility Assessment',
          description: 'An objective evaluation of empirical evidence, verification benchmarks, and potential scalability bottlenecks.',
          prompt: 'Conduct a thorough Technical Feasibility Assessment analyzing empirical validation metrics and operational limitations.',
        },
      ];
    }

    return [
      {
        id: 'exec_roadmap',
        title: 'Executive Roadmap',
        description: `A structured operational progression and phased strategic roadmap for ${primary}.`,
        prompt: `Create an Executive Roadmap outlining sequential phases, dependencies, and deliverables grounded in the documents.`,
      },
      {
        id: 'thematic_analysis',
        title: 'Thematic Deep Dive',
        description: 'A multi-pillar substantive investigation analyzing the core empirical findings and relationships across the documents.',
        prompt: 'Synthesize a Thematic Deep Dive examining key arguments, evidence provenance, and operational implications.',
      },
      {
        id: 'concept_breakdown',
        title: 'Concept Breakdown',
        description: 'A simplified, high-clarity explanation of foundational theories, terminology, and key distinctions.',
        prompt: 'Draft a Concept Breakdown deconstructing complex terms and mechanisms into clear, digestible explanations.',
      },
      {
        id: 'strategic_outlook',
        title: 'Strategic Horizon Brief',
        description: `A forward-looking analysis evaluating implications, risk factors, and actionable opportunities.`,
        prompt: 'Provide a Strategic Horizon Brief evaluating forward-looking implications, risks, and recommended actions.',
      },
    ];
  };

  // Combine default and AI suggested formats
  const allFormatsMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string; description: string; prompt: string }>();
    defaultFormats.forEach((d) => {
      map.set(d.id, {
        id: d.id,
        title: d.title,
        description: d.description,
        prompt: d.defaultPrompt,
      });
    });
    aiSuggestions.forEach((s) => {
      map.set(s.id, {
        id: s.id,
        title: s.title,
        description: s.description,
        prompt: s.prompt,
      });
    });
    return map;
  }, [aiSuggestions]);

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

  const handleSelectFormat = (id: string, title: string, defaultP: string) => {
    setSelectedFormatId(id);
    setSelectedFormatTitle(title);
    if (!customPrompt || customPrompt === allFormatsMap.get(selectedFormatId)?.prompt) {
      setCustomPrompt(defaultP);
    }
  };

  const handleEditPencil = (e: React.MouseEvent, id: string, title: string, defaultP: string) => {
    e.stopPropagation();
    setSelectedFormatId(id);
    setSelectedFormatTitle(title);
    setCustomPrompt(defaultP);
    setIsEditingPrompt(true);
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
    const chosenFormat = allFormatsMap.get(selectedFormatId);
    onGenerate({
      topic: selectedFormatTitle,
      selectedSourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : sources.map((s) => s.id),
      format: selectedFormatId,
      depth,
      customPrompt: customPrompt.trim() || chosenFormat?.prompt || '',
      formatTitle: selectedFormatTitle,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#191b1a] border border-[#dadce0] dark:border-[#2e312b] rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-gray-900 dark:text-[#e8e9e6]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#282a25] bg-gray-50 dark:bg-[#191b1a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center text-amber-500">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-[#e8e9e6] tracking-tight">
              Create report
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282a26] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 pb-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* SECTION 1: FORMAT (Top 4 Defaults) */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-[#c8cbc3]">
              Format
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {defaultFormats.map((fmt) => {
                const isSelected = selectedFormatId === fmt.id;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => handleSelectFormat(fmt.id, fmt.title, fmt.defaultPrompt)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[142px] ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-[#2a2d28] border-amber-500/80 ring-2 ring-amber-500/20 shadow-md'
                        : 'bg-white dark:bg-[#242724] border-gray-200 dark:border-[#363a33] hover:border-gray-300 dark:hover:border-[#4d5147] hover:bg-gray-50 dark:hover:bg-[#2a2c28]'
                    }`}
                  >
                    {/* Card Header: Title + Optional Pencil */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-[#e8e9e6] leading-snug">
                        {fmt.title}
                      </h4>

                      {fmt.hasPencil && (
                        <button
                          type="button"
                          onClick={(e) => handleEditPencil(e, fmt.id, fmt.title, fmt.defaultPrompt)}
                          title="Edit format instructions"
                          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#353831] hover:bg-gray-200 dark:hover:bg-[#43473e] text-gray-600 dark:text-[#c7cac0] hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Card Subtitle */}
                    <p className="text-xs text-gray-500 dark:text-[#9da097] leading-relaxed line-clamp-3 mt-2">
                      {fmt.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: SUGGESTED FORMAT (Bottom 4 AI Tailored) */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-[#c8cbc3] flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-amber-500 dark:text-[#e8e9e6]" />
              <span>Suggested Format</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {isLoadingSuggestions && aiSuggestions.length === 0 ? (
                // Shimmer Skeletons
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-gray-100 dark:bg-[#242724]/60 border border-gray-200 dark:border-[#363a33] min-h-[142px] animate-pulse flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 dark:bg-[#353831] rounded-md w-3/4" />
                      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-[#353831]" />
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="h-3 bg-gray-200 dark:bg-[#353831]/80 rounded-md w-full" />
                      <div className="h-3 bg-gray-200 dark:bg-[#353831]/60 rounded-md w-4/5" />
                    </div>
                  </div>
                ))
              ) : (
                aiSuggestions.map((sug) => {
                  const isSelected = selectedFormatId === sug.id;
                  return (
                    <div
                      key={sug.id}
                      onClick={() => handleSelectFormat(sug.id, sug.title, sug.prompt)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[142px] ${
                        isSelected
                          ? 'bg-amber-50/70 dark:bg-[#2a2d28] border-amber-500/80 ring-2 ring-amber-500/20 shadow-md'
                          : 'bg-white dark:bg-[#242724] border-gray-200 dark:border-[#363a33] hover:border-gray-300 dark:hover:border-[#4d5147] hover:bg-gray-50 dark:hover:bg-[#2a2c28]'
                      }`}
                    >
                      {/* Card Header: Title + Pencil */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-[#e8e9e6] leading-snug">
                          {sug.title}
                        </h4>

                        <button
                          type="button"
                          onClick={(e) => handleEditPencil(e, sug.id, sug.title, sug.prompt)}
                          title="Edit suggestion prompt"
                          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#353831] hover:bg-gray-200 dark:hover:bg-[#43473e] text-gray-600 dark:text-[#c7cac0] hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Card Subtitle */}
                      <p className="text-xs text-gray-500 dark:text-[#9da097] leading-relaxed line-clamp-3 mt-2">
                        {sug.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 3: CUSTOMIZATION & INSTRUCTION PANEL */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#20221f] border border-gray-200 dark:border-[#32362f] space-y-3.5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-[#c8cbc3] uppercase tracking-wider">
                  Selected Format:
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                  {selectedFormatTitle}
                </span>
              </div>

              {/* Toggle Prompt Editing */}
              {selectedFormatId !== 'create_your_own' && (
                <button
                  type="button"
                  onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Pencil className="w-3 h-3" />
                  <span>{isEditingPrompt ? 'Hide Instructions' : 'Customize Instructions'}</span>
                </button>
              )}
            </div>

            {/* Custom Instructions Input (Always open for "Create Your Own", or toggled via Pencil) */}
            {(selectedFormatId === 'create_your_own' || isEditingPrompt) && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                  {selectedFormatId === 'create_your_own'
                    ? 'Specify structure, tone, style, and key themes to cover:'
                    : 'Custom instructions & prompt overrides:'}
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={
                    selectedFormatId === 'create_your_own'
                      ? 'e.g. Create a 3-part strategic memorandum analyzing technical milestones, commercial viability, and competitive trade-offs...'
                      : 'Add any specific guidance, focus points, or questions to address...'
                  }
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#171918] border border-gray-200 dark:border-[#363a33] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 custom-scrollbar leading-relaxed"
                />
              </div>
            )}

            {/* Scope / Sources Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-gray-200 dark:border-[#2a2d26]">
              {/* Sources Count & Dropdown Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSourcesDropdown(!showSourcesDropdown)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#282b26] hover:bg-gray-100 dark:hover:bg-[#323630] border border-gray-200 dark:border-[#3a3e35] text-xs text-gray-800 dark:text-gray-200 flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>
                    {selectedSourceIds.length} of {sources.length} sources included
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showSourcesDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Sources Checklist Modal/Popup */}
                {showSourcesDropdown && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 sm:w-80 p-2 rounded-2xl bg-white dark:bg-[#1a1c1a] border border-gray-200 dark:border-[#363a33] max-h-52 overflow-y-auto space-y-1 custom-scrollbar shadow-2xl z-30">
                    <div className="flex items-center justify-between px-2 py-1 pb-2 border-b border-gray-100 dark:border-[#2d302a] text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-medium"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-gray-500 dark:text-gray-400 hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>

                    {sources.map((src) => {
                      const isChecked = selectedSourceIds.includes(src.id);
                      return (
                        <div
                          key={src.id}
                          onClick={() => handleToggleSource(src.id)}
                          className={`p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-amber-50 dark:bg-[#252824] text-gray-900 dark:text-white'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1f221f] hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <div
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? 'bg-amber-500 border-amber-500 text-white dark:text-black'
                                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent'
                              }`}
                            >
                              {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="truncate">{src.title}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono shrink-0">
                            {Math.round((src.content ? src.content.length : 0) / 4)} tokens
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Length / Depth Setting */}
              <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span className="text-gray-500 dark:text-gray-400 text-[11px]">Depth:</span>
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value as ReportDepth)}
                  className="bg-white dark:bg-[#282b26] border border-gray-200 dark:border-[#3a3e35] text-xs text-gray-900 dark:text-white rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
                >
                  <option value="concise">Concise (~750 words)</option>
                  <option value="standard">Standard (~1,600 words)</option>
                  <option value="extensive">Extensive (~2,800+ words)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#282a25] flex items-center justify-between shrink-0 bg-gray-50 dark:bg-[#161817]">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#242622] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerating || sources.length === 0}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black" />
                <span>Generate Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

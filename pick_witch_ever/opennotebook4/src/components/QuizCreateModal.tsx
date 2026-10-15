import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Source } from '../types';

export type QuestionCountOption = 'fewer' | 'standard' | 'more';
export type DifficultyOption = 'easy' | 'medium' | 'hard';
export type QuestionTypeOption = 'fill_blank' | 'multiple_choice' | 'multiple_select' | 'short_answer';

export interface QuizGenerationConfig {
  topic: string;
  selectedSourceIds: string[];
  questionCount: QuestionCountOption;
  difficulty: DifficultyOption;
  questionTypes: QuestionTypeOption[];
}

interface QuizCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (config: QuizGenerationConfig) => void;
  isGenerating?: boolean;
}

export const QuizCreateModal: React.FC<QuizCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating = false,
}) => {
  // Configuration State
  const [questionCount, setQuestionCount] = useState<QuestionCountOption>('standard');
  const [difficulty, setDifficulty] = useState<DifficultyOption>('medium');
  const [selectedTypes, setSelectedTypes] = useState<QuestionTypeOption[]>([
    'fill_blank',
    'multiple_choice',
    'multiple_select',
    'short_answer',
  ]);
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

  const handleToggleType = (type: QuestionTypeOption) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        // Keep at least one question type selected
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const suggestedPrompts = [
    'Create a quiz to help me prepare for my history exam on Ancient Egypt',
    'The quiz must have 30 questions (maximum of 50 questions allowed)',
    'The quiz must be restricted to a specific source (e.g. "the article about Italy")',
    'The quiz must focus solely on the key concepts of physics',
  ];

  const handleGenerateClick = () => {
    if (isGenerating || selectedSourceIds.length === 0 || selectedTypes.length === 0) return;
    onGenerate({
      topic: topic.trim(),
      selectedSourceIds,
      questionCount,
      difficulty,
      questionTypes: selectedTypes,
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
            {/* Custom SVG Icon matching Google NotebookLM Quiz Icon */}
            <svg
              className="w-5 h-5 text-sky-600 dark:text-gray-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M9 9h.01" />
              <path d="M12 17v-1" />
              <path d="M12 13a2 2 0 1 0-2-2" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">Quiz</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
          {/* Row 1: Number of Questions & Level of Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Number of Questions */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
                Number of Questions
              </label>
              <div className="inline-flex rounded-full bg-gray-100 dark:bg-[#1e222b] border border-gray-200 dark:border-[#313847] p-1 gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setQuestionCount('fewer')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    questionCount === 'fewer'
                      ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {questionCount === 'fewer' && <Check className="w-3 h-3 text-sky-600 dark:text-white" />}
                  <span>Fewer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionCount('standard')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    questionCount === 'standard'
                      ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {questionCount === 'standard' && <Check className="w-3 h-3 text-sky-600 dark:text-white" />}
                  <span>Standard (Default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionCount('more')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    questionCount === 'more'
                      ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {questionCount === 'more' && <Check className="w-3 h-3 text-sky-600 dark:text-white" />}
                  <span>More</span>
                </button>
              </div>
            </div>

            {/* Level of Difficulty */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
                Level of Difficulty
              </label>
              <div className="inline-flex rounded-full bg-gray-100 dark:bg-[#1e222b] border border-gray-200 dark:border-[#313847] p-1 gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDifficulty('easy')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    difficulty === 'easy'
                      ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {difficulty === 'easy' && <Check className="w-3 h-3 text-sky-600 dark:text-white" />}
                  <span>Easy</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDifficulty('medium')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    difficulty === 'medium'
                      ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {difficulty === 'medium' && <Check className="w-3 h-3 text-sky-600 dark:text-white" />}
                  <span>Medium (Default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDifficulty('hard')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    difficulty === 'hard'
                      ? 'bg-white dark:bg-[#2b3342] text-gray-900 dark:text-white shadow-xs font-semibold'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {difficulty === 'hard' && <Check className="w-3 h-3 text-sky-600 dark:text-white" />}
                  <span>Hard</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Question Types (Multi-select Chips) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
              Question Types
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'fill_blank' as QuestionTypeOption, label: 'Fill in the Blank' },
                { id: 'multiple_choice' as QuestionTypeOption, label: 'Multiple Choice' },
                { id: 'multiple_select' as QuestionTypeOption, label: 'Multiple Select' },
                { id: 'short_answer' as QuestionTypeOption, label: 'Short Answer' },
              ].map((item) => {
                const isChecked = selectedTypes.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleType(item.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isChecked
                        ? 'bg-sky-50 dark:bg-[#2b3342] border-sky-400 dark:border-[#3f495e] text-sky-900 dark:text-white shadow-xs font-semibold'
                        : 'bg-white dark:bg-[#181b22] border-gray-200 dark:border-[#2c3240] text-gray-600 dark:text-gray-500 hover:border-gray-300 dark:hover:text-gray-300'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-white" />}
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
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSourcesDropdown(!showSourcesDropdown);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#313847] hover:border-gray-300 dark:hover:border-[#434c5f] text-xs font-medium text-gray-900 dark:text-white transition-colors cursor-pointer shadow-xs"
              >
                <span>{selectedSourceIds.length} sources</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {/* Dropdown Popover */}
              {showSourcesDropdown && (
                <div
                  className="absolute left-0 mt-2 w-72 max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#313847] shadow-2xl p-2 z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-[#282f3d] mb-1.5">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      {selectedSourceIds.length} of {sources.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAllSources}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer font-medium"
                    >
                      {selectedSourceIds.length === sources.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="space-y-1">
                    {sources.map((src) => {
                      const isChecked = selectedSourceIds.includes(src.id);
                      return (
                        <div
                          key={src.id}
                          onClick={() => handleToggleSource(src.id)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252b38] transition-colors cursor-pointer text-left"
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'border-gray-300 dark:border-[#434c5f] bg-white dark:bg-[#14161d]'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-xs text-gray-900 dark:text-gray-200 truncate flex-1" title={src.title}>
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

          {/* Row 4: What should the topic be? */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
              What should the topic be?
            </label>
            <div className="relative rounded-2xl bg-gray-50 dark:bg-[#14161d] border border-gray-200 dark:border-[#2e3544] focus-within:border-blue-500/80 transition-all p-4">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder=""
                rows={3}
                className="w-full bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none leading-relaxed"
              />

              {/* Suggestions Container */}
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-[#232836]">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">Things to try</p>
                <div className="space-y-1.5">
                  {suggestedPrompts.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => setTopic(p)}
                      className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer group transition-colors"
                    >
                      <span className="text-gray-400 dark:text-gray-500 group-hover:text-blue-500 text-sm leading-none">•</span>
                      <span className="leading-snug">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-[#252a36] bg-gray-50 dark:bg-[#181a20]">
          <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 rounded-full bg-gray-200 dark:bg-[#242936] hover:bg-gray-300 dark:hover:bg-[#2d3442] border border-gray-300 dark:border-[#3b4252] text-xs font-medium text-gray-800 dark:text-white transition-colors cursor-pointer"
            >
              Generate later
            </button>

            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={isGenerating || selectedSourceIds.length === 0 || selectedTypes.length === 0}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-xs font-medium text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
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

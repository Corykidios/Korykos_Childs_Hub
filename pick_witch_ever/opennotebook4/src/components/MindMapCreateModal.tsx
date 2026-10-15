import React, { useState, useEffect } from 'react';
import { X, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Source } from '../types';

interface MindMapCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  onGenerate: (topic: string, selectedSourceIds: string[]) => void;
  isGenerating?: boolean;
}

export const MindMapCreateModal: React.FC<MindMapCreateModalProps> = ({
  isOpen,
  onClose,
  sources,
  onGenerate,
  isGenerating = false,
}) => {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [showSourcesDropdown, setShowSourcesDropdown] = useState(false);
  const [topic, setTopic] = useState('');

  // Sync selected sources with available active sources
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

  const handleToggleAll = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  };

  const suggestedPrompts = [
    'The mind map must be restricted to a specific source (e.g. "the article about Italy")',
    'The mind map must focus solely on the key concepts of quantum physics',
    'Create a mind map to help me study the causes of World War I',
  ];

  const handleGenerateClick = () => {
    if (isGenerating || selectedSourceIds.length === 0) return;
    onGenerate(topic.trim(), selectedSourceIds);
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
        onClick={(e) => {
          // Close dropdown if clicked outside
          if (showSourcesDropdown) setShowSourcesDropdown(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#252a36] bg-gray-50 dark:bg-[#181a20]">
          <div className="flex items-center gap-2.5">
            {/* Custom SVG icon matching Google NotebookLM Mind Map icon */}
            <svg 
              className="w-5 h-5 text-emerald-600 dark:text-[#c4c7c5]" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="3" y="10" width="4" height="4" rx="1" />
              <rect x="17" y="4" width="4" height="4" rx="1" />
              <rect x="17" y="16" width="4" height="4" rx="1" />
              <path d="M7 12h5v-6h5" />
              <path d="M12 12v6h5" />
            </svg>
            <h2 className="text-[15px] font-medium text-gray-900 dark:text-white tracking-tight">Mind Map</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252a36] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Sources Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">Sources</label>
            
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowSourcesDropdown(!showSourcesDropdown)}
                className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#383e4e] hover:border-gray-300 dark:hover:border-[#4d5568] text-xs text-gray-900 dark:text-white font-medium flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <span>{selectedSourceIds.length} sources</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-[#9aa0a6] transition-transform ${showSourcesDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Sources Dropdown */}
              {showSourcesDropdown && (
                <div className="absolute left-0 top-full mt-2 w-80 max-h-64 overflow-y-auto bg-white dark:bg-[#1e222b] border border-gray-200 dark:border-[#383e4e] rounded-xl shadow-2xl p-2.5 z-30 divide-y divide-gray-100 dark:divide-[#2a2f3d]">
                  <div className="flex items-center justify-between pb-2 px-1">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-[#8a919e] uppercase tracking-wider">
                      Selected ({selectedSourceIds.length}/{sources.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAll}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer"
                    >
                      {selectedSourceIds.length === sources.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="pt-2 space-y-1">
                    {sources.map((src) => {
                      const isChecked = selectedSourceIds.includes(src.id);
                      return (
                        <label
                          key={src.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#282d38] cursor-pointer text-xs text-gray-700 dark:text-[#c4c7c5] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSource(src.id)}
                            className="rounded border-gray-300 dark:border-[#383e4e] text-blue-600 focus:ring-0 bg-white dark:bg-[#16181f] w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="truncate flex-1 font-normal text-gray-900 dark:text-white">{src.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* What should the topic be? Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-[#c4c7c5] block">
              What should the topic be?
            </label>

            <div className="rounded-xl border border-gray-200 dark:border-[#383e4e] focus-within:border-blue-500/80 bg-gray-50 dark:bg-[#14161d] p-4 transition-all flex flex-col gap-3 min-h-[160px]">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder=""
                rows={topic ? 3 : 1}
                className="w-full bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6b7280] resize-none focus:outline-none leading-relaxed"
                autoFocus
              />

              {/* Things to try (shown when textarea is empty) */}
              {!topic.trim() && (
                <div className="space-y-2 select-none pt-1">
                  <span className="text-xs font-normal text-gray-500 dark:text-[#9aa0a6] block">
                    Things to try
                  </span>
                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-[#8a919e]">
                    {suggestedPrompts.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTopic(suggestion)}
                        className="text-left w-full hover:text-gray-900 dark:hover:text-[#d1d5db] transition-colors cursor-pointer flex items-start gap-2 group"
                      >
                        <span className="text-gray-400 dark:text-[#6b7280] group-hover:text-blue-500 dark:group-hover:text-blue-400">•</span>
                        <span className="leading-snug">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-[#252a36] bg-gray-50 dark:bg-[#14161d]">
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
              disabled={isGenerating || selectedSourceIds.length === 0}
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

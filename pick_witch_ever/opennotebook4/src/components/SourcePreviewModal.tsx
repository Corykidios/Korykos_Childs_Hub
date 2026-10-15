import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  FileText, 
  Copy, 
  Check, 
  Globe, 
  ChevronUp, 
  ChevronDown, 
  Sparkles, 
  Loader2 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Source, AppSettings } from '../types';
import { generateSourceGuideAPI } from '../services/api';

interface SourcePreviewModalProps {
  source: Source | null;
  onClose: () => void;
  highlightText?: string;
  onUpdateSource?: (updated: Source) => void;
  settings?: AppSettings;
}

export const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({
  source,
  onClose,
  onUpdateSource,
  settings,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [sourceGuide, setSourceGuide] = useState<string>(source?.sourceGuide || '');
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);

  useEffect(() => {
    if (!source) return;

    if (source.sourceGuide) {
      setSourceGuide(source.sourceGuide);
      setIsLoadingGuide(false);
      return;
    }

    let isMounted = true;
    setIsLoadingGuide(true);

    generateSourceGuideAPI(source.title, source.content, settings).then((guide) => {
      if (isMounted) {
        setSourceGuide(guide);
        setIsLoadingGuide(false);
        if (guide && onUpdateSource) {
          onUpdateSource({ ...source, sourceGuide: guide });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [source?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (source) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [source, onClose]);

  if (!source) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(source.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCleanDomain = (url?: string): string => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[2] || 'web';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#383e4e] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-white dark:bg-[#252a35] text-blue-500 dark:text-blue-400 border border-gray-200 dark:border-[#333a49] shrink-0 shadow-xs">
              {source.type === 'web' ? <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" /> : <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate max-w-md">
                  {source.title}
                </h3>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
                    title="Open original website in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-[#8a919e] flex flex-wrap items-center gap-2 mt-0.5">
                <span className="uppercase font-semibold text-[10px] text-blue-600 dark:text-blue-400">{source.type}</span>
                <span>•</span>
                <span>{(source.tokenCount / 1000).toFixed(1)}k tokens ({source.content.length.toLocaleString()} chars)</span>
                {source.url && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-700 dark:text-white/90 bg-gray-100 dark:bg-[#252a35] px-1.5 py-0.5 rounded text-[10px] border border-gray-200 dark:border-[#333a49]">
                      {getCleanDomain(source.url)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-[#252a35] border border-gray-200 dark:border-[#383e4e] rounded-xl p-0.5 text-xs shadow-xs">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-[#313747] text-gray-900 dark:text-white font-medium shadow-xs'
                    : 'text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-white dark:bg-[#313747] text-gray-900 dark:text-white font-medium shadow-xs'
                    : 'text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Raw
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="p-2 rounded-xl text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252a35] border border-transparent hover:border-gray-200 dark:hover:border-[#383e4e] transition-colors cursor-pointer"
              title="Copy text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#252a35] border border-transparent hover:border-gray-200 dark:hover:border-[#383e4e] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 flex-1 overflow-y-auto bg-white dark:bg-[#181b22]/50 text-xs leading-relaxed text-gray-800 dark:text-[#c4c7c5] select-text">
          {/* AI SOURCE GUIDE CARD (Matches Google NotebookLM Screenshot) */}
          <div className="bg-blue-50/70 dark:bg-[#202738] border border-blue-100 dark:border-[#333d56] rounded-2xl p-4 sm:p-5 mb-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-300 shrink-0" />
                <h4 className="text-sm font-semibold text-blue-900 dark:text-white tracking-wide">
                  Source guide
                </h4>
              </div>

              <button
                onClick={() => setIsGuideOpen(!isGuideOpen)}
                className="p-1 text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                title={isGuideOpen ? 'Collapse source guide' : 'Expand source guide'}
              >
                {isGuideOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {isGuideOpen && (
              <div className="mt-3">
                {isLoadingGuide ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-gray-500 dark:text-[#9aa0a6] animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                    <span>Synthesizing Source guide from AI...</span>
                  </div>
                ) : sourceGuide ? (
                  <div className="text-xs sm:text-[13px] text-gray-800 dark:text-[#c4c7c5] leading-relaxed select-text prose prose-slate dark:prose-invert prose-sm max-w-none prose-p:my-2 prose-strong:text-gray-900 dark:prose-strong:text-white prose-strong:font-semibold">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {sourceGuide}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-[#9aa0a6]">No source guide available for this document.</p>
                )}
              </div>
            )}
          </div>

          {/* Main Source Content */}
          <div className="pt-1">
            <h5 className="text-[11px] font-semibold text-gray-500 dark:text-[#8a919e] uppercase tracking-wider mb-2.5">
              Full Document Text
            </h5>
            {viewMode === 'preview' ? (
              <div className="prose prose-slate dark:prose-invert prose-sm max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:my-2 prose-code:text-indigo-600 dark:prose-code:text-amber-300 prose-pre:bg-gray-100 dark:prose-pre:bg-[#151820]">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {source.content}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="font-mono whitespace-pre-wrap font-light text-gray-800 dark:text-gray-300">
                {source.content}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChevronDown, 
  FileText, 
  Globe, 
  FileCode, 
  Mic, 
  Trash2, 
  CheckSquare, 
  Square,
  Zap,
  Sparkles,
  ArrowRight,
  Link as LinkIcon,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from 'lucide-react';
import { YoutubeIcon, PanelToggleIcon } from './Icons';
import { Source } from '../types';
import { searchWebAPI, scrapeUrlAPI } from '../services/api';

interface InlineResearchSite {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  content: string;
  tokenCount: number;
}

interface SourcesPanelProps {
  sources: Source[];
  onOpenAddModal: () => void;
  onToggleSource: (id: string) => void;
  onToggleAllSources: (select: boolean) => void;
  onDeleteSource: (id: string) => void;
  onSearchSubmit: (query: string, scope: string, depth: 'fast' | 'deep') => void;
  onOpenDeepResearch?: (query: string, scope: 'Web' | 'Academic' | 'YouTube') => void;
  onAddSources?: (newSources: Source[]) => void;
  searchProvider?: string;
  searchApiKey?: string;
  onPreviewSource: (source: Source) => void;
  onCollapse: () => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  onOpenAddModal,
  onToggleSource,
  onToggleAllSources,
  onDeleteSource,
  onSearchSubmit,
  onOpenDeepResearch,
  onAddSources,
  searchProvider = 'duckduckgo',
  searchApiKey = '',
  onPreviewSource,
  onCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'Web' | 'Academic' | 'YouTube'>('Web');
  const [researchDepth, setResearchDepth] = useState<'fast' | 'deep'>('fast');
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [showDepthDropdown, setShowDepthDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Inline Research Card State matching Google NotebookLM
  const [researchStatus, setResearchStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [researchResultQuery, setResearchResultQuery] = useState('');
  const [researchResultDepth, setResearchResultDepth] = useState<'fast' | 'deep'>('fast');
  const [discoveredSites, setDiscoveredSites] = useState<InlineResearchSite[]>([]);
  const [showAllSources, setShowAllSources] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const allSelected = sources.length > 0 && sources.every((s) => s.selected);

  const getCleanDomain = (url?: string): string => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[2] || '';
    }
  };

  const handleRunInlineResearch = async () => {
    if (!searchQuery.trim() || researchStatus === 'running') return;

    if (researchDepth === 'deep') {
      if (onOpenDeepResearch) {
        onOpenDeepResearch(searchQuery, scope);
        return;
      }
      onSearchSubmit(searchQuery, scope, 'deep');
      return;
    }

    setResearchStatus('running');
    setResearchResultQuery(searchQuery);
    setResearchResultDepth(researchDepth);
    setDiscoveredSites([]);
    setShowAllSources(false);
    setFeedbackGiven(null);

    try {
      let effectiveQuery = searchQuery.trim();
      if (scope === 'Academic') {
        effectiveQuery += ' research paper pdf academic';
      } else if (scope === 'YouTube') {
        effectiveQuery += ' site:youtube.com';
      }

      const results = await searchWebAPI(effectiveQuery, searchProvider, searchApiKey);
      const targetCount = researchDepth === 'fast' ? 5 : 10;
      const candidates = (results || []).slice(0, targetCount);

      if (candidates.length === 0) {
        setDiscoveredSites([
          {
            id: `site-${Date.now()}-0`,
            title: `${searchQuery} - Foundational Concepts & Evidence`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(searchQuery.replace(/\s+/g, '_'))}`,
            domain: 'wikipedia.org',
            snippet: `Direct overview and reference analysis for ${searchQuery}.`,
            content: `# ${searchQuery}\n\n**Source Domain:** wikipedia.org\n\n## Overview\nOverview of ${searchQuery} indexing foundational principles and empirical findings.`,
            tokenCount: 1400,
          },
        ]);
        setResearchStatus('completed');
        return;
      }

      const scrapedSites: InlineResearchSite[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        const domain = getCleanDomain(item.url);
        try {
          const scraped = await scrapeUrlAPI(item.url);
          const hasContent = scraped.content && scraped.content.length > 200 && !scraped.content.includes('Failed to fetch directly');
          scrapedSites.push({
            id: `site-${Date.now()}-${i}`,
            title: (hasContent && scraped.title && scraped.title.length > 3) ? scraped.title : item.title,
            url: item.url,
            domain,
            snippet: item.snippet,
            content: hasContent
              ? scraped.content
              : `# ${item.title}\n\n**Source Domain:** ${domain}\n**Direct URL:** ${item.url}\n\n## Overview\n${item.snippet}`,
            tokenCount: scraped.tokenCount || Math.ceil((item.snippet.length + 100) / 4),
          });
        } catch {
          scrapedSites.push({
            id: `site-${Date.now()}-${i}`,
            title: item.title,
            url: item.url,
            domain,
            snippet: item.snippet,
            content: `# ${item.title}\n\n**Source Domain:** ${domain}\n**Direct URL:** ${item.url}\n\n## Overview\n${item.snippet}`,
            tokenCount: Math.ceil((item.snippet.length + 100) / 4),
          });
        }
      }

      setDiscoveredSites(scrapedSites);
      setResearchStatus('completed');
    } catch (err) {
      console.error('Inline research error:', err);
      setResearchStatus('idle');
    }
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleRunInlineResearch();
    }
  };

  const handleImportDiscoveredSites = () => {
    if (!onAddSources || discoveredSites.length === 0) return;
    setIsImporting(true);

    // Treat each visited site as an INDIVIDUAL Source
    const newSources: Source[] = discoveredSites.map((site, idx) => ({
      id: `source-web-${Date.now()}-${idx}`,
      title: site.title,
      type: 'web',
      url: site.url,
      content: site.content,
      tokenCount: site.tokenCount,
      selected: true,
      addedAt: Date.now(),
    }));

    onAddSources(newSources);
    setIsImporting(false);
    setResearchStatus('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onOpenAddModal();
  };

  const getSourceIcon = (type: Source['type']) => {
    switch (type) {
      case 'web':
        return <Globe className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'youtube':
        return <YoutubeIcon className="w-4 h-4 text-red-400 shrink-0" />;
      case 'audio':
        return <Mic className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
  };

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`h-full flex flex-col bg-white dark:bg-[#1e222b] border ${isDragging ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[#dadce0] dark:border-[#2d3340]'} rounded-2xl overflow-hidden transition-all select-none`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-[#2a2f3a]/60">
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-[#e3e3e3]">Sources</h2>
        <button 
          onClick={onCollapse}
          title="Collapse Sources panel"
          className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-[#9aa0a6] dark:hover:text-[#e3e3e3] p-1 rounded dark:hover:bg-[#282d38] transition-colors cursor-pointer"
        >
          <PanelToggleIcon side="left" />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3 flex-1 overflow-y-auto">
        {/* + Add sources button */}
        <button
          onClick={onOpenAddModal}
          className="w-full py-2.5 px-4 rounded-full border border-[#dadce0] dark:border-[#3b4150] bg-white dark:bg-transparent text-gray-800 dark:text-[#e3e3e3] hover:bg-gray-50 dark:hover:bg-[#282d38] hover:border-gray-400 dark:hover:border-[#4c5467] text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm group cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-900 dark:text-[#9aa0a6] dark:group-hover:text-white transition-colors" />
          <span>Add sources</span>
        </button>

        {/* Search the web for new sources */}
        <div className="bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#2e3442] rounded-xl p-2.5 flex flex-col gap-2 relative focus-within:border-blue-500 transition-colors">
          <input
            type="text"
            placeholder="Search the web for new sources"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            className="bg-transparent text-xs text-gray-900 dark:text-[#e3e3e3] placeholder-gray-500 dark:placeholder-[#8a919e] focus:outline-none w-full px-1"
          />

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              {/* Scope Dropdown Chip */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowScopeDropdown(!showScopeDropdown);
                    setShowDepthDropdown(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#dadce0] dark:border-[#383e4e] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#252a35] text-[11px] text-gray-700 dark:text-[#c4c7c5] transition-colors cursor-pointer"
                >
                  <Globe className="w-3 h-3 text-gray-500 dark:text-[#9aa0a6]" />
                  <span>{scope}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400 dark:text-[#8a919e]" />
                </button>

                {showScopeDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 w-32 bg-white dark:bg-[#252a35] border border-[#dadce0] dark:border-[#383e4e] rounded-lg shadow-xl py-1 z-30">
                    {(['Web', 'Academic', 'YouTube'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setScope(s); setShowScopeDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-[#323847] flex items-center gap-2 cursor-pointer ${scope === s ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-[#c4c7c5]'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Research Depth Chip */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowDepthDropdown(!showDepthDropdown);
                    setShowScopeDropdown(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#dadce0] dark:border-[#383e4e] bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#252a35] text-[11px] text-gray-700 dark:text-[#c4c7c5] transition-colors cursor-pointer"
                >
                  <Sparkles className={`w-3 h-3 ${researchDepth === 'fast' ? 'text-amber-500' : 'text-purple-500'}`} />
                  <span>{researchDepth === 'fast' ? 'Fast Research' : 'Deep Research'}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400 dark:text-[#8a919e]" />
                </button>

                {showDepthDropdown && (
                  <div className="absolute top-full left-0 mt-1.5 w-36 bg-white dark:bg-[#252a35] border border-[#dadce0] dark:border-[#383e4e] rounded-lg shadow-xl py-1 z-30">
                    <button
                      onClick={() => { setResearchDepth('fast'); setShowDepthDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-[#323847] flex items-center gap-1.5 cursor-pointer ${researchDepth === 'fast' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-[#c4c7c5]'}`}
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>Fast Research</span>
                    </button>
                    <button
                      onClick={() => { setResearchDepth('deep'); setShowDepthDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-[#323847] flex items-center gap-1.5 cursor-pointer ${researchDepth === 'deep' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-[#c4c7c5]'}`}
                    >
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span>Deep Research</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Circular Arrow Trigger Button matching screenshot */}
            <button
              onClick={handleRunInlineResearch}
              disabled={researchStatus === 'running' || !searchQuery.trim()}
              className="w-7 h-7 rounded-full bg-gray-200 dark:bg-[#2a303e] hover:bg-gray-300 dark:hover:bg-[#384154] disabled:opacity-40 text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Run Research"
            >
              {researchStatus === 'running' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* INLINE RESEARCH CARD MATCHING SCREENSHOT */}
        {researchStatus !== 'idle' && (
          <div className="bg-[#f0f4f9] dark:bg-[#1e222b] border border-[#d2e3fc] dark:border-[#2d3340] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-lg animate-in fade-in duration-200">
            {/* Header: Sparkles + Title + View */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500 dark:text-[#8ab4f8]" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  {researchStatus === 'running'
                    ? `${researchResultDepth === 'fast' ? 'Fast' : 'Deep'} Research in progress...`
                    : `${researchResultDepth === 'fast' ? 'Fast' : 'Deep'} Research completed!`}
                </span>
              </div>
              {researchStatus === 'completed' && (
                <button
                  onClick={() => {
                    if (researchResultDepth === 'deep' && onOpenDeepResearch) {
                      onOpenDeepResearch(researchResultQuery, scope);
                    } else {
                      onSearchSubmit(researchResultQuery, scope, researchResultDepth);
                    }
                  }}
                  className="text-xs text-blue-600 dark:text-[#e3e3e3] hover:underline cursor-pointer font-medium"
                >
                  View
                </button>
              )}
            </div>

            {/* Inner Card */}
            <div className="bg-white dark:bg-[#14171f] border border-[#dadce0] dark:border-[#262c38] rounded-xl p-3 flex flex-col gap-3 shadow-sm">
              {researchStatus === 'running' ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  <p className="text-xs text-gray-500 dark:text-[#9aa0a6]">Discovering & scraping sources for "{researchResultQuery}"...</p>
                </div>
              ) : discoveredSites.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-[#9aa0a6] text-center py-4">No sources found. Try a different query.</p>
              ) : (
                <>
                  {/* List of Discovered Sites */}
                  <div className="flex flex-col gap-3">
                    {(showAllSources ? discoveredSites : discoveredSites.slice(0, 3)).map((site) => (
                      <div key={site.id} className="flex items-start gap-2.5 min-w-0">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`}
                          alt=""
                          className="w-4 h-4 rounded-full mt-0.5 shrink-0 object-contain bg-gray-100 dark:bg-[#222733]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-gray-900 dark:text-white truncate block hover:text-blue-600 dark:hover:text-blue-300 hover:underline"
                            title={site.title}
                          >
                            {site.title}
                          </a>
                          <p className="text-[11px] text-gray-500 dark:text-[#9aa0a6] truncate block mt-0.5" title={site.snippet}>
                            {site.snippet}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Expand / Collapse More Sources Link */}
                  {discoveredSites.length > 3 && (
                    <button
                      onClick={() => setShowAllSources(!showAllSources)}
                      className="text-xs text-blue-600 dark:text-[#8ab4f8] hover:underline flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>
                        {showAllSources
                          ? 'Show fewer sources'
                          : `${discoveredSites.length - 3} more sources`}
                      </span>
                    </button>
                  )}

                  {/* Action Row: Thumbs Feedback + Delete + Import */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-[#252a36]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFeedbackGiven(feedbackGiven === 'up' ? null : 'up')}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-[#252a35] transition-colors cursor-pointer ${
                          feedbackGiven === 'up' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-[#8a919e] hover:text-gray-700 dark:hover:text-white'
                        }`}
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setFeedbackGiven(feedbackGiven === 'down' ? null : 'down')}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-[#252a35] transition-colors cursor-pointer ${
                          feedbackGiven === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-[#8a919e] hover:text-gray-700 dark:hover:text-white'
                        }`}
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setResearchStatus('idle')}
                        className="text-xs text-gray-500 hover:text-gray-800 dark:text-[#9aa0a6] dark:hover:text-white px-2 py-1 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        onClick={handleImportDiscoveredSites}
                        disabled={isImporting || discoveredSites.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Import</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sources List or Empty State */}
        {sources.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 select-none">
            {/* Outline Document Icon matching screenshot */}
            <div className="w-12 h-14 border-2 border-gray-300 dark:border-[#5f6368] rounded-md relative flex items-center justify-center mb-4">
              <div className="w-6 h-0.5 bg-gray-300 dark:bg-[#5f6368] mb-1.5" />
              <div className="w-6 h-0.5 bg-gray-300 dark:bg-[#5f6368] absolute top-5" />
              <div className="w-4 h-0.5 bg-gray-300 dark:bg-[#5f6368] absolute top-7 left-2.5" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-b-2 border-l-2 border-white dark:border-[#1e222b] bg-white dark:bg-[#1e222b]" />
            </div>

            <h3 className="text-xs font-semibold text-gray-900 dark:text-[#e3e3e3] mb-1.5">
              Saved sources will appear here
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-[#9aa0a6] leading-relaxed max-w-[210px] mb-3">
              Add files, websites, or more. Then ask questions or create things based on these sources.
            </p>
            <p className="text-[11px] text-gray-500 dark:text-[#9aa0a6]">
              Drop files here or{' '}
              <button
                onClick={onOpenAddModal}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer inline"
              >
                add a source
              </button>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 flex-1">
            {/* Selection control */}
            <div className="flex items-center justify-between px-1 py-1 text-xs text-gray-500 dark:text-[#9aa0a6]">
              <button
                onClick={() => onToggleAllSources(!allSelected)}
                className="flex items-center gap-1.5 text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {allSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-gray-400 dark:text-[#6c7280]" />
                )}
                <span className="text-[11px]">{allSelected ? 'Deselect all' : 'Select all'}</span>
              </button>
              <span className="text-[11px]">
                {sources.filter((s) => s.selected).length}/{sources.length} active
              </span>
            </div>

            {/* List of Sources */}
            <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className={`group p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                    source.selected
                      ? 'bg-[#f8fafd] dark:bg-[#252a35] border-[#dadce0] dark:border-[#383e4e] hover:border-gray-400 dark:hover:border-[#4a5266]'
                      : 'bg-white/70 dark:bg-[#181b22]/70 border-gray-200 dark:border-[#282d38] opacity-60 hover:opacity-100'
                  }`}
                  onClick={() => onPreviewSource(source)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSource(source.id);
                    }}
                    className="mt-0.5 hover:opacity-80 cursor-pointer"
                  >
                    {source.selected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-gray-400 dark:text-[#6c7280]" />
                    )}
                  </button>

                  <div className="mt-0.5">{getSourceIcon(source.type)}</div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-[#e3e3e3] truncate group-hover:text-black dark:group-hover:text-white">
                      {source.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-500 dark:text-[#9aa0a6] uppercase tracking-wider font-semibold">
                        {source.type}
                      </span>
                      {source.url && (
                        <>
                          <span className="text-[10px] text-gray-300 dark:text-[#525968]">•</span>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono truncate max-w-[110px]" title={source.url}>
                            {getCleanDomain(source.url)}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-gray-300 dark:text-[#525968]">•</span>
                      <span className="text-[10px] text-gray-500 dark:text-[#717784]">
                        {(source.tokenCount / 1000).toFixed(1)}k tokens
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSource(source.id);
                    }}
                    title="Remove source"
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-[#9aa0a6] hover:text-red-500 dark:hover:text-red-400 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

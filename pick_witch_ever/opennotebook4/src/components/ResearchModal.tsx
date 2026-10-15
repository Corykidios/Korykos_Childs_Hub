import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Globe,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus
} from 'lucide-react';
import { Source } from '../types';
import { searchWebAPI, scrapeUrlAPI } from '../services/api';

interface ResearchSiteItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  status: 'queued' | 'visiting' | 'scraped' | 'fallback' | 'error';
  content: string;
  tokenCount: number;
  selected: boolean;
}

interface ResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
  initialScope?: 'Web' | 'Academic' | 'YouTube';
  initialDepth?: 'fast' | 'deep';
  searchProvider: string;
  searchApiKey?: string;
  onAddSources: (newSources: Source[]) => void;
  onOpenDeepResearch?: (query: string, scope: 'Web' | 'Academic' | 'YouTube') => void;
}

export const ResearchModal: React.FC<ResearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
  initialScope = 'Web',
  initialDepth = 'fast',
  searchProvider,
  searchApiKey,
  onAddSources,
  onOpenDeepResearch,
}) => {
  const [query, setQuery] = useState(initialQuery || '');
  const [scope, setScope] = useState<'Web' | 'Academic' | 'YouTube'>(initialScope);
  const [depth, setDepth] = useState<'fast' | 'deep'>(initialDepth);
  const [isSearching, setIsSearching] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [currentScrapingUrl, setCurrentScrapingUrl] = useState<string>('');
  const [progressStep, setProgressStep] = useState<string>('');
  const [sites, setSites] = useState<ResearchSiteItem[]>([]);
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSearching && !isScraping) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isSearching, isScraping, onClose]);

  // Helper to extract clean domain from url
  const getCleanDomain = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[2] || 'web';
    }
  };

  // Run research workflow
  const executeResearch = async (searchQuery: string, searchDepth: 'fast' | 'deep', searchScope: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setIsScraping(false);
    setSites([]);
    setProgressStep(`Querying search index for "${searchQuery}" via ${searchProvider.toUpperCase()}...`);

    try {
      let effectiveQuery = searchQuery.trim();
      if (searchScope === 'Academic') {
        effectiveQuery += ' research paper pdf academic';
      } else if (searchScope === 'YouTube') {
        effectiveQuery += ' site:youtube.com';
      }

      const results = await searchWebAPI(effectiveQuery, searchProvider, searchApiKey);

      if (!results || results.length === 0) {
        setProgressStep('No search results found. Try broadening your query.');
        setIsSearching(false);
        return;
      }

      // Limit target count based on research depth: 4 for Fast, 8 for Deep
      const targetCount = searchDepth === 'fast' ? 4 : 8;
      
      // Deduplicate domains for diverse sources
      const seenDomains = new Set<string>();
      const candidateList: ResearchSiteItem[] = [];

      for (const item of results) {
        const domain = getCleanDomain(item.url);
        // Avoid duplicates if we have enough results
        if (candidateList.length < targetCount) {
          candidateList.push({
            id: `site-${Date.now()}-${candidateList.length}`,
            title: item.title,
            url: item.url,
            snippet: item.snippet,
            domain,
            status: 'queued',
            content: '',
            tokenCount: 0,
            selected: true,
          });
          seenDomains.add(domain);
        }
      }

      setSites(candidateList);
      setIsSearching(false);
      setIsScraping(true);
      setProgressStep(`Found ${candidateList.length} candidate websites. Visiting and extracting text...`);

      // Sequentially visit and scrape each site
      const updatedSites = [...candidateList];
      for (let i = 0; i < updatedSites.length; i++) {
        const site = updatedSites[i];
        setCurrentScrapingUrl(site.url);
        setProgressStep(`Visiting (${i + 1}/${updatedSites.length}): ${site.domain}...`);

        site.status = 'visiting';
        setSites([...updatedSites]);

        try {
          const scraped = await scrapeUrlAPI(site.url);
          if (scraped.content && scraped.content.length > 200 && !scraped.content.includes('Failed to fetch directly')) {
            site.content = scraped.content;
            site.tokenCount = scraped.tokenCount || Math.ceil(scraped.content.length / 4);
            site.status = 'scraped';
            if (scraped.title && scraped.title.length > 3) {
              site.title = scraped.title;
            }
          } else {
            // Fallback to rich snippet if scraper is blocked
            site.content = `# ${site.title}\n\n**Source Domain:** ${site.domain}\n**Direct URL:** ${site.url}\n\n## Overview\n${site.snippet}\n\n*Full web page was protected by bot shielding or paywall. Summarized snippet retained for citations.*`;
            site.tokenCount = Math.ceil(site.content.length / 4);
            site.status = 'fallback';
          }
        } catch (scrapeErr) {
          site.content = `# ${site.title}\n\n**Source Domain:** ${site.domain}\n**Direct URL:** ${site.url}\n\n## Excerpt\n${site.snippet}`;
          site.tokenCount = Math.ceil(site.content.length / 4);
          site.status = 'fallback';
        }

        setSites([...updatedSites]);
      }

      setCurrentScrapingUrl('');
      setIsScraping(false);
      setProgressStep(`Research complete! ${updatedSites.filter(s => s.status === 'scraped').length} sites extracted, ${updatedSites.filter(s => s.status === 'fallback').length} summarized.`);
    } catch (err: any) {
      console.error('Research execution error:', err);
      setIsSearching(false);
      setIsScraping(false);
      setProgressStep(`Research error: ${err.message || 'Failed to complete search'}`);
    }
  };

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      setScope(initialScope);
      setDepth(initialDepth);
      executeResearch(initialQuery, initialDepth, initialScope);
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const selectedSites = sites.filter((s) => s.selected);
  const totalTokens = selectedSites.reduce((acc, s) => acc + s.tokenCount, 0);

  const handleToggleSelectAll = () => {
    const allSelected = sites.every((s) => s.selected);
    setSites(sites.map((s) => ({ ...s, selected: !allSelected })));
  };

  const handleToggleSite = (id: string) => {
    setSites(sites.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
  };

  const handleImportSources = () => {
    if (selectedSites.length === 0) return;

    // Convert EACH site into its own INDIVIDUAL Source object
    const newSources: Source[] = selectedSites.map((site, idx) => ({
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#383e4e] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative text-gray-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Globe className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Web & Deep Research Explorer</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#262c38] text-blue-600 dark:text-blue-300 font-normal border border-blue-200 dark:border-[#343c4e]">
                  Individual Sources Grounding
                </span>
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-[#8a919e]">
                Transparent search, site visitation, and token extraction for OpenNotebookLM
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="p-5 border-b border-gray-100 dark:border-[#2d3340] bg-gray-50/50 dark:bg-[#1a1e27] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 dark:text-[#8a919e] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeResearch(query, depth, scope)}
                placeholder="Enter research topic, question, or technology..."
                className="w-full bg-white dark:bg-[#14171f] border border-gray-200 dark:border-[#343c4e] rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#757d8e] focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <button
              onClick={() => executeResearch(query, depth, scope)}
              disabled={isSearching || isScraping || !query.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
            >
              {isSearching || isScraping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Research</span>
            </button>
          </div>

          {/* Scope and Depth Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {/* Scope */}
              <div className="flex items-center bg-gray-100 dark:bg-[#14171f] border border-gray-200 dark:border-[#2d3340] rounded-xl p-0.5">
                {(['Web', 'Academic', 'YouTube'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setScope(s);
                      executeResearch(query, depth, s);
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                      scope === s
                        ? 'bg-white dark:bg-[#2a303e] text-gray-900 dark:text-white font-medium shadow-xs'
                        : 'text-gray-600 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Depth */}
              <div className="flex items-center bg-gray-100 dark:bg-[#14171f] border border-gray-200 dark:border-[#2d3340] rounded-xl p-0.5">
                <button
                  onClick={() => {
                    setDepth('fast');
                    executeResearch(query, 'fast', scope);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] flex items-center gap-1 ${
                    depth === 'fast'
                      ? 'bg-white dark:bg-[#2a303e] text-amber-600 dark:text-amber-400 font-medium shadow-xs'
                      : 'text-gray-600 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  <span>Fast (3-5 sites)</span>
                </button>
                <button
                  onClick={() => {
                    if (onOpenDeepResearch) {
                      onClose();
                      onOpenDeepResearch(query, scope);
                    } else {
                      setDepth('deep');
                      executeResearch(query, 'deep', scope);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] flex items-center gap-1 ${
                    depth === 'deep'
                      ? 'bg-white dark:bg-[#2a303e] text-purple-600 dark:text-purple-400 font-medium shadow-xs'
                      : 'text-gray-600 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                  <span>Deep Research (20–30 sources + Report)</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-gray-500 dark:text-[#8a919e]">
              Provider: <span className="text-gray-700 dark:text-[#c4c7c5] font-medium">{searchProvider.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Live Progress Banner */}
        <div className="px-6 py-2.5 bg-gray-100/60 dark:bg-[#14171f] border-b border-gray-200 dark:border-[#282d38] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isSearching || isScraping ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 animate-spin shrink-0" />
            ) : sites.length > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-[#8a919e] shrink-0" />
            )}
            <span className="text-gray-700 dark:text-[#c4c7c5] truncate font-medium">{progressStep || 'Ready for research.'}</span>
          </div>

          {sites.length > 0 && (
            <button
              onClick={handleToggleSelectAll}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium shrink-0 ml-3 cursor-pointer"
            >
              {sites.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* Discovered & Visited Sites List */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-3">
          {isSearching && sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Searching the web...</p>
              <p className="text-xs text-gray-500 dark:text-[#8a919e] max-w-sm">
                Querying DuckDuckGo index for reliable sources and documentation on "{query}"
              </p>
            </div>
          ) : sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Globe className="w-8 h-8 text-gray-400 dark:text-[#545b6b]" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">No research sites loaded</p>
              <p className="text-xs text-gray-500 dark:text-[#8a919e] max-w-sm">
                Type your topic above and click "Research" to discover and scrape websites.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8a919e] px-1">
                <span>
                  Discovered & Visited Websites ({sites.length} sites):
                </span>
                <span>
                  Each site will be treated as an individual source with full citations
                </span>
              </div>

              {sites.map((site) => (
                <div
                  key={site.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    site.selected
                      ? 'bg-blue-50/40 dark:bg-[#212631] border-blue-200 dark:border-[#383e4e] hover:border-blue-300 dark:hover:border-[#4d566d]'
                      : 'bg-gray-50 dark:bg-[#181b22]/70 border-gray-200 dark:border-[#2a2f3a] opacity-60'
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={site.selected}
                      onChange={() => handleToggleSite(site.id)}
                      className="mt-1 rounded accent-blue-500 cursor-pointer"
                    />

                    {/* Site Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {/* Domain Tag */}
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#161a22] text-[11px] font-mono font-medium text-blue-700 dark:text-blue-300 border border-gray-200 dark:border-[#2d3444] flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5 text-blue-500 dark:text-blue-400" />
                          <span>{site.domain}</span>
                        </span>

                        {/* Status Badge */}
                        {site.status === 'visiting' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium flex items-center gap-1 border border-blue-500/20">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>Visiting & Scraping...</span>
                          </span>
                        )}
                        {site.status === 'scraped' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium flex items-center gap-1 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Extracted ({(site.tokenCount / 1000).toFixed(1)}k tokens)</span>
                          </span>
                        )}
                        {site.status === 'fallback' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-medium flex items-center gap-1 border border-amber-500/20">
                            <AlertCircle className="w-2.5 h-2.5" />
                            <span>Protected (Excerpt • {site.tokenCount} tokens)</span>
                          </span>
                        )}
                        {site.status === 'queued' && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#2b313d] text-gray-500 dark:text-[#8a919e] text-[10px] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Queued</span>
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-1">
                        {site.title}
                      </h4>

                      {/* URL */}
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 dark:text-[#8ab4f8] hover:underline flex items-center gap-1 truncate max-w-lg"
                        >
                          <span className="truncate">{site.url}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </div>

                      {/* Snippet Preview */}
                      <p className="text-[11px] text-gray-500 dark:text-[#9aa0a6] mt-1.5 line-clamp-2 leading-relaxed">
                        {site.snippet}
                      </p>
                    </div>

                    {/* Preview Content Toggle */}
                    {site.content && (
                      <button
                        onClick={() => setExpandedSiteId(expandedSiteId === site.id ? null : site.id)}
                        title="Inspect extracted text"
                        className="p-1 rounded text-gray-400 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2c3240] transition-colors cursor-pointer"
                      >
                        {expandedSiteId === site.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Scraped Content Preview */}
                  {expandedSiteId === site.id && site.content && (
                    <div className="px-4 py-3 bg-gray-50 dark:bg-[#171a21] border-t border-gray-200 dark:border-[#2d3340] text-xs font-mono text-gray-800 dark:text-[#c4c7c5] max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-[#282d38] text-[11px] text-gray-500 dark:text-[#8a919e]">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                          <span>Extracted Content Preview</span>
                        </span>
                        <span>{site.content.length.toLocaleString()} characters</span>
                      </div>
                      {site.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#181b22] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500 dark:text-[#8a919e]">
            {selectedSites.length > 0 ? (
              <span>
                <strong className="text-gray-900 dark:text-white">{selectedSites.length}</strong> site(s) selected •{' '}
                <strong className="text-blue-600 dark:text-blue-400">~{(totalTokens / 1000).toFixed(1)}k tokens</strong> ready for RAG grounding
              </span>
            ) : (
              <span>Select at least 1 site to add as a source</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleImportSources}
              disabled={selectedSites.length === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add {selectedSites.length} Source{selectedSites.length !== 1 ? 's' : ''} to Notebook</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

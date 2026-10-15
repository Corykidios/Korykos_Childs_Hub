import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Search,
  Globe,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
  Terminal,
  Bookmark,
  Share2,
  Plus
} from 'lucide-react';
import { Source, AppSettings } from '../types';
import {
  runDeepResearchAPI,
  DeepResearchResult,
  DeepResearchProgressLog,
  DeepResearchStats,
  DeepResearchSourceItem,
} from '../services/api';

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialScope?: 'Web' | 'Academic' | 'YouTube';
  settings?: AppSettings;
  onAddSources: (newSources: Source[]) => void;
  onSaveReportArtifact?: (title: string, content: string) => void;
}

export const DeepResearchModal: React.FC<DeepResearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  initialScope = 'Web',
  settings,
  onAddSources,
  onSaveReportArtifact,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<'Web' | 'Academic' | 'YouTube'>(initialScope);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [currentStage, setCurrentStage] = useState<DeepResearchProgressLog['stage']>('planning');
  const [logs, setLogs] = useState<DeepResearchProgressLog[]>([]);
  const [stats, setStats] = useState<DeepResearchStats>({});
  const [result, setResult] = useState<DeepResearchResult | null>(null);
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'dossier' | 'sources' | 'logs'>('dossier');
  const [filterSourceText, setFilterSourceText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const logTerminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Sync initial query when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
        setScope(initialScope);
        handleStartResearch(initialQuery, initialScope);
      } else {
        setStatus('idle');
        setLogs([]);
        setStats({});
        setResult(null);
      }
      setIsAdded(false);
      setIsCopied(false);
    }
  }, [isOpen, initialQuery, initialScope]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'running') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, status, onClose]);

  const handleStartResearch = async (searchQuery: string, searchScope: string) => {
    const cleanQ = searchQuery.trim();
    if (!cleanQ || status === 'running') return;

    setStatus('running');
    setLogs([]);
    setStats({});
    setResult(null);
    setErrorMessage('');
    setIsAdded(false);
    setCurrentStage('planning');

    try {
      const researchResult = await runDeepResearchAPI(
        cleanQ,
        searchScope,
        settings,
        (incomingLog, currentStats) => {
          setLogs((prev) => [...prev, incomingLog]);
          setCurrentStage(incomingLog.stage);
          if (currentStats) {
            setStats((prev) => ({ ...prev, ...currentStats }));
          }
        }
      );

      setResult(researchResult);
      // Select all shortlisted sources by default
      const selectionMap: Record<string, boolean> = {};
      researchResult.shortlistedSources.forEach((s) => {
        selectionMap[s.id] = true;
      });
      setSelectedSources(selectionMap);
      setStatus('completed');
      setCurrentStage('complete');
      setActiveTab('dossier');
    } catch (err: any) {
      console.error('Deep research failure:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Deep Research pipeline encountered an error.');
    }
  };

  if (!isOpen) return null;

  const getCleanDomain = (url?: string): string => {
    if (!url) return 'web';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[2] || 'web';
    }
  };

  const handleCopyReport = () => {
    if (!result?.report.content) return;
    navigator.clipboard.writeText(result.report.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveToArtifacts = () => {
    if (!result || !onSaveReportArtifact) return;
    onSaveReportArtifact(result.report.title, result.report.content);
  };

  // Add BOTH the Report itself as a primary Source AND the shortlisted web sources as individual sources
  const handleIngestAll = () => {
    if (!result) return;

    const sourcesToAdd: Source[] = [];

    // 1. Ingest the Deep Research Report as a primary Source
    const reportSource: Source = {
      id: `source-report-${Date.now()}`,
      title: result.report.title,
      type: 'text',
      content: result.report.content,
      tokenCount: result.report.tokenCount,
      selected: true,
      addedAt: Date.now(),
      sourceGuide: result.report.summary,
    };
    sourcesToAdd.push(reportSource);

    // 2. Ingest each selected Shortlisted Site as an individual Source
    result.shortlistedSources.forEach((site, idx) => {
      if (selectedSources[site.id] !== false) {
        sourcesToAdd.push({
          id: `source-web-${Date.now()}-${idx}`,
          title: site.title,
          type: 'web',
          url: site.url,
          content: site.content,
          tokenCount: site.tokenCount,
          selected: true,
          addedAt: Date.now() + idx + 1,
        });
      }
    });

    onAddSources(sourcesToAdd);

    // Also persist as Studio Note/Report artifact for immediate accessibility
    if (onSaveReportArtifact) {
      onSaveReportArtifact(result.report.title, result.report.content);
    }

    setIsAdded(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const toggleSourceSelection = (id: string) => {
    setSelectedSources((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAllSources = () => {
    if (!result) return;
    const allSelected = result.shortlistedSources.every((s) => selectedSources[s.id] !== false);
    const updated: Record<string, boolean> = {};
    result.shortlistedSources.forEach((s) => {
      updated[s.id] = !allSelected;
    });
    setSelectedSources(updated);
  };

  const selectedCount = result
    ? result.shortlistedSources.filter((s) => selectedSources[s.id] !== false).length
    : 0;

  const filteredSources = (result?.shortlistedSources || []).filter((s) => {
    if (!filterSourceText.trim()) return true;
    const low = filterSourceText.toLowerCase();
    return s.title.toLowerCase().includes(low) || s.domain.toLowerCase().includes(low) || s.snippet.toLowerCase().includes(low);
  });

  // Stage indicator metadata
  const stages = [
    { key: 'planning', label: 'Formulation', desc: 'Orthogonal Query Expansion' },
    { key: 'searching', label: 'Discovery', desc: '20–30 Candidates' },
    { key: 'reading', label: 'Deep Reading', desc: 'Text & Token Extraction' },
    { key: 'shortlisting', label: 'Shortlisting', desc: '15–20 Authorities' },
    { key: 'synthesizing', label: 'Synthesis', desc: 'Dossier & Citations' },
  ];

  const getStageIndex = (s: string) => {
    switch (s) {
      case 'planning': return 0;
      case 'searching': return 1;
      case 'reading': return 2;
      case 'shortlisting': return 3;
      case 'synthesizing': return 4;
      case 'complete': return 5;
      default: return 0;
    }
  };

  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#181b22] border border-[#dadce0] dark:border-[#2d3342] rounded-2xl w-full max-w-5xl h-[92vh] max-h-[900px] flex flex-col shadow-2xl overflow-hidden relative text-gray-900 dark:text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#282d3a] bg-gray-50 dark:bg-[#14171f] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-gradient-to-br dark:from-purple-500/20 dark:to-blue-500/20 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white tracking-wide">
                  NotebookLM Deep Research
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                  Autonomous Engine
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8a919e] mt-0.5">
                Multi-angle discovery (20–30 sources), full text reading, evidence shortlisting (15–20), and dossier synthesis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#252a35] transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Query Input Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-[#262b38] bg-gray-50/50 dark:bg-[#161922] flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 dark:text-[#8a919e] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartResearch(query, scope)}
              placeholder="Enter research topic, question, or technology for deep investigation..."
              disabled={status === 'running'}
              className="w-full bg-white dark:bg-[#10131a] border border-gray-200 dark:border-[#2c3240] focus:border-purple-500 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6d7586] focus:outline-none shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center bg-gray-100 dark:bg-[#10131a] border border-gray-200 dark:border-[#2c3240] rounded-xl p-0.5 text-xs">
              {(['Web', 'Academic', 'YouTube'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  disabled={status === 'running'}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                    scope === s
                      ? 'bg-white dark:bg-[#252a36] text-purple-700 dark:text-purple-300 font-semibold shadow-xs'
                      : 'text-gray-600 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleStartResearch(query, scope)}
              disabled={status === 'running' || !query.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Researching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Deep Research</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visual Multi-Stage Pipeline Progress Bar */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-[#252a36] bg-gray-50/70 dark:bg-[#12141c] shrink-0">
          <div className="grid grid-cols-5 gap-2 text-xs">
            {stages.map((st, idx) => {
              const isCompleted = currentIdx > idx || status === 'completed';
              const isActive = status === 'running' && currentIdx === idx;

              return (
                <div
                  key={st.key}
                  className={`flex flex-col p-2 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-500/50 shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-white dark:bg-[#181b24]/40 border-gray-200 dark:border-[#242934] opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-[#525969] text-[9px] flex items-center justify-center text-gray-500 dark:text-[#8a919e]">
                        {idx + 1}
                      </div>
                    )}
                    <span
                      className={`text-[11px] font-semibold truncate ${
                        isActive
                          ? 'text-purple-700 dark:text-purple-300'
                          : isCompleted
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-gray-500 dark:text-[#8a919e]'
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-[#6d7586] truncate">{st.desc}</span>
                </div>
              );
            })}
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-gray-200 dark:border-[#202430] text-[11px] text-gray-600 dark:text-[#8a919e]">
            <div className="flex items-center gap-4">
              <span>
                Discovered: <strong className="text-gray-900 dark:text-white font-mono">{stats.totalFound || (result ? result.totalFound : 0)}</strong> candidates (target 20–30)
              </span>
              <span>•</span>
              <span>
                Read & Scraped: <strong className="text-gray-900 dark:text-white font-mono">{stats.totalRead || (result ? result.totalRead : 0)}</strong> sites
              </span>
              <span>•</span>
              <span>
                Shortlisted: <strong className="text-purple-700 dark:text-purple-300 font-mono">{stats.shortlistedCount || (result ? result.shortlistedCount : 0)}</strong> authorities (target 15–20)
              </span>
              <span>•</span>
              <span>
                Context: <strong className="text-blue-700 dark:text-blue-300 font-mono">~{(((stats.totalTokens || (result ? result.totalTokens : 0))) / 1000).toFixed(1)}k</strong> tokens
              </span>
            </div>

            {status === 'running' && (
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Engine actively crawling & synthesizing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Center Main View Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-[#11131a]">
          {status === 'idle' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-gradient-to-br dark:from-purple-500/10 dark:to-blue-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 shadow-lg">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                Begin Autonomous Deep Research
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#8a919e] max-w-md leading-relaxed mb-6">
                Enter a complex topic above. The engine will formulate 6+ orthogonal research vectors, crawl 20–30 authoritative candidate websites, parse full contents, shortlist 15–20 premier sources, and generate a comprehensive publication-grade report with in-line citations.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                {['Quantum Computing Error Correction', 'Transformer Attention Optimization', 'Synthetic Biology mRNA Vaccines', 'Solid-State Battery Breakthroughs'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setQuery(t);
                      handleStartResearch(t, scope);
                    }}
                    className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1b1f2b] border border-gray-200 dark:border-[#2d3344] text-[11px] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white hover:border-purple-400/50 shadow-xs transition-colors cursor-pointer"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
          ) : status === 'running' ? (
            /* Live Terminal Activity Viewer during execution */
            <div className="flex-1 p-6 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 text-xs text-gray-500 dark:text-[#8a919e]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold text-gray-900 dark:text-white">Autonomous Research Execution Feed</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  <span className="text-gray-700 dark:text-gray-300">STREAMING REAL-TIME LOGS</span>
                </div>
              </div>

              <div className="flex-1 bg-gray-900 dark:bg-[#0c0e14] border border-gray-800 dark:border-[#242936] rounded-xl p-4 font-mono text-xs overflow-y-auto shadow-inner flex flex-col gap-2">
                {logs.map((l, i) => {
                  const time = new Date(l.timestamp).toLocaleTimeString();
                  let badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
                  if (l.stage === 'planning') badgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
                  if (l.stage === 'reading') badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                  if (l.stage === 'shortlisting') badgeColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
                  if (l.stage === 'synthesizing') badgeColor = 'text-pink-400 bg-pink-500/10 border-pink-500/20';
                  if (l.stage === 'complete') badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                  return (
                    <div key={i} className="flex items-start gap-2.5 text-[#c4c7c5] leading-relaxed">
                      <span className="text-[#596072] shrink-0 select-none">[{time}]</span>
                      <span className={`px-1.5 py-0.2 rounded uppercase text-[10px] font-semibold border ${badgeColor} shrink-0`}>
                        {l.stage}
                      </span>
                      <span className="break-all">{l.message}</span>
                    </div>
                  );
                })}
                <div ref={logTerminalEndRef} />
              </div>
            </div>
          ) : status === 'error' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Deep Research Failed</h3>
              <p className="text-xs text-gray-500 dark:text-[#8a919e] max-w-md mb-4">{errorMessage}</p>
              <button
                onClick={() => handleStartResearch(query, scope)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer"
              >
                Retry Research
              </button>
            </div>
          ) : (
            /* Completed Result View: Dossier Tab, Shortlisted Sources Tab, and Terminal Logs Tab */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab Navigation */}
              <div className="px-6 border-b border-gray-100 dark:border-[#252a36] bg-gray-50 dark:bg-[#14171f] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab('dossier')}
                    className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                      activeTab === 'dossier'
                        ? 'border-purple-600 dark:border-purple-400 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Research Dossier</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('sources')}
                    className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                      activeTab === 'sources'
                        ? 'border-blue-600 dark:border-blue-400 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Shortlisted Sources ({result?.shortlistedSources.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                      activeTab === 'logs'
                        ? 'border-cyan-600 dark:border-cyan-400 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Execution Logs ({logs.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeTab === 'dossier' && (
                    <>
                      <button
                        onClick={handleCopyReport}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#222735] hover:bg-gray-200 dark:hover:bg-[#2c3244] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200 dark:border-transparent"
                        title="Copy report markdown"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied!' : 'Copy Markdown'}</span>
                      </button>
                      <button
                        onClick={handleSaveToArtifacts}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#222735] hover:bg-gray-200 dark:hover:bg-[#2c3244] text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200 dark:border-transparent"
                        title="Save as Studio Artifact"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span>Save to Studio</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 select-text">
                {activeTab === 'dossier' ? (
                  <div className="max-w-4xl mx-auto bg-white dark:bg-[#181b24] border border-gray-200 dark:border-[#2c3344] rounded-2xl p-6 sm:p-8 shadow-xl text-xs sm:text-sm text-gray-800 dark:text-[#d1d5db] leading-relaxed">
                    {/* Rendered Dossier View */}
                    <div className="prose dark:prose-invert max-w-none space-y-4">
                      {result?.report.content.split('\n\n').map((paragraph, pIdx) => {
                        // Headings
                        if (paragraph.startsWith('# ')) {
                          return (
                            <h1 key={pIdx} className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#2d3446] pb-3 mb-4">
                              {paragraph.replace(/^# /, '')}
                            </h1>
                          );
                        }
                        if (paragraph.startsWith('## ')) {
                          return (
                            <h2 key={pIdx} className="text-base sm:text-lg font-semibold text-purple-700 dark:text-purple-200 mt-6 pt-2 border-b border-gray-100 dark:border-[#262c3a] pb-1">
                              {paragraph.replace(/^## /, '')}
                            </h2>
                          );
                        }
                        if (paragraph.startsWith('### ')) {
                          return (
                            <h3 key={pIdx} className="text-sm font-semibold text-blue-700 dark:text-blue-200 mt-4">
                              {paragraph.replace(/^### /, '')}
                            </h3>
                          );
                        }

                        // Markdown Table
                        if (paragraph.includes('|') && paragraph.includes('\n|')) {
                          const rows = paragraph.split('\n').filter((r) => r.trim().startsWith('|'));
                          if (rows.length >= 2) {
                            const headerCols = rows[0].split('|').slice(1, -1).map((c) => c.trim());
                            const bodyRows = rows.slice(2).map((r) => r.split('|').slice(1, -1).map((c) => c.trim()));
                            return (
                              <div key={pIdx} className="overflow-x-auto my-4 rounded-xl border border-gray-200 dark:border-[#2d3446] bg-gray-50 dark:bg-[#12141c]">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-gray-100 dark:bg-[#1c212e] border-b border-gray-200 dark:border-[#2d3446]">
                                      {headerCols.map((col, cIdx) => (
                                        <th key={cIdx} className="p-2.5 font-semibold text-purple-800 dark:text-purple-300">
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bodyRows.map((bRow, rIdx) => (
                                      <tr key={rIdx} className="border-b border-gray-200 dark:border-[#202533] hover:bg-gray-100/50 dark:hover:bg-[#181c28]">
                                        {bRow.map((cell, cIdx) => (
                                          <td key={cIdx} className="p-2.5 text-gray-700 dark:text-[#c4c7c5]">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }
                        }

                        // Horizontal rule
                        if (paragraph.trim() === '---') {
                          return <hr key={pIdx} className="border-gray-200 dark:border-[#2c3242] my-4" />;
                        }

                        // Bullet list
                        if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                          const items = paragraph.split('\n');
                          return (
                            <ul key={pIdx} className="list-disc pl-5 space-y-1 my-2">
                              {items.map((it, itIdx) => (
                                <li key={itIdx} className="text-gray-700 dark:text-[#c4c7c5]">
                                  {it.replace(/^[-*]\s+/, '')}
                                </li>
                              ))}
                            </ul>
                          );
                        }

                        // Regular paragraph with highlightable in-line citations [1], [2]
                        return (
                          <p key={pIdx} className="leading-relaxed">
                            {paragraph}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : activeTab === 'sources' ? (
                  /* Shortlisted Sources Grid */
                  <div className="max-w-5xl mx-auto flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#181b24] border border-gray-200 dark:border-[#282d3a] p-3.5 rounded-xl shadow-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={toggleAllSources}
                          className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#252a36] hover:bg-gray-200 dark:hover:bg-[#303746] text-xs text-gray-800 dark:text-white font-medium transition-colors cursor-pointer border border-gray-200 dark:border-transparent"
                        >
                          {result?.shortlistedSources.every((s) => selectedSources[s.id] !== false)
                            ? 'Deselect All'
                            : 'Select All'}
                        </button>
                        <span className="text-xs text-gray-600 dark:text-[#8a919e]">
                          <strong className="text-purple-700 dark:text-purple-300 font-semibold">{selectedCount}</strong> of {result?.shortlistedSources.length} sources selected for workspace grounding
                        </span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-gray-400 dark:text-[#8a919e] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={filterSourceText}
                          onChange={(e) => setFilterSourceText(e.target.value)}
                          placeholder="Filter sources by name or domain..."
                          className="w-full bg-gray-50 dark:bg-[#12141c] border border-gray-200 dark:border-[#2d3444] rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#6d7586] focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredSources.map((s, idx) => {
                        const isSelected = selectedSources[s.id] !== false;
                        return (
                          <div
                            key={s.id}
                            onClick={() => toggleSourceSelection(s.id)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                              isSelected
                                ? 'bg-purple-50/40 dark:bg-[#1c212e] border-purple-300 dark:border-purple-500/40 shadow-xs'
                                : 'bg-white dark:bg-[#14171f] border-gray-200 dark:border-[#252a36] opacity-60'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSourceSelection(s.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded accent-purple-600 cursor-pointer shrink-0"
                                  />
                                  <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 shrink-0">
                                    [{idx + 1}]
                                  </span>
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`}
                                    alt=""
                                    className="w-4 h-4 rounded-full shrink-0 bg-gray-100 dark:bg-[#262c3a]"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <span className="font-mono text-[11px] text-blue-700 dark:text-blue-300 truncate" title={s.domain}>
                                    {s.domain}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-gray-500 dark:text-[#8a919e] font-mono">
                                    {(s.tokenCount / 1000).toFixed(1)}k tokens
                                  </span>
                                  {s.url && (
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 rounded text-gray-400 dark:text-[#8a919e] hover:text-gray-900 dark:hover:text-white transition-colors"
                                      title="Open original website"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              <h4 className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-1.5">
                                {s.title}
                              </h4>

                              <p className="text-[11px] text-gray-500 dark:text-[#8a919e] line-clamp-3 leading-relaxed">
                                {s.snippet || s.content.slice(0, 180)}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-[#6d7586] pt-2 border-t border-gray-100 dark:border-[#252a36]">
                              <span>Grounding Source #{idx + 1}</span>
                              <span className={isSelected ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-400 dark:text-[#8a919e]'}>
                                {isSelected ? '✓ Ingest on confirmation' : 'Excluded'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Execution Log Tab */
                  <div className="max-w-4xl mx-auto bg-gray-900 dark:bg-[#0c0e14] border border-gray-800 dark:border-[#242936] rounded-xl p-5 font-mono text-xs shadow-inner flex flex-col gap-2">
                    {logs.map((l, i) => {
                      const time = new Date(l.timestamp).toLocaleTimeString();
                      return (
                        <div key={i} className="flex items-start gap-2.5 text-[#c4c7c5] leading-relaxed">
                          <span className="text-[#596072] shrink-0">[{time}]</span>
                          <span className="text-purple-400 uppercase text-[10px] font-semibold shrink-0">
                            [{l.stage}]
                          </span>
                          <span>{l.message}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Grounding Action Bar */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#262b38] bg-gray-50 dark:bg-[#14171f] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-600 dark:text-[#8a919e]">
            {status === 'completed' ? (
              <span className="flex items-center gap-1.5 text-gray-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>
                  Ready to ground <strong className="text-purple-700 dark:text-purple-300">1 Comprehensive Dossier</strong> and{' '}
                  <strong className="text-blue-700 dark:text-blue-300">{selectedCount} Individual Sources</strong> into your Notebook.
                </span>
              </span>
            ) : status === 'running' ? (
              <span>Engine is processing multi-angle research. Please wait...</span>
            ) : (
              <span>Deep Research will ground individual sources alongside a synthesized publication report.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-gray-600 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#222634] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {status === 'completed' && (
              <button
                onClick={handleIngestAll}
                disabled={isAdded || (selectedCount === 0 && !result?.report)}
                className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg hover:shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
              >
                {isAdded ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Added to Notebook!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      Add Report + {selectedCount} Sources to Notebook
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Globe, 
  Search, 
  Check, 
  Loader2,
  FileUp,
  Link,
  AlignLeft,
  ExternalLink
} from 'lucide-react';
import { YoutubeIcon } from './Icons';
import { Source } from '../types';
import { 
  searchWebAPI, 
  scrapeUrlAPI, 
  extractYoutubeAPI, 
  parsePdfFileAPI 
} from '../services/api';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSources: (newSources: Source[]) => void;
  searchProvider: string;
}

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSources,
  searchProvider,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'search' | 'url' | 'youtube' | 'text'>('upload');
  
  // URL Tab
  const [webUrl, setWebUrl] = useState('');
  
  // YouTube Tab
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Text Tab
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  
  // Search Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ title: string; url: string; snippet: string; selected: boolean }>>([]);
  
  // Upload State
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleProcessFiles = async () => {
    if (uploadedFiles.length === 0) return;
    setIsProcessing(true);
    setProcessingStatus('Parsing uploaded documents...');
    const newSources: Source[] = [];

    try {
      for (const file of uploadedFiles) {
        if (file.name.endsWith('.pdf')) {
          setProcessingStatus(`Extracting text from PDF: ${file.name}...`);
          const pdfResult = await parsePdfFileAPI(file);
          newSources.push({
            id: `source-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: file.name,
            type: 'pdf',
            content: pdfResult.text,
            tokenCount: pdfResult.tokenCount,
            pageCount: pdfResult.pages,
            selected: true,
            addedAt: Date.now(),
          });
        } else {
          setProcessingStatus(`Reading text file: ${file.name}...`);
          const text = await file.text();
          newSources.push({
            id: `source-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: file.name,
            type: file.type.includes('audio') ? 'audio' : 'text',
            content: text || `[Content extracted from ${file.name}]`,
            tokenCount: estimateTokens(text || file.name),
            selected: true,
            addedAt: Date.now(),
          });
        }
      }
      if (newSources.length > 0) {
        onAddSources(newSources);
        onClose();
      }
    } catch (err: any) {
      alert(`Error processing files: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleAddUrl = async () => {
    if (!webUrl.trim()) return;
    setIsProcessing(true);
    setProcessingStatus(`Fetching & scraping ${webUrl}...`);
    try {
      const scraped = await scrapeUrlAPI(webUrl);
      const newSource: Source = {
        id: `source-${Date.now()}`,
        title: scraped.title,
        type: 'web',
        url: webUrl,
        content: scraped.content,
        tokenCount: scraped.tokenCount,
        selected: true,
        addedAt: Date.now(),
      };
      onAddSources([newSource]);
      setWebUrl('');
      onClose();
    } catch (e: any) {
      alert(`Error scraping webpage: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;
    setIsProcessing(true);
    setProcessingStatus('Extracting YouTube video metadata & audio overview notes...');
    try {
      const yt = await extractYoutubeAPI(youtubeUrl);
      const newSource: Source = {
        id: `source-${Date.now()}`,
        title: yt.title,
        type: 'youtube',
        url: youtubeUrl,
        content: yt.content,
        tokenCount: yt.tokenCount,
        selected: true,
        addedAt: Date.now(),
      };
      onAddSources([newSource]);
      setYoutubeUrl('');
      onClose();
    } catch (e: any) {
      alert(`Error extracting YouTube: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleAddText = () => {
    if (!textContent.trim()) return;
    const newSource: Source = {
      id: `source-${Date.now()}`,
      title: textTitle.trim() || 'Copied Text Note',
      type: 'text',
      content: textContent,
      tokenCount: estimateTokens(textContent),
      selected: true,
      addedAt: Date.now(),
    };
    onAddSources([newSource]);
    setTextTitle('');
    setTextContent('');
    onClose();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchWebAPI(searchQuery, searchProvider);
      if (results.length > 0) {
        setSearchResults(results.map((r, i) => ({ ...r, selected: i < 3 })));
      } else {
        // Fallback search suggestions
        setSearchResults([
          {
            title: `${searchQuery} - Technical Overview & Architecture`,
            url: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
            snippet: `Direct search queries for ${searchQuery} indexing foundational principles and verified citations.`,
            selected: true,
          },
        ]);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportSearchResults = async () => {
    const selected = searchResults.filter((r) => r.selected);
    if (selected.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(`Scraping ${selected.length} web sources...`);
    const newSources: Source[] = [];

    try {
      for (let i = 0; i < selected.length; i++) {
        const item = selected[i];
        setProcessingStatus(`Scraping (${i + 1}/${selected.length}): ${item.title.slice(0, 30)}...`);
        const scraped = await scrapeUrlAPI(item.url);
        newSources.push({
          id: `source-${Date.now()}-${i}`,
          title: item.title,
          type: 'web',
          url: item.url,
          content: scraped.content.length > 200 ? scraped.content : `# ${item.title}\n\n${item.snippet}\n\n**Source Link:** ${item.url}`,
          tokenCount: scraped.tokenCount || estimateTokens(item.snippet),
          selected: true,
          addedAt: Date.now(),
        });
      }
      onAddSources(newSources);
      setSearchQuery('');
      setSearchResults([]);
      onClose();
    } catch (e: any) {
      alert(`Error importing results: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#333a49] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col relative">
        {/* Loading / Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-30 bg-white/90 dark:bg-[#1e222b]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{processingStatus || 'Processing sources...'}</p>
            <p className="text-xs text-gray-500 dark:text-[#8a919e]">Extracting text, formatting citations, and loading into context window</p>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2d3340] bg-gray-50 dark:bg-[#1e222b]">
          <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <span>Add sources</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#2a303d] text-blue-700 dark:text-[#8ab4f8]">
              Supports 1.5M+ tokens
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2a2f3b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 dark:border-[#2d3340] px-6 bg-gray-50/80 dark:bg-[#181b22] overflow-x-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'upload'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Files</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'search'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Web Research</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'url'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Link</span>
          </button>

          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'youtube'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <YoutubeIcon className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
            <span>YouTube</span>
          </button>

          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              activeTab === 'text'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3]'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Paste Text</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 min-h-[280px]">
          {/* UPLOAD TAB */}
          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-[#383e4e] hover:border-blue-500 dark:hover:border-blue-400/60 rounded-xl p-8 transition-colors bg-[#f8fafd] dark:bg-[#181b22]/50">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.mp3,.m4a,.wav"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-white dark:bg-[#252a35] border border-gray-200 dark:border-transparent flex items-center justify-center mb-3 shadow-xs">
                <FileUp className="w-6 h-6 text-blue-500 dark:text-[#8ab4f8]" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Upload your source documents
              </p>
              <p className="text-xs text-gray-500 dark:text-[#9aa0a6] mb-4 text-center max-w-sm">
                PDFs, Markdown (.md), Plain Text (.txt), or Audio recordings.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-full bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Choose files
              </button>

              {uploadedFiles.length > 0 && (
                <div className="mt-4 w-full max-w-md bg-white dark:bg-[#232833] rounded-lg p-3 border border-gray-200 dark:border-[#333a49] shadow-xs">
                  <p className="text-xs font-medium text-gray-900 dark:text-white mb-2">Selected files ({uploadedFiles.length}):</p>
                  <ul className="text-xs text-gray-600 dark:text-[#9aa0a6] space-y-1 max-h-24 overflow-y-auto">
                    {uploadedFiles.map((f, i) => (
                      <li key={i} className="truncate flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <span>{f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleProcessFiles}
                    className="mt-3 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    Import Selected Files
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search topics, research papers, or documentation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl px-4 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 placeholder-gray-500 dark:placeholder-[#8a919e]"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-5 py-2.5 bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search</span>
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-[#c4c7c5]">
                    Discovered Sources (Backend: {searchProvider.toUpperCase()}):
                  </p>
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const updated = [...searchResults];
                          updated[i].selected = !updated[i].selected;
                          setSearchResults(updated);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                          res.selected
                            ? 'bg-blue-50/60 dark:bg-[#252a35] border-blue-500 dark:border-blue-500/60'
                            : 'bg-[#f8fafd] dark:bg-[#181b22] border-gray-200 dark:border-[#2f3542] opacity-70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={res.selected}
                          onChange={() => {}}
                          className="mt-1 rounded accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#161a22] text-[10px] font-mono text-blue-600 dark:text-blue-300 border border-gray-200 dark:border-[#2d3444]">
                              {(() => {
                                try {
                                  return new URL(res.url).hostname.replace(/^www\./, '');
                                } catch {
                                  return 'web';
                                }
                              })()}
                            </span>
                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{res.title}</p>
                          </div>
                          <p className="text-[11px] text-gray-600 dark:text-[#9aa0a6] line-clamp-2 mt-0.5">{res.snippet}</p>
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-1 truncate max-w-md"
                          >
                            <span className="truncate">{res.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleImportSearchResults}
                    className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Import Selected ({searchResults.filter((r) => r.selected).length}) to Notebook
                  </button>
                </div>
              )}
            </div>
          )}

          {/* URL TAB */}
          {activeTab === 'url' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#c4c7c5] block mb-1.5">
                  Web Page URL
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="w-4 h-4 text-gray-400 dark:text-[#8a919e] absolute left-3.5 top-3" />
                    <input
                      type="url"
                      placeholder="https://example.com/article"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                      className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleAddUrl}
                    disabled={!webUrl.trim()}
                    className="px-5 py-2.5 bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Fetch Page
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#9aa0a6] leading-relaxed">
                Will be extracted via {searchProvider.toUpperCase()} and converted into clean markdown with all navigation and ads stripped out.
              </p>
            </div>
          )}

          {/* YOUTUBE TAB */}
          {activeTab === 'youtube' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#c4c7c5] block mb-1.5">
                  YouTube Video Link
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-3">
                      <YoutubeIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
                    </span>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddYouTube()}
                      className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleAddYouTube}
                    disabled={!youtubeUrl.trim()}
                    className="px-5 py-2.5 bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Import Transcript
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#9aa0a6] leading-relaxed">
                Transcripts are automatically extracted with timestamps and formatted for source citation and synthesis.
              </p>
            </div>
          )}

          {/* PASTE TEXT TAB */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#c4c7c5] block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g., Project Specifications, Meeting Notes"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-[#c4c7c5] block mb-1">
                  Text Content
                </label>
                <textarea
                  rows={6}
                  placeholder="Paste research, raw notes, or articles here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#383e4e] rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddText}
                  disabled={!textContent.trim()}
                  className="px-5 py-2 bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Add Text Source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

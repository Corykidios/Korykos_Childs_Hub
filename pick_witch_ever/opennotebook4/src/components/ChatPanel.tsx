import React, { useState, useRef, useEffect } from 'react';
import { 
  SlidersHorizontal, 
  MoreVertical, 
  ArrowRight, 
  Sparkles, 
  Copy, 
  Check, 
  BookOpen,
  FilePlus,
  Pin
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PanelToggleIcon } from './Icons';
import { ChatMessage, Citation, Source } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  sources: Source[];
  onSendMessage: (text: string, style?: 'Default' | 'Concise' | 'Detailed') => void;
  onClearChat: () => void;
  onCitationClick: (citation: Citation) => void;
  onSaveToNote?: (title: string, content: string) => void;
  isLoading: boolean;
  isSourcesCollapsed: boolean;
  onExpandSources: () => void;
  isStudioCollapsed: boolean;
  onExpandStudio: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  sources,
  onSendMessage,
  onClearChat,
  onCitationClick,
  onSaveToNote,
  isLoading,
  isSourcesCollapsed,
  onExpandSources,
  isStudioCollapsed,
  onExpandStudio,
}) => {
  const [input, setInput] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [chatStyle, setChatStyle] = useState<'Default' | 'Concise' | 'Detailed'>('Default');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSourceCount = sources.filter((s) => s.selected).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize prompt textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 128);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim(), chatStyle);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveMessageToNote = (id: string, text: string) => {
    if (onSaveToNote) {
      const previewTitle = text.slice(0, 40).replace(/[#*`\n]/g, ' ').trim() + '...';
      onSaveToNote(previewTitle || 'Saved Note', text);
      setSavedNoteId(id);
      setTimeout(() => setSavedNoteId(null), 2000);
    }
  };

  const starterPills = activeSourceCount > 0
    ? [
        'Summarize key themes across all sources',
        'What are the most surprising takeaways?',
        'Compare key methodologies & findings',
        'Outline critical questions raised',
      ]
    : [
        'Learn about a new topic',
        'Create something new',
        'Make progress on a project',
      ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1e222b] border border-[#dadce0] dark:border-[#2d3340] rounded-2xl overflow-hidden relative select-none transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-[#2a2f3a]/60 z-10 bg-white dark:bg-[#1e222b]">
        {/* Left Header area */}
        <div className="flex items-center gap-3">
          {/* If Sources panel is collapsed, show uncollapse button */}
          {isSourcesCollapsed && (
            <button
              onClick={onExpandSources}
              title="Expand Sources panel"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#dadce0] dark:border-[#3b4150] bg-white dark:bg-transparent text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282d38] text-xs font-medium cursor-pointer transition-colors shadow-sm"
            >
              <PanelToggleIcon side="left" isCollapsed={true} />
              <span>Sources</span>
            </button>
          )}
          <h2 className="text-[15px] font-medium text-gray-900 dark:text-[#e3e3e3]">Chat</h2>
        </div>

        {/* Right Header area */}
        <div className="flex items-center gap-2">
          {/* Style Tuner */}
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              title="Chat settings"
              className="p-1.5 text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3] rounded-lg hover:bg-gray-100 dark:hover:bg-[#282d38] transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {showOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#252a35] border border-[#dadce0] dark:border-[#383e4e] rounded-xl shadow-xl p-2 z-30">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8a919e] px-2 py-1 uppercase tracking-wider">
                  Response Style
                </p>
                {(['Default', 'Concise', 'Detailed'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => { setChatStyle(style); setShowOptions(false); }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                      chatStyle === style 
                        ? 'bg-blue-50 dark:bg-[#333a4a] text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-gray-700 dark:text-[#c4c7c5] hover:bg-gray-100 dark:hover:bg-[#2d3342]'
                    }`}
                  >
                    <span>{style}</span>
                    {chatStyle === style && <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onClearChat}
            title="Chat options"
            className="p-1.5 text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-[#e3e3e3] rounded-lg hover:bg-gray-100 dark:hover:bg-[#282d38] transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* If Studio panel is collapsed, show uncollapse button */}
          {isStudioCollapsed && (
            <button
              onClick={onExpandStudio}
              title="Expand Studio panel"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#dadce0] dark:border-[#3b4150] bg-white dark:bg-transparent text-gray-700 dark:text-[#c4c7c5] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282d38] text-xs font-medium cursor-pointer transition-colors shadow-sm ml-1"
            >
              <PanelToggleIcon side="right" isCollapsed={true} />
              <span>Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col justify-between">
        {messages.length === 0 ? (
          /* Empty State Canvas */
          <div className="my-auto max-w-xl mx-auto py-8">
            <div className="text-3xl mb-3">👋</div>
            <h1 className="text-[26px] font-normal text-gray-900 dark:text-[#f1f3f4] tracking-tight mb-2">
              Let's start your notebook...
            </h1>
            <p className="text-sm text-gray-600 dark:text-[#9aa0a6] leading-relaxed mb-6 font-normal">
              This is your blank canvas to understand, create, or make progress on something new. I can help you get started or you can go ahead and add your own sources.
            </p>

            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-[#d0d3d8]">
                What would you like this notebook to help you do?
              </p>
              <div className="flex flex-wrap gap-2">
                {starterPills.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => onSendMessage(`I want to: ${pill}. What can we do based on the current workspace?`)}
                    className="px-4 py-2 rounded-full border border-[#dadce0] dark:border-[#383e4e] hover:border-gray-400 dark:hover:border-[#4d566b] bg-white dark:bg-[#232731] hover:bg-gray-50 dark:hover:bg-[#2a303d] text-xs text-gray-800 dark:text-[#e3e3e3] transition-all shadow-sm"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat History */
          <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full py-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group`}
              >
                {msg.role === 'user' ? (
                  <div className="bg-[#e8f0fe] dark:bg-[#2c3240] text-gray-900 dark:text-[#f1f3f4] text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full bg-[#f8fafd] dark:bg-[#232732]/70 border border-[#e0e2ec] dark:border-[#2f3545] rounded-2xl p-4 text-gray-900 dark:text-[#e3e3e3] text-sm leading-relaxed shadow-sm relative">
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:text-gray-900 dark:prose-headings:text-white prose-code:text-indigo-600 dark:prose-code:text-amber-300 prose-pre:bg-gray-100 dark:prose-pre:bg-[#181b22]">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Citations / Grounded Sources */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-[#313747] flex flex-wrap gap-1.5 items-center">
                        <span className="text-[11px] font-medium text-gray-500 dark:text-[#9aa0a6] mr-1 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-blue-500" />
                          Sources:
                        </span>
                        {msg.citations.map((c, idx) => (
                          <button
                            key={c.id}
                            onClick={() => onCitationClick(c)}
                            title={c.excerpt}
                            className="px-2 py-0.5 rounded-full bg-[#e8f0fe] dark:bg-[#2c3342] hover:bg-[#d2e3fc] dark:hover:bg-[#384154] border border-[#c2e7ff] dark:border-[#3e475b] text-[10px] text-blue-700 dark:text-blue-300 transition-colors flex items-center gap-1"
                          >
                            <span>[{idx + 1}]</span>
                            <span className="truncate max-w-[140px]">{c.sourceTitle}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message Actions */}
                    <div className="mt-2.5 flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onSaveToNote && (
                        <button
                          onClick={() => handleSaveMessageToNote(msg.id, msg.content)}
                          title="Save as note in Studio"
                          className="px-2 py-1 rounded text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#313747] text-xs flex items-center gap-1 transition-colors"
                        >
                          {savedNoteId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Saved to Notes</span>
                            </>
                          ) : (
                            <>
                              <FilePlus className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Save to Note</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        title="Copy to clipboard"
                        className="p-1 rounded text-gray-500 dark:text-[#9aa0a6] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#313747] text-xs flex items-center gap-1 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-[#232732]/70 border border-gray-200 dark:border-[#2f3545] rounded-2xl w-48 text-xs text-gray-600 dark:text-[#9aa0a6] animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span>Thinking & synthesizing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Bar Docked at Bottom */}
        <div className="pt-2">
          <div className="bg-[#f0f4f9] dark:bg-[#181b22] border border-[#dadce0] dark:border-[#2f3542] rounded-2xl p-2.5 flex items-center gap-2 shadow-sm focus-within:shadow-md focus-within:bg-white dark:focus-within:bg-[#181b22] focus-within:border-blue-500 dark:focus-within:border-[#4b5468] transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask a question or create something"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-sm text-gray-900 dark:text-[#e3e3e3] placeholder-gray-500 dark:placeholder-[#8a919e] focus:outline-none flex-1 resize-none max-h-32 px-2 py-1 leading-normal"
            />

            <div className="flex items-center gap-2 shrink-0">
              {/* Active source counter pill */}
              <div
                title={`${activeSourceCount} source${activeSourceCount === 1 ? '' : 's'} included in context`}
                className="text-xs text-gray-600 dark:text-[#9aa0a6] bg-white dark:bg-[#232733] px-2.5 py-1 rounded-full border border-[#dadce0] dark:border-[#32394a] flex items-center gap-1.5 select-none"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeSourceCount > 0 ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                />
                <span>{activeSourceCount} source{activeSourceCount === 1 ? '' : 's'}</span>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  input.trim() && !isLoading
                    ? 'bg-[#1f1f1f] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6]'
                    : 'bg-gray-200 text-gray-400 dark:bg-[#292e3a] dark:text-[#717784] cursor-not-allowed'
                }`}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Disclaimer Footer */}
          <p className="text-[11px] text-gray-500 dark:text-[#717784] text-center mt-2 font-normal select-none">
            NotebookLM can be inaccurate; please double check its responses.
          </p>
        </div>
      </div>
    </div>
  );
};

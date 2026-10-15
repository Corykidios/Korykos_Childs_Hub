import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { SourceManager } from './SourceManager';
import { AnalysisTools } from './AnalysisTools';
import { NotesPanel } from './NotesPanel';
import { ConversationConfig } from './ConversationConfig';
import {
  Plus, Send, MessageSquare, FileText, StickyNote,
  Sparkles, Pin, RefreshCw, Copy, Check, Loader2,
  Zap, Download, Share2, Settings
} from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import { generatePDF, downloadPDF, sharePDF } from '../../utils/pdf-generator';

export function NotebookView() {
  const {
    notebooks, currentNotebookId, currentConversationId,
    setPage, createConversation, sendMessage, isStreaming,
    pinMessage, regenerateResponse, showToast, updateNotebook,
    setDefaultModel
  } = useStore();

  const notebook = notebooks.find(n => n.id === currentNotebookId);
  const conversation = notebook?.conversations.find(c => c.id === currentConversationId);

  const [activeTab, setActiveTab] = useState<'chat' | 'sources' | 'analysis' | 'notes'>('chat');
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  if (!notebook) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-muted">Notebook não encontrado</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;
    
    let convId = currentConversationId;
    if (!convId) {
      convId = createConversation(notebook.id);
    }
    sendMessage(notebook.id, convId, inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportConversationPDF = () => {
    if (!conversation || conversation.messages.length === 0) {
      showToast('error', 'Nenhuma mensagem para exportar');
      return;
    }

    const chatContent = conversation.messages
      .map(msg => {
        const role = msg.role === 'user' ? 'Você' : 'IA';
        return `[${role}]\n${msg.content}\n`;
      })
      .join('\n---\n\n');

    const doc = generatePDF({
      title: conversation.title || 'Conversa',
      subtitle: `Notebook: ${notebook.name}`,
      content: chatContent,
      footer: 'Gerado por OpenNotebook AI',
    });

    const filename = `${conversation.title || 'conversa'}-${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(doc, filename);
    showToast('success', 'Conversa exportada como PDF!');
  };

  const handleShareConversationPDF = async () => {
    if (!conversation || conversation.messages.length === 0) {
      showToast('error', 'Nenhuma mensagem para compartilhar');
      return;
    }

    const chatContent = conversation.messages
      .map(msg => {
        const role = msg.role === 'user' ? 'Você' : 'IA';
        return `[${role}]\n${msg.content}\n`;
      })
      .join('\n---\n\n');

    const doc = generatePDF({
      title: conversation.title || 'Conversa',
      subtitle: `Notebook: ${notebook.name}`,
      content: chatContent,
      footer: 'Gerado por OpenNotebook AI',
    });

    const title = `${conversation.title || 'Conversa'} - ${notebook.name}`;
    const shared = await sharePDF(doc, title);

    if (!shared) {
      const filename = `${conversation.title || 'conversa'}-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(doc, filename);
      showToast('info', 'PDF baixado (compartilhamento não suportado)');
    }
  };

  const tabs = [
    { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
    { id: 'sources' as const, icon: FileText, label: 'Fontes' },
    { id: 'analysis' as const, icon: Sparkles, label: 'Análise' },
    { id: 'notes' as const, icon: StickyNote, label: 'Notas' },
  ];

  return (
    <div className="h-full flex flex-col safe-top">
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-bg-secondary/50 shrink-0 pl-14 lg:pl-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
            style={{ backgroundColor: notebook.color + '20' }}
          >
            {notebook.icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold truncate max-w-[120px] sm:max-w-none">{notebook.name}</h1>
            <p className="text-[10px] sm:text-xs text-text-muted">{notebook.sources.filter(s => s.enabled).length} fontes ativas</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowConfig(true)}
            className="p-1.5 sm:p-2 text-text-muted hover:text-accent-light transition-colors"
            title="Configurar conversas"
          >
            <Settings className="w-4 h-4" />
          </button>
          {conversation && conversation.messages.length > 0 && (
            <>
              <button
                onClick={handleExportConversationPDF}
                className="p-1.5 sm:p-2 text-text-muted hover:text-success transition-colors"
                title="Exportar conversa como PDF"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleShareConversationPDF}
                className="p-1.5 sm:p-2 text-text-muted hover:text-accent-light transition-colors"
                title="Compartilhar conversa"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </>
          )}
          <ProviderSelector />
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-3 sm:px-4 py-2 border-b border-border bg-bg-secondary/30 overflow-x-auto hide-scrollbar shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-accent/10 text-accent-light border border-accent/30'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {tab.id === 'sources' && notebook.sources.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px]">
                {notebook.sources.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
              {(!conversation || conversation.messages.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                    <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-accent" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2">Comece uma conversa</h3>
                  <p className="text-xs sm:text-sm text-text-secondary max-w-md">
                    Pergunte sobre suas fontes, peça resumos, ou explore os documentos com ajuda da IA.
                  </p>
                  {notebook.sources.length === 0 && (
                    <button
                      onClick={() => setActiveTab('sources')}
                      className="mt-4 px-4 py-2 bg-accent/10 text-accent-light border border-accent/30 rounded-lg text-sm hover:bg-accent/20 transition-colors"
                    >
                      + Adicionar fontes primeiro
                    </button>
                  )}
                </div>
              )}

              {conversation?.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div className={`w-full sm:max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                    <div
                      className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-accent text-white rounded-br-md'
                          : 'bg-bg-card border border-border rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="markdown-content">
                          {msg.isStreaming ? (
                            <span>{msg.content}</span>
                          ) : (
                            <span dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                          )}
                          {msg.isStreaming && (
                            <span className="inline-flex gap-1 ml-2">
                              <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full" />
                              <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full" />
                              <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span>{msg.content}</span>
                      )}
                    </div>

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && !msg.isStreaming && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.citations.map((cite, i) => (
                          <span
                            key={cite.id}
                            className="inline-flex items-center px-2 py-0.5 bg-accent/10 text-accent-light text-[10px] rounded-full border border-accent/20 cursor-pointer hover:bg-accent/20 transition-colors"
                            title={cite.text}
                          >
                            [{i + 1}] {cite.sourceName}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Message actions */}
                    {msg.role === 'assistant' && !msg.isStreaming && (
                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                          title="Copiar"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => pinMessage(notebook.id, conversation.id, msg.id)}
                          className={`p-1 transition-colors ${msg.pinned ? 'text-accent-light' : 'text-text-muted hover:text-text-secondary'}`}
                          title="Fixar"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => regenerateResponse(notebook.id, conversation.id, msg.id)}
                          className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                          title="Regenerar"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 sm:px-4 pt-3 pb-4 sm:pb-3 border-t border-border bg-bg-secondary/50 mobile-safe-bottom shrink-0">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte sobre suas fontes..."
                    rows={1}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-bg-card border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none transition-colors"
                    style={{ minHeight: '44px', maxHeight: '120px', fontSize: '16px' }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  className="p-2.5 sm:p-3 bg-accent hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0"
                >
                  {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sources' && <SourceManager notebookId={notebook.id} />}
        {activeTab === 'analysis' && <AnalysisTools notebookId={notebook.id} />}
        {activeTab === 'notes' && <NotesPanel notebookId={notebook.id} />}
      </div>

      {/* Conversation Config Modal */}
      {showConfig && (
        <ConversationConfig
          notebookId={notebook.id}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

// Simple markdown formatter
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
    .replace(/\[Fonte (\d+)\]/g, '<span class="inline-flex items-center px-1.5 py-0.5 bg-accent/20 text-accent-light text-xs rounded">$1</span>');
}

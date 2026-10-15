import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  Plus, FileText, Globe, Youtube, Upload, Trash2,
  Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Clock, X
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  notebookId: string;
}

export function SourceManager({ notebookId }: Props) {
  const { notebooks, addSource, removeSource, toggleSource, showToast } = useStore();
  const notebook = notebooks.find(n => n.id === notebookId);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<'text' | 'url'>('text');
  const [sourceName, setSourceName] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [viewSource, setViewSource] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({
    show: false,
    id: '',
    name: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!notebook) return null;

  const handleAddText = () => {
    if (!sourceName.trim() || !sourceContent.trim()) return;
    addSource(notebookId, sourceName.trim(), 'txt', sourceContent.trim());
    setSourceName('');
    setSourceContent('');
    setShowAdd(false);
    showToast('success', 'Fonte adicionada e processando...');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      addSource(notebookId, file.name, file.name.endsWith('.md') ? 'md' : 'txt', content);
      showToast('success', `"${file.name}" adicionado!`);
    };
    reader.readAsText(file);
    setShowAdd(false);
  };

  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-text-muted" />,
    processing: <Loader2 className="w-4 h-4 text-accent animate-spin" />,
    ready: <CheckCircle className="w-4 h-4 text-success" />,
    error: <AlertCircle className="w-4 h-4 text-error" />,
  };

  const statusLabels = {
    pending: 'Pendente',
    processing: 'Processando...',
    ready: 'Pronto',
    error: 'Erro',
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-sm font-semibold">Fontes de Conhecimento</h2>
          <p className="text-xs text-text-muted">{notebook.sources.length} fonte{notebook.sources.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Adicionar Fonte</span>
          <span className="sm:hidden">Adicionar</span>
        </button>
      </div>

      {/* Add Source Panel */}
      {showAdd && (
        <div className="mb-4 p-4 bg-bg-card border border-accent/30 rounded-xl animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Adicionar Fonte</h3>
            <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Type Selector */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAddType('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                addType === 'text' ? 'bg-accent/10 text-accent-light border border-accent/30' : 'bg-bg-tertiary text-text-muted'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Texto / Colar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Arquivo
            </button>
            <button
              onClick={() => setAddType('url')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                addType === 'url' ? 'bg-accent/10 text-accent-light border border-accent/30' : 'bg-bg-tertiary text-text-muted'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> URL
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            onChange={handleFileUpload}
            className="hidden"
          />

          {addType === 'text' && (
            <div className="space-y-2">
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Nome da fonte"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <textarea
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                placeholder="Cole o conteúdo aqui... (PDF, texto, artigos, etc.)"
                rows={6}
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
              <button
                onClick={handleAddText}
                disabled={!sourceName.trim() || !sourceContent.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Adicionar Fonte
              </button>
            </div>
          )}

          {addType === 'url' && (
            <div className="space-y-2">
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="Nome da fonte"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <input
                type="url"
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                placeholder="https://exemplo.com/artigo"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-text-muted">
                💡 Cole o conteúdo da página web. No futuro, scraping automático será implementado.
              </p>
              <button
                onClick={handleAddText}
                disabled={!sourceName.trim() || !sourceContent.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Adicionar URL
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sources List */}
      <div className="space-y-2">
        {notebook.sources.map((source) => (
          <div
            key={source.id}
            className={`p-3 bg-bg-card border rounded-xl transition-all ${
              source.enabled ? 'border-border' : 'border-border/50 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-bg-tertiary rounded-lg flex items-center justify-center shrink-0">
                {source.type === 'url' ? <Globe className="w-4 h-4 text-text-muted" /> :
                 source.type === 'youtube' ? <Youtube className="w-4 h-4 text-text-muted" /> :
                 <FileText className="w-4 h-4 text-text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium truncate">{source.name}</h4>
                  {statusIcons[source.status]}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-text-muted">
                    {source.metadata.wordCount || 0} palavras
                  </span>
                  <span className="text-xs text-text-muted">•</span>
                  <span className="text-xs text-text-muted">
                    {source.chunks.length} chunks
                  </span>
                  <span className="text-xs text-text-muted">•</span>
                  <span className="text-xs text-text-muted">
                    {statusLabels[source.status]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewSource(viewSource === source.id ? null : source.id)}
                  className="p-1.5 text-text-muted hover:text-text-secondary transition-colors"
                  title="Visualizar conteúdo"
                >
                  {viewSource === source.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => toggleSource(notebookId, source.id)}
                  className={`p-1.5 transition-colors ${source.enabled ? 'text-success' : 'text-text-muted'}`}
                  title={source.enabled ? 'Desativar' : 'Ativar'}
                >
                  {source.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirm({ show: true, id: source.id, name: source.name });
                  }}
                  className="p-1.5 text-text-muted hover:text-error transition-colors"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded content view */}
            {viewSource === source.id && (
              <div className="mt-3 p-3 bg-bg-secondary rounded-lg max-h-48 overflow-y-auto animate-fade-in">
                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                  {source.content.slice(0, 2000)}
                  {source.content.length > 2000 && '\n\n... (truncado)'}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {notebook.sources.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 bg-bg-secondary rounded-xl flex items-center justify-center mb-3">
            <FileText className="w-7 h-7 text-text-muted" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Nenhuma fonte adicionada</h3>
          <p className="text-xs text-text-muted mb-3">Adicione documentos, textos ou URLs para começar</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent-light border border-accent/30 rounded-lg text-xs hover:bg-accent/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar primeira fonte
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.show}
        title="Remover Fonte"
        message={`Tem certeza que deseja remover "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={() => {
          removeSource(notebookId, deleteConfirm.id);
          setDeleteConfirm({ show: false, id: '', name: '' });
        }}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  );
}

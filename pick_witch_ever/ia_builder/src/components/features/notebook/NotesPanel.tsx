import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Trash2, Edit3, Check, X, FileText, Sparkles, Download, Share2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { generatePDF, downloadPDF, sharePDF } from '../../utils/pdf-generator';

interface Props {
  notebookId: string;
}

export function NotesPanel({ notebookId }: Props) {
  const { notebooks, createNote, updateNote, deleteNote } = useStore();
  const notebook = notebooks.find(n => n.id === notebookId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({
    show: false,
    id: '',
    name: '',
  });

  if (!notebook) return null;

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createNote(notebookId, newTitle.trim(), newContent.trim());
    setNewTitle('');
    setNewContent('');
    setShowNew(false);
  };

  const handleEdit = (id: string) => {
    const note = notebook.notes.find(n => n.id === id);
    if (note) {
      setEditingId(id);
      setEditTitle(note.title);
      setEditContent(note.content);
    }
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateNote(notebookId, editingId, { title: editTitle, content: editContent });
    setEditingId(null);
  };

  const handleExport = (content: string, title: string) => {
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = (content: string, title: string) => {
    const notebook = notebooks.find(n => n.id === notebookId);
    const doc = generatePDF({
      title: title,
      subtitle: `Notebook: ${notebook?.name || 'Sem nome'}`,
      content: content,
      footer: 'Gerado por OpenNotebook AI',
    });
    
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(doc, filename);
    useStore.getState().showToast('success', 'Nota exportada como PDF!');
  };

  const handleSharePDF = async (content: string, title: string) => {
    const notebook = notebooks.find(n => n.id === notebookId);
    const doc = generatePDF({
      title: title,
      subtitle: `Notebook: ${notebook?.name || 'Sem nome'}`,
      content: content,
      footer: 'Gerado por OpenNotebook AI',
    });
    
    const shareTitle = `${title} - ${notebook?.name || 'OpenNotebook'}`;
    const shared = await sharePDF(doc, shareTitle);
    
    if (!shared) {
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(doc, filename);
      useStore.getState().showToast('info', 'PDF baixado (compartilhamento não suportado)');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-sm font-semibold">Notas</h2>
          <p className="text-xs text-text-muted">{notebook.notes.length} nota{notebook.notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-accent hover:bg-accent-dark text-white rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova Nota</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* New Note Form */}
      {showNew && (
        <div className="mb-4 p-4 bg-bg-card border border-accent/30 rounded-xl animate-fade-in">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título da nota"
            className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent mb-2"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Conteúdo da nota (Markdown suportado)..."
            rows={5}
            className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="px-3 py-1.5 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-text-secondary hover:text-text-primary text-xs transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {notebook.notes.map((note) => (
          <div
            key={note.id}
            className="p-4 bg-bg-card border border-border rounded-xl group"
          >
            {editingId === note.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 px-3 py-1.5 bg-success/10 text-success rounded-lg text-xs hover:bg-success/20 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 px-3 py-1.5 text-text-muted hover:text-text-secondary text-xs transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {note.isAiGenerated ? (
                      <Sparkles className="w-4 h-4 text-accent-light" />
                    ) : (
                      <FileText className="w-4 h-4 text-text-muted" />
                    )}
                    <h4 className="text-sm font-semibold">{note.title}</h4>
                    {note.isAiGenerated && (
                      <span className="px-1.5 py-0.5 bg-accent/10 text-accent-light text-[10px] rounded">IA</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleExport(note.content, note.title)}
                      className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                      title="Exportar Markdown"
                    >
                      📥
                    </button>
                    <button
                      onClick={() => handleExportPDF(note.content, note.title)}
                      className="p-1 text-text-muted hover:text-success transition-colors"
                      title="Exportar PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleSharePDF(note.content, note.title)}
                      className="p-1 text-text-muted hover:text-accent-light transition-colors"
                      title="Compartilhar PDF"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(note.id)}
                      className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirm({ show: true, id: note.id, name: note.title });
                      }}
                      className="p-1 text-text-muted hover:text-error transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-text-secondary line-clamp-4 whitespace-pre-wrap">
                  {note.content.slice(0, 300)}
                  {note.content.length > 300 && '...'}
                </div>
                <div className="mt-2 text-[10px] text-text-muted">
                  {new Date(note.updatedAt).toLocaleString('pt-BR')}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {notebook.notes.length === 0 && !showNew && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 bg-bg-secondary rounded-xl flex items-center justify-center mb-3">
            <FileText className="w-7 h-7 text-text-muted" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Nenhuma nota ainda</h3>
          <p className="text-xs text-text-muted mb-3">Crie notas manualmente ou gere com IA</p>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent-light border border-accent/30 rounded-lg text-xs hover:bg-accent/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar primeira nota
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.show}
        title="Excluir Nota"
        message={`Tem certeza que deseja excluir "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={() => {
          deleteNote(notebookId, deleteConfirm.id);
          setDeleteConfirm({ show: false, id: '', name: '' });
        }}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  );
}

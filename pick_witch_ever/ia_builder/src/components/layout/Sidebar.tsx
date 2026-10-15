import { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  Menu, X, Settings, Plus, MessageSquare, Trash2, BookOpen,
  Home, ChevronRight, Zap
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: Props) {
  const {
    notebooks, currentNotebookId, currentConversationId,
    setPage, createConversation, deleteConversation, deleteNotebook
  } = useStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConvConfirm, setDeleteConvConfirm] = useState<{ show: boolean; notebookId: string; convId: string; title: string }>({
    show: false, notebookId: '', convId: '', title: ''
  });
  const [deleteNotebookConfirm, setDeleteNotebookConfirm] = useState<{ show: boolean; id: string; name: string }>({
    show: false, id: '', name: ''
  });

  const currentNotebook = notebooks.find(n => n.id === currentNotebookId);

  const handleNewChat = () => {
    if (!currentNotebookId) return;
    createConversation(currentNotebookId);
    setIsOpen(false);
  };

  const handleSelectNotebook = (id: string) => {
    setPage('notebook', id);
    setIsOpen(false);
  };

  const handleSelectConversation = (convId: string) => {
    useStore.setState({ currentConversationId: convId });
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2 bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors shadow-lg"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 bg-bg-secondary border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold">OpenNotebook AI</h1>
              <p className="text-[10px] text-text-muted">Multi-provider IA</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-3 space-y-2 border-b border-border">
          <button
            onClick={() => { setPage('dashboard'); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          
          {currentNotebook && (
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-accent/10 text-accent-light border border-accent/30 rounded-lg hover:bg-accent/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Conversa
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Notebooks */}
          <div className="p-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-2">
              Notebooks
            </h3>
            <div className="space-y-1">
              {notebooks.map((notebook) => (
                <div key={notebook.id}>
                  <button
                    onClick={() => handleSelectNotebook(notebook.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors group ${
                      notebook.id === currentNotebookId
                        ? 'bg-bg-tertiary text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50'
                    }`}
                  >
                    <span className="text-base">{notebook.icon}</span>
                    <span className="flex-1 text-left truncate">{notebook.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteNotebookConfirm({ show: true, id: notebook.id, name: notebook.name });
                      }}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-text-muted hover:text-error transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>

                  {/* Conversations under current notebook */}
                  {notebook.id === currentNotebookId && notebook.conversations.length > 0 && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {notebook.conversations.slice(-5).reverse().map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors group ${
                            conv.id === currentConversationId
                              ? 'bg-accent/10 text-accent-light'
                              : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50'
                          }`}
                        >
                          <MessageSquare className="w-3 h-3 shrink-0" />
                          <span className="flex-1 text-left truncate">{conv.title || 'Nova conversa'}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConvConfirm({
                                show: true,
                                notebookId: notebook.id,
                                convId: conv.id,
                                title: conv.title || 'Nova conversa'
                              });
                            }}
                            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-0.5 text-text-muted hover:text-error transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {notebooks.length === 0 && (
              <div className="text-center py-6">
                <Zap className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-xs text-text-muted">Nenhum notebook</p>
                <button
                  onClick={() => { setPage('dashboard'); setIsOpen(false); }}
                  className="mt-2 text-xs text-accent-light hover:underline"
                >
                  Criar primeiro notebook
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <button
            onClick={() => { onOpenSettings(); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurações
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      </aside>

      {/* Delete Conversation Modal */}
      <ConfirmModal
        isOpen={deleteConvConfirm.show}
        title="Excluir Conversa"
        message={`Tem certeza que deseja excluir "${deleteConvConfirm.title}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={() => {
          deleteConversation(deleteConvConfirm.notebookId, deleteConvConfirm.convId);
          setDeleteConvConfirm({ show: false, notebookId: '', convId: '', title: '' });
        }}
        onCancel={() => setDeleteConvConfirm({ show: false, notebookId: '', convId: '', title: '' })}
      />

      {/* Delete Notebook Modal */}
      <ConfirmModal
        isOpen={deleteNotebookConfirm.show}
        title="Excluir Notebook"
        message={`Tem certeza que deseja excluir "${deleteNotebookConfirm.name}"? Todas as conversas e fontes serão perdidas.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={() => {
          deleteNotebook(deleteNotebookConfirm.id);
          setDeleteNotebookConfirm({ show: false, id: '', name: '' });
        }}
        onCancel={() => setDeleteNotebookConfirm({ show: false, id: '', name: '' })}
      />
    </>
  );
}

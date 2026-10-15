import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Search, Trash2, Edit2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { ProviderSelector } from './ProviderSelector';

export function Dashboard() {
  const { notebooks, createNotebook, deleteNotebook, updateNotebook, setPage, settings } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNotebook, setEditingNotebook] = useState<{ id: string; name: string; description: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; name: string }>({
    show: false,
    id: '',
    name: '',
  });

  const configuredProviders = Object.entries(settings.providers).filter(([_, p]) => p.status === 'configured');

  const handleCreate = () => {
    if (newName.trim()) {
      const id = createNotebook(newName.trim(), newDesc.trim());
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setPage('notebook', id);
    }
  };

  const handleEdit = () => {
    if (editingNotebook && editingNotebook.name.trim()) {
      updateNotebook(editingNotebook.id, {
        name: editingNotebook.name.trim(),
        description: editingNotebook.description.trim(),
      });
      setEditingNotebook(null);
    }
  };

  const filteredNotebooks = notebooks.filter(n => 
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border safe-top shrink-0 pl-14 lg:pl-6">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold truncate">Dashboard</h1>
          <p className="text-[10px] sm:text-xs text-text-muted">
            {notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''}
            {configuredProviders.length > 0 && ` • ${configuredProviders.length} provedor${configuredProviders.length > 1 ? 'es' : ''} ativo${configuredProviders.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ProviderSelector />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Search & Create */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar notebooks..."
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium text-xs sm:text-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Notebook</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="mb-6 p-4 bg-bg-card border border-accent/30 rounded-xl animate-fade-in">
            <h3 className="text-sm font-semibold mb-3">Criar Novo Notebook</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do notebook"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Criar
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingNotebook && (
          <div className="mb-6 p-4 bg-bg-card border border-accent/30 rounded-xl animate-fade-in">
            <h3 className="text-sm font-semibold mb-3">Editar Notebook</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editingNotebook.name}
                onChange={(e) => setEditingNotebook({ ...editingNotebook, name: e.target.value })}
                placeholder="Nome do notebook"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
              />
              <input
                type="text"
                value={editingNotebook.description}
                onChange={(e) => setEditingNotebook({ ...editingNotebook, description: e.target.value })}
                placeholder="Descrição (opcional)"
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingNotebook(null)}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notebooks Grid */}
        {filteredNotebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-bg-secondary rounded-2xl flex items-center justify-center mb-4">
              <Plus className="w-10 h-10 text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'Nenhum notebook encontrado' : 'Nenhum notebook ainda'}
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              {searchQuery ? 'Tente outra busca' : 'Crie seu primeiro notebook para começar a pesquisar'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar Notebook
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredNotebooks.map((notebook) => (
              <div
                key={notebook.id}
                className="group bg-bg-card border border-border rounded-xl p-4 sm:p-5 hover:border-accent/50 transition-all cursor-pointer animate-fade-in"
                onClick={() => setPage('notebook', notebook.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: notebook.color + '20' }}
                  >
                    {notebook.icon}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNotebook({
                          id: notebook.id,
                          name: notebook.name,
                          description: notebook.description,
                        });
                      }}
                      className="p-1.5 text-text-muted hover:text-accent-light rounded transition-all"
                      title="Editar notebook"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ show: true, id: notebook.id, name: notebook.name });
                      }}
                      className="p-1.5 text-text-muted hover:text-error rounded transition-all"
                      title="Excluir notebook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm mb-1 truncate">{notebook.name}</h3>
                {notebook.description && (
                  <p className="text-xs text-text-secondary mb-3 line-clamp-2">{notebook.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>{notebook.sources.length} fontes</span>
                  <span>•</span>
                  <span>{notebook.conversations.length} conversas</span>
                  <span>•</span>
                  <span>{notebook.notes.length} notas</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.show}
        title="Excluir Notebook"
        message={`Tem certeza que deseja excluir "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={() => {
          deleteNotebook(deleteConfirm.id);
          setDeleteConfirm({ show: false, id: '', name: '' });
        }}
        onCancel={() => setDeleteConfirm({ show: false, id: '', name: '' })}
      />
    </div>
  );
}

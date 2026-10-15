import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { Dashboard } from './components/features/dashboard/Dashboard';
import { NotebookView } from './components/features/notebook/NotebookView';
import { Settings } from './components/features/settings/Settings';
import { Onboarding } from './components/features/onboarding/Onboarding';
import { Toast } from './components/common/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { runMigrations } from './utils/migrations';

export default function App() {
  const { currentPage, settings, loadState, showToast, setPage } = useStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      loadState();
      
      // Run migrations to update deprecated models
      const { migrated, changes } = runMigrations();
      if (migrated && changes.length > 0) {
        // Reload state after migration
        loadState();
        showToast('info', 'Modelos atualizados automaticamente');
      }

      // Register service worker for PWA
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service worker registration failed, continue without PWA features
          });
        });
      }
    } catch (err) {
      console.error('Erro ao inicializar app:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [loadState, showToast]);

  // Tela de erro
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary text-text-primary p-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Ops! Algo deu errado</h1>
          <p className="text-text-secondary mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    try {
      if (!settings.onboardingComplete) {
        return <Onboarding />;
      }

      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />;
        case 'notebook':
          return <NotebookView />;
        case 'settings':
          return <Settings />;
        default:
          return <Dashboard />;
      }
    } catch (err) {
      console.error('Erro ao renderizar página:', err);
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-text-secondary">Erro ao carregar página</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-accent text-white rounded-lg"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
  };

  const handleOpenSettings = () => {
    setPage('settings');
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-primary text-text-primary flex">
      {/* Sidebar */}
      {settings.onboardingComplete && (
        <Sidebar onOpenSettings={handleOpenSettings} />
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderPage()}
      </div>
      
      <Toast />
    </div>
  );
}

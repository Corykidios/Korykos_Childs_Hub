import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Download, Upload, Trash2, Database, AlertTriangle, Copy, Check, X, FileJson } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export function DataManagement() {
  const { notebooks, settings, showToast } = useStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<string>('');
  const [exportJson, setExportJson] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Calcular tamanho do localStorage
  const calculateStorageSize = () => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return (total / 1024).toFixed(2);
  };

  // Gerar JSON de exportação
  const generateExportData = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      notebooks,
      settings: {
        ...settings,
        providers: Object.fromEntries(
          Object.entries(settings.providers).map(([id, p]) => [
            id,
            { ...p, apiKey: '[REDACTED]' }
          ])
        )
      }
    };
    return JSON.stringify(data, null, 2);
  };

  // Abrir modal de exportação
  const handleExport = () => {
    const json = generateExportData();
    setExportJson(json);
    setShowExportModal(true);
  };

  // Copiar JSON para clipboard
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      showToast('success', 'JSON copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast('error', 'Erro ao copiar. Selecione o texto manualmente.');
    }
  };

  // Baixar arquivo JSON
  const handleDownload = () => {
    try {
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opennotebook-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('success', 'Backup baixado com sucesso!');
      setShowExportModal(false);
    } catch (error) {
      showToast('error', 'Erro ao baixar arquivo');
      console.error(error);
    }
  };

  // Importar dados
  const handleImport = () => {
    try {
      if (!importData.trim()) {
        showToast('error', 'Cole os dados JSON primeiro');
        return;
      }

      const data = JSON.parse(importData);
      
      if (!data.notebooks || !data.settings) {
        showToast('error', 'Formato de arquivo inválido');
        return;
      }

      // Importar notebooks
      localStorage.setItem('onb_notebooks', JSON.stringify(data.notebooks));
      
      // Importar settings (preservar API keys atuais)
      const currentSettings = JSON.parse(localStorage.getItem('onb_settings') || '{}');
      const newSettings = {
        ...data.settings,
        providers: {
          ...data.settings.providers,
          ...Object.fromEntries(
            Object.entries(currentSettings.providers || {}).map(([id, p]: [string, any]) => [
              id,
              { ...data.settings.providers[id], apiKey: p.apiKey }
            ])
          )
        }
      };
      localStorage.setItem('onb_settings', JSON.stringify(newSettings));

      showToast('success', 'Dados importados com sucesso! Recarregando...');
      setImportData('');
      setShowImportModal(false);
      
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      showToast('error', 'Erro ao importar dados. Verifique o formato JSON.');
      console.error(error);
    }
  };

  // Limpar todos os dados
  const handleClear = () => {
    localStorage.removeItem('onb_notebooks');
    localStorage.removeItem('onb_settings');
    localStorage.removeItem('onb_providers');
    localStorage.removeItem('onb_migration_version');
    
    showToast('success', 'Todos os dados foram apagados! Recarregando...');
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Storage Info */}
      <div className="p-4 bg-bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <Database className="w-5 h-5 text-accent-light" />
          <h3 className="text-sm font-semibold">Armazenamento Local</h3>
        </div>
        <div className="space-y-2 text-xs text-text-secondary">
          <p>• Tamanho atual: <strong className="text-text-primary">{calculateStorageSize()} KB</strong></p>
          <p>• Notebooks: <strong className="text-text-primary">{notebooks.length}</strong></p>
          <p>• Limite do navegador: ~5-10 MB</p>
          <p className="text-text-muted mt-2">
            💡 Os dados ficam salvos apenas neste navegador. Faça backup regularmente.
          </p>
        </div>
      </div>

      {/* Export */}
      <div className="p-4 bg-bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <Download className="w-5 h-5 text-success" />
          <h3 className="text-sm font-semibold">Exportar Dados</h3>
        </div>
        <p className="text-xs text-text-secondary mb-3">
          Visualize, copie ou baixe um arquivo JSON com todos os seus notebooks, conversas e configurações.
          As API keys não são exportadas por segurança.
        </p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success border border-success/30 rounded-lg text-sm hover:bg-success/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar Backup
        </button>
      </div>

      {/* Import */}
      <div className="p-4 bg-bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <Upload className="w-5 h-5 text-accent-light" />
          <h3 className="text-sm font-semibold">Importar Dados</h3>
        </div>
        <p className="text-xs text-text-secondary mb-3">
          Restaure um backup anterior. Isso vai substituir todos os dados atuais.
        </p>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent-light border border-accent/30 rounded-lg text-sm hover:bg-accent/20 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Importar Dados
        </button>
      </div>

      {/* Clear Data */}
      <div className="p-4 bg-bg-card border border-error/30 rounded-xl">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-error" />
          <h3 className="text-sm font-semibold text-error">Zona de Perigo</h3>
        </div>
        <p className="text-xs text-text-secondary mb-3">
          Apague todos os dados locais. Esta ação não pode ser desfeita.
          Faça um backup antes se necessário.
        </p>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error border border-error/30 rounded-lg text-sm hover:bg-error/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Apagar Todos os Dados
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowExportModal(false)}
          />
          <div className="relative bg-bg-card border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col animate-fade-in shadow-2xl">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <FileJson className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Exportar Backup</h3>
                <p className="text-xs text-text-muted">Visualize, copie ou baixe o JSON</p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden mb-4">
              <textarea
                value={exportJson}
                readOnly
                className="w-full h-full min-h-[300px] p-4 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopyJson}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent/10 text-accent-light border border-accent/30 rounded-lg text-sm hover:bg-accent/20 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-success" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar JSON
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success hover:bg-success/80 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar Arquivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowImportModal(false)}
          />
          <div className="relative bg-bg-card border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col animate-fade-in shadow-2xl">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-accent-light" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Importar Backup</h3>
                <p className="text-xs text-text-muted">Cole o JSON do backup abaixo</p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden mb-4">
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder='Cole o JSON do backup aqui...'
                className="w-full h-full min-h-[300px] p-4 bg-bg-secondary border border-border rounded-lg text-xs text-text-primary font-mono resize-none focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 px-4 py-2.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!importData.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importar Dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Apagar Todos os Dados"
        message="Tem certeza que deseja apagar TODOS os dados? Isso inclui notebooks, conversas, notas e configurações. Esta ação não pode ser desfeita!"
        confirmLabel="Apagar Tudo"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

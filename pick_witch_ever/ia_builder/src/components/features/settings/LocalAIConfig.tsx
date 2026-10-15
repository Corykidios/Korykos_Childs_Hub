import { useState, useEffect } from 'react';
import { localAI, LOCAL_MODELS, FREE_APIS, LocalModel } from '../../services/ai/local';
import { Download, Check, Loader2, Trash2, Cpu, Wifi, WifiOff, Globe } from 'lucide-react';

export function LocalAIConfig() {
  const [models, setModels] = useState<LocalModel[]>(LOCAL_MODELS);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [testingAPI, setTestingAPI] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Monitorar status de conexão
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar modelos já carregados
    const loadedModels = models.map(m => ({
      ...m,
      downloaded: localAI.isModelLoaded(m.id),
    }));
    setModels(loadedModels);

    // Assinar progresso de download
    const unsubscribe = localAI.onProgress(({ model, progress }) => {
      setDownloadProgress(prev => ({ ...prev, [model]: progress }));
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const testFreeAPI = async () => {
    setTestingAPI(true);
    setApiStatus('idle');
    
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-large', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputs: 'Olá, como você está?', 
          parameters: { max_new_tokens: 50 } 
        }),
      });
      
      if (response.ok) {
        setApiStatus('success');
      } else {
        setApiStatus('error');
      }
    } catch (error) {
      setApiStatus('error');
    } finally {
      setTestingAPI(false);
    }
  };

  const handleLoadModel = async (modelId: string) => {
    setLoadingModel(modelId);
    try {
      await localAI.loadModel(modelId, (progress) => {
        setDownloadProgress(prev => ({ ...prev, [modelId]: progress }));
      });
      
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, downloaded: true } : m
      ));
      
      // Mostrar mensagem de sucesso
      const model = LOCAL_MODELS.find(m => m.id === modelId);
      alert(`✅ Modelo "${model?.name}" carregado com sucesso!\n\nAgora você pode usá-lo no chat.`);
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`❌ Erro ao carregar modelo\n\n${errorMessage}\n\nSugestões:\n1. Verifique sua conexão com a internet\n2. Tente novamente\n3. Use as APIs gratuitas (DialoGPT ou BlenderBot) que não precisam de download`);
    } finally {
      setLoadingModel(null);
    }
  };

  const handleUnloadModel = (modelId: string) => {
    localAI.unloadModel(modelId);
    setModels(prev => prev.map(m => 
      m.id === modelId ? { ...m, downloaded: false } : m
    ));
    setDownloadProgress(prev => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Status de Conexão */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${
        isOnline 
          ? 'bg-green-500/10 border-green-500/30 text-green-400' 
          : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
      }`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span className="text-sm">
          {isOnline 
            ? 'Online - Você pode baixar novos modelos' 
            : 'Offline - Usando apenas modelos já baixados'}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Cpu className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-200">
            <p className="font-semibold mb-1">IA Local no Navegador</p>
            <p className="text-xs text-purple-300">
              Modelos rodam diretamente no seu dispositivo usando WebAssembly. 
              Funciona offline após o download inicial. Sem API key, sem custos, total privacidade.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Modelos */}
      <div className="space-y-3">
        {models.map((model) => {
          const isLoading = loadingModel === model.id;
          const progress = downloadProgress[model.id] || 0;

          return (
            <div
              key={model.id}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    {model.name}
                    {model.downloaded && (
                      <Check className="w-4 h-4 text-green-400" />
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{model.description}</p>
                  <p className="text-xs text-slate-500 mt-1">Tamanho: {model.size}</p>
                </div>

                <div className="flex-shrink-0">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                      <span className="text-xs text-slate-400">{progress}%</span>
                    </div>
                  ) : model.downloaded ? (
                    <button
                      onClick={() => handleUnloadModel(model.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                      title="Descarregar modelo"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs">Descarregar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLoadModel(model.id)}
                      disabled={!isOnline}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-purple-400 rounded-lg transition-colors"
                      title="Baixar modelo"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-xs">Baixar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de Progresso */}
              {isLoading && (
                <div className="mt-3">
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* APIs Gratuitas Online */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          APIs Gratuitas (Online)
        </h3>
        
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-4">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-1">Use IA sem baixar modelos!</p>
              <p className="text-xs text-blue-300">
                APIs gratuitas do Hugging Face funcionam online, sem API key e sem download. 
                Perfeito para dispositivos com pouca memória ou quando precisa de respostas rápidas.
              </p>
              <button
                onClick={testFreeAPI}
                disabled={testingAPI || !isOnline}
                className="mt-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 text-blue-400 rounded-lg text-xs transition-colors"
              >
                {testingAPI ? 'Testando...' : 'Testar API Gratuita'}
              </button>
              {apiStatus === 'success' && (
                <p className="mt-2 text-xs text-green-400">✅ API funcionando!</p>
              )}
              {apiStatus === 'error' && (
                <p className="mt-2 text-xs text-red-400">❌ API não está respondendo</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {FREE_APIS.map((api) => (
            <div
              key={api.id}
              className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    {api.name}
                    <Check className="w-4 h-4 text-green-400" />
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">{api.description}</p>
                  <div className="mt-2 space-y-1">
                    {api.models.map((model) => (
                      <div key={model.id} className="text-xs text-slate-500">
                        • {model.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                    Online
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dicas */}
      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg mt-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Dicas</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• <strong>APIs Gratuitas:</strong> Use online sem download (recomendado para começar)</li>
          <li>• <strong>Modelos Locais:</strong> Baixe quando estiver em Wi-Fi para uso offline</li>
          <li>• Use "Qwen 2.5 0.5B" para dispositivos com pouca memória</li>
          <li>• "MiniLM Embeddings" é essencial para busca vetorial</li>
          <li>• Descarregue modelos não utilizados para liberar memória</li>
        </ul>
      </div>
    </div>
  );
}

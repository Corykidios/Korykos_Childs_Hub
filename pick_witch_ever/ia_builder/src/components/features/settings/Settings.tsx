import { useState } from 'react';
import { useStore } from '../store/useStore';
import { PROVIDER_DEFINITIONS } from '../../services/ai/adapter';
import { maskKey } from '../../utils/crypto';
import {
  Key, Check, Trash2, ExternalLink,
  Shield, Loader2, Plus, ChevronDown, ChevronUp, Database, Cpu, X
} from 'lucide-react';
import { DataManagement } from './DataManagement';
import { ProviderSelector } from './ProviderSelector';
import { LocalAIConfig } from './LocalAIConfig';

export function Settings() {
  const {
    settings, setPage, setProviderKey, removeProviderKey,
    validateProvider, setDefaultModel, showToast
  } = useStore();

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [validating, setValidating] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showLocalAI, setShowLocalAI] = useState(false);

  const handleSaveKey = (providerId: string) => {
    if (apiKeyInput.trim()) {
      setProviderKey(providerId, apiKeyInput.trim());
      setEditingProvider(null);
      setApiKeyInput('');
      showToast('success', 'Chave salva!');
    }
  };

  const handleValidate = async (providerId: string) => {
    setValidating(providerId);
    const success = await validateProvider(providerId);
    setValidating(null);
  };

  const configuredProviders = Object.entries(settings.providers).filter(([_, p]) => p.status === 'configured');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border safe-top shrink-0 pl-14 lg:pl-6">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold">Configurações</h1>
          <p className="text-[10px] sm:text-xs text-text-muted">Gerencie provedores de IA e preferências</p>
        </div>
        <ProviderSelector />
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full">
        {/* Security Notice */}
        <div className="flex items-start gap-3 p-4 bg-accent/5 border border-accent/20 rounded-xl mb-6">
          <Shield className="w-5 h-5 text-accent-light shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-accent-light">Segurança das Chaves</h3>
            <p className="text-xs text-text-secondary mt-1">
              Suas API keys são criptografadas e armazenadas apenas no seu navegador. 
              Elas nunca são enviadas para nossos servidores — as chamadas de IA vão direto do seu navegador para o provedor.
            </p>
          </div>
        </div>

        {/* Default Model */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-accent-light" />
            Modelo Padrão
          </h2>
          <div className="p-4 bg-bg-card border border-border rounded-xl">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Provedor</label>
                <select
                  value={settings.defaultProvider}
                  onChange={(e) => setDefaultModel(e.target.value, '')}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Selecionar...</option>
                  {configuredProviders.map(([id, p]) => (
                    <option key={id} value={id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Modelo</label>
                <select
                  value={settings.defaultModel}
                  onChange={(e) => setDefaultModel(settings.defaultProvider, e.target.value)}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Selecionar...</option>
                  {settings.defaultProvider && PROVIDER_DEFINITIONS[settings.defaultProvider]?.models
                    .filter(m => m.type === 'chat')
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))
                  }
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Providers */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Provedores de IA</h2>
          
          {/* Local AI Button */}
          <button
            onClick={() => setShowLocalAI(true)}
            className="w-full mb-3 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl hover:border-purple-500/50 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                <Cpu className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">📱 IA Local (Sem API Key)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rode modelos diretamente no seu celular • Funciona offline • Total privacidade
                </p>
              </div>
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </div>
          </button>

          <div className="space-y-2">
            {Object.entries(PROVIDER_DEFINITIONS).map(([id, def]) => {
              const isConfigured = settings.providers[id]?.status === 'configured';
              const isExpanded = expandedProvider === id;
              const isEditing = editingProvider === id;

              return (
                <div
                  key={id}
                  className={`bg-bg-card border rounded-xl overflow-hidden transition-all ${
                    isConfigured ? 'border-success/30' : 'border-border'
                  }`}
                >
                  {/* Provider Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                    onClick={() => setExpandedProvider(isExpanded ? null : id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{def.icon}</span>
                      <div>
                        <h3 className="text-sm font-semibold">{def.name}</h3>
                        <p className="text-xs text-text-muted">{def.models.length} modelos disponíveis</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConfigured ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">
                          <Check className="w-3 h-3" /> Configurado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary text-text-muted text-xs rounded-full">
                          Não configurado
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border pt-3 animate-fade-in">
                      {/* Models list */}
                      <div className="mb-3">
                        <p className="text-xs text-text-muted mb-1.5">Modelos:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {def.models.map(m => (
                            <span
                              key={m.id}
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                m.type === 'embedding' 
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                  : 'bg-bg-tertiary text-text-secondary'
                              }`}
                            >
                              {m.name}
                              {m.type === 'embedding' && ' 🔢'}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* API Key Input */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={`Cole sua ${def.name} API key...`}
                            className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveKey(id)}
                              disabled={!apiKeyInput.trim()}
                              className="px-3 py-1.5 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => { setEditingProvider(null); setApiKeyInput(''); }}
                              className="px-3 py-1.5 text-text-secondary hover:text-text-primary text-xs transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isConfigured ? (
                            <>
                              <span className="text-xs text-text-muted font-mono">
                                {maskKey(settings.providers[id]?.apiKey || '')}
                              </span>
                              <button
                                onClick={() => { setEditingProvider(id); setApiKeyInput(''); }}
                                className="text-xs text-accent-light hover:underline"
                              >
                                Alterar
                              </button>
                              {validating === id ? (
                                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                              ) : (
                                <button
                                  onClick={() => handleValidate(id)}
                                  className="text-xs text-success hover:underline"
                                >
                                  Validar
                                </button>
                              )}
                              <button
                                onClick={() => removeProviderKey(id)}
                                className="p-1 text-text-muted hover:text-error transition-colors ml-auto"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setEditingProvider(id); setApiKeyInput(''); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent-light border border-accent/30 rounded-lg text-xs hover:bg-accent/20 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Adicionar API Key
                            </button>
                          )}
                        </div>
                      )}

                      {/* Link to get API key */}
                      <a
                        href={def.apiKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-text-muted hover:text-accent-light transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Obter API key em {def.name}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Management */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-accent-light" />
            Gerenciamento de Dados
          </h2>
          <DataManagement />
        </section>

        {/* Architecture Info */}
        <section className="mt-8 p-4 bg-bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-2">🏗️ Arquitetura do Sistema</h3>
          <div className="text-xs text-text-secondary space-y-2">
            <p><strong>Camada de Abstração:</strong> AIProviderAdapter unifica OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama, OpenRouter e IA Local.</p>
            <p><strong>RAG Pipeline:</strong> Chunking → Embedding → Busca Vetorial (cosine similarity) → Contexto → Geração com citações.</p>
            <p><strong>Persistência:</strong> localStorage com chaves criptografadas (XOR + Base64). Em produção: PostgreSQL + AES-256.</p>
            <p><strong>Segurança:</strong> Keys nunca expostas em logs. Proxy backend recomendado para produção.</p>
          </div>
        </section>
      </main>

      {/* Local AI Modal */}
      {showLocalAI && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLocalAI(false)}
          />
          <div className="relative bg-bg-card border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col animate-fade-in shadow-2xl">
            <button
              onClick={() => setShowLocalAI(false)}
              className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Cpu className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">IA Local</h3>
                <p className="text-xs text-text-muted">Baixe e gerencie modelos de IA para rodar no dispositivo</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <LocalAIConfig />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

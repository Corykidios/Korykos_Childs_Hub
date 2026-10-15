import { useState } from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, Check } from 'lucide-react';
import { PROVIDER_DEFINITIONS } from '../../services/ai/adapter';

export function ProviderSelector() {
  const { settings, setDefaultModel, setPage } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  const configuredProviders = Object.entries(settings.providers).filter(([_, p]) => p.status === 'configured');
  
  if (configuredProviders.length === 0) return null;

  const currentProviderDef = PROVIDER_DEFINITIONS[settings.defaultProvider];
  const currentModel = currentProviderDef?.models.find(m => m.id === settings.defaultModel);

  const handleProviderChange = (providerId: string) => {
    const providerDef = PROVIDER_DEFINITIONS[providerId];
    if (providerDef && providerDef.models.length > 0) {
      const firstChatModel = providerDef.models.find(m => m.type === 'chat');
      if (firstChatModel) {
        setDefaultModel(providerId, firstChatModel.id);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors"
      >
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success rounded-full shrink-0" />
        <div className="text-left hidden sm:block">
          <div className="text-xs text-text-primary font-medium">
            {currentProviderDef?.icon} {currentProviderDef?.name || 'Provedor'}
          </div>
          <div className="text-[10px] text-text-muted">
            {currentModel?.name || 'Modelo'}
          </div>
        </div>
        <div className="sm:hidden">
          <span className="text-xs text-text-primary font-medium">
            {currentProviderDef?.icon}
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
            <div className="p-2 border-b border-border">
              <p className="text-[10px] text-text-muted uppercase tracking-wider px-2 py-1">
                Selecionar Provedor
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {configuredProviders.map(([id, provider]) => {
                // Sempre usar os modelos atualizados de PROVIDER_DEFINITIONS
                const providerDef = PROVIDER_DEFINITIONS[id];
                const chatModels = providerDef?.models.filter(m => m.type === 'chat') || [];
                const isSelected = id === settings.defaultProvider;

                return (
                  <div key={id} className="mb-1">
                    <button
                      onClick={() => handleProviderChange(id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-accent/10 border border-accent/30'
                          : 'hover:bg-bg-tertiary'
                      }`}
                    >
                      <span className="text-base shrink-0">{providerDef?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-text-primary">
                            {providerDef?.name}
                          </span>
                          {isSelected && (
                            <Check className="w-3 h-3 text-accent-light shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">
                          {chatModels.length} modelo{chatModels.length !== 1 ? 's' : ''} disponível{chatModels.length !== 1 ? 'is' : ''}
                        </div>
                      </div>
                    </button>

                    {isSelected && chatModels.length > 0 && (
                      <div className="ml-8 mt-1 mb-2 space-y-0.5">
                        {chatModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => {
                              setDefaultModel(id, model.id);
                              setIsOpen(false);
                            }}
                            className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors ${
                              model.id === settings.defaultModel
                                ? 'bg-accent/20 text-accent-light font-medium'
                                : 'text-text-secondary hover:bg-bg-tertiary'
                            }`}
                          >
                            {model.name}
                            {model.id === settings.defaultModel && (
                              <Check className="w-3 h-3 inline ml-1" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-2 border-t border-border">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setPage('settings');
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-accent-light hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                + Configurar provedores
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

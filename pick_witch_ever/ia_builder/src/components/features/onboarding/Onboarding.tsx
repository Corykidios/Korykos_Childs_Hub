import { useState } from 'react';
import { useStore } from '../store/useStore';
import { PROVIDER_DEFINITIONS } from '../../services/ai/adapter';
import { Sparkles, ArrowRight, Key, BookOpen, Brain, Zap } from 'lucide-react';

export function Onboarding() {
  const { setProviderKey, completeOnboarding, showToast } = useStore();
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      setProviderKey(selectedProvider, apiKey.trim());
      showToast('success', 'Chave salva com sucesso!');
    }
    setStep(2);
  };

  const steps = [
    {
      title: 'Bem-vindo ao OpenNotebook AI',
      subtitle: 'Sua plataforma de pesquisa inteligente com suporte a múltiplos provedores de IA',
      icon: <Sparkles className="w-16 h-16 text-accent" />,
      content: (
        <div className="space-y-4 text-text-secondary">
          <p>O OpenNotebook AI é inspirado no NotebookLM do Google, mas com um diferencial:</p>
          <ul className="space-y-2 ml-4">
            <li className="flex items-start gap-2">
              <Brain className="w-5 h-5 text-accent-light mt-0.5 shrink-0" />
              <span><strong className="text-text-primary">Multi-Provider:</strong> Use OpenAI, Anthropic, Google Gemini, Groq, Mistral, Ollama e mais</span>
            </li>
            <li className="flex items-start gap-2">
              <BookOpen className="w-5 h-5 text-accent-light mt-0.5 shrink-0" />
              <span><strong className="text-text-primary">RAG Inteligente:</strong> Upload de documentos, busca vetorial e citações automáticas</span>
            </li>
            <li className="flex items-start gap-2">
              <Zap className="w-5 h-5 text-accent-light mt-0.5 shrink-0" />
              <span><strong className="text-text-primary">Ferramentas de Análise:</strong> Resumos, flashcards, FAQs, mapas mentais e mais</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Configure seu primeiro provedor',
      subtitle: 'Adicione uma API key para começar a usar a IA',
      icon: <Key className="w-16 h-16 text-accent" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PROVIDER_DEFINITIONS).map(([id, def]) => (
              <button
                key={id}
                onClick={() => setSelectedProvider(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  selectedProvider === id
                    ? 'border-accent bg-accent/10 text-text-primary'
                    : 'border-border bg-bg-secondary text-text-secondary hover:border-accent/50'
                }`}
              >
                <span>{def.icon}</span>
                <span>{def.name}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">
              API Key ({PROVIDER_DEFINITIONS[selectedProvider]?.name})
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Cole sua ${PROVIDER_DEFINITIONS[selectedProvider]?.name} API key...`}
              className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <a
              href={PROVIDER_DEFINITIONS[selectedProvider]?.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-light hover:underline"
            >
              → Obter API key em {PROVIDER_DEFINITIONS[selectedProvider]?.name}
            </a>
          </div>
          <p className="text-xs text-text-muted">
            💡 Suas chaves são criptografadas e armazenadas localmente. Você pode adicionar mais provedores depois nas configurações.
          </p>
        </div>
      ),
    },
    {
      title: 'Tudo pronto!',
      subtitle: 'Comece a explorar o poder da IA com suas fontes',
      icon: <Sparkles className="w-16 h-16 text-success" />,
      content: (
        <div className="space-y-4 text-text-secondary">
          <p>Agora você pode:</p>
          <ul className="space-y-2 ml-4">
            <li>📚 Criar notebooks para organizar suas pesquisas</li>
            <li>📄 Upload de PDFs, textos, URLs e vídeos do YouTube</li>
            <li>💬 Conversar com a IA sobre suas fontes</li>
            <li>📊 Gerar resumos, flashcards e análises automáticas</li>
            <li>🔀 Trocar entre modelos de IA a qualquer momento</li>
          </ul>
          <p className="text-sm">Você pode adicionar mais provedores e configurar tudo nas <strong>Configurações</strong>.</p>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="h-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-lg w-full my-auto">
        <div className="bg-bg-card border border-border rounded-2xl p-5 sm:p-8 animate-fade-in">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'bg-accent w-6' : i < step ? 'bg-accent/50' : 'bg-border'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            {currentStep.icon}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">{currentStep.title}</h1>
          <p className="text-text-secondary text-center mb-6">{currentStep.subtitle}</p>

          {/* Content */}
          <div className="mb-8">{currentStep.content}</div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Voltar
              </button>
            ) : (
              <div />
            )}
            
            {step < steps.length - 1 ? (
              <button
                onClick={() => step === 1 ? handleSaveKey() : setStep(step + 1)}
                className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
              >
                {step === 1 ? 'Salvar e Continuar' : 'Próximo'}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={completeOnboarding}
                className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
              >
                Começar a Usar
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

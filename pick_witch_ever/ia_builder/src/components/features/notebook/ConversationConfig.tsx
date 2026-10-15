import { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, BookOpen, GraduationCap, Settings2, Check, Search } from 'lucide-react';
import { ConversationMode, ResponseLength } from '../../types';

interface Props {
  notebookId: string;
  onClose: () => void;
}

export function ConversationConfig({ notebookId, onClose }: Props) {
  const { notebooks, updateNotebook } = useStore();
  const notebook = notebooks.find(n => n.id === notebookId);
  
  const currentConfig = notebook?.settings.conversationConfig || {
    mode: 'default' as ConversationMode,
    responseLength: 'default' as ResponseLength,
    customInstructions: '',
    role: '',
    tone: '',
    socraticConfig: {
      askQuestions: true,
      identifyGaps: true,
      suggestResearch: true,
    },
  };

  const [mode, setMode] = useState<ConversationMode>(currentConfig.mode);
  const [responseLength, setResponseLength] = useState<ResponseLength>(currentConfig.responseLength);
  const [customInstructions, setCustomInstructions] = useState(currentConfig.customInstructions || '');
  const [role, setRole] = useState(currentConfig.role || '');
  const [tone, setTone] = useState(currentConfig.tone || '');
  const [askQuestions, setAskQuestions] = useState(currentConfig.socraticConfig?.askQuestions ?? true);
  const [identifyGaps, setIdentifyGaps] = useState(currentConfig.socraticConfig?.identifyGaps ?? true);
  const [suggestResearch, setSuggestResearch] = useState(currentConfig.socraticConfig?.suggestResearch ?? true);

  const handleSave = () => {
    if (!notebook) return;

    const newConfig = {
      mode,
      responseLength,
      customInstructions: mode === 'custom' ? customInstructions : '',
      role: mode === 'custom' ? role : '',
      tone: mode === 'custom' ? tone : '',
      socraticConfig: mode === 'socratic_discovery' ? {
        askQuestions,
        identifyGaps,
        suggestResearch,
      } : undefined,
    };

    updateNotebook(notebookId, {
      settings: {
        ...notebook.settings,
        conversationConfig: newConfig,
      },
    });

    onClose();
  };

  const modes = [
    {
      id: 'default' as ConversationMode,
      icon: BookOpen,
      title: 'Padrão',
      description: 'Ideal para pesquisas gerais e discutir ideias.',
      color: 'blue',
    },
    {
      id: 'learning_guide' as ConversationMode,
      icon: GraduationCap,
      title: 'Guia de Aprendizagem',
      description: 'Melhor opção para conteúdo educacional. Ajuda a entender novos conceitos e habilidades de maneira eficaz.',
      color: 'green',
    },
    {
      id: 'socratic_discovery' as ConversationMode,
      icon: Search,
      title: 'Descoberta Socrática',
      description: 'A IA não dá respostas. Faz perguntas que levam VOCÊ a descobrir. Identifica lacunas nas fontes e sugere o que pesquisar.',
      color: 'orange',
    },
    {
      id: 'custom' as ConversationMode,
      icon: Settings2,
      title: 'Personalizado',
      description: 'Defina sua meta, estilo ou papel na conversa.',
      color: 'purple',
    },
  ];

  const responseLengths = [
    { id: 'short' as ResponseLength, label: 'Mais curta', description: 'Respostas concisas e diretas' },
    { id: 'default' as ResponseLength, label: 'Padrão', description: 'Equilíbrio entre detalhe e concisão' },
    { id: 'long' as ResponseLength, label: 'Mais longa', description: 'Respostas detalhadas e completas' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-bg-card border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col animate-fade-in shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-bold mb-1">Configurar Conversas</h2>
          <p className="text-sm text-text-secondary">
            Personalize este notebook para alcançar diferentes objetivos
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Modo da Conversa */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Defina sua meta, estilo ou papel na conversa</h3>
            <div className="space-y-2">
              {modes.map((m) => {
                const Icon = m.icon;
                const isSelected = mode === m.id;
                
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg-secondary hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-accent/20' : 'bg-bg-tertiary'
                      }`}>
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-accent-light' : 'text-text-muted'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-sm font-semibold ${isSelected ? 'text-accent-light' : 'text-text-primary'}`}>
                            {m.title}
                          </h4>
                          {isSelected && <Check className="w-4 h-4 text-accent-light" />}
                        </div>
                        <p className="text-xs text-text-secondary">{m.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configurações Personalizadas */}
          {mode === 'custom' && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  Papel da IA (opcional)
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Ex: Especialista em direito digital, Professor de matemática..."
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  Tom da conversa (opcional)
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Ex: Formal, Casual, Acadêmico, Didático..."
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  Instruções personalizadas
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Descreva como a IA deve responder, que tipo de informações priorizar, que estilo usar..."
                  rows={4}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>
          )}

          {/* Configurações Socráticas */}
          {mode === 'socratic_discovery' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-xs text-orange-200">
                  💡 <strong>Como funciona:</strong> A IA fará perguntas em vez de dar respostas, ajudando você a descobrir o conhecimento por conta própria. Também identificará lacunas nas suas fontes e sugerirá o que pesquisar.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-bg-secondary border border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={askQuestions}
                    onChange={(e) => setAskQuestions(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">Fazer perguntas socráticas</div>
                    <div className="text-xs text-text-secondary">A IA fará perguntas que levam você a descobrir a resposta</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-bg-secondary border border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={identifyGaps}
                    onChange={(e) => setIdentifyGaps(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">Identificar lacunas nas fontes</div>
                    <div className="text-xs text-text-secondary">Mostra o que FALTA nas suas fontes de conhecimento</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-bg-secondary border border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={suggestResearch}
                    onChange={(e) => setSuggestResearch(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">Sugerir o que pesquisar</div>
                    <div className="text-xs text-text-secondary">Recomenda tópicos e fontes para complementar seu conhecimento</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Tamanho da Resposta */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Escolha o tamanho da resposta</h3>
            <div className="grid grid-cols-3 gap-2">
              {responseLengths.map((rl) => {
                const isSelected = responseLength === rl.id;
                
                return (
                  <button
                    key={rl.id}
                    onClick={() => setResponseLength(rl.id)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg-secondary hover:border-accent/50'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isSelected ? 'text-accent-light' : 'text-text-primary'}`}>
                      {rl.label}
                    </div>
                    <div className="text-[10px] text-text-secondary">{rl.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-medium transition-colors"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}

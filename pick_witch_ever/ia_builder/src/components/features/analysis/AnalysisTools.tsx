import { useState } from 'react';
import { useStore } from '../store/useStore';
import { AnalysisType } from '../../types';
import {
  FileText, ListChecks, HelpCircle, Map, GitCompare,
  Clock, Lightbulb, Newspaper, Loader2, Copy, Check, Download, Share2
} from 'lucide-react';
import { generatePDF, downloadPDF, sharePDF } from '../../utils/pdf-generator';

interface Props {
  notebookId: string;
}

const ANALYSIS_TOOLS: { type: AnalysisType; icon: typeof FileText; label: string; description: string }[] = [
  { type: 'summary', icon: FileText, label: 'Resumo Executivo', description: 'Resumo completo e estruturado de todas as fontes' },
  { type: 'flashcards', icon: ListChecks, label: 'Flashcards', description: 'Cartões de estudo com perguntas e respostas' },
  { type: 'faq', icon: HelpCircle, label: 'FAQ Automático', description: 'Perguntas frequentes baseadas nas fontes' },
  { type: 'mindmap', icon: Map, label: 'Mapa Mental', description: 'Estrutura visual das conexões entre conceitos' },
  { type: 'comparison', icon: GitCompare, label: 'Tabela Comparativa', description: 'Comparação de perspectivas das fontes' },
  { type: 'timeline', icon: Clock, label: 'Cronologia', description: 'Linha do tempo dos eventos e informações' },
  { type: 'insights', icon: Lightbulb, label: 'Insights', description: 'Conexões e padrões não óbvios entre fontes' },
  { type: 'article', icon: Newspaper, label: 'Gerar Artigo', description: 'Artigo completo sintetizando as fontes' },
];

export function AnalysisTools({ notebookId }: Props) {
  const { notebooks, runAnalysis, isStreaming, showToast } = useStore();
  const notebook = notebooks.find(n => n.id === notebookId);
  const [result, setResult] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<AnalysisType | null>(null);
  const [resultToolType, setResultToolType] = useState<AnalysisType | null>(null);
  const [copied, setCopied] = useState(false);

  if (!notebook) return null;

  const handleRun = async (type: AnalysisType) => {
    setActiveTool(type);
    setResult(null);
    const output = await runAnalysis(notebookId, type);
    if (output) {
      setResult(output);
      setResultToolType(type);
    }
    setActiveTool(null);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveAsNote = () => {
    if (result && resultToolType) {
      const tool = ANALYSIS_TOOLS.find(t => t.type === resultToolType);
      const { createNote } = useStore.getState();
      createNote(notebookId, `${tool?.label || 'Análise'} - ${new Date().toLocaleDateString()}`, result);
      showToast('success', 'Salvo nas notas!');
    }
  };

  const handleExportPDF = () => {
    if (!result || !resultToolType) return;
    const tool = ANALYSIS_TOOLS.find(t => t.type === resultToolType);
    const notebook = notebooks.find(n => n.id === notebookId);
    
    const doc = generatePDF({
      title: tool?.label || 'Análise',
      subtitle: `Notebook: ${notebook?.name || 'Sem nome'}`,
      content: result,
      footer: 'Gerado por OpenNotebook AI',
    });
    
    const filename = `${tool?.label || 'analise'}-${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(doc, filename);
    showToast('success', 'PDF exportado!');
  };

  const handleSharePDF = async () => {
    if (!result || !resultToolType) return;
    const tool = ANALYSIS_TOOLS.find(t => t.type === resultToolType);
    const notebook = notebooks.find(n => n.id === notebookId);
    
    const doc = generatePDF({
      title: tool?.label || 'Análise',
      subtitle: `Notebook: ${notebook?.name || 'Sem nome'}`,
      content: result,
      footer: 'Gerado por OpenNotebook AI',
    });
    
    const title = `${tool?.label || 'Análise'} - ${notebook?.name || 'OpenNotebook'}`;
    const shared = await sharePDF(doc, title);
    
    if (!shared) {
      // Fallback: baixar PDF se compartilhamento não suportado
      const filename = `${tool?.label || 'analise'}-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPDF(doc, filename);
      showToast('info', 'PDF baixado (compartilhamento não suportado)');
    }
  };

  const readySources = notebook.sources.filter(s => s.status === 'ready' && s.enabled);

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      <div className="mb-3 sm:mb-4">
        <h2 className="text-sm font-semibold">Ferramentas de Análise</h2>
        <p className="text-xs text-text-muted">
          {readySources.length} fonte{readySources.length !== 1 ? 's' : ''} pronta{readySources.length !== 1 ? 's' : ''} para análise
        </p>
      </div>

      {readySources.length === 0 && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl mb-4">
          <p className="text-xs text-warning">
            ⚠️ Adicione e processe fontes antes de usar as ferramentas de análise.
          </p>
        </div>
      )}

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {ANALYSIS_TOOLS.map((tool) => (
          <button
            key={tool.type}
            onClick={() => handleRun(tool.type)}
            disabled={isStreaming || readySources.length === 0}
            className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 bg-bg-card border border-border rounded-xl text-left hover:border-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              {isStreaming && activeTool === tool.type ? (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              ) : (
                <tool.icon className="w-4 h-4 text-accent-light" />
              )}
            </div>
            <div>
              <h4 className="text-xs font-semibold">{tool.label}</h4>
              <p className="text-[11px] text-text-muted mt-0.5">{tool.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Result */}
      {result && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Resultado</h3>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1 px-2 py-1 text-xs text-success hover:text-success/80 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={handleSharePDF}
                className="flex items-center gap-1 px-2 py-1 text-xs text-accent-light hover:text-accent transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>
              <button
                onClick={handleSaveAsNote}
                className="flex items-center gap-1 px-2 py-1 text-xs text-accent-light hover:text-accent transition-colors"
              >
                <span className="hidden sm:inline">💾 Salvar como nota</span>
                <span className="sm:hidden">💾</span>
              </button>
            </div>
          </div>
          <div className="p-4 bg-bg-card border border-border rounded-xl">
            <div className="markdown-content text-sm text-text-secondary max-h-96 overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: formatMarkdown(result) }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

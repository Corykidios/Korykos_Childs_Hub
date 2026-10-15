import { useStore } from '../store/useStore';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export function Toast() {
  const { toastMessage, clearToast } = useStore();

  if (!toastMessage) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-error" />,
    info: <Info className="w-5 h-5 text-accent-light" />,
  };

  const bgColors = {
    success: 'bg-success/10 border-success/30',
    error: 'bg-error/10 border-error/30',
    info: 'bg-accent/10 border-accent/30',
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-fade-in">
      <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border backdrop-blur-sm ${bgColors[toastMessage.type]}`}>
        {icons[toastMessage.type]}
        <span className="text-xs sm:text-sm font-medium flex-1">{toastMessage.text}</span>
        <button onClick={clearToast} className="ml-2 text-text-muted hover:text-text-primary shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

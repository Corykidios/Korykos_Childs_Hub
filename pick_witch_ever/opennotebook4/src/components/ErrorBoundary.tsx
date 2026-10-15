import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in NotebookLM:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#f0f4f9] dark:bg-[#0e1117] text-gray-900 dark:text-[#e3e3e3] select-none">
          <div className="max-w-lg w-full bg-white dark:bg-[#181a20] border border-gray-200 dark:border-[#2e3442] rounded-3xl p-8 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">Something unexpected occurred</h2>
              <p className="text-sm text-gray-600 dark:text-[#9aa0a6] leading-relaxed">
                NotebookLM encountered an issue while rendering this view. Your saved notebook data and sources in local storage remain safe.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left bg-gray-50 dark:bg-[#12141a] border border-gray-200 dark:border-[#282d3a] rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400 font-mono">
                <summary className="cursor-pointer text-gray-500 dark:text-[#8a919e] font-sans hover:underline">
                  View technical error details
                </summary>
                <div className="mt-2 overflow-x-auto whitespace-pre-wrap select-text">
                  {this.state.error.toString()}
                </div>
              </details>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#383e4e] bg-gray-100 hover:bg-gray-200 dark:bg-[#202530] dark:hover:bg-[#282f3d] text-xs font-semibold text-gray-800 dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Workspace</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

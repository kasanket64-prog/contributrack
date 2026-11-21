import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onResetToDashboard?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ContribuTrack UI ErrorBoundary caught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center bg-[#030712] p-6 text-white">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/25 bg-[#070E1F] p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-base font-black text-white">Something went wrong in this frame</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
              The rest of the application is unaffected. You can retry rendering this view or jump back to the Dashboard.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-rose-300 break-words">
              {this.state.errorMessage}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20"
              >
                <RefreshCw size={13} /> Try Again
              </button>
              {this.props.onResetToDashboard && (
                <button
                  type="button"
                  onClick={() => {
                    this.handleReset();
                    this.props.onResetToDashboard?.();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10"
                >
                  <Home size={13} /> Back to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

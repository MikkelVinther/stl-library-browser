import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-gray-900 border border-red-900/50 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-lg font-bold text-red-400 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-400 mb-4">
              The application encountered an unexpected error. Try reloading the window.
            </p>
            <pre className="text-xs text-gray-600 bg-gray-950 rounded-lg p-3 text-left overflow-auto max-h-40 mb-4">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

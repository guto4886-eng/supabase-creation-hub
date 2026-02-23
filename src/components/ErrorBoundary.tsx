import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md text-center p-8 space-y-4 shadow-xl">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Ocorreu um erro!</h2>
            <p className="text-sm text-muted-foreground">
              Desculpe-nos pelo transtorno. Tente recarregar a página.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3 font-mono break-all max-h-20 overflow-auto">
                {this.state.error.message}
              </p>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={this.handleDismiss}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm"
              >
                Ignorar
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Caso o erro persista, entre em contato conosco.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

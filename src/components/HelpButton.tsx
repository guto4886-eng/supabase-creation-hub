import { useState, useEffect } from "react";
import { HelpCircle, X, ExternalLink, MessageCircle, BookOpen, Search, GraduationCap, AlertTriangle, RefreshCw } from "lucide-react";

const helpLinks = [
  { icon: GraduationCap, label: "Central de Treinamento", url: "https://ajuda.obraprima.eng.br/kb", external: true },
  { icon: BookOpen, label: "Central de Ajuda", url: "https://ajuda.obraprima.eng.br/kb", external: true },
  { icon: MessageCircle, label: "Fale Conosco", url: "mailto:suporte@obraprima.eng.br", external: true },
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showError, setShowError] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Listen for global unhandled errors to show inline error bubble
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      e.preventDefault();
      setShowError(true);
    };
    const rejHandler = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      setShowError(true);
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rejHandler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", rejHandler);
    };
  }, []);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q.length < 3) return;
    window.open(`https://ajuda.obraprima.eng.br/kb?q=${encodeURIComponent(q)}`, "_blank");
    setSearchQuery("");
    setOpen(false);
  };

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMinimized(false)}
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center"
          title="Ajuda"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Error bubble */}
      {showError && !open && (
        <div className="absolute bottom-14 right-0 w-72 bg-card border border-destructive/30 rounded-xl shadow-lg overflow-hidden mb-2 animate-in slide-in-from-bottom-2">
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Ocorreu um erro!</p>
                <p className="text-xs text-muted-foreground mt-1">Desculpe-nos pelo transtorno.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => location.reload()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
              >
                <RefreshCw className="h-3 w-3" /> Recarregar
              </button>
              <button
                onClick={() => setShowError(false)}
                className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                Ignorar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help menu */}
      {open && (
        <div className="absolute bottom-14 right-0 w-72 bg-card border border-border rounded-xl shadow-lg overflow-hidden mb-2">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <p className="text-sm font-semibold text-card-foreground">Posso ajudar? 👋</p>
            <p className="text-xs text-muted-foreground">Pesquise ou escolha uma opção</p>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-border">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Digite sua dúvida..."
                className="w-full pl-3 pr-8 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={handleSearch} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="py-1">
            {helpLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                onClick={() => setOpen(false)}
              >
                <link.icon className="h-4 w-4 text-primary" />
                <span className="text-sm text-card-foreground">{link.label}</span>
                {link.external && <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />}
              </a>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={() => { setMinimized(true); setOpen(false); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Minimizar assistente
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => { setOpen(!open); if (showError) setShowError(false); }}
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center"
        title="Ajuda"
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}

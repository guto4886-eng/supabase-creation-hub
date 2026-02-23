import { useState } from "react";
import { HelpCircle, X, ExternalLink, MessageCircle, BookOpen, Mail } from "lucide-react";

const helpLinks = [
  { icon: BookOpen, label: "Central de Ajuda", url: "https://ajuda.obraprima.eng.br/kb", external: true },
  { icon: MessageCircle, label: "Fale Conosco", url: "mailto:suporte@obraprima.eng.br", external: true },
  { icon: ExternalLink, label: "Documentação", url: "https://ajuda.obraprima.eng.br/kb", external: true },
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-14 right-0 w-64 bg-card border border-border rounded-xl shadow-lg overflow-hidden mb-2">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <p className="text-sm font-semibold text-card-foreground">Posso ajudar?</p>
            <p className="text-xs text-muted-foreground">Escolha uma opção abaixo</p>
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
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center"
        title="Ajuda"
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}

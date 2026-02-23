import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Check, Star } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: "Grátis",
    features: ["1 obra ativa", "5 orçamentos/mês", "Suporte por email"],
    current: true,
  },
  {
    name: "Profissional",
    price: "R$ 99/mês",
    features: ["Obras ilimitadas", "Orçamentos ilimitados", "Exportação avançada", "Suporte prioritário"],
    recommended: true,
  },
  {
    name: "Enterprise",
    price: "R$ 249/mês",
    features: ["Tudo do Profissional", "Multi-usuários", "API de integração", "Gestor de conta dedicado"],
  },
];

export default function Plans() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Meu Plano</h2>
        <p className="text-muted-foreground mt-1">Gerencie sua assinatura e serviços</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative border rounded-xl p-6 flex flex-col ${
              plan.recommended
                ? "border-primary shadow-lg ring-2 ring-primary/20"
                : "border-border"
            }`}
          >
            {plan.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center gap-1">
                <Star className="h-3 w-3" /> Recomendado
              </div>
            )}
            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {plan.name}
                {plan.current && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Atual</span>}
              </h3>
              <p className="text-2xl font-bold text-foreground mt-2">{plan.price}</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                plan.current
                  ? "border border-border text-muted-foreground cursor-default"
                  : plan.recommended
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border text-foreground hover:bg-muted"
              }`}
              disabled={plan.current}
            >
              {plan.current ? "Plano atual" : "Assinar"}
            </button>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-2">Informações da conta</h3>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano</span>
            <span className="text-foreground">Básico</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="text-primary font-medium">Ativo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

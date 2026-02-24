import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Check, Star, CreditCard, History } from "lucide-react";

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

type Tab = "assinatura" | "pagamentos" | "historico";

export default function Plans() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("assinatura");

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "assinatura", label: "Assinatura", icon: Crown },
    { key: "pagamentos", label: "Pagamentos", icon: CreditCard },
    { key: "historico", label: "Histórico de alterações", icon: History },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Meu Plano</h2>
        <p className="text-muted-foreground mt-1">Gerencie sua assinatura e serviços</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Assinatura */}
      {tab === "assinatura" && (
        <>
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
        </>
      )}

      {/* Pagamentos */}
      {tab === "pagamentos" && (
        <div className="border border-border rounded-xl p-6">
          <div className="text-center py-8 space-y-3">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-foreground">Nenhum pagamento registrado</h3>
            <p className="text-sm text-muted-foreground">
              Seus pagamentos aparecerão aqui quando você assinar um plano pago.
            </p>
          </div>
        </div>
      )}

      {/* Histórico */}
      {tab === "historico" && (
        <div className="border border-border rounded-xl p-6">
          <div className="text-center py-8 space-y-3">
            <History className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-foreground">Nenhuma alteração registrada</h3>
            <p className="text-sm text-muted-foreground">
              O histórico de alterações do seu plano aparecerá aqui.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

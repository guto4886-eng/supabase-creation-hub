// Normalização de tags para o módulo Central de Custos.
// Mapeia variações de itens (marcas, tipos, embalagens) em tags principais.

const TAG_RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "cimento", patterns: [/cimento/i, /\bcp\s*ii?\b/i, /votoran/i, /portland/i] },
  { tag: "areia", patterns: [/areia/i] },
  { tag: "brita", patterns: [/brita/i, /pedra\s*brita/i] },
  { tag: "tijolo", patterns: [/tijolo/i, /bloco\s*ceramico/i] },
  { tag: "bloco", patterns: [/bloco\s*(estrutural|concreto)/i] },
  { tag: "argamassa", patterns: [/argamassa/i, /quartzolit/i, /votomassa/i] },
  { tag: "vergalhao", patterns: [/vergalhao|vergalhão/i, /\bca[-\s]?50\b/i, /aço\s*ca/i] },
  { tag: "ferro", patterns: [/\bferro\b/i, /barra\s*de\s*aco/i] },
  { tag: "tinta", patterns: [/tinta/i, /suvinil/i, /coral/i, /sherwin/i] },
  { tag: "madeira", patterns: [/madeira|tabua|sarrafo|caibro|pontalete|compensado/i] },
  { tag: "tubo", patterns: [/\btubo\b|cano\s*pvc|tigre|amanco/i] },
  { tag: "conexao", patterns: [/conex(ao|ão)|joelho|luva|tê\s*pvc|cotovelo/i] },
  { tag: "fiacao", patterns: [/fio|cabo|fiacao|fiação|prysmian|nambei/i] },
  { tag: "eletroduto", patterns: [/eletroduto/i] },
  { tag: "telha", patterns: [/telha/i] },
  { tag: "porcelanato", patterns: [/porcelanato|piso\s*ceramico|revestimento\s*ceramico/i] },
  { tag: "louca", patterns: [/vaso\s*sanit|bacia|cuba|louca|deca|celite/i] },
  { tag: "torneira", patterns: [/torneira|misturador|registro/i] },
  { tag: "epi", patterns: [/\bepi\b|capacete|luva|botina|oculos\s*proteç/i] },
  { tag: "ferramenta", patterns: [/furadeira|martelo|serra|esmerilhadeira|betoneira|ferramenta/i] },
  { tag: "combustivel", patterns: [/diesel|gasolina|combust(ivel|ível)/i] },
  { tag: "alimentacao", patterns: [/marmita|aliment|lanche|refei(cao|ção)/i] },
  { tag: "transporte", patterns: [/frete|transporte|caminhao|caminhão|uber/i] },
];

export function normalizeTags(name: string, category?: string | null): string[] {
  const text = `${name || ""} ${category || ""}`.toLowerCase();
  const matched = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.patterns.some((p) => p.test(text))) matched.add(rule.tag);
  }
  if (matched.size === 0) {
    // fallback: primeira palavra significativa
    const firstWord = text
      .replace(/[^a-záéíóúâêôãõç\s]/gi, " ")
      .trim()
      .split(/\s+/)[0];
    if (firstWord && firstWord.length > 2) matched.add(firstWord);
  }
  return Array.from(matched);
}

export const COST_TYPES = [
  { value: "material", label: "Material", icon: "📦" },
  { value: "funcionario", label: "Funcionário", icon: "👷" },
  { value: "equipamento", label: "Equipamento", icon: "🛠️" },
  { value: "transporte", label: "Transporte", icon: "🚚" },
  { value: "alimentacao", label: "Alimentação", icon: "🍱" },
  { value: "servico", label: "Serviço", icon: "🧰" },
  { value: "outros", label: "Outros", icon: "📌" },
];

export const PAYMENT_METHODS = [
  "Dinheiro",
  "Pix",
  "Cartão Débito",
  "Cartão Crédito",
  "Boleto",
  "Transferência",
  "Cheque",
];

export const UNITS = ["un", "kg", "g", "m", "m²", "m³", "L", "saco", "pç", "h", "dia"];

export function formatBRL(value: number | null | undefined): string {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

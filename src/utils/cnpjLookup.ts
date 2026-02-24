export interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
}

export async function fetchCnpj(cnpj: string): Promise<CnpjData | null> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      razao_social: data.razao_social || "",
      nome_fantasia: data.nome_fantasia || "",
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      municipio: data.municipio || "",
      uf: data.uf || "",
      cep: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "",
      telefone: data.ddd_telefone_1 || "",
      email: data.email || "",
    };
  } catch {
    return null;
  }
}

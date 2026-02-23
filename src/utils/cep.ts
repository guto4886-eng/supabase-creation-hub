export async function fetchCep(cep: string): Promise<{ city: string; state: string; address: string } | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      city: data.localidade || "",
      state: data.uf || "",
      address: [data.logradouro, data.bairro].filter(Boolean).join(", "),
    };
  } catch {
    return null;
  }
}

-- Adiciona campo fase nos lançamentos de custo
ALTER TABLE public.cc_cost_entries ADD COLUMN IF NOT EXISTS fase TEXT;
CREATE INDEX IF NOT EXISTS idx_cc_cost_entries_fase ON public.cc_cost_entries(obra_id, fase);

-- Tabela de fases customizadas pelo usuário
CREATE TABLE IF NOT EXISTS public.cc_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT,
  icone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cc_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc phases"
ON public.cc_phases FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_phases_user_nome ON public.cc_phases(user_id, lower(nome));
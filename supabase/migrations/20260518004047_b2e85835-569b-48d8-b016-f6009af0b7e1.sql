
-- Tabela de lançamentos de custos
CREATE TABLE public.cc_cost_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'material',
  nome_item TEXT NOT NULL,
  categoria TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  quantidade NUMERIC DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT,
  fornecedor TEXT,
  funcionario_id UUID,
  observacao TEXT,
  comprovante_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_cost_entries_obra ON public.cc_cost_entries(obra_id);
CREATE INDEX idx_cc_cost_entries_user ON public.cc_cost_entries(user_id);
CREATE INDEX idx_cc_cost_entries_data ON public.cc_cost_entries(data);
CREATE INDEX idx_cc_cost_entries_tags ON public.cc_cost_entries USING GIN(tags);

ALTER TABLE public.cc_cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc cost entries"
ON public.cc_cost_entries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_cc_cost_entries_updated
BEFORE UPDATE ON public.cc_cost_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Funcionários da central
CREATE TABLE public.cc_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  nome TEXT NOT NULL,
  funcao TEXT,
  valor_diaria NUMERIC DEFAULT 0,
  valor_mensal NUMERIC DEFAULT 0,
  data_entrada DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_employees_obra ON public.cc_employees(obra_id);
CREATE INDEX idx_cc_employees_user ON public.cc_employees(user_id);

ALTER TABLE public.cc_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc employees"
ON public.cc_employees FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_cc_employees_updated
BEFORE UPDATE ON public.cc_employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configurações da obra (orçamento, alertas, etc.)
CREATE TABLE public.cc_obra_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  obra_id UUID NOT NULL UNIQUE,
  orcamento_previsto NUMERIC DEFAULT 0,
  meta_margem NUMERIC DEFAULT 0,
  alerta_estouro_pct NUMERIC DEFAULT 90,
  obra_publica BOOLEAN DEFAULT FALSE,
  imagem_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_obra_settings_user ON public.cc_obra_settings(user_id);

ALTER TABLE public.cc_obra_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc obra settings"
ON public.cc_obra_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_cc_obra_settings_updated
BEFORE UPDATE ON public.cc_obra_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anexos do módulo
CREATE TABLE public.cc_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  obra_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_attachments_obra ON public.cc_attachments(obra_id);
CREATE INDEX idx_cc_attachments_user ON public.cc_attachments(user_id);

ALTER TABLE public.cc_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc attachments"
ON public.cc_attachments FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Bucket para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('cc-comprovantes', 'cc-comprovantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own cc comprovantes"
ON storage.objects FOR SELECT
USING (bucket_id = 'cc-comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own cc comprovantes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cc-comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own cc comprovantes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'cc-comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own cc comprovantes"
ON storage.objects FOR DELETE
USING (bucket_id = 'cc-comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

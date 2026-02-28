
-- Encargos trabalhistas do colaborador
CREATE TABLE public.labor_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_id uuid NOT NULL REFERENCES public.obra_labor(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  charge_type text NOT NULL, -- inss, fgts, irrf, vale_transporte, desconto_faltas, etc
  description text,
  percentage numeric DEFAULT 0,
  fixed_value numeric DEFAULT 0,
  reference_month text, -- YYYY-MM
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labor_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own labor charges" ON public.labor_charges FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Benefícios do colaborador
CREATE TABLE public.labor_benefits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_id uuid NOT NULL REFERENCES public.obra_labor(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  benefit_type text NOT NULL, -- vale_refeicao, vale_alimentacao, plano_saude, plano_odonto, seguro_vida, cesta_basica, etc
  description text,
  value numeric DEFAULT 0,
  discount_value numeric DEFAULT 0,
  provider text,
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labor_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own labor benefits" ON public.labor_benefits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- EPIs do colaborador
CREATE TABLE public.labor_epis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_id uuid NOT NULL REFERENCES public.obra_labor(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  epi_name text NOT NULL, -- capacete, luva, botina, oculos, protetor_auricular, etc
  ca_number text, -- Certificado de Aprovação
  delivery_date date,
  return_date date,
  quantity integer DEFAULT 1,
  status text DEFAULT 'entregue', -- entregue, devolvido, perdido, danificado
  signature boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labor_epis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own labor epis" ON public.labor_epis FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Histórico de alocação do colaborador
CREATE TABLE public.labor_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_id uuid NOT NULL REFERENCES public.obra_labor(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  obra_id uuid REFERENCES public.obras(id),
  start_date date NOT NULL,
  end_date date,
  role text,
  daily_rate numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labor_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own labor allocations" ON public.labor_allocations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

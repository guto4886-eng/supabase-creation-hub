
-- Add new columns to obras
ALTER TABLE public.obras
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER,
ADD COLUMN IF NOT EXISTS duration_unit TEXT DEFAULT 'meses',
ADD COLUMN IF NOT EXISTS cno TEXT,
ADD COLUMN IF NOT EXISTS area_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS empreiteiro TEXT,
ADD COLUMN IF NOT EXISTS resp_tecnico TEXT,
ADD COLUMN IF NOT EXISTS art_number TEXT,
ADD COLUMN IF NOT EXISTS resp_obra TEXT,
ADD COLUMN IF NOT EXISTS billing_cep TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_number TEXT,
ADD COLUMN IF NOT EXISTS billing_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS billing_complement TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_address_source TEXT DEFAULT 'obra',
ADD COLUMN IF NOT EXISTS stock_control BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_type TEXT,
ADD COLUMN IF NOT EXISTS client_access BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_type TEXT,
ADD COLUMN IF NOT EXISTS billing_frequency TEXT DEFAULT 'semanal',
ADD COLUMN IF NOT EXISTS document_type TEXT,
ADD COLUMN IF NOT EXISTS planning_frequency TEXT DEFAULT 'mensal',
ADD COLUMN IF NOT EXISTS tracking_method TEXT DEFAULT 'custo',
ADD COLUMN IF NOT EXISTS work_days TEXT[] DEFAULT ARRAY['seg','ter','qua','qui','sex'];

-- Obra contacts
CREATE TABLE public.obra_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  cellphone TEXT,
  email TEXT,
  notes TEXT,
  origin TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their obra contacts" ON public.obra_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Obra daily entries (dia a dia)
CREATE TABLE public.obra_daily_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_daily_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their obra daily entries" ON public.obra_daily_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Obra admin rates (taxa de administração)
CREATE TABLE public.obra_admin_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cost_type TEXT NOT NULL,
  percentage NUMERIC DEFAULT 0,
  fixed_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_admin_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their obra admin rates" ON public.obra_admin_rates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

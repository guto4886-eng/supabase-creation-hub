
-- Tabela principal de veículos
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  plate TEXT NOT NULL,
  renavam TEXT,
  chassis TEXT,
  brand TEXT,
  model TEXT,
  year_manufacture INTEGER,
  year_model INTEGER,
  color TEXT,
  fuel_type TEXT DEFAULT 'flex',
  category TEXT DEFAULT 'carro',
  owner_name TEXT,
  owner_document TEXT,
  acquisition_date DATE,
  acquisition_value NUMERIC DEFAULT 0,
  km_current NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicles"
  ON public.vehicles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Tabela de documentos/taxas do veículo (licenciamento, IPVA, seguro, multas)
CREATE TABLE public.vehicle_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'licenciamento',
  description TEXT NOT NULL,
  reference_year INTEGER,
  due_date DATE,
  payment_date DATE,
  value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  insurer TEXT,
  policy_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicle documents"
  ON public.vehicle_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de manutenções do veículo
CREATE TABLE public.vehicle_maintenances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'preventiva',
  description TEXT NOT NULL,
  maintenance_date DATE DEFAULT CURRENT_DATE,
  km_at_maintenance NUMERIC,
  next_km NUMERIC,
  next_date DATE,
  supplier_id UUID REFERENCES public.suppliers(id),
  value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicle maintenances"
  ON public.vehicle_maintenances FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela de abastecimentos
CREATE TABLE public.vehicle_fueling (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  fueling_date DATE DEFAULT CURRENT_DATE,
  fuel_type TEXT DEFAULT 'gasolina',
  liters NUMERIC DEFAULT 0,
  price_per_liter NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  km_at_fueling NUMERIC,
  station TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_fueling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicle fueling"
  ON public.vehicle_fueling FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

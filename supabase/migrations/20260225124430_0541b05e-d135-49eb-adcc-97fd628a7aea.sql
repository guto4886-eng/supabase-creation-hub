
-- Add market value and depreciation fields to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS market_value NUMERIC DEFAULT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC DEFAULT NULL;

-- Add IPVA payment mode fields to vehicle_documents
ALTER TABLE public.vehicle_documents ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'unica';
ALTER TABLE public.vehicle_documents ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1;

-- Create vehicle_doc_installments for IPVA installment tracking
CREATE TABLE public.vehicle_doc_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.vehicle_documents(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL DEFAULT 1,
  due_date DATE,
  value NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente',
  payment_date DATE,
  proof_path TEXT,
  proof_file_name TEXT,
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_doc_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicle doc installments"
  ON public.vehicle_doc_installments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create vehicle_insurance table
CREATE TABLE public.vehicle_insurance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  insured_name TEXT,
  insurer TEXT NOT NULL,
  broker TEXT,
  policy_number TEXT,
  start_date DATE,
  end_date DATE,
  premium_value NUMERIC,
  deductible_value NUMERIC,
  coverage_type TEXT,
  payment_method TEXT,
  installment_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'vigente',
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicle insurance"
  ON public.vehicle_insurance FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

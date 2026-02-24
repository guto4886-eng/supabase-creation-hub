
-- Create companies table (matriz and filiais)
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  trade_name TEXT,
  document TEXT,
  company_type TEXT NOT NULL DEFAULT 'matriz',
  parent_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  cellphone TEXT,
  address TEXT,
  address_number TEXT,
  neighborhood TEXT,
  complement TEXT,
  cep TEXT,
  city TEXT,
  state TEXT,
  logo_url TEXT,
  ie TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own companies"
  ON public.companies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add company_id to key tables
ALTER TABLE public.purchase_quotations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.financial_docs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_companies_parent_id ON public.companies(parent_id);
CREATE INDEX idx_purchase_quotations_company_id ON public.purchase_quotations(company_id);
CREATE INDEX idx_obras_company_id ON public.obras(company_id);
CREATE INDEX idx_financial_docs_company_id ON public.financial_docs(company_id);

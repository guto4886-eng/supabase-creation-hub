
-- Supplier bank accounts
CREATE TABLE public.supplier_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bank_name text,
  agency text,
  account text,
  account_type text DEFAULT 'corrente',
  pix_key text,
  pix_type text,
  holder_name text,
  holder_document text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplier bank accounts" ON public.supplier_bank_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Supplier salespeople/contacts (vendedores)
CREATE TABLE public.supplier_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  phone text,
  cellphone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplier contacts" ON public.supplier_contacts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Supplier categories (tags)
CREATE TABLE public.supplier_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplier categories" ON public.supplier_categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Supplier quality ratings
CREATE TABLE public.supplier_quality_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  criterion text NOT NULL,
  rating integer NOT NULL DEFAULT 5,
  evaluation_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_quality_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplier quality ratings" ON public.supplier_quality_ratings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Supplier certifications
CREATE TABLE public.supplier_certifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  issuer text,
  issue_date date,
  expiry_date date,
  certificate_number text,
  status text DEFAULT 'vigente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own supplier certifications" ON public.supplier_certifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

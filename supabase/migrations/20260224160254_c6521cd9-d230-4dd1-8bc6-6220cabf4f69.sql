
-- Add delivery address columns to purchase_quotations
ALTER TABLE public.purchase_quotations 
  ADD COLUMN IF NOT EXISTS delivery_cep TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_complement TEXT,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_source TEXT DEFAULT 'obra';

-- Quotation suppliers (fornecedores vinculados à cotação)
CREATE TABLE public.quotation_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  sent_at TIMESTAMPTZ,
  sent_method TEXT,
  response_value NUMERIC DEFAULT 0,
  response_notes TEXT,
  response_at TIMESTAMPTZ,
  selected BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.quotation_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quotation suppliers"
  ON public.quotation_suppliers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Quotation messages
CREATE TABLE public.quotation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.quotation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quotation messages"
  ON public.quotation_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Quotation linked records
CREATE TABLE public.quotation_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  linked_entity_type TEXT NOT NULL,
  linked_entity_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.quotation_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quotation links"
  ON public.quotation_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

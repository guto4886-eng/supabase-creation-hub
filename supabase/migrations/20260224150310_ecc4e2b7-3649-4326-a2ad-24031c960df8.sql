
CREATE TABLE public.supplier_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  description text NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'un',
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  purchase_date date DEFAULT CURRENT_DATE,
  invoice_number text,
  payment_status text DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own supplier purchases"
  ON public.supplier_purchases FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_supplier_purchases_supplier ON public.supplier_purchases(supplier_id);
CREATE INDEX idx_supplier_purchases_user ON public.supplier_purchases(user_id);

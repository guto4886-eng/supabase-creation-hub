
-- Purchase Requests (Solicitações de Compra)
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'un',
  priority text DEFAULT 'normal',
  status text DEFAULT 'pendente',
  needed_by date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase requests" ON public.purchase_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purchase Quotations (Cotações de Compra)
CREATE TABLE public.purchase_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'rascunho',
  deadline date,
  total_value numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase quotations" ON public.purchase_quotations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purchase Orders (Ordens de Compra)
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  order_code text,
  description text,
  status text DEFAULT 'rascunho',
  order_date date DEFAULT CURRENT_DATE,
  delivery_date date,
  total_value numeric DEFAULT 0,
  payment_terms text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase orders" ON public.purchase_orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

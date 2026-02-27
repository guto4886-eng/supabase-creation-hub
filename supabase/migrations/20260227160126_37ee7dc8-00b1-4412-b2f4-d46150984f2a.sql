
-- Add extra fields to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_contact_id uuid REFERENCES public.supplier_contacts(id) ON DELETE SET NULL;

-- Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'insumo',
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  description text NOT NULL,
  brand text,
  complement text,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  phase text,
  service text,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'un',
  unit_price numeric NOT NULL DEFAULT 0,
  discount_value numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  freight numeric DEFAULT 0,
  total numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their order items via order"
  ON public.purchase_order_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.user_id = auth.uid())
  );

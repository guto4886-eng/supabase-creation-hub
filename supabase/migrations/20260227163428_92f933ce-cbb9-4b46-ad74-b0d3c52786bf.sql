
-- Table to track receiving/launching of purchase order items
CREATE TABLE public.purchase_order_receivings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  user_id UUID NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_receivings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own receivings"
  ON public.purchase_order_receivings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_por_order_id ON public.purchase_order_receivings(purchase_order_id);
CREATE INDEX idx_por_item_id ON public.purchase_order_receivings(purchase_order_item_id);

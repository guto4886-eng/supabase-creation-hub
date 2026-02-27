
ALTER TABLE public.purchase_order_receivings
  ADD COLUMN romaneio text,
  ADD COLUMN delivery_date date DEFAULT CURRENT_DATE;

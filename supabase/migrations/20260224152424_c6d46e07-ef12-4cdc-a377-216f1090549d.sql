
ALTER TABLE public.purchase_request_items ADD COLUMN unit_price NUMERIC DEFAULT 0;
NOTIFY pgrst, 'reload schema';

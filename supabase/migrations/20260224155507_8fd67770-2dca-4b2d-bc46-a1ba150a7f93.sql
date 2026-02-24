
ALTER TABLE public.purchase_quotations ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id);
NOTIFY pgrst, 'reload schema';

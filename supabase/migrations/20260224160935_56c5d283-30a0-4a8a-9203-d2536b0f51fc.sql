
ALTER TABLE public.purchase_quotations
  ADD COLUMN IF NOT EXISTS needed_by DATE,
  ADD COLUMN IF NOT EXISTS response_deadline DATE,
  ADD COLUMN IF NOT EXISTS sending_notes TEXT;

NOTIFY pgrst, 'reload schema';

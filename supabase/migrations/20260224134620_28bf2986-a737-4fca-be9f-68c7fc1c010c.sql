
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS folder text;

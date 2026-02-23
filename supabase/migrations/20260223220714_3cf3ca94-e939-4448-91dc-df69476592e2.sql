
-- Add remaining fields from legacy client detail
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS profession text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cellphone text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_number text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS neighborhood text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS complement text DEFAULT NULL;

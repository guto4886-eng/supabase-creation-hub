
-- Add missing columns to suppliers table for the new form layout
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS person_type text DEFAULT 'j';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS trade_name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS ie text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cellphone text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS site text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS complement text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS recommended boolean DEFAULT false;

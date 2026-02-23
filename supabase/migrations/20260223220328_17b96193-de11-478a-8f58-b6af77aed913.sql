
-- Add missing fields from legacy system to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS person_type text DEFAULT 'f'; -- 'f' = física, 'j' = jurídica
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rg text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birth_date date DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nationality text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS marital_status text DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cep text DEFAULT NULL;

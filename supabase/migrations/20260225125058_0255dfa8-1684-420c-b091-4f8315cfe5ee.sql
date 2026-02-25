
ALTER TABLE public.vehicle_insurance ADD COLUMN IF NOT EXISTS policy_path TEXT DEFAULT NULL;
ALTER TABLE public.vehicle_insurance ADD COLUMN IF NOT EXISTS policy_file_name TEXT DEFAULT NULL;

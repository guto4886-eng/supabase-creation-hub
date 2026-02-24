
ALTER TABLE public.budget_measurement_items ADD COLUMN measured_at timestamp with time zone DEFAULT now();

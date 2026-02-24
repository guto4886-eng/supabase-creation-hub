
-- Create table for physical measurements
CREATE TABLE public.budget_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  measurement_number integer NOT NULL DEFAULT 1,
  reference_period text,
  status text NOT NULL DEFAULT 'aberta',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  user_id uuid NOT NULL
);

-- Create table for measurement items (progress per service)
CREATE TABLE public.budget_measurement_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id uuid NOT NULL REFERENCES public.budget_measurements(id) ON DELETE CASCADE,
  budget_item_id uuid NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  measured_quantity numeric DEFAULT 0,
  measured_percentage numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_measurement_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users manage own measurements"
ON public.budget_measurements FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage measurement items via measurement"
ON public.budget_measurement_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.budget_measurements bm
  WHERE bm.id = budget_measurement_items.measurement_id AND bm.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.budget_measurements bm
  WHERE bm.id = budget_measurement_items.measurement_id AND bm.user_id = auth.uid()
));

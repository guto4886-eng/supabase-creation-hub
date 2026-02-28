
CREATE TABLE public.obra_labor (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  role text DEFAULT NULL,
  daily_rate numeric DEFAULT 0,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  phone text DEFAULT NULL,
  document text DEFAULT NULL,
  notes text DEFAULT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.obra_labor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own obra labor"
  ON public.obra_labor FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

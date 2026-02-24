
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  holiday_date date NOT NULL,
  type text NOT NULL DEFAULT 'federal',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own holidays" ON public.holidays FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

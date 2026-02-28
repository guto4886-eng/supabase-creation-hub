
CREATE TABLE public.labor_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_id uuid NOT NULL REFERENCES public.obra_labor(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  attendance_date date NOT NULL,
  entry_time text,
  exit_time text,
  extra_hours numeric DEFAULT 0,
  absence_type text, -- falta, atestado, folga, feriado, ferias
  worked boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labor_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own labor attendance" ON public.labor_attendance FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_labor_attendance_labor_date ON public.labor_attendance(labor_id, attendance_date);

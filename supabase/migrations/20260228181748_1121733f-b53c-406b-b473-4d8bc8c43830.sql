
ALTER TABLE public.obra_labor
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS shift_type text,
  ADD COLUMN IF NOT EXISTS remuneration_type text,
  ADD COLUMN IF NOT EXISTS remuneration_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_value numeric DEFAULT 0;

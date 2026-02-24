
ALTER TABLE public.obra_daily_entries
  ADD COLUMN IF NOT EXISTS entry_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS service text,
  ADD COLUMN IF NOT EXISTS show_to_client boolean NOT NULL DEFAULT false;

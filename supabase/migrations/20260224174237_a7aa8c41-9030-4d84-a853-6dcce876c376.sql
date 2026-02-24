-- Add budget_code column
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS budget_code text;

-- Create a sequence for budget codes
CREATE SEQUENCE IF NOT EXISTS public.budget_code_seq START 1;

-- Create function to auto-generate budget code on insert
CREATE OR REPLACE FUNCTION public.generate_budget_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_code IS NULL OR NEW.budget_code = '' THEN
    NEW.budget_code := LPAD(nextval('public.budget_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS set_budget_code ON public.budgets;
CREATE TRIGGER set_budget_code
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_budget_code();

-- Set existing budgets that don't have a code
UPDATE public.budgets
SET budget_code = LPAD(nextval('public.budget_code_seq')::text, 6, '0')
WHERE budget_code IS NULL;
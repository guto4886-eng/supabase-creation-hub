
-- Table to store planned measurement periods and per-item planned percentages
CREATE TABLE public.budget_plan_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  period_label TEXT,
  sort_order INTEGER DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_plan_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget plan periods"
ON public.budget_plan_periods FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.budget_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_period_id UUID NOT NULL REFERENCES public.budget_plan_periods(id) ON DELETE CASCADE,
  budget_item_id UUID NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  planned_percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage plan items via period"
ON public.budget_plan_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.budget_plan_periods bp
  WHERE bp.id = budget_plan_items.plan_period_id AND bp.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.budget_plan_periods bp
  WHERE bp.id = budget_plan_items.plan_period_id AND bp.user_id = auth.uid()
));


-- Add new columns to financial_docs for a complete financial module
ALTER TABLE public.financial_docs
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS installments integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_installment integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.financial_docs(id),
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origin_id uuid;

-- Index for parent_id to support installment grouping
CREATE INDEX IF NOT EXISTS idx_financial_docs_parent_id ON public.financial_docs(parent_id);
CREATE INDEX IF NOT EXISTS idx_financial_docs_origin ON public.financial_docs(origin, origin_id);

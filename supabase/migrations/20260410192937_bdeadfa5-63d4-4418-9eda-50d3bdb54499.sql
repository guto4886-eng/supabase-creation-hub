
ALTER TABLE public.sinapi_items ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'sem_desoneracao';

ALTER TABLE public.sinapi_items ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sinapi_items_state_pricing ON public.sinapi_items (state, pricing_type);

DROP INDEX IF EXISTS idx_sinapi_items_unique_default;
CREATE UNIQUE INDEX idx_sinapi_items_unique_default ON public.sinapi_items (code, state, pricing_type, item_type) WHERE is_default = true;

ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS sinapi_pricing_type text NOT NULL DEFAULT 'sem_desoneracao';

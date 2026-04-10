
DROP INDEX IF EXISTS idx_sinapi_items_unique_default;
ALTER TABLE public.sinapi_items ADD CONSTRAINT sinapi_items_code_state_pricing_type_unique UNIQUE (code, state, pricing_type, item_type);


-- Add delivery and billing address fields to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS delivery_address_source text DEFAULT 'obra',
  ADD COLUMN IF NOT EXISTS delivery_cep text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_number text,
  ADD COLUMN IF NOT EXISTS delivery_complement text,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_receiver text,
  ADD COLUMN IF NOT EXISTS billing_address_source text DEFAULT 'obra',
  ADD COLUMN IF NOT EXISTS billing_cep text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_number text,
  ADD COLUMN IF NOT EXISTS billing_complement text,
  ADD COLUMN IF NOT EXISTS billing_neighborhood text,
  ADD COLUMN IF NOT EXISTS billing_state text,
  ADD COLUMN IF NOT EXISTS billing_city text;

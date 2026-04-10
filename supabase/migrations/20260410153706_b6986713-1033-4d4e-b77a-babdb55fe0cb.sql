
-- Tabela principal de itens SINAPI
CREATE TABLE public.sinapi_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  unit_price numeric NOT NULL DEFAULT 0,
  category text,
  item_type text NOT NULL DEFAULT 'insumo',
  state text DEFAULT 'SP',
  reference_date date,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sinapi_items_code ON public.sinapi_items (code);
CREATE INDEX idx_sinapi_items_user ON public.sinapi_items (user_id);
CREATE INDEX idx_sinapi_items_description ON public.sinapi_items USING gin (to_tsvector('portuguese', description));

ALTER TABLE public.sinapi_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view default and own sinapi items"
  ON public.sinapi_items FOR SELECT
  USING (is_default = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own sinapi items"
  ON public.sinapi_items FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can update own sinapi items"
  ON public.sinapi_items FOR UPDATE
  USING (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can delete own sinapi items"
  ON public.sinapi_items FOR DELETE
  USING (auth.uid() = user_id AND is_default = false);

-- Tabela de composições SINAPI (insumos que compõem cada serviço)
CREATE TABLE public.sinapi_compositions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sinapi_item_id uuid NOT NULL REFERENCES public.sinapi_items(id) ON DELETE CASCADE,
  component_code text NOT NULL,
  component_description text NOT NULL,
  component_unit text NOT NULL DEFAULT 'un',
  coefficient numeric NOT NULL DEFAULT 0,
  component_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sinapi_compositions_item ON public.sinapi_compositions (sinapi_item_id);

ALTER TABLE public.sinapi_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage compositions via sinapi item"
  ON public.sinapi_compositions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sinapi_items si
    WHERE si.id = sinapi_compositions.sinapi_item_id
    AND (si.is_default = true OR si.user_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sinapi_items si
    WHERE si.id = sinapi_compositions.sinapi_item_id
    AND si.user_id = auth.uid() AND si.is_default = false
  ));

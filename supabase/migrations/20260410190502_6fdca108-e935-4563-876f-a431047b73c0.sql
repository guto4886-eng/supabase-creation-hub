
-- Remover policies duplicadas se existirem
DROP POLICY IF EXISTS "Users can insert own sinapi items" ON public.sinapi_items;
DROP POLICY IF EXISTS "Users can update own sinapi items" ON public.sinapi_items;
DROP POLICY IF EXISTS "Users can delete own sinapi items" ON public.sinapi_items;

CREATE POLICY "Users can insert own sinapi items"
ON public.sinapi_items
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can update own sinapi items"
ON public.sinapi_items
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can delete own sinapi items"
ON public.sinapi_items
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND is_default = false);

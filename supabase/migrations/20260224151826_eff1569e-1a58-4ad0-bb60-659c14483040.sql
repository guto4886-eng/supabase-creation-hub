
CREATE TABLE public.purchase_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'livre',
  item TEXT NOT NULL,
  complement TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  phase TEXT,
  service TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their request items via request"
ON public.purchase_request_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requests pr WHERE pr.id = request_id AND pr.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchase_requests pr WHERE pr.id = request_id AND pr.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';

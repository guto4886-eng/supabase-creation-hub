
CREATE TABLE public.letterhead_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  image_mode text DEFAULT 'original',
  image_fill boolean DEFAULT false,
  image_align_h text DEFAULT 'centro',
  image_align_v text DEFAULT 'meio',
  image_opacity integer DEFAULT 0,
  image_url text,
  text_message text,
  text_direction text DEFAULT 'horizontal',
  text_size integer DEFAULT 8,
  text_bold boolean DEFAULT false,
  text_italic boolean DEFAULT false,
  text_opacity integer DEFAULT 0,
  text_color text DEFAULT '#000000',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.letterhead_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own letterhead configs" ON public.letterhead_configs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_letterhead_configs_updated_at BEFORE UPDATE ON public.letterhead_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

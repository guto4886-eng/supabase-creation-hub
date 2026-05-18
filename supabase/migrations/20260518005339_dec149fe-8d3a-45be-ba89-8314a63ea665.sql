
CREATE TABLE public.cc_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  imagem_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cc_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cc projects"
ON public.cc_projects FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cc_projects_user ON public.cc_projects(user_id);

CREATE TRIGGER update_cc_projects_updated_at
BEFORE UPDATE ON public.cc_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

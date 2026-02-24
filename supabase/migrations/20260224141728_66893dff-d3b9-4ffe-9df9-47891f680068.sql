
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS rdo_sections text[] DEFAULT ARRAY['turno_tempo','tarefas_realizadas','imagens','ocorrencias','equipe','maquinas','materiais_recebidos','materiais_utilizados'];

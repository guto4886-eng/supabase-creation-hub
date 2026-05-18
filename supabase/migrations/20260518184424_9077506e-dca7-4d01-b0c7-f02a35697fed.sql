UPDATE public.cc_cost_entries
SET tags = ARRAY['meio-fio']
WHERE tipo = 'material'
  AND nome_item ILIKE '%meio%fio%'
  AND 'fiacao' = ANY(tags);
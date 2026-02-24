
-- Tabela de insumos (materiais de construção civil)
CREATE TABLE public.insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  category TEXT,
  user_id UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

-- Insumos padrão são visíveis por todos, insumos customizados só pelo dono
CREATE POLICY "Users can view default and own insumos"
ON public.insumos FOR SELECT
USING (is_default = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own insumos"
ON public.insumos FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can update own insumos"
ON public.insumos FOR UPDATE
USING (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can delete own insumos"
ON public.insumos FOR DELETE
USING (auth.uid() = user_id AND is_default = false);

-- Tabela de itens da cotação
CREATE TABLE public.quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.purchase_quotations(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES public.insumos(id),
  item_type TEXT NOT NULL DEFAULT 'insumo',
  description TEXT NOT NULL,
  brand TEXT,
  complement TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  unit_price NUMERIC DEFAULT 0,
  phase TEXT,
  service TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage quotation items via quotation"
ON public.quotation_items FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.purchase_quotations pq WHERE pq.id = quotation_id AND pq.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.purchase_quotations pq WHERE pq.id = quotation_id AND pq.user_id = auth.uid())
);

-- Inserir insumos padrão da construção civil
INSERT INTO public.insumos (name, unit, category, is_default) VALUES
-- Cimento e Argamassas
('Cimento CP II 50kg', 'sc', 'Cimento e Argamassas', true),
('Cimento CP V ARI 50kg', 'sc', 'Cimento e Argamassas', true),
('Argamassa colante AC-I', 'sc', 'Cimento e Argamassas', true),
('Argamassa colante AC-II', 'sc', 'Cimento e Argamassas', true),
('Argamassa colante AC-III', 'sc', 'Cimento e Argamassas', true),
('Argamassa de reboco', 'sc', 'Cimento e Argamassas', true),
('Argamassa de assentamento', 'sc', 'Cimento e Argamassas', true),
('Cal hidratada CH-I', 'sc', 'Cimento e Argamassas', true),
('Cal hidratada CH-III', 'sc', 'Cimento e Argamassas', true),
('Rejunte flexível', 'kg', 'Cimento e Argamassas', true),
-- Areia e Agregados
('Areia média', 'm³', 'Areia e Agregados', true),
('Areia fina', 'm³', 'Areia e Agregados', true),
('Areia grossa', 'm³', 'Areia e Agregados', true),
('Brita 0', 'm³', 'Areia e Agregados', true),
('Brita 1', 'm³', 'Areia e Agregados', true),
('Brita 2', 'm³', 'Areia e Agregados', true),
('Pedra rachinha', 'm³', 'Areia e Agregados', true),
('Pedrisco', 'm³', 'Areia e Agregados', true),
('Saibro', 'm³', 'Areia e Agregados', true),
-- Concreto
('Concreto usinado fck 20 MPa', 'm³', 'Concreto', true),
('Concreto usinado fck 25 MPa', 'm³', 'Concreto', true),
('Concreto usinado fck 30 MPa', 'm³', 'Concreto', true),
('Concreto usinado fck 35 MPa', 'm³', 'Concreto', true),
('Concreto usinado fck 40 MPa', 'm³', 'Concreto', true),
-- Aço e Ferragens
('Aço CA-50 6.3mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-50 8.0mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-50 10.0mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-50 12.5mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-50 16.0mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-50 20.0mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-60 4.2mm', 'kg', 'Aço e Ferragens', true),
('Aço CA-60 5.0mm', 'kg', 'Aço e Ferragens', true),
('Arame recozido nº 18', 'kg', 'Aço e Ferragens', true),
('Prego 17x27', 'kg', 'Aço e Ferragens', true),
('Prego 18x30', 'kg', 'Aço e Ferragens', true),
('Tela soldada Q-92', 'm²', 'Aço e Ferragens', true),
('Tela soldada Q-138', 'm²', 'Aço e Ferragens', true),
-- Tijolos e Blocos
('Bloco cerâmico 9x19x19', 'un', 'Tijolos e Blocos', true),
('Bloco cerâmico 14x19x19', 'un', 'Tijolos e Blocos', true),
('Bloco cerâmico 19x19x19', 'un', 'Tijolos e Blocos', true),
('Bloco de concreto 9x19x39', 'un', 'Tijolos e Blocos', true),
('Bloco de concreto 14x19x39', 'un', 'Tijolos e Blocos', true),
('Bloco de concreto 19x19x39', 'un', 'Tijolos e Blocos', true),
('Tijolo maciço', 'un', 'Tijolos e Blocos', true),
('Lajota cerâmica', 'un', 'Tijolos e Blocos', true),
-- Madeira
('Tábua de pinus 2.5x30cm', 'm', 'Madeira', true),
('Pontalete 7x7cm', 'm', 'Madeira', true),
('Sarrafo 2.5x5cm', 'm', 'Madeira', true),
('Vigota 6x12cm', 'm', 'Madeira', true),
('Chapa compensada 12mm', 'un', 'Madeira', true),
('Chapa compensada 18mm', 'un', 'Madeira', true),
('Chapa OSB 15mm', 'un', 'Madeira', true),
-- Tubulação e Hidráulica
('Tubo PVC soldável 25mm', 'm', 'Hidráulica', true),
('Tubo PVC soldável 32mm', 'm', 'Hidráulica', true),
('Tubo PVC soldável 50mm', 'm', 'Hidráulica', true),
('Tubo PVC esgoto 40mm', 'm', 'Hidráulica', true),
('Tubo PVC esgoto 50mm', 'm', 'Hidráulica', true),
('Tubo PVC esgoto 75mm', 'm', 'Hidráulica', true),
('Tubo PVC esgoto 100mm', 'm', 'Hidráulica', true),
('Tubo PVC esgoto 150mm', 'm', 'Hidráulica', true),
('Registro de gaveta 3/4"', 'un', 'Hidráulica', true),
('Registro de pressão 3/4"', 'un', 'Hidráulica', true),
('Caixa d''água 500L', 'un', 'Hidráulica', true),
('Caixa d''água 1000L', 'un', 'Hidráulica', true),
-- Elétrica
('Fio flexível 1.5mm²', 'm', 'Elétrica', true),
('Fio flexível 2.5mm²', 'm', 'Elétrica', true),
('Fio flexível 4.0mm²', 'm', 'Elétrica', true),
('Fio flexível 6.0mm²', 'm', 'Elétrica', true),
('Fio flexível 10.0mm²', 'm', 'Elétrica', true),
('Eletroduto corrugado 3/4"', 'm', 'Elétrica', true),
('Eletroduto corrugado 1"', 'm', 'Elétrica', true),
('Caixa de luz 4x2"', 'un', 'Elétrica', true),
('Caixa de luz octogonal', 'un', 'Elétrica', true),
('Disjuntor monopolar 10A', 'un', 'Elétrica', true),
('Disjuntor monopolar 20A', 'un', 'Elétrica', true),
('Quadro de distribuição 12 disjuntores', 'un', 'Elétrica', true),
-- Impermeabilização
('Manta asfáltica 3mm', 'm²', 'Impermeabilização', true),
('Manta asfáltica 4mm', 'm²', 'Impermeabilização', true),
('Primer asfáltico', 'L', 'Impermeabilização', true),
('Impermeabilizante flexível', 'kg', 'Impermeabilização', true),
('Impermeabilizante cristalizante', 'kg', 'Impermeabilização', true),
-- Tintas e Acabamento
('Tinta látex PVA branca 18L', 'un', 'Tintas e Acabamento', true),
('Tinta acrílica branca 18L', 'un', 'Tintas e Acabamento', true),
('Selador acrílico 18L', 'un', 'Tintas e Acabamento', true),
('Massa corrida PVA 25kg', 'un', 'Tintas e Acabamento', true),
('Massa acrílica 25kg', 'un', 'Tintas e Acabamento', true),
('Textura acrílica 25kg', 'un', 'Tintas e Acabamento', true),
('Fundo preparador 18L', 'un', 'Tintas e Acabamento', true),
-- Pisos e Revestimentos
('Porcelanato polido 60x60cm', 'm²', 'Pisos e Revestimentos', true),
('Porcelanato acetinado 60x60cm', 'm²', 'Pisos e Revestimentos', true),
('Piso cerâmico 45x45cm', 'm²', 'Pisos e Revestimentos', true),
('Azulejo branco 20x20cm', 'm²', 'Pisos e Revestimentos', true),
('Pastilha de vidro', 'm²', 'Pisos e Revestimentos', true),
('Piso vinílico', 'm²', 'Pisos e Revestimentos', true),
('Rodapé cerâmico', 'm', 'Pisos e Revestimentos', true),
-- Cobertura
('Telha cerâmica colonial', 'un', 'Cobertura', true),
('Telha cerâmica romana', 'un', 'Cobertura', true),
('Telha fibrocimento 6mm', 'un', 'Cobertura', true),
('Telha metálica trapezoidal', 'm²', 'Cobertura', true),
('Telha sanduíche', 'm²', 'Cobertura', true),
('Cumeeira cerâmica', 'un', 'Cobertura', true),
('Calha galvanizada', 'm', 'Cobertura', true),
-- Esquadrias
('Porta de madeira interna 80x210cm', 'un', 'Esquadrias', true),
('Porta de madeira externa 80x210cm', 'un', 'Esquadrias', true),
('Janela de alumínio 100x120cm', 'un', 'Esquadrias', true),
('Janela de alumínio 120x120cm', 'un', 'Esquadrias', true),
('Janela de alumínio 150x120cm', 'un', 'Esquadrias', true),
('Porta de alumínio 80x210cm', 'un', 'Esquadrias', true),
('Vidro temperado 8mm', 'm²', 'Esquadrias', true),
-- Diversos
('Lona plástica preta', 'm²', 'Diversos', true),
('Fita veda-rosca', 'un', 'Diversos', true),
('Silicone acético', 'un', 'Diversos', true),
('Bucha de nylon S6', 'un', 'Diversos', true),
('Bucha de nylon S8', 'un', 'Diversos', true),
('Parafuso philips 4.5x40mm', 'un', 'Diversos', true),
('EPI - Capacete', 'un', 'Diversos', true),
('EPI - Luva de látex', 'par', 'Diversos', true),
('EPI - Óculos de proteção', 'un', 'Diversos', true),
('EPI - Botina de segurança', 'par', 'Diversos', true);

NOTIFY pgrst, 'reload schema';

## Central de Custos — Novo módulo financeiro

Vou criar um módulo **totalmente isolado**, sem alterar nada dos módulos atuais (Obras, Mão de Obra, Financeiro, etc.). Ele apenas lê obras já existentes da tabela `obras` para listagem, mas usa suas próprias tabelas para custos, funcionários da central, materiais e arquivos.

### 1. Banco de dados (novas tabelas, prefixo `cc_`)

- `cc_cost_entries` — lançamentos de custo
  - obra_id, user_id, tipo (material/funcionário/equipamento/transporte/alimentação/serviço/outros), nome_item, categoria, tags[], quantidade, unidade, valor_unitario, valor_total, data, forma_pagamento, fornecedor, funcionario_id, observacao, comprovante_url
- `cc_employees` — funcionários por obra
  - obra_id, user_id, nome, funcao, valor_diaria, valor_mensal, data_entrada, status
- `cc_obra_settings` — config financeira por obra (orçamento previsto, meta margem, alertas)
- `cc_attachments` — arquivos do módulo
- RLS: tudo restrito por `user_id = auth.uid()`
- Bucket de storage `cc-comprovantes` (privado)

### 2. Sidebar
Adicionar item **"Central de Custos"** logo abaixo de **Obras**, com ícone `LineChart` (ou similar) e badge **NOVO**.

### 3. Rotas
- `/central-custos` — listagem de obras com cards visuais + KPIs
- `/central-custos/:obraId` — painel da obra com abas

### 4. Telas

**Listagem (`CentralCustos.tsx`)**
- Header com título, subtítulo, botão "+ Nova Obra" (abre modal reaproveitando criação de obra existente)
- 5 cards KPI: Obras Ativas, Custo Total, Orçamento Previsto, Margem Estimada, Obras em Risco
- Filtros: busca, status saúde, período, cidade, pública/privada
- Cards de obra (não tabela): imagem placeholder, nome, cidade/UF, badge saúde (saudável/atenção/risco), % consumido com barra, gasto/previsto, sparkline, último lançamento, botão "Abrir Central"

**Painel da obra (`CentralCustosObra.tsx`)** com abas:
- **Visão Geral** — 5 KPIs + gráficos (linha evolução, donut categorias, gauge saúde, ranking materiais, meta x realizado) + timeline lançamentos recentes + card "Adicionar custo rápido"
- **Custos** — listagem moderna com filtros avançados, editar/excluir/duplicar, export CSV/PDF
- **Funcionários** — CRUD + ranking custo + gráfico equipe
- **Materiais** — agrupamento por tag, busca, total/qtd/média/evolução/fornecedor top
- **Analytics** — insights automáticos (material mais caro, categoria crítica, previsão estouro, score 0–100 com velocímetro)
- **Relatórios** — PDFs premium reutilizando `pdfHeader.ts`
- **Arquivos** — upload drag-and-drop
- **Configurações** — orçamento previsto, meta margem, alertas

### 5. Tags automáticas
Função `normalizeTag(name)` em utils: minúsculas, remove marcas/variações comuns ("cp ii", "votoran", "50kg"), mapeia palavra-chave principal. Aplica no salvar e usa em analytics/materiais.

### 6. Gráficos
Usar **Recharts** (já compatível com stack atual; ApexCharts adiciona dependência pesada). Animações via Framer Motion (já no projeto se disponível, senão adicionar).

### 7. Visual
- Cards com `rounded-2xl`, sombras suaves, gradientes sutis nos KPIs
- Tokens semânticos do `index.css` (não cores hardcoded)
- Micro-animações com Framer Motion
- Mantém sidebar/topbar atuais

### Detalhes técnicos
- Stack: React + Vite + Tailwind + shadcn + Recharts + Framer Motion + React Query
- Reutiliza `supabase`, `useAuth`, `pdfHeader.ts`, `exportWithHeader.ts`
- Nenhum arquivo existente é modificado **exceto**: `src/App.tsx` (2 rotas novas) e `src/components/Layout.tsx` (1 item de menu novo + badge)
- Migração SQL via tool de migration (aguarda aprovação)

### Escopo de entrega (este loop)
Dado o tamanho, vou entregar em **fase 1**:
1. Migration (tabelas + RLS + bucket)
2. Sidebar + rotas
3. Tela de listagem completa (KPIs, filtros, cards de obra)
4. Painel da obra com abas **Visão Geral, Custos, Funcionários, Adicionar Custo rápido** totalmente funcionais
5. Abas **Materiais, Analytics, Relatórios, Arquivos, Configurações** com estrutura + conteúdo inicial funcional (gráficos e KPIs reais, sem mocks)

Fases seguintes (próximas mensagens) refinam Analytics avançado, PDFs premium com capa, drag-and-drop polido e responsividade mobile dedicada.

Confirma para eu iniciar pela migration?
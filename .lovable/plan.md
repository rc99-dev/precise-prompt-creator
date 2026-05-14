## Plano de correção — Solicitações, Pedidos, Preços, PDFs e Inventário

Agrupei as falhas auditadas em 6 frentes. Cada item tem causa-raiz e correção objetiva.

---

### 1. Categorias e produtos na Solicitação

**Problema:** `products.categoria` é texto livre e diverge dos nomes em `product_categories`. Lista de categorias hard-coded em telas. Filtro por categoria não retorna produtos.

**Correção:**
- Em `MyRequisitionsPage.tsx` (e qualquer tela de solicitação/pedido com seletor de categoria): buscar categorias via `select id, nome from product_categories order by nome` — remover listas fixas.
- Filtro de produtos: comparar `products.categoria` (texto) com `product_categories.nome` (texto) via `ilike` case-insensitive e `trim()`. Manter compatibilidade com dados legados.
- Migração leve (opcional, recomendada): script de normalização que faz `UPDATE products SET categoria = pc.nome FROM product_categories pc WHERE lower(trim(products.categoria)) = lower(trim(pc.nome))` para alinhar capitalização.

---

### 2. Importação de solicitações no Pedido (Comparativo / Novo Pedido)

**Problema:** Agrupamento por `titulo + created_at` é frágil; ao gerar pedido só `selectedReqId` recebe `incluida_no_pedido`, deixando irmãs órfãs. PDF puxa apenas 1 requisição (`.limit(1)`), perdendo saldos.

**Correção:**
- Em `NewOrderPage.tsx` / `ComparativePage.tsx`: ao emitir o pedido, atualizar **todos** os `requisition_items` originais via array de IDs (`in('id', allReqItemIds)`) marcando `incluida_no_pedido = true`, não só o selecionado.
- Persistir o vínculo correto em `purchase_order_requisitions` para cada requisição que entrou no pedido.
- Em `pdfGenerator.ts`: trocar `.limit(1)` por busca completa de todas as requisições vinculadas (`select ... from purchase_order_requisitions where order_id = $1`) e agregar `saldo_atual` por produto somando todas as origens.

---

### 3. Edição de preço na tela de Ordem de Compra

**Problema:** Campo de preço é read-only; só muda ao trocar fornecedor.

**Correção:**
- Em `NewOrderPage.tsx`: tornar o campo `preco_unitario` editável quando o pedido está em `rascunho` ou `rejeitado`.
- Recalcular `subtotal = quantidade * preco_unitario` em onChange.
- Ao salvar, se o preço editado divergir de `supplier_prices.preco_unitario`, oferecer toast com ação "Atualizar tabela de preços" que faz `update supplier_prices` (gatilho `track_price_change` registra histórico automaticamente).

---

### 4. Tela de Preços (PricesPage)

**Problema:** Cache key `prices-page-data-v2` x invalidate `prices-page-data` (dessincronia). Inline edit cobre só `preco_unitario`. Detalhes (prazo, observações, qtd. mínima) não aparecem.

**Correção:**
- Padronizar queryKey: usar `["prices-page-data-v2"]` em todos os `invalidateQueries`.
- Expandir o painel de edição inline para incluir `prazo_entrega`, `quantidade_minima`, `observacoes`, `unidade_medida`.
- Mostrar essas colunas (ou um popover de detalhes) na linha do produto-fornecedor.

---

### 5. Histórico, exportação e nome do usuário

**Problema:** Nome do usuário sai como "—" em PDFs/históricos. Botão de exportação em massa (status → emitido) escondido para perfis privilegiados. Master perde acesso a ações.

**Correção:**
- Centralizar resolução de nome: helper `resolveUserName(userId)` que tenta `get_profile_names` RPC → fallback `profiles.full_name` → fallback `profiles.email` → "Usuário".
- Aplicar esse helper em `OrderHistoryPage`, `InventoryHistoryPage`, `InventoriesPage`, `pdfGenerator` e `reportExports`.
- Em `OrderHistoryPage.tsx`: remover condicional que esconde "Exportar em massa" para master/comprador — exibir para todos os perfis com permissão de update.

---

### 6. Inventário — exclusão, log e calculadora

**Problema:** `deleteInventory` falha porque `inventory_log` não tem policy de DELETE. Campos de quantidade não usam `CalcInput`.

**Correção:**
- Migração: adicionar policy `DELETE` em `inventory_log` permitindo dono do inventário e master:
  ```sql
  CREATE POLICY "Users delete own inventory log"
  ON inventory_log FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'master'));
  ```
- Em `deleteInventory`: deletar `inventory_log` antes de `inventories` (cascade manual).
- Em `InventoriesPage.tsx`: trocar `<Input type="number">` por `<CalcInput>` nos campos de saldo.

---

### Ordem de execução sugerida

1. Migração RLS de `inventory_log` (desbloqueia exclusão).
2. Helper `resolveUserName` + aplicação nos PDFs/históricos (fix visível imediato).
3. Categorias dinâmicas + filtro de produtos (desbloqueia solicitações).
4. Edição de preço no pedido + correção do cache em Preços.
5. Importação de solicitações + PDF agregando saldos.
6. Polimentos: CalcInput inventário, botão de exportação em massa universal.

### Detalhes técnicos

- Arquivos editados: `MyRequisitionsPage.tsx`, `NewOrderPage.tsx`, `ComparativePage.tsx`, `OrderHistoryPage.tsx`, `InventoriesPage.tsx`, `InventoryHistoryPage.tsx`, `PricesPage.tsx`, `lib/pdfGenerator.ts`, `lib/reportExports.ts`, novo `lib/userNames.ts`.
- 1 migração SQL (policy DELETE em `inventory_log`).
- 1 script opcional de normalização de `products.categoria`.
- Sem mudanças em auth, edge functions ou schema de tabelas principais.

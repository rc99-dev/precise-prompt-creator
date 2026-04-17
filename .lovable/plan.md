
## Diagnóstico

Investigando os 5 pontos + o sintoma "master não consegue excluir emitido/aprovado":

| # | Estado real no código | Ação necessária |
|---|---|---|
| 1 | `ReceiptsPage` já filtra por `unidade_setor` (a coluna correta — não existe `unidade` em `purchase_orders`). O filtro funciona, mas o select do profile usa só `unidade` para o fallback do "comprador". | Manter filtro; garantir refetch e adicionar log se necessário. **Sem mudança funcional.** |
| 2 | UI de Histórico já esconde o botão Excluir para status ≠ rascunho/rejeitado (linha 421). RLS atual dá `ALL` ao master → master poderia excluir via API. | Adicionar policy restritiva no banco bloqueando DELETE de pedidos não-rascunho/rejeitado **inclusive para master**. |
| 3 | `defaultPermissions['minhas-solicitacoes']` já inclui `solicitante, comprador, estoquista`. Sidebar já usa `canAccess` → link já aparece. | **Sem mudança.** |
| 4 | `RequisitionsPage` faz query sem filtro por `user_id`; RLS já libera para comprador/master. | **Sem mudança.** |
| 5 | `MyRequisitionsPage` filtra por `user_id = user.id`. | **Sem mudança.** |
| **+** | "Master não consegue excluir emitido/aprovado" | **Esse comportamento É a regra correta solicitada no item 2.** Para excluir, o pedido precisa primeiro ser movido para rascunho ou rejeitado. |

## Plano de implementação

### 1. Migração de banco — blindar DELETE em `purchase_orders`
Adicionar policy restritiva que se aplica a TODOS os perfis (inclusive master):

```sql
CREATE POLICY "Block delete unless rascunho or rejeitado"
ON public.purchase_orders
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (status IN ('rascunho','rejeitado'));
```

Mesma proteção para `purchase_order_items` (evitar deletar itens de pedido emitido):

```sql
CREATE POLICY "Block delete items unless parent rascunho/rejeitado"
ON public.purchase_order_items
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = order_id AND po.status IN ('rascunho','rejeitado')
));
```

### 2. `ReceiptsPage.tsx` — reforçar o filtro
- Manter `eq('unidade_setor', filterUnidade)` (já está).
- Adicionar `refetchOnWindowFocus: false` e `refetchOnMount: 'always'` no `useQuery` para garantir refetch ao trocar filtro (já garantido pela `queryKey`, mas reforçar).
- Adicionar `console.info('[recebimentos] filtro unidade:', filterUnidade)` para diagnóstico.

### 3. `OrderHistoryPage.tsx` — mensagem amigável quando master tentar excluir
No `handleDelete`, se a RLS bloquear (erro `new row violates...` ou afetadas=0), mostrar toast: "Pedidos emitidos/aprovados/recebidos não podem ser excluídos. Reprove ou cancele primeiro."

## Comunicação ao usuário

Sobre "não consigo excluir emitido/aprovado como master": **isso é o comportamento correto pedido no item 2**. Para apagar um pedido nesses status, o caminho é:
- Aprovado → usar o botão "Reprovar" (vira rejeitado) → excluir.
- Emitido/Recebido → não devem ser excluídos (integridade de auditoria). Caso precise, apenas o histórico fica registrado.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` — policies restritivas de DELETE.
- `src/pages/ReceiptsPage.tsx` — log de debug + reforço de refetch.
- `src/pages/OrderHistoryPage.tsx` — mensagem amigável no `handleDelete`.

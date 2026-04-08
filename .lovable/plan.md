

# Grupo B: Recebimentos, Cores de Status e Notificações

## Resumo

Implementar 3 melhorias focadas no fluxo de recebimento: reformular a tela do estoquista (MELHORIA 6), corrigir cores de status e adicionar aba de recebimento no modal do Histórico (MELHORIA 10), e criar notificações automáticas de previsão e recebimento (MELHORIA 12).

---

## MELHORIA 6 — Tela de Recebimentos reformulada

**Arquivo:** `src/pages/ReceiptsPage.tsx` (reescrever)

Mudanças na query principal:
- Buscar pedidos com status `emitido` que tenham `previsao_entrega` preenchida, E pedidos com status `recebido` ou `recebido_com_ocorrencia` (para visualização do histórico)
- Ordenar por `previsao_entrega` ascendente (mais próxima primeiro)
- Incluir join com `profiles` para mostrar o comprador

Mudanças na listagem:
- Exibir: número, comprador (via profile), data prevista de entrega, observação do comprador (`obs_estoquista`)
- Badge de alerta vermelho para entregas atrasadas (previsão < hoje) e âmbar para entregas de hoje
- Separar visualmente pedidos pendentes (emitidos) dos já recebidos com abas ou seções

Modal de recebimento (mantém lógica atual, melhorada):
- Mostrar itens com descrição, unidade e quantidade esperada
- Opções por item: "Recebido conforme", "Recebido parcialmente" (campo qtd), "Ocorrência" (tipo: avaria, quantidade errada, produto errado, NF incorreta)
- Campo NF no topo
- Botão "Confirmar recebimento" atualiza status e envia notificações

---

## MELHORIA 10 — Status recebido: cores e aba no modal

**Arquivo:** `src/pages/OrderHistoryPage.tsx`

Cores de status (função `statusVariant`):
- `recebido` → badge com classe `bg-success/20 text-success` (verde)
- `recebido_com_ocorrencia` → badge com classe `bg-warning/20 text-warning` (amarelo)
- Usar classes CSS diretas no Badge em vez do sistema de variants limitado

Aba "Recebimento" no modal de detalhes:
- Quando status é `recebido` ou `recebido_com_ocorrencia`, adicionar Tabs com "Itens do Pedido" e "Recebimento"
- Aba Recebimento busca dados de `receipts` + `receipt_items` (join com `purchase_order_items` → `products`)
- Exibir: número NF, data/hora do recebimento, nome do estoquista (via profiles), observação geral
- Tabela de itens: descrição, qtd esperada, qtd recebida, status do item, tipo de ocorrência

---

## MELHORIA 12 — Notificações de previsão e recebimento

**Arquivo:** `src/pages/ReceiptsPage.tsx` (dentro de `handleSave`)

Ao confirmar recebimento:
- Notificar o criador do pedido (`purchase_orders.user_id`): "Pedido [número] foi recebido por [nome estoquista] em [data]."
- Se houver ocorrência: "⚠️ Recebido com ocorrências — verifique os detalhes." com tipo `alerta`
- Notificar todos os aprovadores sobre ocorrências

**Arquivo:** `src/pages/OrderHistoryPage.tsx` (dentro de `exportPDF` quando muda para emitido)

Já existe notificação ao emitir. Adicionar notificação de previsão obrigatória ao aprovar:

**Arquivo:** `src/components/NotificationBell.tsx`

Destaque visual diferente por tipo de notificação:
- `alerta` → borda esquerda vermelha
- `previsao` → borda esquerda âmbar com ícone de calendário
- Padrão → sem destaque extra

---

## Detalhes técnicos

### Banco de dados
Nenhuma migração necessária — todas as tabelas (`receipts`, `receipt_items`, `notifications`, `purchase_orders`) já existem com as colunas necessárias.

### Arquivos a editar
1. `src/pages/ReceiptsPage.tsx` — reescrever com previsão de entrega, badges de alerta, histórico de recebidos
2. `src/pages/OrderHistoryPage.tsx` — cores de status com classes CSS, aba Recebimento no modal
3. `src/components/NotificationBell.tsx` — destaque visual por tipo de notificação
4. `src/lib/helpers.ts` — já tem `statusColors` corretos (recebido=success, ocorrência=warning), manter

### Dependências
- Nenhuma nova dependência necessária
- Usa componentes UI existentes: Tabs, Badge, Card, Dialog


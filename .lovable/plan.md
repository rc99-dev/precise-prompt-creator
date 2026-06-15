Vou corrigir o problema dos itens zerados na tela `/solicitacoes`.

O diagnóstico mostrou que:
- Existem 132 itens salvos no banco, vinculados a 12 solicitações.
- A tela busca corretamente em `requisition_items`.
- Mas a role `authenticated` não tem GRANT explícito na tabela `requisition_items`, então o app pode receber lista vazia/sem acesso mesmo com políticas RLS.

Plano de implementação:
1. Criar uma migração para restaurar os GRANTs explícitos necessários:
   - `requisitions`: SELECT para usuários autenticados e ALL para service role.
   - `requisition_items`: SELECT para usuários autenticados e ALL para service role.
   - Se necessário, também garantir SELECT em `products` e `profiles`, porque o modal depende dos nomes dos produtos e solicitantes.
2. Preservar as regras de RLS existentes; a mudança será só de permissão Data API, sem abrir acesso anônimo.
3. Ajustar a tela `/solicitacoes` para tratar erro na busca dos itens em vez de falhar silenciosamente, exibindo erro se a consulta não retornar por permissão.
4. Validar consultando novamente as permissões e conferindo que a lista passa a mostrar a contagem real de itens.
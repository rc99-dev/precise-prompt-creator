type ProductLine = {
  product_id: string | null;
  quantidade?: number | string | null;
  preco_unitario?: number | string | null;
  subtotal?: number | string | null;
};

export function dedupeOrderItemsByProduct<T extends ProductLine>(items: T[] | null | undefined): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items || []) {
    const key = item.product_id || `sem-produto-${unique.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

export function calculateOrderItemsTotal(items: ProductLine[]): number {
  return items.reduce((sum, item) => {
    const quantidade = Number(item.quantidade || 0);
    const preco = Number(item.preco_unitario || 0);
    return sum + quantidade * preco;
  }, 0);
}
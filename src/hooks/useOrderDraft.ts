import { useState, useEffect, useCallback, useRef } from "react";

const DRAFT_KEY = "order-draft-v1";

export interface DraftOrderItem {
  product_id: string;
  product_name: string;
  unidade: string;
  quantidade: number;
  saldo?: number;
  supplier_id: string;
  preco_unitario: number;
  subtotal: number;
  observacoes: string;
}

interface DraftData {
  items: DraftOrderItem[];
  observacoes: string;
  activeStrategy: "melhor_preco" | "melhor_fornecedor" | null;
  editingOrderId?: string | null;
  savedAt: number;
}

export function useOrderDraft() {
  const [hasDraft, setHasDraft] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    setHasDraft(!!raw);
    initialized.current = true;
  }, []);

  const saveDraft = useCallback((data: Omit<DraftData, "savedAt">) => {
    if (data.items.length === 0) {
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    setHasDraft(true);
  }, []);

  const loadDraft = useCallback((): DraftData | null => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DraftData;
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  }, []);

  return { hasDraft, saveDraft, loadDraft, clearDraft };
}

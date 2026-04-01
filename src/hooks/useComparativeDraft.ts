import { useState, useEffect, useCallback, useRef } from "react";

const DRAFT_KEY = "draft_comparative";

export interface DraftCompItem {
  product_id: string;
  product_name: string;
  unidade: string;
  quantidade: number;
  saldo?: number;
}

interface DraftData {
  items: DraftCompItem[];
  unidadeSolicitante: string;
  showSaldo: boolean;
  selectedRequisitionId: string | null;
  savedAt: number;
}

export function useComparativeDraft() {
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

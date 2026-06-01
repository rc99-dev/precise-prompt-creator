import { KeyboardEvent } from "react";

/**
 * Focuses a specific field within a row identified by `data-row`.
 * Uses requestAnimationFrame to wait for React to render new rows.
 */
export function focusRowField(rowId: string, field: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-row="${CSS.escape(rowId)}"] [data-field="${field}"]`
    );
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
    }
  });
}

/** Focuses the product search input identified by `data-product-search`. */
export function focusProductSearch(searchKey: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-product-search="${searchKey}"]`
    );
    el?.focus();
  });
}

/**
 * Returns an onKeyDown handler that on Enter moves focus to the next field
 * in `sequence`, or back to the product search when at the end.
 */
export function rowEnterHandler(
  rowId: string,
  current: string,
  sequence: string[],
  searchKey: string
) {
  return (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = sequence.indexOf(current);
    if (idx >= 0 && idx < sequence.length - 1) {
      focusRowField(rowId, sequence[idx + 1]);
    } else {
      focusProductSearch(searchKey);
    }
  };
}

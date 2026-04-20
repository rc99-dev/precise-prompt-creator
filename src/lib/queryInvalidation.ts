import { QueryClient } from "@tanstack/react-query";

/**
 * Invalidates every cache that depends on purchase orders so that
 * any open screen reflects the latest state without manual refresh.
 *
 * Covers: history, approvals, receipts, dashboard, requisitions
 * (which display the linked order status).
 */
export function invalidateOrderQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['order-history'] });
  qc.invalidateQueries({ queryKey: ['approval-orders'] });
  qc.invalidateQueries({ queryKey: ['receipt-orders'] });
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
  qc.invalidateQueries({ queryKey: ['requisitions-list'] });
  qc.invalidateQueries({ queryKey: ['my-requisitions'] });
  qc.invalidateQueries({ queryKey: ['pending-requisitions-for-comp'] });
}

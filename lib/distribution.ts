export interface Merchant {
  merchant_id: string;
  name: string;
  phone: string;
  rating: number;
  reviews_count: number;
  sales_count: number;
  orders_segment: string;
  cancelled_pct: number;
  returned_pct: number;
  late_delivery_pct: number;
  state: string;
  city: string;
  created: string;
  segment: string;
}

const SEGMENT_ORDER = ['Топ', 'Хорошие', 'Средние', 'Малые', 'Нет данных'];

export function distributeToManager(
  merchants: Merchant[],
  managerId: string,
  managerIds: string[]
): Merchant[] {
  if (managerIds.length === 0) return [];

  const managerIndex = managerIds.indexOf(managerId);
  if (managerIndex === -1) return [];

  const N = managerIds.length;

  // Group by segment
  const bySegment: Record<string, Merchant[]> = {};
  for (const seg of SEGMENT_ORDER) {
    bySegment[seg] = [];
  }

  for (const m of merchants) {
    const seg = SEGMENT_ORDER.includes(m.segment) ? m.segment : 'Нет данных';
    bySegment[seg].push(m);
  }

  const assigned: Merchant[] = [];

  for (const seg of SEGMENT_ORDER) {
    const segMerchants = bySegment[seg];
    for (let i = 0; i < segMerchants.length; i++) {
      if (i % N === managerIndex) {
        assigned.push(segMerchants[i]);
      }
    }
  }

  return assigned;
}

export function getSegmentCounts(
  merchants: Merchant[],
  managerId: string,
  managerIds: string[]
): Record<string, number> {
  const assigned = distributeToManager(merchants, managerId, managerIds);
  const counts: Record<string, number> = {};
  for (const seg of SEGMENT_ORDER) {
    counts[seg] = 0;
  }
  for (const m of assigned) {
    const seg = SEGMENT_ORDER.includes(m.segment) ? m.segment : 'Нет данных';
    counts[seg] = (counts[seg] || 0) + 1;
  }
  return counts;
}

export function getAllSegmentCounts(
  merchants: Merchant[],
  managerIds: string[]
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const id of managerIds) {
    result[id] = getSegmentCounts(merchants, id, managerIds);
  }
  return result;
}

export { SEGMENT_ORDER };

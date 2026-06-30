export function calculatePrice(merchant: {
  segment: string;
  orders_segment?: string;
  sales_count?: number | null;
}): number {
  const seg = parseInt(merchant.orders_segment || '0', 10) || merchant.sales_count || 0;

  if (seg >= 50000) return 150000;
  if (seg >= 10000) return 80000;
  if (seg >= 5000)  return 50000;
  if (seg >= 2000)  return 35000;
  if (seg >= 1000)  return 25000;
  if (seg >= 500)   return 18000;
  if (seg >= 100)   return 12000;
  return 8000;
}

export function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU') + ' ₸';
}

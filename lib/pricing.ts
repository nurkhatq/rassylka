export function calculatePrice(merchant: {
  segment: string;
  orders_segment?: string;
  sales_count?: number | null;
}): number {
  // Основываемся на сегменте — он уже рассчитан из sales_count
  switch (merchant.segment) {
    case 'Топ':      return 50000;  // 10k+ продаж
    case 'Хорошие':  return 30000;  // 1k–10k продаж
    case 'Средние':  return 20000;  // 100–1k продаж
    case 'Малые':    return 12000;  // <100 продаж
    default:         return 15000;
  }
}

export function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU') + ' ₸';
}

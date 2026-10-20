export function normalizeSalesCategory(
  category: string | null | undefined
): string {
  switch (category?.trim().toUpperCase()) {
    case '1-PICK UP':
    case 'PICK UP':
      return 'PICK UP';
    case '2-DELIVERY':
    case 'DELIVERY':
      return 'DELIVERY';
    default:
      return category ?? 'PICK UP';
  }
}

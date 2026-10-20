export interface ShortcutItem {
  itemid: string | number;
  itemcode: string;
  description: string;
  qty: number;
  price: number;
  cost: number;
  amount: number;
  Refill: number;
  Non_Refill: number;
  cost_refill: number;
  cost_non_refill: number;
  unit: 'REFILL' | 'NON-REFILL';
}

export interface ShortcutPreset {
  id: string;
  codeName: string;
  customer: any;
  items: ShortcutItem[];
  discountType?: 'fixed' | 'percentage' | 'none';
  discountValue?: number;
}
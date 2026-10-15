import { PosSalesComponent } from './pos-sales.component';

describe('PosSalesComponent discounts', () => {
  const createComponent = () =>
    new PosSalesComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: async () => null } as any,
      {} as any
    );

  it('calculates a percentage discount from the pre-discount subtotal', () => {
    const component = createComponent();
    component.cart = [{ qty: 1, unit: 'REFILL', Refill: 112 }];
    component.discountType = 'regular';
    component.discountMode = 'percent';
    component.discountInputVal = 10;

    component.calculateTotals();

    expect(component.discountAmount).toBe(10);
    expect(component.posData.regularDiscount).toBe(10);
    expect(component.posData.specialDiscount).toBe(0);
    expect(component.getTotal()).toBe(102);
    expect(component.getDiscountLabel()).toBe('Discount (10%):');
  });

  it('selects the matching cost for refill and non-refill units', () => {
    const component = createComponent();
    const item = {
      unit: 'REFILL',
      itemcost: 40,
      cost_refill: 25,
      cost_non_refill: 60,
    };

    expect(component.getItemCost(item)).toBe(25);
    item.unit = 'NON-REFILL';
    expect(component.getItemCost(item)).toBe(60);
  });

  it('falls back to the legacy item cost when a unit cost is absent', () => {
    const component = createComponent();

    expect(component.getItemCost({ unit: 'NON-REFILL', itemcost: 40 })).toBe(40);
  });

  it('stores a fixed special discount separately from regular discounts', () => {
    const component = createComponent();
    component.cart = [{ qty: 1, unit: 'REFILL', Refill: 112 }];
    component.discountType = 'special';
    component.discountMode = 'fixed';
    component.discountInputVal = 20;

    component.calculateTotals();

    expect(component.discountAmount).toBe(20);
    expect(component.posData.regularDiscount).toBe(0);
    expect(component.posData.specialDiscount).toBe(20);
    expect(component.getTotal()).toBe(92);
    expect(component.getDiscountLabel()).toBe('Special Discount:');
  });

  it('rounds percentage discounts and payable totals to cents', () => {
    const component = createComponent();
    component.cart = [{ qty: 1, unit: 'REFILL', Refill: 101.005 }];
    component.discountType = 'regular';
    component.discountMode = 'percent';
    component.discountInputVal = '10' as any;

    component.calculateTotals();

    expect(component.discountAmount).toBe(9.02);
    expect(component.getTotal()).toBe(91.98);
  });
});
import { PosSalesComponent } from './pos-sales.component';

describe('PosSalesComponent discounts', () => {
  const createComponent = () =>
    new PosSalesComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { get: async () => null } as any
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
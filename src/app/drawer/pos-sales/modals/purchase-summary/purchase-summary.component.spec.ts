import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PurchaseSummaryComponent } from './purchase-summary.component';

describe('PurchaseSummaryComponent', () => {
  let component: PurchaseSummaryComponent;
  let fixture: ComponentFixture<PurchaseSummaryComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PurchaseSummaryComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats receipt summary rows within the 32-character printer width', () => {
    const line = (component as any).formatLine(
      '',
      'Non-Vatable Sales:',
      '0.00'
    );

    expect(line.length).toBe(32);
    expect(line.startsWith('Non-Vatable Sales:')).toBeTrue();
    expect(line.endsWith('0.00')).toBeTrue();
  });

  it('allows full payment of a rounded zero-total sale', () => {
    component.totalAmount = 0;
    component.paymentType = 'FULL PAYMENT';
    component.paymentMethod = 'CASH';
    component.tenderedAmount = '0.00';

    expect(component.canConfirm()).toBeTrue();
  });

  it('accepts tender equal to the rounded payable amount', () => {
    component.totalAmount = 135.000000002;
    component.paymentType = 'FULL PAYMENT';
    component.paymentMethod = 'CASH';
    component.tenderedAmount = '135.00';

    expect(component.canConfirm()).toBeTrue();
  });
});

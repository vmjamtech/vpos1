import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AlertController, IonicModule, ModalController } from '@ionic/angular';
import { PettyCashService } from 'src/app/services/pettycash.service';

import { PettycashlogsComponent } from './pettycashlogs.component';

describe('PettycashlogsComponent', () => {
  let component: PettycashlogsComponent;
  let fixture: ComponentFixture<PettycashlogsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PettycashlogsComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PettycashlogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('PettycashlogsComponent split totals', () => {
  it('loads separate totals for the currently selected date range', async () => {
    const pettyCashService = jasmine.createSpyObj<PettyCashService>(
      'PettyCashService',
      ['getTotalsByType']
    );
    pettyCashService.getTotalsByType.and.resolveTo({
      cashInTotal: 2500,
      cashOutTotal: 500,
    });
    const component = new PettycashlogsComponent(
      pettyCashService,
      {} as AlertController,
      {} as ModalController
    );
    component.currentDateFrom = '2026-09-25';
    component.currentDateTo = '2026-09-26';

    await component.loadtotals();

    expect(pettyCashService.getTotalsByType).toHaveBeenCalledWith(
      '2026-09-25',
      '2026-09-26'
    );
    expect(component.cashInTotal).toBe(2500);
    expect(component.cashOutTotal).toBe(500);
  });
});

import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { PettyCashService } from 'src/app/services/pettycash.service';

import { PettycashlogsComponent } from './pettycashlogs.component';

describe('PettycashlogsComponent', () => {
  let component: PettycashlogsComponent;
  let fixture: ComponentFixture<PettycashlogsComponent>;

  beforeEach(async () => {
    const pettyCashService = jasmine.createSpyObj<PettyCashService>(
      'PettyCashService',
      ['getTotalsByType', 'getFilterdb', 'getPettyCash']
    );
    pettyCashService.getTotalsByType.and.resolveTo({
      cashInTotal: 0,
      cashOutTotal: 0,
    });
    pettyCashService.getFilterdb.and.resolveTo([]);
    pettyCashService.getPettyCash.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [PettycashlogsComponent],
      providers: [
        { provide: PettyCashService, useValue: pettyCashService },
        { provide: AlertController, useValue: {} },
        { provide: ModalController, useValue: {} },
        {
          provide: ChangeDetectorRef,
          useValue: {
            detectChanges: () => {},
            markForCheck: () => {},
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PettycashlogsComponent);
    component = fixture.componentInstance;
  });

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
      {} as ModalController,
      { detectChanges: () => {}, markForCheck: () => {} } as ChangeDetectorRef
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

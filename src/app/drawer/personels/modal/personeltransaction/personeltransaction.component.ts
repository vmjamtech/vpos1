import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { FiltermodalComponent } from 'src/app/drawer/customers/modal/customertransactions/modals/filtermodal/filtermodal.component';
import { PersonnelTransactionService } from 'src/app/services/personnel-transaction.service';
import { PaysalaryComponent } from './modals/paysalary/paysalary.component';
import {
  getTodayDateRange,
  normalizeDatePickerValue,
} from 'src/app/utils/date-range';
import { DateRangeDisplayComponent } from 'src/app/shared/date-range-display/date-range-display.component';
import { PermissionService } from 'src/app/services/permission.service';
import { ItemSizePipe } from 'src/app/shared/item-size/item-size.pipe';
import { PersonnelIncentiveService } from 'src/app/services/personnel-incentive.service';
import { IncentiveInfoModalComponent } from './modals/incentive-info/incentive-info.modal';

interface IncentiveInfoRow {
  size: string;
  qty: number;
  rate: number;
  amount: number;
  soldQty?: number;
  excessQty?: number;
}

@Component({
  selector: 'app-personeltransaction',
  templateUrl: './personeltransaction.component.html',
  styleUrls: ['./personeltransaction.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonIcon,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonList,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
    IonFab,
    IonFabButton,
    DateRangeDisplayComponent,
    ItemSizePipe,
  ],
})
export class PersoneltransactionComponent implements OnInit {
  pid?: number;
  pname?: string;
  prole?: string;
  linked_userid?: number | null;
  items: any[] = []; // all loaded items
  filteredItems: any[] = []; // filtered by search
  searchValue: string = '';
  offset: number = 0;
  limit: number = 20;
  allLoaded: boolean = false;

  isLoading = true; // skeleton loader for first load
  isFetching = false; // prevent double triggers
  skeletonArray = Array(10);
  totalCommission: number = 0;
  totalIncentive: number = 0;
  incentiveInfoRows: IncentiveInfoRow[] = [];
  riderQuota = 0;
  totalSoldCylinders = 0;
  totalExcessCylinders = 0;
  totalamount: number = 0;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private personelTransactionService: PersonnelTransactionService,
    private personnelIncentiveService: PersonnelIncentiveService,
    private cdr: ChangeDetectorRef,
    public permissionService: PermissionService
  ) {}

  async ngOnInit() {
    const { dateFrom, dateTo } = getTodayDateRange();
    await this.applyFilter(dateFrom, dateTo);
  }

  async openFilter() {
    const filtermodal = await this.modalCtrl.create({
      component: FiltermodalComponent,
      componentProps: {
        dateFrom: this.currentDateFrom,
        dateTo: this.currentDateTo,
      },
      initialBreakpoint: 0.4,
      breakpoints: [0.4],
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.data) {
        const f = result.data;

        if (f.mode === 'showAll') {
          this.currentDateFrom = null;
          this.currentDateTo = null;
          this.cdr.detectChanges();
          this.loadInitialData();
          return;
        }

        if (f.mode === 'filter') {
          const today = getTodayDateRange().dateFrom;

          // Handle null/empty
          const dateFrom = normalizeDatePickerValue(f.dateFrom, today);
          const dateTo = normalizeDatePickerValue(f.dateTo, today);

          this.currentDateFrom = dateFrom;
          this.currentDateTo = dateTo;
          this.cdr.detectChanges();
          this.applyFilter(dateFrom, dateTo);
        }
      }
    });

    await filtermodal.present();
  }

  async applyFilter(dateFrom: string, dateTo: string) {
    this.currentDateFrom = dateFrom || null;
    this.currentDateTo = dateTo || null;
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];
    try {
      const isFiltered = !!(this.currentDateFrom && this.currentDateTo);

      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';
      const pname = this.pname ?? '';
      const pid = this.pid ?? 0;
      const loadingAll = !isFiltered;

      let fetchFn;

      // Pick function based on role
      switch (this.prole) {
        case 'Cashier':
        case 'StoreKeeper':
          fetchFn =
            this.personelTransactionService.getCashierTransactionByIdAndDate;
          break;
        case 'Rider':
          fetchFn =
            this.personelTransactionService.getRiderTransactionByIdAndDate;
          break;
        default:
          fetchFn =
            this.personelTransactionService.getDriverTransactionByIdAndDate;
          break;
      }

      const data: any[] = await fetchFn.call(
        this.personelTransactionService,
        dateFrom,
        dateTo,
        pname,
        pid,
        this.limit,
        this.offset,
        loadingAll,
        this.linked_userid ?? null
      );
      await this.loadtotals();
      this.items = data;
      this.filteredItems = [...this.items];
      this.offset += this.limit;
      if (data.length < this.limit) this.allLoaded = true;
    } catch (err) {
      console.error('Filter load error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  /** Load first page */
  async loadInitialData() {
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    await this.loadMore();
    await this.loadtotals();
    this.isLoading = false;
  }

  /** Load first page */
  async loadtotals() {
    if (!this.pid || !this.pname) return;

    const dateFrom = this.currentDateFrom ?? '';
    const dateTo = this.currentDateTo ?? '';
    const pname = this.pname ?? '';
    const pid = this.pid ?? 0;

    const loadingAll = !(this.currentDateFrom && this.currentDateTo);

    // Select function based on role
    let fetchFn;

    switch (this.prole) {
      case 'Cashier':
      case 'StoreKeeper':
        fetchFn = this.personelTransactionService.getCashierSumSalary;
        break;
      case 'Rider':
        fetchFn = this.personelTransactionService.getRiderSumSalary;
        break;
      default:
        fetchFn = this.personelTransactionService.getDriverSumSalary;
        break;
    }

    this.totalCommission = await fetchFn.call(
      this.personelTransactionService,
      dateFrom,
      dateTo,
      pname,
      pid,
      loadingAll,
      this.linked_userid ?? null
    );

    this.riderQuota = 0;
    this.totalSoldCylinders = 0;
    this.totalExcessCylinders = 0;
    const incentiveFrom = this.currentDateFrom;
    const incentiveTo = this.currentDateTo;
    if (
      (this.prole === 'Cashier' || this.prole === 'StoreKeeper') &&
      this.linked_userid != null
    ) {
      const result = await this.personnelIncentiveService.getCashierIncentive(
        pid,
        this.linked_userid,
        incentiveFrom,
        incentiveTo
      );
      this.totalIncentive = result.totalIncentive;
      this.incentiveInfoRows = result.breakdown.map((line) => ({
        size: line.size,
        qty: line.qty,
        rate: line.rate,
        amount: line.amount,
      }));
    } else if (this.prole === 'Rider') {
      const result = await this.personnelIncentiveService.getRiderIncentive(
        pid,
        incentiveFrom,
        incentiveTo
      );
      this.totalIncentive = result.totalIncentive;
      this.riderQuota = result.quota;
      this.totalSoldCylinders = result.totalSoldCylinders;
      this.totalExcessCylinders = result.totalExcessCylinders;
      this.incentiveInfoRows = result.breakdown.map((line) => ({
        size: line.size,
        qty: line.soldQty,
        soldQty: line.soldQty,
        excessQty: line.excessQty,
        rate: line.rate,
        amount: line.amount,
      }));
    } else if (this.prole === 'Driver') {
      const result = await this.personnelIncentiveService.getDriverIncentive(
        pid,
        incentiveFrom,
        incentiveTo
      );
      this.totalIncentive = result.totalIncentive;
      this.incentiveInfoRows = result.breakdown.map((line) => ({
        size: line.size,
        qty: line.qty,
        rate: line.rate,
        amount: line.amount,
      }));
    } else {
      this.totalIncentive = 0;
      this.incentiveInfoRows = [];
    }
  }

  async openIncentiveInfoModal() {
    const role = this.prole === 'StoreKeeper' ? 'Cashier' : this.prole;
    const modal = await this.modalCtrl.create({
      component: IncentiveInfoModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 0.85],
      handle: true,
      componentProps: {
        role,
        items: this.incentiveInfoRows,
        totalIncentive: this.totalIncentive,
        riderQuota: this.riderQuota,
        totalSoldCylinders: this.totalSoldCylinders,
        totalExcessCylinders: this.totalExcessCylinders,
      },
    });
    await modal.present();
  }

  isRestockCategory(category: string | null | undefined): boolean {
    return (category ?? '').toUpperCase().includes('RESTOCK');
  }

  /** Pull-to-refresh */
  async doRefresh(event: any) {
    if (this.isFetching) {
      event.target.complete();
      return;
    }

    this.isFetching = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    try {
      const isFiltered = !!(this.currentDateFrom && this.currentDateTo);
      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';
      const pname = this.pname ?? '';
      const pid = this.pid ?? 0;
      const loadingAll = !isFiltered;
      let fetchFn;

      // Pick function based on role
      switch (this.prole) {
        case 'Cashier':
        case 'StoreKeeper':
          fetchFn =
            this.personelTransactionService.getCashierTransactionByIdAndDate;
          break;
        case 'Rider':
          fetchFn =
            this.personelTransactionService.getRiderTransactionByIdAndDate;
          break;
        default:
          fetchFn =
            this.personelTransactionService.getDriverTransactionByIdAndDate;
          break;
      }

      const newItems: any[] = await fetchFn.call(
        this.personelTransactionService,
        dateFrom,
        dateTo,
        pname,
        pid,
        this.limit,
        this.offset,
        loadingAll,
        this.linked_userid ?? null
      );

      this.items = [...newItems];
      this.filteredItems = [...this.items];
      this.offset += this.limit;
      await this.loadtotals();
      if (newItems.length < this.limit) this.allLoaded = true;
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      this.isFetching = false;
      event.target.complete();
    }
  }

  /** Infinite scroll load more */
  async loadMore(event?: any) {
    if (this.allLoaded || this.isFetching) {
      event?.target.complete();
      return;
    }

    this.isFetching = true;

    try {
      const isFiltered = !!(this.currentDateFrom && this.currentDateTo);

      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';
      const pname = this.pname ?? '';
      const pid = this.pid ?? 0;
      const loadingAll = !isFiltered;

      let fetchFn;

      // Pick function based on role
      switch (this.prole) {
        case 'Cashier':
        case 'StoreKeeper':
          fetchFn =
            this.personelTransactionService.getCashierTransactionByIdAndDate;
          break;
        case 'Rider':
          fetchFn =
            this.personelTransactionService.getRiderTransactionByIdAndDate;
          break;
        default:
          fetchFn =
            this.personelTransactionService.getDriverTransactionByIdAndDate;
          break;
      }

      const newItems: any[] = await fetchFn.call(
        this.personelTransactionService,
        dateFrom,
        dateTo,
        pname,
        pid,
        this.limit,
        this.offset,
        loadingAll,
        this.linked_userid ?? null
      );

      this.items.push(...newItems);
      this.filteredItems = [...this.items];

      this.offset += this.limit;

      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }
    } catch (err) {
      console.error('Error loading more:', err);
    } finally {
      this.isFetching = false;
      event?.target.complete?.();
    }
  }

  /** Close modal */
  dismiss() {
    this.modalCtrl.dismiss();
  }

  async openAddModal() {
    if (!this.permissionService.has('personnel.paySalary')) return;

    const modal = await this.modalCtrl.create({
      component: PaysalaryComponent,
      initialBreakpoint: 0.85,
      breakpoints: [0.85],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        mode: 'add',
        Data: {
          datefrom: this.currentDateFrom,
          dateto: this.currentDateTo,
          pid: this.pid,
          pname: this.pname,
          commission: this.totalCommission,
          prole: this.prole,
          linked_userid: this.linked_userid,
        },
      },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data) {
        // this.items.push(res.data);
        // this.resetAndLoad();
        // this.applySearch();
      }
    });

    await modal.present();
  }
}

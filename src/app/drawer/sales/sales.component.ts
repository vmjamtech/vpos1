import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { SalesService } from 'src/app/services/sales.service';
import { FiltermodalComponent } from '../customers/modal/customertransactions/modals/filtermodal/filtermodal.component';
import {
  getTodayDateRange,
  normalizeDatePickerValue,
  toLocalDateString,
} from 'src/app/utils/date-range';
import { SalesdetailsComponent } from './modal/salesdetails/salesdetails.component';
import { DateRangeDisplayComponent } from 'src/app/shared/date-range-display/date-range-display.component';
import { PaginationComponent } from 'src/app/shared/pagination/pagination.component';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonIcon,
    IonLabel,
    IonItem,
    IonList,
    IonSearchbar,
    IonButton,
    IonSkeletonText,
    IonSpinner,
    IonBadge,
    IonFooter,
    DateRangeDisplayComponent,
    PaginationComponent,
  ],
})
export class SalesComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  currentPage = 1;
  readonly pageSize = 50;
  totalCount = 0;
  totalPages = 1;

  isLoading = false;
  isRefreshing = false;
  skeletonArray = Array(10);
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  total: number = 0;
  private hasEnteredView = false;
  private loadRequestId = 0;

  searchField: 'salesrefnum' | 'salescust' = 'salesrefnum';
  searchFieldLabels: any = {
    salesrefnum: 'REFERENCE NUMBER',
    salescust: 'CUSTOMER NAME',
  };

  constructor(
    private salesService: SalesService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef
  ) {}

  private getToday(): string {
    return toLocalDateString();
  }

  async ngOnInit() {
    const { dateFrom, dateTo } = getTodayDateRange();
    await this.applyFilter(dateFrom, dateTo);
  }

  async ionViewDidEnter() {
    if (this.hasEnteredView && !this.isLoading) {
      const { dateFrom, dateTo } = getTodayDateRange();
      await this.applyFilter(dateFrom, dateTo);
    }
    this.hasEnteredView = true;
  }

  /** Reloads with the active filter unchanged. */
  async onRefreshClick() {
    if (this.isRefreshing || this.isLoading) return;
    this.isRefreshing = true;
    try {
      await this.applyFilter(
        this.currentDateFrom ?? '',
        this.currentDateTo ?? ''
      );
    } finally {
      this.isRefreshing = false;
    }
  }

  onSearchChange() {
    void this.loadPage(1);
  }

  async openFilter() {
    const filtermodal = await this.modalCtrl.create({
      component: FiltermodalComponent,
      componentProps: {
        dateFrom: this.currentDateFrom, // pass current values
        dateTo: this.currentDateTo,
      },
      initialBreakpoint: 0.35,
      breakpoints: [0.35],
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.data) {
        const f = result.data;

        console.log('RESULT F', f);
        if (f.mode === 'showAll') {
          this.currentDateFrom = null;
          this.currentDateTo = null;
          this.cdr.detectChanges();
          this.applyFilter(
            this.currentDateFrom ?? '',
            this.currentDateTo ?? ''
          );
          return;
        }

        if (f.mode === 'filter') {
          // Handle null / empty
          const today = this.getToday();
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
    this.currentPage = 1;
    this.items = [];
    this.filteredItems = [];
    try {
      await Promise.all([this.loadPage(1), this.loadtotals()]);
    } catch (error) {
      console.error('Failed to refresh sales list:', error);
    }
  }

  async loadPage(page: number): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    try {
      const result = await this.salesService.getSalesPage(
        page,
        this.pageSize,
        this.currentDateFrom,
        this.currentDateTo,
        this.searchValue,
        this.searchField
      );
      if (requestId !== this.loadRequestId) return;
      this.currentPage = result.currentPage;
      this.totalCount = result.totalCount;
      this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 1;
      this.items = result.rows;
      this.filteredItems = result.rows;
    } catch (error) {
      console.error('Failed to load sales page:', error);
      if (requestId === this.loadRequestId) {
        this.items = [];
        this.filteredItems = [];
      }
    } finally {
      if (requestId === this.loadRequestId) this.isLoading = false;
    }
  }

  /** Load first page */
  async loadtotals() {
    const dateFrom = this.currentDateFrom ?? '';
    const dateTo = this.currentDateTo ?? '';

    // Select function based on role
    let fetchFn;
    fetchFn = this.salesService.getTotalSales;

    this.total = await fetchFn.call(this.salesService, dateFrom, dateTo);
  }

  /** 🔹 Search field selection */
  async selectSearchField() {
    const alert = await this.alertCtrl.create({
      header: 'Search by',
      inputs: [
        {
          name: 'salesrefnum',
          type: 'radio',
          label: 'Reference Number',
          value: 'salesrefnum',
          checked: this.searchField === 'salesrefnum',
        },
        {
          name: 'salescust',
          type: 'radio',
          label: 'Customer Name',
          value: 'salescust',
          checked: this.searchField === 'salescust',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: async (value) => {
            this.searchField = value;
            void this.loadPage(1);
          },
        },
      ],
    });

    await alert.present();
  }

  getPersonnel(item: any): string {
    if (item.salesdelby && item.salesdelby2) {
      return item.salesdelby + ' | ' + item.salesdelby2;
    } else if (item.salesdelby) {
      return item.salesdelby;
    } else if (item.salesdelby2) {
      return item.salesdelby2;
    } else {
      return '';
    }
  }

  async openDetails(item: any) {
    const filtermodal = await this.modalCtrl.create({
      component: SalesdetailsComponent,
      componentProps: {
        salesid: item.salesid,
        screfnum: item.salesrefnum,
        sales: item,
      },
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.data) {
        console.log('DATA RESULT', result.data);
        const index = this.items.findIndex((i) => i.salesid === item.salesid);
        if (index > -1) {
          this.items[index] = {
            ...this.items[index],
            ...result.data,
          };
          void this.loadPage(this.currentPage);
        }
      }
    });

    await filtermodal.present();
  }

  // Close modal
  dismiss() {
    this.modalCtrl.dismiss();
  }
}

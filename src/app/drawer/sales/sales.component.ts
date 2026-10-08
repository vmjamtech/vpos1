import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  InfiniteScrollCustomEvent,
  IonBadge,
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
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
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonButton,
    IonSkeletonText,
    IonSpinner,
    IonBadge,
    IonFooter,
    DateRangeDisplayComponent,
  ],
})
export class SalesComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  isSearching: boolean = false;
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  isRefreshing = false;
  skeletonArray = Array(10);
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  total: number = 0;
  private hasEnteredView = false;

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

  /** 📡 Fetch items from database safely */
  private async fetchItems(): Promise<any[]> {
    // 🔒 Prevent fetching if already loaded
    if (this.allLoaded) return [];

    let items: any[] = [];

    items =
      this.currentDateFrom && this.currentDateTo
        ? await this.salesService.getSalesFilterdb(
            this.limit,
            this.offset,
            this.currentDateFrom,
            this.currentDateTo
          )
        : await this.salesService.getSalesdb(this.limit, this.offset);

    console.log(items);
    await this.loadtotals();

    // Mark allLoaded if fewer items returned than limit
    if (items.length < this.limit) this.allLoaded = true;

    // Increment offset by actual fetched items
    this.offset += items.length;

    return items;
  }

  /** 🔽 Infinite Scroll Loader */
  async loadMore(event: InfiniteScrollCustomEvent) {
    // Prevent multiple triggers
    if (this.allLoaded || this.isFetching) {
      event.target.complete();
      return;
    }

    this.isFetching = true; // 🔒 lock immediately

    try {
      const newItems = await this.fetchItems();
      if (newItems.length > 0) {
        this.items.push(...newItems);
        this.applySearch();
      }
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      this.isFetching = false;
      event.target.complete();
    }
  }

  /** 🔃 Reset + load first page */
  // async resetAndLoad(fromRefresh = false) {
  //   this.isLoading = true;
  //   this.offset = 0;
  //   this.allLoaded = false;
  //   this.isFetching = false;

  //   // Disable infinite scroll during reset
  //   const infinite = document.querySelector('ion-infinite-scroll') as any;
  //   if (infinite) infinite.disabled = true;

  //   const newItems = await this.fetchItems();
  //   this.items = newItems;
  //   this.applySearch();

  //   this.isLoading = false;

  //   // Re-enable infinite scroll
  //   if (infinite) infinite.disabled = false;
  // }

  async applySearch(reset: boolean = false) {
    const query = this.searchValue.trim();

    // When typing starts or resets → reset offset and list
    if (reset) {
      this.offset = 0;
      this.filteredItems = [];
    }

    // If query empty → load original list
    if (!query) {
      this.filteredItems = [...this.items];
      return;
    }

    // Add prefix
    let searchQuery = query;

    if (this.searchField === 'salesrefnum') {
      searchQuery = `salesrefnum:${query}`;
    } else if (this.searchField === 'salescust') {
      searchQuery = `salescust:${query}`;
    }

    try {
      const rows = await this.salesService.searchOfflineSpecific(
        searchQuery,
        this.limit,
        this.offset
      );

      if (reset) {
        this.filteredItems = rows; // replace
      } else {
        this.filteredItems.push(...rows); // append (infinite scroll)
      }

      // Update offset
      this.offset += this.limit;
    } catch (err) {
      console.error('sales search failed', err);
      this.filteredItems = []; // ensure clear on error
    }
  }

  onSearchChange() {
    this.applySearch(true); // always reset when typing
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
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];
    try {
      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';

      let fetchFn;

      fetchFn = this.salesService.getSalesFilterdb;

      const data: any[] = await fetchFn.call(
        this.salesService,
        this.limit,
        this.offset,
        dateFrom,
        dateTo
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
            this.applySearch();
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
          this.applySearch();
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

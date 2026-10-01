import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  InfiniteScrollCustomEvent,
  IonBadge,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonFooter,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  ModalController,
} from '@ionic/angular/standalone';
import { PettyCashService } from 'src/app/services/pettycash.service';
import { FiltermodalComponent } from '../customers/modal/customertransactions/modals/filtermodal/filtermodal.component';
import {
  getTodayDateRange,
  normalizeDatePickerValue,
  toLocalDateString,
} from 'src/app/utils/date-range';
import { PettycashformComponent } from './modal/pettycashform/pettycashform.component';

@Component({
  selector: 'app-pettycashlogs',
  templateUrl: './pettycashlogs.component.html',
  styleUrls: ['./pettycashlogs.component.scss'],
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
    IonRefresher,
    IonRefresherContent, 
    IonFooter,
    IonFab,
    IonFabButton,
  ],
})
export class PettycashlogsComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  isSearching: boolean = false;
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  cashInTotal = 0;
  cashOutTotal = 0;
  private hasEnteredView = false;

  searchField: 'pettylogremarks' = 'pettylogremarks';
  searchFieldLabels: any = {
    pettylogremarks: 'Remarks',
  };

  constructor(
    private pettyCashService: PettyCashService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    const { dateFrom, dateTo } = getTodayDateRange();
    this.currentDateFrom = dateFrom;
    this.currentDateTo = dateTo;
    await this.resetAndLoad();
  }

  async ionViewDidEnter() {
    if (this.hasEnteredView) {
      await this.applyFilter(
        this.currentDateFrom ?? '',
        this.currentDateTo ?? ''
      );
    }
    this.hasEnteredView = true;
  }

  private getToday(): string {
    return toLocalDateString();
  }

  /** 🔄 Pull-to-refresh */
  async doRefresh(event: any) {
    try {
      await this.resetAndLoad(true);
    } catch (err) {
      console.error(err);
    } finally {
      event.target.complete();
    }
  }

  /** 📡 Fetch items from database safely */
  private async fetchItems(): Promise<any[]> {
    // 🔒 Prevent fetching if already loaded
    if (this.allLoaded) return [];

    let items: any[] = [];

    items =
      this.currentDateFrom && this.currentDateTo
        ? await this.pettyCashService.getFilterdb(
            this.limit,
            this.offset,
            this.currentDateFrom,
            this.currentDateTo
          )
        : await this.pettyCashService.getPettyCash(this.limit, this.offset);

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
  async resetAndLoad(fromRefresh = false) {
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.isFetching = false;

    // Disable infinite scroll during reset
    const infinite = document.querySelector('ion-infinite-scroll') as any;
    if (infinite) infinite.disabled = true;

    const newItems = await this.fetchItems();
    this.items = newItems;
    this.applySearch();

    this.isLoading = false;

    // Re-enable infinite scroll
    if (infinite) infinite.disabled = false;
  }

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

    if (this.searchField === 'pettylogremarks') {
      searchQuery = `pettylogremarks:${query}`;
    }

    try {
      const rows = await this.pettyCashService.searchOfflineSpecific(
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

      fetchFn = this.pettyCashService.getFilterdb;

      const data: any[] = await fetchFn.call(
        this.pettyCashService,
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

    const totals = await this.pettyCashService.getTotalsByType(
      dateFrom,
      dateTo
    );
    this.cashInTotal = totals.cashInTotal;
    this.cashOutTotal = totals.cashOutTotal;
  }

  /** 🔹 Search field selection */
  async selectSearchField() {
    const alert = await this.alertCtrl.create({
      header: 'Search by',
      inputs: [
        {
          name: 'pettylogremarks',
          type: 'radio',
          label: 'Remarks',
          value: 'pettylogremarks',
          checked: this.searchField === 'pettylogremarks',
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

  // Close modal
  dismiss() {
    this.modalCtrl.dismiss();
  }

  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: PettycashformComponent,
      initialBreakpoint: 0.5,
      breakpoints: [0.5],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'add' },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data) {
        // this.items.push(res.data);
        this.resetAndLoad();
        // this.applySearch();
      }
    });

    await modal.present();
  }
}

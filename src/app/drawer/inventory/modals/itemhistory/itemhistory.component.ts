import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
  PopoverController,
} from '@ionic/angular/standalone';
import { ItemhistoryService } from 'src/app/services/itemhistory.service';
import { FiltermodalComponent } from './modal/filtermodal/filtermodal.component';
import {
  getTodayDateRange,
  normalizeDatePickerValue,
} from 'src/app/utils/date-range';

@Component({
  selector: 'app-itemhistory',
  templateUrl: './itemhistory.component.html',
  styleUrls: ['./itemhistory.component.scss'],
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
  ],
})
export class ItemhistoryComponent implements OnInit {
  @Input() itemcode?: string;

  items: any[] = []; // all loaded items
  filteredItems: any[] = []; // filtered by search
  searchValue: string = '';
  offset: number = 0;
  limit: number = 20;
  allLoaded: boolean = false;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  filtertype: string = 'ALL';

  isLoading = true; // skeleton loader for first load
  isFetching = false; // prevent double triggers
  skeletonArray = Array(10);

  constructor(
    private modalCtrl: ModalController,
    private itemHistoryService: ItemhistoryService,
    private popoverCtrl: PopoverController
  ) {}

  async ngOnInit() {
    const { dateFrom, dateTo } = getTodayDateRange();
    this.currentDateFrom = dateFrom;
    this.currentDateTo = dateTo;
    await this.applyFilter(dateFrom, dateTo, this.filtertype);
  }

  async openFilter(ev: Event) {
    const filtermodal = await this.modalCtrl.create({
      component: FiltermodalComponent,
      componentProps: {
        dateFrom: this.currentDateFrom, // pass current values
        dateTo: this.currentDateTo,
        filterType: this.filtertype,
      },
      initialBreakpoint: 0.5,
      breakpoints: [0.5],
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.data) {
        const f = result.data;

        // Today's date in YYYY-MM-DD
        const today = getTodayDateRange().dateFrom;

        // Handle null/empty
        this.currentDateFrom = normalizeDatePickerValue(f.dateFrom, today);
        this.currentDateTo = normalizeDatePickerValue(f.dateTo, today);

        // Filter type
        let type = f.filter;

        this.applyFilter(
          this.currentDateFrom ?? '',
          this.currentDateTo ?? '',
          type
        );
      }
    });

    await filtermodal.present();
  }

  async applyFilter(dateFrom: string, dateTo: string, filter: string) {
    this.currentDateFrom = dateFrom || null;
    this.currentDateTo = dateTo || null;
    this.filtertype = filter || 'ALL';
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    try {
      const data = await this.itemHistoryService.getItemHistoryByfilter(
        this.itemcode ?? '',
        this.currentDateFrom ?? '',
        this.currentDateTo ?? '',
        this.filtertype,
        this.limit,
        this.offset
      );

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

    await this.loadMore(); // load first batch
    this.isLoading = false;
  }

  private fetchCurrentPage(): Promise<any[]> {
    if (this.currentDateFrom && this.currentDateTo) {
      return this.itemHistoryService.getItemHistoryByfilter(
        this.itemcode ?? '',
        this.currentDateFrom,
        this.currentDateTo,
        this.filtertype,
        this.limit,
        this.offset
      );
    }

    return this.itemHistoryService.getItemHistory(
      this.itemcode ?? '',
      this.limit,
      this.offset
    );
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
      const newItems = await this.fetchCurrentPage();

      this.items = [...newItems];
      this.filteredItems = [...this.items];
      this.offset += this.limit;
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
      const newItems = await this.fetchCurrentPage();

      this.items.push(...newItems);
      this.filteredItems = [...this.items];
      this.offset += this.limit;

      if (newItems.length < this.limit) this.allLoaded = true;
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
}

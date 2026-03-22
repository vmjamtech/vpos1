import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  InfiniteScrollCustomEvent,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
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
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { LenditemsService } from 'src/app/services/lenditems.service';
import { FiltermodalComponent } from './modals/filtermodal/filtermodal.component';

@Component({
  selector: 'app-lendhistory',
  templateUrl: './lendhistory.component.html',
  styleUrls: ['./lendhistory.component.scss'],
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
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
  ],
})
export class LendhistoryComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  isSearching: boolean = false;
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  filtertype: string = 'ALL';

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);

  searchField: 'itemhitemc' | 'lenditemname' | 'lendcustname' = 'itemhitemc';
  searchFieldLabels: any = {
    itemhitemc: 'Item Code',
    lenditemname: 'Description',
    lendcustname: 'Customer Name',
  };

  constructor(
    private lendHistoryService: LenditemsService,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    await this.resetAndLoad();
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

    items = await this.lendHistoryService.getLendHistory(
      this.limit,
      this.offset
    );

    console.log(items);

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

  /** 🔍 Apply search */
  applySearch() {
    const query = this.searchValue.trim().toLowerCase();

    if (!query) {
      this.filteredItems = [...this.items];
      return;
    }

    this.filteredItems = this.items.filter((item) => {
      const field = this.searchField || 'itemhitemc';
      return (item[field] || '').toString().toLowerCase().includes(query);
    });
  }

  onSearchChange() {
    this.applySearch();
  }

  async openFilter() {
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
        const today = new Date().toISOString().split('T')[0];

        // Handle null/empty
        this.currentDateFrom = f.dateFrom ? f.dateFrom.split('T')[0] : today;
        this.currentDateTo = f.dateTo ? f.dateTo.split('T')[0] : today;

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
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    try {
      const data = await this.lendHistoryService.getLendHistoryByFilter(
        dateFrom,
        dateTo,
        filter,
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

  /** 🔹 Search field selection */
  async selectSearchField() {
    const alert = await this.alertCtrl.create({
      header: 'Search by',
      inputs: [
        {
          name: 'itemhitemc',
          type: 'radio',
          label: 'Item Code',
          value: 'itemhitemc',
          checked: this.searchField === 'itemhitemc',
        },
        {
          name: 'lenditemname',
          type: 'radio',
          label: 'Description',
          value: 'lenditemname',
          checked: this.searchField === 'lenditemname',
        },
        {
          name: 'lendcustname',
          type: 'radio',
          label: 'Customer Name',
          value: 'lendcustname',
          checked: this.searchField === 'lendcustname',
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
}

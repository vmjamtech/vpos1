import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
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
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { CustomersService } from 'src/app/services/customers.service';
import { FiltermodalComponent } from './modals/filtermodal/filtermodal.component';

@Component({
  selector: 'app-customertransactions',
  templateUrl: './customertransactions.component.html',
  styleUrls: ['./customertransactions.component.scss'],
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
  ],
})
export class CustomertransactionsComponent implements OnInit {
  custid?: number;
  items: any[] = []; // all loaded items
  filteredItems: any[] = []; // filtered by search
  searchValue: string = '';
  offset: number = 0;
  limit: number = 20;
  allLoaded: boolean = false;

  isLoading = true; // skeleton loader for first load
  isFetching = false; // prevent double triggers
  skeletonArray = Array(10);
  totalBalance: number = 0;
  totalamount: number = 0;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private customerService: CustomersService
  ) {}

  ngOnInit() {
    this.loadInitialData();
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

        if (f.mode === 'showAll') {
          this.currentDateFrom = null;
          this.currentDateTo = null;
          this.loadInitialData();
          return;
        }

        if (f.mode === 'filter') {
          const today = new Date().toISOString().split('T')[0];

          // Handle null/empty
          const dateFrom = f.dateFrom ? f.dateFrom.split('T')[0] : today;
          const dateTo = f.dateTo ? f.dateTo.split('T')[0] : today;

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
      const data = await this.customerService.getCustomerTransactionByIdAndDate(
        dateFrom,
        dateTo,
        this.limit,
        this.offset,
        this.custid
      );
      await this.loadtotalBalance();
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
    await this.loadtotalBalance();
    this.isLoading = false;
  }

  /** Load first page */
  async loadtotalBalance() {
    if (this.custid) {
      this.totalBalance = await this.customerService.getCustomerBalanceById(
        this.custid
      );
      this.totalamount = await this.customerService.getCustomerTotalsById(
        this.custid,
        this.currentDateFrom ?? '',
        this.currentDateTo ?? ''
      );
    }
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
      const newItems = await this.customerService.getCustomerTransactionById(
        this.custid,
        this.limit,
        this.offset
      );

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
      let newItems: any[];

      if (this.currentDateFrom && this.currentDateTo) {
        // Filtered load
        newItems = await this.customerService.getCustomerTransactionByIdAndDate(
          this.currentDateFrom,
          this.currentDateTo,
          this.limit,
          this.offset,
          this.custid
        );
      } else {
        // Load all
        newItems = await this.customerService.getCustomerTransactionById(
          this.custid,
          this.limit,
          this.offset
        );
      }

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

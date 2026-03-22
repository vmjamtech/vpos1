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

@Component({
  selector: 'app-customerbalance',
  templateUrl: './customerbalance.component.html',
  styleUrls: ['./customerbalance.component.scss'],
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
export class CustomerbalanceComponent implements OnInit {
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
  currentSort: string = 'name-asc'; // default sort

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private customerService: CustomersService
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  /** Load first page */
  async loadInitialData() {
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    await this.loadMore(); // load first batch
    await this.loadtotalBalance();
    this.isLoading = false;
  }

  /** Load first page */
  async loadtotalBalance() {
    this.totalBalance = await this.customerService.getCustomersBalance();
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
      const newItems = await this.customerService.getCustomersBalancedb(
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
      const newItems = await this.customerService.getCustomersBalancedb(
        this.limit,
        this.offset
      );
      console.log(newItems);

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

  async openSortAlert() {
    const alert = await this.alertController.create({
      header: 'Sort By',
      inputs: [
        {
          name: 'nameAsc',
          type: 'radio',
          label: 'Customer Name A-Z',
          value: 'name-asc',
          checked: this.currentSort === 'name-asc',
        },
        {
          name: 'nameDesc',
          type: 'radio',
          label: 'Customer Name Z-A',
          value: 'name-desc',
          checked: this.currentSort === 'name-desc',
        },
        {
          name: 'balanceAsc',
          type: 'radio',
          label: 'Balance Low → High',
          value: 'balance-asc',
          checked: this.currentSort === 'balance-asc',
        },
        {
          name: 'balanceDesc',
          type: 'radio',
          label: 'Balance High → Low',
          value: 'balance-desc',
          checked: this.currentSort === 'balance-desc',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: (value) => {
            this.currentSort = value; // store selected sort
            this.sortItems(value);
          },
        },
      ],
    });

    await alert.present();
  }

  sortItems(option: string) {
    switch (option) {
      case 'name-asc':
        this.filteredItems.sort((a, b) => a.custname.localeCompare(b.custname));
        break;
      case 'name-desc':
        this.filteredItems.sort((a, b) => b.custname.localeCompare(a.custname));
        break;
      case 'balance-asc':
        this.filteredItems.sort((a, b) => a.custbalance - b.custbalance);
        break;
      case 'balance-desc':
        this.filteredItems.sort((a, b) => b.custbalance - a.custbalance);
        break;
    }
  }

  /** Close modal */
  dismiss() {
    this.modalCtrl.dismiss();
  }
}

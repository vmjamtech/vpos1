import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoadingController } from '@ionic/angular';
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
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CustomersService } from 'src/app/services/customers.service';

@Component({
  selector: 'app-inactivecustomers',
  templateUrl: './inactivecustomers.component.html',
  styleUrls: ['./inactivecustomers.component.scss'],
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
    IonItemSliding,
    IonItemOption,
    IonItemOptions,
  ],
})
export class InactivecustomersComponent implements OnInit {
  items: any[] = []; // all loaded items
  filteredItems: any[] = []; // filtered by search
  searchValue: string = '';
  offset: number = 0;
  limit: number = 20;
  allLoaded: boolean = false;

  isLoading = true; // skeleton loader for first load
  isFetching = false; // prevent double triggers
  skeletonArray = Array(10);
  total: number = 0;
  currentSort: string = 'name-asc'; // default sort

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private customerService: CustomersService,
    private appdateService: AppdateService,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.initialize();
  }

  /** Full initialization: update inactive customers, then load data */
  async initialize() {
    const loading = await this.loadingController.create({
      message: 'Updating inactive customers...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      // 1️⃣ Update inactive customers
      await this.customerService.UpdateInactiveCustomers();

      // 2️⃣ Load initial data
      await this.loadInitialData();
    } catch (err) {
      console.error('Initialization failed:', err);
    } finally {
      loading.dismiss();
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
    await this.loadtotalinactive();
    this.isLoading = false;
  }

  /** Load first page */
  async loadtotalinactive() {
    this.total = await this.customerService.countInactive();
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
      const newItems = await this.customerService.getInactiveCustomers(
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
      const newItems = await this.customerService.getInactiveCustomers(
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

  async deleteConfirm(item: any) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete this customer?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting customer...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.customerService.delete(item.custid);

              // Remove from local array
              this.items = this.items.filter((i) => i.custid !== item.custid);

              // Toast success
              await this.appdateService.showToastjs(
                'Customer deleted successfully!',
                'success'
              );
            } catch (err) {
              console.error('Delete failed:', err);
              await this.appdateService.showToastjs(
                'Failed to Delete Customer',
                'danger'
              );
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async restoreConfirm(item: any) {
    const alert = await this.alertController.create({
      header: 'Confirm restore',
      message: `Are you sure you want to restore this customer?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Restore',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Restoring customer...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.customerService.restore(item.custid);

              // Remove from local array
              this.items = this.items.filter((i) => i.custid !== item.custid);

              // Toast success
              await this.appdateService.showToastjs(
                'Customer restored successfully!',
                'success'
              );
            } catch (err) {
              console.error('Restore failed:', err);
              await this.appdateService.showToastjs(
                'Failed to Restore Customer',
                'danger'
              );
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }
}

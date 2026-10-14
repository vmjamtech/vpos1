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
  isUpdatingInactive = false;

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
      message: 'Loading inactive customers...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      await this.loadInitialData();
    } catch (err) {
      console.error('Initialization failed:', err);
    } finally {
      loading.dismiss();
    }
  }

  async promptInactivityDuration() {
    const alert = await this.alertController.create({
      header: 'Update Inactive Customers',
      subHeader: 'Mark customers based on their transaction inactivity:',
      buttons: [
        {
          text: '1 Week (7 Days)',
          handler: async () => await this.executeInactiveCheck(7),
        },
        {
          text: '1 Month (30 Days)',
          handler: async () => await this.executeInactiveCheck(30),
        },
        {
          text: '3 Months (90 Days)',
          handler: async () => await this.executeInactiveCheck(90),
        },
        {
          text: 'Custom Days',
          handler: async () => await this.promptCustomDays(),
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await alert.present();
  }

  async promptCustomDays() {
    const alert = await this.alertController.create({
      header: 'Custom Inactivity Period',
      inputs: [
        {
          name: 'days',
          type: 'number',
          placeholder: 'Enter number of days',
          min: 1,
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Apply',
          handler: async (data) => {
            const days = Number(data.days);
            if (!Number.isSafeInteger(days) || days < 1) {
              await this.appdateService.showToastjs(
                'Please enter a valid number of days.',
                'warning'
              );
              return false;
            }

            await this.executeInactiveCheck(days);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async executeInactiveCheck(days: number) {
    if (this.isUpdatingInactive) return;
    this.isUpdatingInactive = true;

    const loading = await this.loadingController.create({
      message: 'Checking customer activity...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const result =
        await this.customerService.updateInactiveCustomersByDays(days);
      await this.loadInitialData();
      await this.appdateService.showToastjs(
        `Updated: ${result.movedCount} marked inactive, ${result.reactivatedCount} reactivated, ${result.skippedCount} skipped (no transaction history).`,
        'success'
      );
    } catch (error) {
      console.error('Failed to update inactive customers:', error);
      await this.appdateService.showToastjs(
        'Failed to update inactive customers.',
        'danger'
      );
    } finally {
      this.isUpdatingInactive = false;
      await loading.dismiss();
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

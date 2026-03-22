import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
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
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { LenditemsService } from 'src/app/services/lenditems.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-lendeditems',
  templateUrl: './lendeditems.component.html',
  styleUrls: ['./lendeditems.component.scss'],
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
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
  ],
})
export class LendeditemsComponent implements OnInit {
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

  searchField: 'lenditemcode' | 'lenditemname' | 'lendcustname' =
    'lenditemcode';
  searchFieldLabels: any = {
    lenditemcode: 'Item Code',
    lenditemname: 'Description',
    lendcustname: 'Customer Name',
  };

  filterType: 'LENDED' | 'RETURNED' | 'all' = 'all';

  constructor(
    private lendHistoryService: LenditemsService,
    private appdateService: AppdateService,
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private actionSheetController: ActionSheetController
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

    if (this.filterType === 'all') {
      items = await this.lendHistoryService.getAllLendsdb(
        this.limit,
        this.offset
      );
    } else {
      items = await this.lendHistoryService.getLendorReturn(
        this.filterType,
        this.limit,
        this.offset
      );
    }

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
      const field = this.searchField || 'lenditemcode';
      return (item[field] || '').toString().toLowerCase().includes(query);
    });
  }

  onSearchChange() {
    this.applySearch();
  }

  /** 🔹 Filter selection */
  async selectDisposeFilter() {
    const alert = await this.alertCtrl.create({
      header: 'Filter Items',
      inputs: [
        {
          name: 'LENDED',
          type: 'radio',
          label: 'Lended Items',
          value: 'LENDED',
          checked: this.filterType === 'LENDED',
        },
        {
          name: 'RETURNED',
          type: 'radio',
          label: 'Returned Items',
          value: 'RETURNED',
          checked: this.filterType === 'RETURNED',
        },
        {
          name: 'all',
          type: 'radio',
          label: 'Show All',
          value: 'all',
          checked: this.filterType === 'all',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: async (value) => {
            this.filterType = value;
            await this.resetAndLoad(); // smooth reload
          },
        },
      ],
    });

    await alert.present();
  }

  /** 🔹 Search field selection */
  async selectSearchField() {
    const alert = await this.alertCtrl.create({
      header: 'Search by',
      inputs: [
        {
          name: 'lenditemcode',
          type: 'radio',
          label: 'Item Code',
          value: 'lenditemcode',
          checked: this.searchField === 'lenditemcode',
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

  async selectItem(item: any) {
    if (item.lendstatus === 'RETURNED') {
      return;
    }
    const disposeAlert = await this.alertCtrl.create({
      header: `Return ${item.lenditemcode} - ${item.lenditemname}`,
      inputs: [
        {
          name: 'qty',
          type: 'number',
          placeholder: `Quantity`,
          min: 1,
          max: item.lendqty,
          value: 1,
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const qty = parseInt(data.qty, 10);

            if (isNaN(qty) || qty < 1 || qty > item.lendqty) {
              this.appdateService.showToastjs(
                `Please enter a quantity between 1 and ${item.lendqty}`,
                'danger'
              );
              return false;
            }

            const loading = await this.loadingCtrl.create({
              message: 'Processing return...',
              spinner: 'crescent',
            });
            await loading.present();

            const itemdata = {
              lendid: item.lendid,
              refnum: item.lendrefnum,
              itemcode: item.lenditemcode,
              qty: qty,
            };
            let isequal: boolean = false;
            if (isNaN(qty) || qty < 1 || qty == item.lendqty) {
              isequal = true;
            }
            console.log('isequal', isequal);
            try {
              // 1️⃣ Update quantities
              await this.lendHistoryService.updateQty({
                ...itemdata,
              });

              if (isequal) {
                await this.lendHistoryService.updateReturnAll({
                  ...itemdata,
                });
              } else {
                await this.lendHistoryService.updateReturn({
                  ...itemdata,
                });
              }

              this.resetAndLoad();

              this.appdateService.showToastjs(
                'Item disposed successfully!',
                'success'
              );
            } catch (err) {
              console.error('Failed to dispose item:', err);
              this.appdateService.showToastjs(
                'Failed to dispose item.',
                'danger'
              );
              return false; // keep alert open
            } finally {
              await loading.dismiss();
            }

            return true; // close alert
          },
        },
      ],
    });

    await disposeAlert.present();
  }

  async deleteItemConfirm(item: any) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Are you sure you want this record?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Deleting record...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.lendHistoryService.deleteitem(
                item.lendid,
                item.lendrefnum
              );

              // Remove from local array
              this.items = this.items.filter((i) => i.lendid !== item.lendid);
              this.applySearch();

              // Toast success
              await this.appdateService.showToastjs(
                'Record deleted successfully!',
                'success'
              );
            } catch (err) {
              console.error('Delete failed:', err);
              await this.appdateService.showToastjs(
                'Failed to delete Record',
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

import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
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
import { DisposeService } from 'src/app/services/dispose.service';
import { CategoryformComponent } from '../category/modal/categoryform/categoryform.component';
import { ItemlistComponent } from './modal/itemlist/itemlist.component';
import { CategoryService } from 'src/app/services/category.service';
import { StorageService } from 'src/app/services/storage.service';
import { WarehouseService } from 'src/app/services/warehouse.service';

@Component({
  selector: 'app-disposeitems',
  templateUrl: './disposeitems.component.html',
  styleUrls: ['./disposeitems.component.scss'],
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
    IonFab,
    IonFabButton,
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
export class DisposeitemsComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);

  searchField: 'disitemcode' | 'disitemdesc' = 'disitemcode';
  searchFieldLabels: any = {
    disitemcode: 'Item Code',
    disitemdesc: 'Description',
  };

  filterType: 'disposed' | 'junked' | 'all' = 'disposed';

  constructor(
    private disposeService: DisposeService,
    private warehouseService: WarehouseService,
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

  /** 🔃 Reset + load first page */
  async resetAndLoad(fromRefresh = false) {
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.isFetching = false;

    // Disable infinite scroll while refreshing
    const infinite = document.querySelector('ion-infinite-scroll') as any;
    if (infinite) infinite.disabled = true;

    const newItems = await this.fetchItems();
    this.items = newItems;
    this.applySearch();

    this.isLoading = false;

    // Re-enable infinite scroll after load
    if (infinite) infinite.disabled = false;
  }

  /** 📡 Fetch items from database */
  private async fetchItems(): Promise<any[]> {
    let items: any[] = [];

    if (this.filterType === 'all') {
      items = await this.disposeService.getAllDisposeJunkdb(
        this.limit,
        this.offset
      );
    } else {
      const isDispose = this.filterType === 'disposed';
      items = await this.disposeService.getDisposeorJunkdb(
        this.limit,
        this.offset,
        isDispose
      );
    }

    // If fewer items returned, no more data
    if (items.length < this.limit) this.allLoaded = true;

    this.offset += this.limit;
    return items;
  }

  /** 🔽 Infinite Scroll Loader */
  async loadMore(event: any) {
    if (this.allLoaded || this.isFetching) {
      event.target.complete();
      return;
    }

    this.isFetching = true;

    try {
      const newItems = await this.fetchItems();
      this.items.push(...newItems);
      this.applySearch();
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      this.isFetching = false;
      event.target.complete();
    }
  }

  /** 🔍 Apply search */
  applySearch() {
    const query = this.searchValue.trim().toLowerCase();

    if (!query) {
      this.filteredItems = [...this.items];
      return;
    }

    this.filteredItems = this.items.filter((item) => {
      const field = this.searchField || 'disitemcode';
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
          name: 'disposed',
          type: 'radio',
          label: 'Disposed Items',
          value: 'disposed',
          checked: this.filterType === 'disposed',
        },
        {
          name: 'junked',
          type: 'radio',
          label: 'Junked / Replaced Items',
          value: 'junked',
          checked: this.filterType === 'junked',
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
          name: 'disitemcode',
          type: 'radio',
          label: 'Item Code',
          value: 'disitemcode',
          checked: this.searchField === 'disitemcode',
        },
        {
          name: 'disitemdesc',
          type: 'radio',
          label: 'Description',
          value: 'disitemdesc',
          checked: this.searchField === 'disitemdesc',
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

  /** Open Add Item Modal */
  async openAddItemModal() {
    const modal = await this.modalCtrl.create({
      component: ItemlistComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'add' },
    });

    // Get data when child modal is dismissed
    modal.onDidDismiss().then(async (res) => {
      if (res?.data) {
        // Add disposed item to parent list
        if (this.filterType !== 'junked') {
          this.items.unshift(res.data);
        }

        this.resetAndLoad();
      }
    });

    await modal.present();
  }

  async showOptionsSheet(item: any) {
    if (item.disremarks !== 'DISPOSED') {
      return;
    }
    const actionSheet = await this.actionSheetController.create({
      buttons: [
        {
          text: 'Junk Item',
          icon: 'close-circle-outline',
          handler: () => {
            console.log('Junked Items clicked');
            this.selectItem(item, 'JUNK');
          },
        },
        {
          text: 'Replace Item',
          icon: 'swap-horizontal-outline',
          handler: () => {
            console.log('Replaced Items clicked');
            this.selectItem(item, 'REPLACE');
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async selectItem(item: any, type: string) {
    const disposeAlert = await this.alertCtrl.create({
      header: `${type} ${item.disitemcode}`,
      inputs: [
        {
          name: 'disposeQty',
          type: 'number',
          placeholder: `${type} Quantity`,
          min: 1,
          max: item.whempty,
          value: 1,
        },
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Notes (optional)',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const qty = parseInt(data.disposeQty, 10);

            if (isNaN(qty) || qty < 1 || qty > item.disqty) {
              this.appdateService.showToastjs(
                `Please enter a quantity between 1 and ${item.disqty}`,
                'danger'
              );
              return false; // keep alert open
            }

            const loading = await this.loadingCtrl.create({
              message: 'Processing disposal...',
              spinner: 'crescent',
            });
            await loading.present();

            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const itemdate = `${now.getFullYear()}-${pad(
              now.getMonth() + 1
            )}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
              now.getMinutes()
            )}:${pad(now.getSeconds())}`;
            // Fetch logged-in user
            const user = await this.storageService.get<any>('login-data');
            const disBy = user?.empname || 'ADMINISTRATOR';
            let disremarks: 'JUNKED' | 'REPLACED';

            if (type === 'JUNK') disremarks = 'JUNKED';
            else if (type === 'REPLACE') disremarks = 'REPLACED';
            else throw new Error('Invalid type');

            const disposeData = {
              disitemcode: item.disitemcode,
              disitemdesc: item.disitemdesc,
              disqty: qty,
              disremarks: disremarks,
              disby: disBy,
              DisposeNote: data.notes || '',
              disdate: itemdate,
            };
            let isequal: boolean = false;
            if (isNaN(qty) || qty < 1 || qty == item.disqty) {
              isequal = true;
            }
            console.log('isequal', isequal);
            try {
              // 1️⃣ Update warehouse quantities
              await this.warehouseService.updateDisposeQty({
                disid: item.disid,
                itemcode: item.disitemcode,
                whdispose: qty,
                type: disremarks,
                isequal: isequal,
              });

              // 2️⃣ Insert dispose record
              await this.disposeService.insertDispose(disposeData);

              if (this.filterType !== 'disposed') {
                this.filteredItems.unshift(disposeData);
                if (isequal) {
                  this.filteredItems = this.filteredItems.filter(
                    (i) => i.disid !== item.disid
                  );
                }
                this.appdateService.showToastjs(
                  'Item disposed successfully!',
                  'success'
                );
              }
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
              await this.disposeService.deleteitem(item.disid);

              // Remove from local array
              this.items = this.items.filter((i) => i.disid !== item.disid);
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

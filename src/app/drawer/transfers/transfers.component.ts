import { CommonModule } from '@angular/common';
import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
  AlertController,
  InfiniteScrollCustomEvent,
  IonBadge,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
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
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { TransferService } from 'src/app/services/transfer.service';
import { FiltermodalComponent } from '../customers/modal/customertransactions/modals/filtermodal/filtermodal.component';
import { SupplierComponent } from './modals/supplier/supplier.component';
import { ItemconvertformComponent } from './modals/itemconvertform/itemconvertform.component';
import { StorageService } from 'src/app/services/storage.service';
import { ItemconvertdetailsComponent } from './modals/itemconvertdetails/itemconvertdetails.component';
import { ItemrestockformComponent } from './modals/itemrestockform/itemrestockform.component';
import { RestockdetailsComponent } from './modals/restockdetails/restockdetails.component';

@Component({
  selector: 'app-transfers',
  templateUrl: './transfers.component.html',
  styleUrls: ['./transfers.component.scss'],
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
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
  ],
})
export class TransfersComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  searchField: 'poutrefnum' | 'poutencoder' | 'pouttype' | 'pullsupplier' =
    'poutrefnum';
  searchFieldLabels: any = {
    poutrefnum: 'Transfer Order Number',
    poutencoder: 'Encoder',
    pouttype: 'Category',
    pullsupplier: 'Transfer To',
  };

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  constructor(
    private transferService: TransferService,
    private alertController: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private appdateService: AppdateService,
    private actionSheetController: ActionSheetController,
    private storageService: StorageService,
    private zone: NgZone
  ) {}

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  async ngOnInit() {
    this.loadData();
  }

  async loadData() {
    const today = this.getToday();

    this.currentDateFrom = today;
    this.currentDateTo = today;

    await this.applyFilter(today, today);
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
          const today = new Date().toISOString().split('T')[0];

          // Handle null / empty
          const dateFrom = f.dateFrom ? f.dateFrom.split('T')[0] : today;
          const dateTo = f.dateTo ? f.dateTo.split('T')[0] : today;

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

      fetchFn = this.transferService.getSalesFilterdb;

      const data: any[] = await fetchFn.call(
        this.transferService,
        this.limit,
        this.offset,
        dateFrom,
        dateTo
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

  async openSupplier() {
    const modal = await this.modalCtrl.create({
      component: SupplierComponent,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async showOptionsSheet() {
    const actionSheet = await this.actionSheetController.create({
      buttons: [
        {
          text: 'Supplier',
          icon: 'business-outline',
          handler: () => {
            console.log('Customers With Balance clicked');
            this.openSupplier();
            // TODO: Add your logic here
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

  async doRefresh(event: any) {
    try {
      const today = this.getToday();

      this.currentDateFrom = today;
      this.currentDateTo = today;

      await this.applyFilter(today, today);
    } catch (err) {
      console.error(err);
    } finally {
      event.target.complete();
    }
  }

  // 🔹 When changing search field, reset pagination
  async selectSearchField() {
    const alert = await this.alertController.create({
      header: 'Search by',
      inputs: [
        {
          name: 'poutrefnum',
          type: 'radio',
          label: 'Transfer Order Number',
          value: 'poutrefnum',
          checked: this.searchField === 'poutrefnum',
        },
        {
          name: 'poutencoder',
          type: 'radio',
          label: 'Encoder',
          value: 'poutencoder',
          checked: this.searchField === 'poutencoder',
        },
        {
          name: 'pouttype',
          type: 'radio',
          label: 'Category',
          value: 'pouttype',
          checked: this.searchField === 'pouttype',
        },
        {
          name: 'pullsupplier',
          type: 'radio',
          label: 'Transfer To',
          value: 'pullsupplier',
          checked: this.searchField === 'pullsupplier',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: async (value) => {
            this.loadData();
          },
        },
      ],
    });

    await alert.present();
  }

  async loadMore(event?: InfiniteScrollCustomEvent) {
    if (this.isFetching || this.allLoaded) {
      event?.target.complete();
      return;
    }

    this.isFetching = true;

    try {
      const newItems = await this.transferService.getTransfers(
        this.limit,
        this.offset
      );

      // Append new items
      this.items.push(...newItems);

      // Increment offset by actual fetched items

      this.offset += newItems.length;

      // Mark allLoaded if no more items
      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }

      this.applySearch();
    } catch (err) {
      console.error('Load more failed', err);
    } finally {
      this.isFetching = false;
      event?.target.complete();
    }
  }

  async applySearch() {
    const query = this.searchValue.trim();

    if (!query) {
      this.filteredItems = [...this.items];
      return;
    }

    try {
      // Include the field prefix based on the selected searchField
      let searchQuery = query;

      if (this.searchField === 'poutrefnum') {
        searchQuery = `poutrefnum:${query}`;
      } else if (this.searchField === 'poutencoder') {
        searchQuery = `poutencoder:${query}`;
      } else if (this.searchField === 'pouttype') {
        searchQuery = `pouttype:${query}`;
      } else if (this.searchField === 'pullsupplier') {
        searchQuery = `pullsupplier:${query}`;
      }
      // if this.searchField is undefined or 'all', just use query as is

      this.filteredItems = await this.transferService.searchOfflineSpecific(
        searchQuery
      );
    } catch (err) {
      console.error('Tansfer search failed', err);
      this.filteredItems = [];
    }
  }

  onSearchChange() {
    this.applySearch();
  }

  /** Open Add Item Modal */
  async openAddModal() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Transfer Creation',
      buttons: [
        {
          text: 'Store Convert',
          icon: 'swap-horizontal-outline',
          handler: () => {
            this.openConvert(
              'Store Convert',
              'CONVERT',
              'Empty Items (+)',
              'Empty Items (-)',
              'STORE'
            );
          },
        },
        {
          text: 'Create Convert',
          icon: 'create-outline',
          handler: () => {
            this.openConvert(
              'Create Convert',
              'CREATE',
              'Fill Items (+)',
              'Empty Items (-)',
              'STORE'
            );
          },
        },
        {
          text: 'Used Convert',
          icon: 'clipboard-outline',
          handler: () => {
            this.openConvert(
              'Used Convert',
              'USED',
              'Fill Items (-)',
              'Empty Items (+)',
              'STORE'
            );
          },
        },

        {
          text: 'Store Restock Out', // Items sent out for refill
          icon: 'return-up-back-outline',
          handler: () => {
            this.openRestock(
              'Restock Out',
              'RESTOCK OUT',
              'Fill Items (-)',
              'Empty Items (-)'
            );
          },
        },
        {
          text: 'Store Restock In', // Items returned/refilled
          icon: 'add-circle-outline',
          handler: () => {
            this.openRestock(
              'Restock In',
              'RESTOCK IN',
              'Fill Items (+)',
              'Empty Items (+)'
            );
          },
        },
        {
          text: 'Warehouse Out', // Stock leaving warehouse
          icon: 'arrow-up-circle-outline',
          handler: () => {
            this.openConvert(
              'Warehouse Out',
              'WAREHOUSE OUT',
              'Fill Items (-)',
              'Empty Items (-)',
              'STORE'
            );
          },
        },
        {
          text: 'Warehouse In', // Stock entering warehouse
          icon: 'arrow-down-circle-outline',
          handler: () => {
            this.openConvert(
              'Warehouse In',
              'WAREHOUSE IN',
              'Fill Items (+)',
              'Empty Items (+)',
              'WAREHOUSE'
            );
          },
        },
        {
          text: 'Warehouse Restock Out', // Sent out for refill
          icon: 'arrow-back-circle-outline',
          handler: () => {
            this.openRestock(
              'Warehouse Restock Out',
              'W.RESTOCK OUT',
              'Fill Items (-)',
              'Empty Items (-)'
            );
          },
        },
        {
          text: 'Warehouse Restock In', // Refilled items coming in
          icon: 'arrow-forward-circle-outline',
          handler: () => {
            this.openRestock(
              'Warehouse Restock In',
              'W.RESTOCK IN',
              'Fill Items (+)',
              'Empty Items (+)'
            );
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

  async openConvert(
    title: string,
    type: string,
    cart1: string,
    cart2: string,
    pullsupplier: string
  ) {
    const refnum = await this.transferService.generateRefNum();
    const user = await this.storageService.get<any>('login-data');
    const username = user?.empname || 'ADMINISTRATOR';
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const pulldate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
    const modal = await this.modalCtrl.create({
      component: ItemconvertformComponent,
      initialBreakpoint: 0.95,
      breakpoints: [0.95],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        mode: 'add',
        poutrefnum: refnum,
        poutencoder: username,
        pulldate: pulldate,
        title: title,
        cart1: cart1,
        cart2: cart2,
        transtype: type,
        pullsupplier: pullsupplier,
      },
    });
    modal.onDidDismiss().then((res) => {
      if (res.data) {
        this.zone.run(() => this.loadData());
      }
    });
    await modal.present();
  }

  async openRestock(title: string, type: string, cart1: string, cart2: string) {
    const refnum = await this.transferService.generateRefNum();
    const user = await this.storageService.get<any>('login-data');
    const username = user?.empname || 'ADMINISTRATOR';
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const pulldate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
      now.getSeconds()
    )}`;
    const modal = await this.modalCtrl.create({
      component: ItemrestockformComponent,
      initialBreakpoint: 0.95,
      breakpoints: [0.95],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        mode: 'add',
        poutrefnum: refnum,
        poutencoder: username,
        pulldate: pulldate,
        title: title,
        cart1: cart1,
        cart2: cart2,
        transtype: type,
      },
    });
    modal.onDidDismiss().then((res) => {
      if (res.data) {
        this.zone.run(() => this.loadData());
      }
    });
    await modal.present();
  }

  async openDetails(item: any) {
    const type = (item.pouttype || '').toUpperCase();

    if (type.includes('RESTOCK')) {
      this.openRestockDetails(item);
    } else {
      this.openConvertDetails(item);
    }
  }

  async openConvertDetails(item: any) {
    const filtermodal = await this.modalCtrl.create({
      component: ItemconvertdetailsComponent,
      componentProps: {
        poutrefnum: item.poutrefnum,
        pouttype: item.pouttype,
        data: item,
      },
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.role) {
        console.log(result);
        const index = this.items.findIndex((i) => i.poutid === item.poutid);
        if (index > -1) {
          this.items[index].pulloutremarks = result.role;
          this.applySearch();
        }
      }
    });

    await filtermodal.present();
  }

  async openRestockDetails(item: any) {
    const filtermodal = await this.modalCtrl.create({
      component: RestockdetailsComponent,
      componentProps: {
        poutrefnum: item.poutrefnum,
        pouttype: item.pouttype,
        pullsupplier: item.pullsupplier,
        data: item,
      },
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.role) {
        const index = this.items.findIndex((i) => i.poutid === item.poutid);
        if (index > -1) {
          this.items[index].pulloutremarks = result.role;
          this.applySearch();
        }
      }
    });

    await filtermodal.present();
  }

  async deleteConfirm(item: any, sliding?: IonItemSliding) {
    console.log(item);
    const alert = await this.alertController.create({
      header: 'Confirm Cancel',
      message: `Are you sure you want to cancel this transfer?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Cancelling transfer...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.transferService.cancel(item.poutid);

              const index = this.items.findIndex(
                (i) => i.poutid === item.poutid
              );
              if (index > -1) {
                this.items[index].pulloutremarks = 'CANCELLED';
                this.applySearch();
              }

              // Toast success
              await this.appdateService.showToastjs(
                'Transfer cancelled successfully!',
                'success'
              );
            } catch (err) {
              console.error('cancelled failed:', err);
              await this.appdateService.showToastjs(
                'Failed to cancelled Transfer item',
                'danger'
              );
            } finally {
              if (sliding) sliding.close();
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }
}

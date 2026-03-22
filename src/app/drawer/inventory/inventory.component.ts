import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBadge,
  IonButton,
  IonChip,
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
import { CategoryService } from 'src/app/services/category.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { CategoryComponent } from './modals/category/category.component';
import { CommissionsComponent } from './modals/commissions/commissions.component';
import { InventoryformComponent } from './modals/inventoryform/inventoryform.component';
import { AppdateService } from 'src/app/services/appdate.service';
import { WarehouseitemsComponent } from './modals/warehouseitems/warehouseitems.component';
import { DisposeitemsComponent } from './modals/disposeitems/disposeitems.component';
import { ItemhistoryComponent } from './modals/itemhistory/itemhistory.component';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss'],
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
    IonChip,
    IonFab,
    IonFabButton,
    IonRefresher,
    IonRefresherContent,
    IonItemSliding,
    IonItemOption,
    IonItemOptions,
    IonBadge,
  ],
})
export class InventoryComponent implements OnInit {
  items: any[] = []; // all loaded items
  filteredItems: any[] = []; // filtered by search
  categories: any[] = [];
  selectedCategory: string = '';

  searchValue: string = '';
  offset: number = 0;
  limit: number = 20;
  allLoaded: boolean = false;

  isLoading = false;
  skeletonArray = Array(10);

  searchField: 'itemcode' | 'description' = 'itemcode';
  searchFieldLabels: { [key: string]: string } = {
    itemcode: 'Item Code',
    description: 'Description',
  };

  sortField: 'itemcode' | 'description' | 'fillqty' | 'emptyqty' = 'itemcode';
  sortOrder: 'asc' | 'desc' = 'asc';

  constructor(
    private inventoryService: InventoryService,
    private categoryService: CategoryService,
    private alertController: AlertController,
    private loadingCtrl: LoadingController,
    private actionSheetController: ActionSheetController,
    private modalCtrl: ModalController,
    private appdateService: AppdateService
  ) {}

  async ngOnInit() {
    await this.loadCategories();
  }

  async loadCategories() {
    try {
      this.categories = await this.categoryService.getAllCategories();

      // Automatically select the first category
      if (this.categories.length > 0) {
        this.selectCategory(this.categories[0].category); // or .catid if you use IDs
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async doRefresh(event: any) {
    try {
      await this.loadCategories(); // reload first page
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete(); // signal refresher to stop
    }
  }

  async selectSearchField() {
    const alert = await this.alertController.create({
      header: 'Search by',
      inputs: [
        {
          name: 'itemcode',
          type: 'radio',
          label: 'Item Code',
          value: 'itemcode',
          checked: this.searchField === 'itemcode',
        },
        {
          name: 'description',
          type: 'radio',
          label: 'Description',
          value: 'description',
          checked: this.searchField === 'description',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'OK',
          handler: (value) => {
            this.searchField = value;
            this.loadMore();
          },
        },
      ],
    });

    await alert.present();
  }

  async selectSortField() {
    const alert = await this.alertController.create({
      header: 'Sort by',
      inputs: [
        {
          name: 'itemcode',
          type: 'radio',
          label: 'Item Code',
          value: 'itemcode',
          checked: this.sortField === 'itemcode',
        },
        {
          name: 'description',
          type: 'radio',
          label: 'Description',
          value: 'description',
          checked: this.sortField === 'description',
        },
        {
          name: 'fillqty',
          type: 'radio',
          label: 'Fill Quantity',
          value: 'fillqty',
          checked: this.sortField === 'fillqty',
        },
        {
          name: 'emptyqty',
          type: 'radio',
          label: 'Empty Quantity',
          value: 'emptyqty',
          checked: this.sortField === 'emptyqty',
        },
      ],
      buttons: [
        {
          text: 'ASC',
          handler: (value) => {
            this.sortField = value;
            this.sortOrder = 'asc';
            this.applySort();
            this.applySearch();
          },
        },
        {
          text: 'DESC',
          handler: (value) => {
            this.sortField = value;
            this.sortOrder = 'desc';
            this.applySort();
            this.applySearch();
          },
        },
        {
          text: 'RESET',
          handler: async (value) => {
            await this.loadCategories();
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  private applySort() {
    if (!this.sortField) {
      return;
    }

    // Map UI value → real field
    const fieldMap: Record<string, string> = {
      itemcode: 'itemcode',
      description: 'itemname',
      fillqty: 'fillqty',
      emptyqty: 'emptyqty',
    };

    const field = fieldMap[this.sortField] ?? this.sortField;
    const isDesc = this.sortOrder === 'desc';

    this.items.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return isDesc ? 1 : -1;
      if (bVal == null) return isDesc ? -1 : 1;

      // Number
      if (!isNaN(aVal) && !isNaN(bVal)) {
        return isDesc ? bVal - aVal : aVal - bVal;
      }

      // String
      const result = aVal
        .toString()
        .toLowerCase()
        .localeCompare(bVal.toString().toLowerCase());

      return isDesc ? -result : result;
    });
  }

  async selectCategory(cat: string) {
    this.selectedCategory = cat;
    this.offset = 0;
    this.items = [];
    this.filteredItems = [];
    this.allLoaded = false;
    await this.loadMore();
  }

  async loadMore(event?: any) {
    if (this.allLoaded) {
      event?.target.complete();
      return;
    }

    const loading = !event
      ? await this.loadingCtrl.create({
          message: 'Loading products...',
          spinner: 'bubbles',
        })
      : null;
    if (loading) await loading.present();

    try {
      const newItems = await this.inventoryService.findByCategory(
        this.selectedCategory,
        this.limit,
        this.offset
      );

      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }

      this.items = [...this.items, ...newItems];
      this.applySearch();
      this.offset += this.limit;
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      if (loading) loading.dismiss();
      event?.target.complete();
    }
  }

  onSearchChange() {
    this.applySearch();
  }

  private applySearch() {
    if (!this.searchValue) {
      this.filteredItems = [...this.items];
      return;
    }

    const search = this.searchValue.toLowerCase();
    this.filteredItems = this.items.filter((item) => {
      const field = this.searchField;
      return (item[field] || '').toString().toLowerCase().includes(search);
    });
  }

  async showOptionsSheet() {
    const actionSheet = await this.actionSheetController.create({
      buttons: [
        {
          text: 'Categories',
          icon: 'grid-outline',
          handler: () => {
            console.log('Categories clicked');
            this.openCategory();
          },
        },
        {
          text: 'Commissions',
          icon: 'cash-outline',
          handler: () => {
            console.log('Commissions clicked');
            this.openCommission();
          },
        },
        {
          text: 'Warehouse Items',
          icon: 'business-outline',
          handler: () => {
            console.log('Warehouse Items clicked');
            this.openWarehouse();
          },
        },
        {
          text: 'Disposed Items',
          icon: 'trash-bin-outline',
          handler: () => {
            console.log('Disposed Items clicked');
            this.openDisposed();
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

  async openCategory() {
    const modal = await this.modalCtrl.create({
      component: CategoryComponent,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async openCommission() {
    const modal = await this.modalCtrl.create({
      component: CommissionsComponent,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async openWarehouse() {
    const modal = await this.modalCtrl.create({
      component: WarehouseitemsComponent,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async openDisposed() {
    const modal = await this.modalCtrl.create({
      component: DisposeitemsComponent,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  /** Open Add Item Modal */
  async openAddItemModal() {
    const modal = await this.modalCtrl.create({
      component: InventoryformComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'add' },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data) {
        this.filteredItems.push(res.data);
        this.applySearch();
      }
    });

    await modal.present();
  }

  async openEditItemModal(item: any) {
    const modal = await this.modalCtrl.create({
      component: InventoryformComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'edit', itemid: item.itemid, itemData: item },
    });

    modal.onDidDismiss().then((res) => {
      if (res.data) {
        const index = this.items.findIndex((i) => i.itemid === item.itemid);
        if (index > -1) {
          this.items[index] = {
            ...this.filteredItems[index],
            ...res.data,
          };
          this.applySearch();
        }
      }
    });

    await modal.present();
  }

  async deleteItemConfirm(item: any) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${item.itemname}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Deleting item...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.inventoryService.deleteitem(item.itemid);

              // Remove from local array
              this.items = this.items.filter((i) => i.itemid !== item.itemid);
              this.applySearch();

              // Toast success
              await this.appdateService.showToastjs(
                'Item deleted successfully!',
                'success'
              );
            } catch (err) {
              console.error('Delete failed:', err);
              await this.appdateService.showToastjs(
                'Failed to delete item',
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

  async viewItemHistory(item: any) {
    const modal = await this.modalCtrl.create({
      component: ItemhistoryComponent,
      expandToScroll: false,
      componentProps: { itemcode: item.itemcode },
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }
}

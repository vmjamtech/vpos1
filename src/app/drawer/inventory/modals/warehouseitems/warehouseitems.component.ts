import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
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
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { WarehouseformComponent } from './modal/warehouseform/warehouseform.component';

@Component({
  selector: 'app-warehouseitems',
  templateUrl: './warehouseitems.component.html',
  styleUrls: ['./warehouseitems.component.scss'],
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
    IonRefresher,
    IonRefresherContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBadge,
    IonFab,
    IonFabButton,
    IonItemSliding,
  ],
})
export class WarehouseitemsComponent implements OnInit {
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

  constructor(
    private warehouseService: WarehouseService,
    private categoryService: CategoryService,
    private alertController: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController
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
      const newItems = await this.warehouseService.findByCategory(
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
      console.error('Error loading warehouse items:', error);
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

  // Close modal
  dismiss() {
    this.modalCtrl.dismiss();
  }

  /** Open Add Item Modal */
  async openAddItemModal() {
    const modal = await this.modalCtrl.create({
      component: WarehouseformComponent,
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
      component: WarehouseformComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'edit', itemid: item.itemid, itemData: item },
    });

    modal.onDidDismiss().then((res) => {
      if (res.data) {
        const index = this.filteredItems.findIndex(
          (i) => i.itemid === item.itemid
        );
        if (index > -1) {
          this.filteredItems[index] = {
            ...this.filteredItems[index],
            ...res.data,
          };
          this.applySearch();
        }
      }
    });

    await modal.present();
  }
}

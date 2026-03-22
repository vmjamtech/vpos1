import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoadingController } from '@ionic/angular';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CategoryService } from 'src/app/services/category.service';
import { DisposeService } from 'src/app/services/dispose.service';
import { StorageService } from 'src/app/services/storage.service';
import { WarehouseService } from 'src/app/services/warehouse.service';

@Component({
  selector: 'app-itemlist',
  templateUrl: './itemlist.component.html',
  styleUrls: ['./itemlist.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonList,
    IonSearchbar,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonButton,
    IonSkeletonText,
    IonChip,
    IonButtons,
    IonTitle,
    IonToolbar,
    IonHeader,
    IonBadge,
  ],
})
export class ItemlistComponent implements OnInit {
  categories: any[] = [];
  selectedCategory: string = '';

  items: any[] = [];
  filteredItems: any[] = [];
  searchText: string = '';
  loading: boolean = true;

  limit: number = 30;
  offset: number = 0;
  allLoaded: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private warehouseService: WarehouseService,
    private categoryService: CategoryService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private appdateService: AppdateService,
    private disposeService: DisposeService,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    await this.loadCategories();
  }

  // Load categories from service
  async loadCategories() {
    try {
      this.categories = await this.categoryService.getCategoriesdb();

      // Automatically select the first category
      if (this.categories.length > 0) {
        this.selectCategory(this.categories[0].category); // Use the correct category ID
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  // Load items with pagination
  async loadItems() {
    if (this.allLoaded) {
      console.log('All items loaded, skipping loadItems.');
      return;
    }

    this.loading = true;
    console.log(
      'Loading items for category:',
      this.selectedCategory,
      'offset:',
      this.offset
    );

    try {
      const newItems = await this.warehouseService.findByCategory(
        this.selectedCategory,
        this.limit,
        this.offset
      );

      console.log('Items loaded:', newItems);

      if (newItems.length < this.limit) {
        this.allLoaded = true;
        console.log('All items loaded, reached end of list.');
      }

      this.items = [...this.items, ...newItems];

      // Filter items after loading
      this.filterItems();

      console.log('Filtered items:', this.filteredItems);

      this.offset += this.limit;
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      this.loading = false;
    }
  }

  // Filter items by search text and category
  filterItems() {
    const s = this.searchText.toLowerCase().trim();

    this.filteredItems = this.items.filter((item) => {
      const code = item.itemcode?.toLowerCase() ?? '';
      const name = item.itemname?.toLowerCase() ?? '';
      const category = item.itemcategory ?? '';

      const matchSearch = code.includes(s) || name.includes(s);
      const matchCategory =
        !this.selectedCategory || category === this.selectedCategory;

      const match = matchSearch && matchCategory;
      return match;
    });

    console.log('Filtered items count:', this.filteredItems.length);
  }

  // Select a category and reload items
  async selectCategory(categoryId: string) {
    this.selectedCategory = categoryId;
    this.items = [];
    this.filteredItems = [];
    this.offset = 0;
    this.allLoaded = false;
    await this.loadItems();
  }

  async selectItem(item: any) {
    if (item.whempty === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Stock Unavailable',
        message: `${item.itemcode} (${item.itemname}) is out of empty stock.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const disposeAlert = await this.alertCtrl.create({
      header: `Dispose ${item.itemcode}`,
      inputs: [
        {
          name: 'disposeQty',
          type: 'number',
          placeholder: 'Dispose Quantity',
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

            if (isNaN(qty) || qty < 1 || qty > item.whempty) {
              this.appdateService.showToastjs(
                `Please enter a quantity between 1 and ${item.whempty}`,
                'danger'
              );
              return false; // keep alert open
            }

            // Show loading
            const loading = await this.loadingCtrl.create({
              message: 'Processing disposal...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              const now = new Date();
              const pad = (n: number) => n.toString().padStart(2, '0');
              const itemdate = `${now.getFullYear()}-${pad(
                now.getMonth() + 1
              )}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
                now.getMinutes()
              )}:${pad(now.getSeconds())}`;

              const user = await this.storageService.get<any>('login-data');
              const disBy = user?.empname || 'ADMINISTRATOR';

              const disposeData = {
                disitemcode: item.itemcode,
                disitemdesc: item.itemname,
                disqty: qty,
                disremarks: 'DISPOSED',
                disby: disBy,
                DisposeNote: data.notes || '',
                disdate: itemdate,
              };

              // 1️⃣ Update warehouse quantities
              await this.warehouseService.updateQty({
                itemcode: item.itemcode,
                whempty: qty,
              });

              // 2️⃣ Insert dispose record
              await this.disposeService.insertDispose(disposeData);

              // 3️⃣ Close modal with dispose data
              this.modalCtrl.dismiss(disposeData);

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

  // Close modal
  dismiss() {
    this.modalCtrl.dismiss();
  }

  // Infinite scroll handler
  async loadMore(event: any) {
    await this.loadItems();
    event.target.complete();
  }
}

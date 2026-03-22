import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
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
import { CategoryService } from 'src/app/services/category.service';
import { InventoryService } from 'src/app/services/inventory.service';

@Component({
  selector: 'app-itemlists',
  templateUrl: './itemlists.component.html',
  styleUrls: ['./itemlists.component.scss'],
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
  ],
})
export class ItemlistsComponent implements OnInit {
  qtyField = 'fillqty';
  categories: any[] = [];
  selectedCategory: string = '';
  isWarehouse: number = 0;

  items: any[] = [];
  filteredItems: any[] = [];
  searchText: string = '';
  loading: boolean = true;

  limit: number = 30;
  offset: number = 0;
  allLoaded: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private inventoryService: InventoryService,
    private categoryService: CategoryService,
    private alertCtrl: AlertController
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
      let newItems: any[] = []; // FIXED: declare outside

      if (this.isWarehouse == 1) {
        newItems = await this.inventoryService.findWhByCategory(
          this.selectedCategory,
          this.limit,
          this.offset
        );
      } else {
        newItems = await this.inventoryService.findByCategory(
          this.selectedCategory,
          this.limit,
          this.offset
        );
      }

      console.log('Items loaded:', newItems);

      // Check if end of list
      if (newItems.length < this.limit) {
        this.allLoaded = true;
        console.log('All items loaded, reached end of list.');
      }

      // Append results
      this.items = [...this.items, ...newItems];

      // Apply filtering
      this.filterItems();

      console.log('Filtered items:', this.filteredItems);

      // Increase offset
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

  // Select an item
  async selectItem(item: any) {
    // If no qtyField was supplied, skip validation
    if (!this.qtyField) {
      this.modalCtrl.dismiss(item);
      return;
    }

    // Use value from field
    const available = item[this.qtyField] ?? 0;

    if (available <= 0) {
      const alert = await this.alertCtrl.create({
        header: 'Out of Stock',
        message: `Item ${item.itemcode} (${item.itemname}) is out of stock.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    console.log('PASSED ITEM', item);
    this.modalCtrl.dismiss(item);
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

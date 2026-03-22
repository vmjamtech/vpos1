import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
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
import { CategoryService } from 'src/app/services/category.service';
import { CategoryformComponent } from './modal/categoryform/categoryform.component';
import { AppdateService } from 'src/app/services/appdate.service';

@Component({
  selector: 'app-category',
  templateUrl: './category.component.html',
  styleUrls: ['./category.component.scss'],
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
  ],
})
export class CategoryComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);

  constructor(
    private categoryService: CategoryService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private appdateService: AppdateService
  ) {}

  async ngOnInit() {
    await this.resetAndLoad();
  }
  

  async doRefresh(event: any) {
    try {
      // Show loading spinner (optional for better UX)
      this.isLoading = true;
      await this.resetAndLoad(); // reload first page
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      this.isLoading = false;
      event.target.complete(); // stop refresher
    }
  }

  async resetAndLoad() {
    this.items = [];
    this.filteredItems = [];
    this.offset = 0;
    this.allLoaded = false;
    this.isLoading = true;
    await this.loadMore();
  }

  async loadMore(event?: any) {
    if (this.allLoaded || this.isFetching) {
      event?.target.complete();
      return;
    }

    this.isFetching = true;
    if (!event) this.isLoading = true;

    try {
      const newItems = await this.categoryService.getCategoriesdb(
        this.limit,
        this.offset
      );

      if (newItems.length < this.limit) this.allLoaded = true;

      this.items.push(...newItems);
      this.offset += this.limit;
      this.applySearch();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      this.isFetching = false;
      this.isLoading = false;
      event?.target.complete();
    }
  }

  // Apply search filter
  private applySearch() {
    if (!this.searchValue) {
      this.filteredItems = [...this.items];
      return;
    }

    const search = this.searchValue.toLowerCase();
    this.filteredItems = this.items.filter((item) =>
      item.category?.toLowerCase().includes(search)
    );
  }

  onSearchChange() {
    this.applySearch();
  }

  // Close modal
  dismiss() {
    this.modalCtrl.dismiss();
  }

  async openAddCategoryModal() {
    const modal = await this.modalCtrl.create({
      component: CategoryformComponent,
      initialBreakpoint: 0.7,
      breakpoints: [0.7],
      backdropDismiss: false,
      componentProps: {
        mode: 'add',
      },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data?.newCategory) {
        // Show loading
        const loading = await this.loadingCtrl.create({
          message: 'Updating list...',
          spinner: 'crescent',
          duration: 1000, // optional: auto dismiss after 1s
        });
        await loading.present();

        // Update list
        this.filteredItems.push(res.data.newCategory);
        this.applySearch();

        await loading.dismiss();
      }
    });

    await modal.present();
  }

  async openEditCategoryModal(item: any) {
    const modal = await this.modalCtrl.create({
      component: CategoryformComponent,
      initialBreakpoint: 0.7,
      breakpoints: [0.7],
      backdropDismiss: false,
      componentProps: {
        mode: 'edit',
        category: item,
      },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data?.updatedCategory) {
        const updated = res.data.updatedCategory;

        // Show loading
        const loading = await this.loadingCtrl.create({
          message: 'Updating category...',
          spinner: 'crescent',
          duration: 1000,
        });
        await loading.present();

        const index = this.filteredItems.findIndex(
          (i) => i.catid === updated.catid
        );
        if (index > -1) {
          this.filteredItems[index] = updated;
          this.applySearch();
        }

        await loading.dismiss();
      }
    });

    await modal.present();
  }

  async deleteCategoryConfirm(category: any) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${category.category}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Deleting category...',
              spinner: 'crescent',
            });
            await loading.present();

            await this.categoryService.deleteCategory(category.catid);
            this.items = this.items.filter((i) => i.catid !== category.catid);
            this.applySearch();

            await loading.dismiss();

            await this.appdateService.showToastjs(
              'Category deleted successfully!',
              'success'
            );
          },
        },
      ],
    });

    await alert.present();
  }
}

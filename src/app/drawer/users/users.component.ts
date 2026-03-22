import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
  AlertController,
  InfiniteScrollCustomEvent,
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
import { UserService } from 'src/app/services/user.service';
import { UserformComponent } from './modal/userform/userform.component';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
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
  ],
})
export class UsersComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);

  searchField: 'empname' | 'usern' = 'empname';
  searchFieldLabels: any = {
    empname: 'Employee Name',
    usern: 'User Name',
  };

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  constructor(
    private userService: UserService,
    private alertController: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private appdateService: AppdateService,
    private actionSheetController: ActionSheetController
  ) {}

  async ngOnInit() {
    await this.resetAndLoad();
  }

  async showOptionsSheet() {
    const actionSheet = await this.actionSheetController.create({
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async doRefresh(event: any) {
    if (this.isFetching) {
      event.target.complete();
      return;
    }

    this.isFetching = true;

    try {
      // reset pagination
      this.items = [];
      this.filteredItems = [];
      this.offset = 0;
      this.allLoaded = false;
      this.isLoading = true;

      const newItems = await this.userService.getUsersdb(
        this.limit,
        this.offset
      );

      this.items = [...newItems];
      this.offset += this.limit;

      // Mark allLoaded if fewer items returned
      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }

      // Apply search filter if any
      this.applySearch();
    } catch (err) {
      console.error('Error refreshing users:', err);
    } finally {
      this.isFetching = false;
      this.isLoading = false;
      event.target.complete();
    }
  }

  // 🔹 When changing search field, reset pagination
  async selectSearchField() {
    const alert = await this.alertController.create({
      header: 'Search by',
      inputs: [
        {
          name: 'empname',
          type: 'radio',
          label: 'Employee Name',
          value: 'empname',
          checked: this.searchField === 'empname',
        },
        {
          name: 'usern',
          type: 'radio',
          label: 'Username',
          value: 'usern',
          checked: this.searchField === 'usern',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: async (value) => {
            this.searchField = value;
            await this.resetAndLoad();
          },
        },
      ],
    });

    await alert.present();
  }

  // 🔹 Reset infinite scroll data
  async resetAndLoad() {
    this.items = [];
    this.filteredItems = [];
    this.offset = 0;
    this.allLoaded = false;
    this.isLoading = true;

    // Disable infinite scroll during refresh
    if (this.infiniteScroll) this.infiniteScroll.disabled = true;

    await this.loadMore(); // Load first batch

    this.isLoading = false;
    if (this.infiniteScroll) this.infiniteScroll.disabled = false;
  }

  async loadMore(event?: InfiniteScrollCustomEvent) {
    if (this.isFetching || this.allLoaded) {
      event?.target.complete();
      return;
    }

    this.isFetching = true;

    try {
      const newItems = await this.userService.getUsersdb(
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
        if (this.infiniteScroll) this.infiniteScroll.disabled = true;
      }

      this.applySearch();
    } catch (err) {
      console.error('Load more failed', err);
    } finally {
      this.isFetching = false;
      event?.target.complete();
    }
  }

  onSearchChange() {
    this.applySearch();
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

      if (this.searchField === 'empname') {
        searchQuery = `empname:${query}`;
      } else if (this.searchField === 'usern') {
        searchQuery = `usern:${query}`;
      }
      // if this.searchField is undefined or 'all', just use query as is

      this.filteredItems = await this.userService.searchUserOfflineSpecific(
        searchQuery
      );
    } catch (err) {
      console.error('User search failed', err);
      this.filteredItems = [];
    }
  }

  /** Open Add Item Modal */
  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: UserformComponent,
      initialBreakpoint: 0.8,
      breakpoints: [0.8],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'add' },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data) {
        // this.items.push(res.data);
        this.resetAndLoad();
        // this.applySearch();
      }
    });

    await modal.present();
  }

  async openEditModal(item: any) {
    const modal = await this.modalCtrl.create({
      component: UserformComponent,
      initialBreakpoint: 0.8,
      breakpoints: [0.8],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'edit', userid: item.userid, Data: item },
    });

    modal.onDidDismiss().then((res) => {
      if (res.data) {
        const index = this.filteredItems.findIndex(
          (i) => i.userid === item.userid
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

  async deleteConfirm(item: any) {
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete this User?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Deleting User...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.userService.delete(item.userid);

              // Remove from local array
              this.items = this.items.filter((i) => i.userid !== item.userid);
              this.applySearch();

              // Toast success
              await this.appdateService.showToastjs(
                'User deleted successfully!',
                'success'
              );
            } catch (err) {
              console.error('Delete failed:', err);
              await this.appdateService.showToastjs(
                'Failed to User item',
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

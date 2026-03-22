import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
  AlertController,
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
import { PersonelsService } from 'src/app/services/personels.service';
import { PersonelformComponent } from './modal/personelform/personelform.component';
import { AppdateService } from 'src/app/services/appdate.service';
import { RatesettingsComponent } from './modal/ratesettings/ratesettings.component';
import { PersoneltransactionComponent } from './modal/personeltransaction/personeltransaction.component';
import { PersonelsalaryhistoryComponent } from './modal/personelsalaryhistory/personelsalaryhistory.component';

@Component({
  selector: 'app-personels',
  templateUrl: './personels.component.html',
  styleUrls: ['./personels.component.scss'],
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
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
  ],
})
export class PersonelsComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  offset: number = 0;
  limit: number = 30;
  allLoaded: boolean = false;

  isLoading = false;
  isFetching = false; // <-- prevents double triggers
  skeletonArray = Array(10);

  searchField: 'pname' | 'paddress' = 'pname';
  searchFieldLabels: any = {
    pname: 'Personnel Name',
    paddress: 'Personnel Address',
  };

  constructor(
    private personelService: PersonelsService,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private modalCtrl: ModalController,
    private appdateService: AppdateService,
    private loadingCtrl: LoadingController
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

  async showPersonelOptionsSheet(item: any) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Personnel Options',
      buttons: [
        {
          text: 'Personnel Transactions',
          icon: 'receipt-outline',
          handler: () => {
            // this.openPersonnelTransactions();
            this.openPersonnelTransactions(item);
          },
        },
        {
          text: 'Personnel Salary History',
          icon: 'time-outline',
          handler: () => {
            this.openPersonnelSalaryHistoy(item);
          },
        },
        {
          text: 'Personnel Rate Settings',
          icon: 'settings-outline',
          handler: () => {
            this.openPersonnelRateSettings(item);
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close-outline',
        },
      ],
    });

    await actionSheet.present();
  }

  async openPersonnelRateSettings(item: any) {
    let breakpoints = 0.4;
    if (item.prole === 'Driver') {
      breakpoints = 0.8;
    } else if (item.prole === 'Rider') {
      breakpoints = 0.25;
    }
    const modal = await this.modalCtrl.create({
      component: RatesettingsComponent,
      initialBreakpoint: breakpoints,
      breakpoints: [breakpoints],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'edit', pid: item.pid, Data: item },
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

  async openPersonnelTransactions(item: any) {
    const modal = await this.modalCtrl.create({
      component: PersoneltransactionComponent,
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { pid: item.pid, pname: item.pname, prole: item.prole },
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

  async openPersonnelSalaryHistoy(item: any) {
    const modal = await this.modalCtrl.create({
      component: PersonelsalaryhistoryComponent,
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { pid: item.pid, pname: item.pname, prole: item.prole },
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

  // 🔹 When changing search field, reset pagination
  async selectSearchField() {
    const alert = await this.alertController.create({
      header: 'Search by',
      inputs: [
        {
          name: 'pname',
          type: 'radio',
          label: 'Personnel Name',
          value: 'pname',
          checked: this.searchField === 'pname',
        },
        {
          name: 'paddress',
          type: 'radio',
          label: 'Personnel Address',
          value: 'paddress',
          checked: this.searchField === 'paddress',
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

      const newItems = await this.personelService.getPersonelsdb(
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
      console.error('Error refreshing personnels:', err);
    } finally {
      this.isFetching = false;
      this.isLoading = false;
      event.target.complete();
    }
  }

  // 🔹 Reset infinite scroll data
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
      const newItems = await this.personelService.getPersonelsdb(
        this.limit,
        this.offset
      );

      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }

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

  onSearchChange() {
    this.applySearch();
  }

  private applySearch() {
    if (!this.searchValue) {
      this.filteredItems = [...this.items];
      return;
    }

    const search = this.searchValue.toLowerCase();
    const field = this.searchField;

    this.filteredItems = this.items.filter((item) =>
      (item[field] || '').toString().toLowerCase().includes(search)
    );
  }

  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: PersonelformComponent,
      initialBreakpoint: 0.5,
      breakpoints: [0.5],
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
      component: PersonelformComponent,
      initialBreakpoint: 0.5,
      breakpoints: [0.5],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'edit', pid: item.pid, Data: item },
    });

    modal.onDidDismiss().then((res) => {
      if (res.data) {
        const index = this.items.findIndex((i) => i.pid === item.pid);
        if (index > -1) {
          this.items[index] = {
            ...this.items[index],
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
      message: `Are you sure you want to delete this personnel?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Deleting personnel...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.personelService.delete(item.pid);

              // Remove from local array
              this.items = this.items.filter((i) => i.pid !== item.pid);
              this.applySearch();

              // Toast success
              await this.appdateService.showToastjs(
                'Personnel deleted successfully!',
                'success'
              );
            } catch (err) {
              console.error('Delete failed:', err);
              await this.appdateService.showToastjs(
                'Failed to Personnel item',
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

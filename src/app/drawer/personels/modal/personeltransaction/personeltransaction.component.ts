import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
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
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { FiltermodalComponent } from 'src/app/drawer/customers/modal/customertransactions/modals/filtermodal/filtermodal.component';
import { PersonnelTransactionService } from 'src/app/services/personnel-transaction.service';
import { PaysalaryComponent } from './modals/paysalary/paysalary.component';

@Component({
  selector: 'app-personeltransaction',
  templateUrl: './personeltransaction.component.html',
  styleUrls: ['./personeltransaction.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonIcon,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonList,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonBadge,
    IonFab,
    IonFabButton,
  ],
})
export class PersoneltransactionComponent implements OnInit {
  pid?: number;
  pname?: string;
  prole?: string;
  items: any[] = []; // all loaded items
  filteredItems: any[] = []; // filtered by search
  searchValue: string = '';
  offset: number = 0;
  limit: number = 20;
  allLoaded: boolean = false;

  isLoading = true; // skeleton loader for first load
  isFetching = false; // prevent double triggers
  skeletonArray = Array(10);
  totalsalary: number = 0;
  totalamount: number = 0;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private personelTransactionService: PersonnelTransactionService
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  async openFilter() {
    const filtermodal = await this.modalCtrl.create({
      component: FiltermodalComponent,
      initialBreakpoint: 0.4,
      breakpoints: [0.4],
    });

    filtermodal.onDidDismiss().then((result) => {
      if (result.data) {
        const f = result.data;

        if (f.mode === 'showAll') {
          this.currentDateFrom = null;
          this.currentDateTo = null;
          this.loadInitialData();
          return;
        }

        if (f.mode === 'filter') {
          const today = new Date().toISOString().split('T')[0];

          // Handle null/empty
          const dateFrom = f.dateFrom ? f.dateFrom.split('T')[0] : today;
          const dateTo = f.dateTo ? f.dateTo.split('T')[0] : today;

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
      const isFiltered = !!(this.currentDateFrom && this.currentDateTo);

      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';
      const pname = this.pname ?? '';
      const pid = this.pid ?? 0;
      const loadingAll = !isFiltered;

      let fetchFn;

      // Pick function based on role
      switch (this.prole) {
        case 'StoreKeeper':
          fetchFn =
            this.personelTransactionService.getCashierTransactionByIdAndDate;
          break;
        case 'Rider':
          fetchFn =
            this.personelTransactionService.getRiderTransactionByIdAndDate;
          break;
        default:
          fetchFn =
            this.personelTransactionService.getDriverTransactionByIdAndDate;
          break;
      }

      const data: any[] = await fetchFn.call(
        this.personelTransactionService,
        dateFrom,
        dateTo,
        pname,
        pid,
        this.limit,
        this.offset,
        loadingAll
      );
      await this.loadtotals();
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

  /** Load first page */
  async loadInitialData() {
    this.isLoading = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    await this.loadMore();
    await this.loadtotals();
    this.isLoading = false;
  }

  /** Load first page */
  async loadtotals() {
    if (!this.pid || !this.pname) return;

    const dateFrom = this.currentDateFrom ?? '';
    const dateTo = this.currentDateTo ?? '';
    const pname = this.pname ?? '';
    const pid = this.pid ?? 0;

    const loadingAll = !(this.currentDateFrom && this.currentDateTo);

    // Select function based on role
    let fetchFn;

    switch (this.prole) {
      case 'StoreKeeper':
        fetchFn = this.personelTransactionService.getCashierSumSalary;
        break;
      case 'Rider':
        fetchFn = this.personelTransactionService.getRiderSumSalary;
        break;
      default:
        fetchFn = this.personelTransactionService.getDriverSumSalary;
        break;
    }

    this.totalsalary = await fetchFn.call(
      this.personelTransactionService,
      dateFrom,
      dateTo,
      pname,
      pid,
      loadingAll
    );
  }

  /** Pull-to-refresh */
  async doRefresh(event: any) {
    if (this.isFetching) {
      event.target.complete();
      return;
    }

    this.isFetching = true;
    this.offset = 0;
    this.allLoaded = false;
    this.items = [];
    this.filteredItems = [];

    try {
      const isFiltered = !!(this.currentDateFrom && this.currentDateTo);
      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';
      const pname = this.pname ?? '';
      const pid = this.pid ?? 0;
      const loadingAll = !isFiltered;
      let fetchFn;

      // Pick function based on role
      switch (this.prole) {
        case 'StoreKeeper':
          fetchFn =
            this.personelTransactionService.getCashierTransactionByIdAndDate;
          break;
        case 'Rider':
          fetchFn =
            this.personelTransactionService.getRiderTransactionByIdAndDate;
          break;
        default:
          fetchFn =
            this.personelTransactionService.getDriverTransactionByIdAndDate;
          break;
      }

      const newItems: any[] = await fetchFn.call(
        this.personelTransactionService,
        dateFrom,
        dateTo,
        pname,
        pid,
        this.limit,
        this.offset,
        loadingAll
      );

      this.items = [...newItems];
      this.filteredItems = [...this.items];
      this.offset += this.limit;
      if (newItems.length < this.limit) this.allLoaded = true;
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      this.isFetching = false;
      event.target.complete();
    }
  }

  /** Infinite scroll load more */
  async loadMore(event?: any) {
    if (this.allLoaded || this.isFetching) {
      event?.target.complete();
      return;
    }

    this.isFetching = true;

    try {
      const isFiltered = !!(this.currentDateFrom && this.currentDateTo);

      const dateFrom = this.currentDateFrom ?? '';
      const dateTo = this.currentDateTo ?? '';
      const pname = this.pname ?? '';
      const pid = this.pid ?? 0;
      const loadingAll = !isFiltered;

      let fetchFn;

      // Pick function based on role
      switch (this.prole) {
        case 'StoreKeeper':
          fetchFn =
            this.personelTransactionService.getCashierTransactionByIdAndDate;
          break;
        case 'Rider':
          fetchFn =
            this.personelTransactionService.getRiderTransactionByIdAndDate;
          break;
        default:
          fetchFn =
            this.personelTransactionService.getDriverTransactionByIdAndDate;
          break;
      }

      const newItems: any[] = await fetchFn.call(
        this.personelTransactionService,
        dateFrom,
        dateTo,
        pname,
        pid,
        this.limit,
        this.offset,
        loadingAll
      );

      this.items.push(...newItems);
      this.filteredItems = [...this.items];

      this.offset += this.limit;

      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }
    } catch (err) {
      console.error('Error loading more:', err);
    } finally {
      this.isFetching = false;
      event?.target.complete?.();
    }
  }

  /** Close modal */
  dismiss() {
    this.modalCtrl.dismiss();
  }

  async openAddModal() {
    const modal = await this.modalCtrl.create({
      component: PaysalaryComponent,
      initialBreakpoint: 0.85,
      breakpoints: [0.85],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        mode: 'add',
        Data: {
          datefrom: this.currentDateFrom,
          dateto: this.currentDateTo,
          pid: this.pid,
          pname: this.pname,
          incentive: this.totalsalary,
          prole: this.prole,
        },
      },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data) {
        // this.items.push(res.data);
        // this.resetAndLoad();
        // this.applySearch();
      }
    });

    await modal.present();
  }
}

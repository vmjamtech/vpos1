import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  LoadingController,
  ModalController,
  IonBadge,
  IonSelect,
  IonSelectOption,
  ActionSheetController,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { DashboardService } from 'src/app/services/dashboard.service';
import { StorageService } from 'src/app/services/storage.service';
import { ChatComponent } from './modal/chat/chat.component';
import { ItemconvertformComponent } from '../transfers/modals/itemconvertform/itemconvertform.component';
import { TransferService } from 'src/app/services/transfer.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ItemrestockformComponent } from '../transfers/modals/itemrestockform/itemrestockform.component';
import { toLocalDateString } from 'src/app/utils/date-range';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    HighchartsChartComponent,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonList,
    IonSelect,
    IonSelectOption,
    IonRefresher,
    IonRefresherContent,
  ],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // Summary Cards
  sales = 0;
  profit = 0;
  expenses = 0;

  // Date filters
  dateFrom: string = toLocalDateString();
  dateTo: string = toLocalDateString();
  itemsSoldUpdateFlag = false;
  personnelUpdateFlag = false;
  expenseUpdateFlag = false;

  expensesData: { rem: string; amount: number; cdate: string }[] = [];

  lendData: {
    customer: string;
    itemcode: string;
    itemname: string;
    qty: number;
    cdate: string;
    status: string;
  }[] = [];

  // Charts
  itemsSoldChartOptions: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Items Sold' },
    xAxis: { categories: [] },
    yAxis: { title: { text: 'Quantity Sold' }, min: 0 },
    series: [],
    credits: { enabled: false },
  };

  personnelChartOptions: Highcharts.Options = {
    chart: { type: 'bar' },
    title: { text: 'Personnel Transactions' },
    xAxis: { categories: [] },
    yAxis: { title: { text: 'Transactions / Salary' }, min: 0 },
    series: [],
    credits: { enabled: false },
  };

  expensesChartOptions: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'Expenses' },
    series: [],
    credits: { enabled: false },
  };

  lowStocksData: {
    itemcode: string;
    name: string;
    stock: number;
    min: number;
  }[] = [];
  lowStocksChartOptions: Highcharts.Options = {};

  selectedLocation: 'STORE' | 'WAREHOUSE' = 'STORE';
  isLoadingLowStocks = false;
  private itemsSoldChart?: Highcharts.Chart;
  private personnelChart?: Highcharts.Chart;
  private resizeObserver?: ResizeObserver;
  private hasEnteredDashboard = false;

  @ViewChild('itemsSoldHost', { read: ElementRef })
  itemsSoldHost?: ElementRef<HTMLElement>;

  @ViewChild('personnelHost', { read: ElementRef })
  personnelHost?: ElementRef<HTMLElement>;

  @ViewChild('expensesTimeline', { read: ElementRef })
  expensesTimelineHost?: ElementRef<HTMLElement>;

  constructor(
    private dashboardService: DashboardService,
    private storageService: StorageService,
    private modalCtrl: ModalController,
    private inventoryService: InventoryService,
    private actionSheetController: ActionSheetController,
    private transferService: TransferService,
    private zone: NgZone
  ) {}

  async openAI() {
    const modal = await this.modalCtrl.create({
      component: ChatComponent, // your AI chat UI
      cssClass: 'ai-modal',
    });
    await modal.present();
  }

  async ngOnInit() {
    await this.refreshDashboardData();
  }

  ngAfterViewInit() {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.refreshChartLayout());
    if (this.itemsSoldHost?.nativeElement) {
      this.resizeObserver.observe(this.itemsSoldHost.nativeElement);
    }
    if (this.personnelHost?.nativeElement) {
      this.resizeObserver.observe(this.personnelHost.nativeElement);
    }
  }

  async ionViewDidEnter() {
    if (this.hasEnteredDashboard) {
      await this.refreshDashboardData();
    }
    this.hasEnteredDashboard = true;
    this.refreshChartLayout();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  getToday(): string {
    return toLocalDateString();
  }

  async doRefresh(event: any) {
    try {
      await this.refreshDashboardData();
    } finally {
      event.target.complete();
    }
  }

  scrollToExpensesTimeline() {
    this.expensesTimelineHost?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  async onDateChangeInput(event: any) {
    if (!this.dateFrom) this.dateFrom = this.getToday();
    if (!this.dateTo) this.dateTo = this.getToday();
    await this.loadDashboardData();
    this.refreshChartLayout();
  }

  private async refreshDashboardData() {
    await this.loadDashboardData();
    await this.loadLowStocks(this.selectedLocation);
    this.refreshChartLayout();
  }

  private async loadDashboardData() {
    try {
      const user = await this.storageService.get<any>('login-data');
      const empname = user?.empname || 'VMJAM';
      const role = user?.accnttype || 'ADMINISTRATOR';

      // Summary Cards
      this.sales = await this.dashboardService.getSales(
        this.dateFrom,
        this.dateTo,
        role
      );
      this.profit = await this.dashboardService.getProfit(
        this.dateFrom,
        this.dateTo
      );
      this.expenses = await this.dashboardService.getTotalExpense(
        this.dateFrom,
        this.dateTo,
        role,
        empname
      );

      // Top 5 Items Sold
      const topItems = await this.dashboardService.getTopItemsSold(
        this.dateFrom,
        this.dateTo
      );
      console.log('top items', topItems);
      this.updateItemsSoldChart(topItems);

      const personnel = await this.dashboardService.getPersonnelTransactions(
        this.dateFrom,
        this.dateTo,
        role,
        empname
      );
      // console.log('personel', personnel);
      this.updatePersonnelChart(personnel);

      const expenses = await this.dashboardService.getExpenseDetails(
        this.dateFrom,
        this.dateTo,
        role,
        empname
      );
      console.log(expenses);
      // Sort descending by date
      this.expensesData = expenses.sort(
        (a, b) => new Date(b.cdate).getTime() - new Date(a.cdate).getTime()
      );

      const lenditems = await this.dashboardService.getLendDetails(
        this.dateFrom,
        this.dateTo
      );

      console.log(lenditems);
      // Sort descending by date
      this.lendData = lenditems.sort(
        (a, b) => new Date(b.cdate).getTime() - new Date(a.cdate).getTime()
      );
    } catch (err) {
      console.error('Error loading dash board:', err);
    }
  }

  private updateItemsSoldChart(
    items: { scitemcode: string; quantity: number }[]
  ) {
    const hasData = items.length > 0;

    this.itemsSoldChartOptions = {
      ...this.itemsSoldChartOptions,
      xAxis: {
        categories: hasData ? items.map((i) => i.scitemcode) : ['No data'],
      },
      series: [
        {
          type: 'column',
          name: 'Quantity Sold',
          data: hasData ? items.map((i) => i.quantity) : [0],
          color: hasData ? '#0369a1' : '#94a3b8',
        },
      ],
    };
    this.itemsSoldUpdateFlag = true;
    this.refreshChartLayout();
  }

  private updatePersonnelChart(
    personnel: { pname: string; transcount: number; salary: number }[]
  ) {
    const hasData = personnel.length > 0;

    this.personnelChartOptions = {
      ...this.personnelChartOptions,
      xAxis: {
        categories: hasData ? personnel.map((p) => p.pname) : ['No data'],
      },
      series: [
        {
          type: 'bar',
          name: 'Total Transactions',
          data: hasData ? personnel.map((p) => p.transcount) : [0],
          color: hasData ? '#10b981' : '#94a3b8',
        },
        {
          type: 'bar',
          name: 'Salary',
          data: hasData ? personnel.map((p) => p.salary) : [0],
          color: hasData ? '#f59e0b' : '#cbd5e1',
        },
      ],
    };
    this.personnelUpdateFlag = true;
    this.refreshChartLayout();
  }

  onItemsSoldChartInstance(chart: Highcharts.Chart) {
    this.itemsSoldChart = chart;
  }

  onPersonnelChartInstance(chart: Highcharts.Chart) {
    this.personnelChart = chart;
  }

  private refreshChartLayout() {
    const run = () => {
      this.zone.runOutsideAngular(() => {
        this.itemsSoldChart?.reflow();
        this.itemsSoldChart?.redraw(false);
        this.personnelChart?.reflow();
        this.personnelChart?.redraw(false);
      });
    };

    setTimeout(run, 0);
    setTimeout(run, 120);
    setTimeout(run, 320);
  }

  onLocationChange(value: 'STORE' | 'WAREHOUSE') {
    console.log('Selected:', value);
    this.selectedLocation = value;
    this.loadLowStocks(value);
  }

  async loadLowStocks(location: 'STORE' | 'WAREHOUSE') {
    this.isLoadingLowStocks = true;

    try {
      const result =
        location === 'STORE'
          ? await this.dashboardService.getLowStocks()
          : await this.dashboardService.getWhLowStocks();

      this.lowStocksData = result.map((item) => ({
        itemcode: item.itemcode,
        name: item.itemname,
        stock: Number(item.fillqty),
        min: Number(item.alertnum),
      }));
      this.updateLowStockChart();
    } catch (error) {
      console.error(error);
      this.lowStocksData = [];
    } finally {
      this.isLoadingLowStocks = false;
    }
  }

  updateLowStockChart() {
    this.lowStocksChartOptions = {
      chart: {
        type: 'column',
      },
      title: { text: 'Low Stock Items' },
      xAxis: {
        categories: this.lowStocksData.map((i) => i.name),
        title: { text: 'Items' },
      },
      yAxis: {
        min: 0,
        title: { text: 'Quantity' },
        plotLines: [
          {
            value: 10, // optional: can set dynamically
            color: '#ff3b30',
            width: 2,
            dashStyle: 'ShortDash',
            label: { text: 'Minimum Level', style: { color: '#ff3b30' } },
          },
        ],
      },
      tooltip: { shared: true, valueSuffix: ' pcs' },
      series: [
        {
          type: 'column',
          name: 'Current Stock',
          data: this.lowStocksData.map((i) => i.stock),
          color: '#ff9500',
        },
        {
          type: 'column',
          name: 'Minimum Required',
          data: this.lowStocksData.map((i) => i.min),
          color: '#34c759',
        },
      ],
    };
  }

  sortLowStocks(option: string) {
    switch (option) {
      case 'stockAsc':
        this.lowStocksData.sort((a, b) => a.stock - b.stock);
        break;
      case 'stockDesc':
        this.lowStocksData.sort((a, b) => b.stock - a.stock);
        break;
      case 'nameAsc':
        this.lowStocksData.sort((a, b) => a.itemcode.localeCompare(b.itemcode));
        break;
      case 'nameDesc':
        this.lowStocksData.sort((a, b) => b.itemcode.localeCompare(a.itemcode));
        break;
    }

    // Update chart to reflect new order
    this.updateLowStockChart();
  }

  mapInventoryToTransferItem(item: any) {
    return {
      itemid: item.itemid,
      itemcode: item.itemcode,
      itemname: item.itemname,
      itemsize: item.itemsize,
      itemqty: item.itemqty ?? 0,

      // Decide source based on location
      fillqty:
        this.selectedLocation === 'WAREHOUSE'
          ? item.whfill ?? 0
          : item.fillqty ?? 0,

      emptyqty:
        this.selectedLocation === 'WAREHOUSE'
          ? item.whempty ?? 0
          : item.emptyqty ?? 0,

      lendqty: item.lendqty ?? 0,
      alertnum: item.alertnum ?? 0,
      itemcost: item.itemcost ?? 0,
      itemcategory: item.itemcategory,
      qty: 1, // default transfer qty
    };
  }

  async openAddModal(item: any) {
    const buttons: any[] = [];
    const itemDetails = await this.inventoryService.findbyItemCode(
      item.itemcode
    );
    // console.log('Item details for transfer:', itemDetails);
    const mappedItems = itemDetails.map((invItem: any) =>
      this.mapInventoryToTransferItem(invItem)
    );

    // console.log('Mapped transfer items:', mappedItems);
    if (this.selectedLocation === 'STORE') {
      buttons.push(
        {
          text: 'Create Convert',
          icon: 'create-outline',
          handler: () => {
            this.openConvert(
              'Create Convert',
              'CREATE',
              'Fill Items (+)',
              'Empty Items (-)',
              'STORE',
              mappedItems
            );
          },
        },
        {
          text: 'Store Restock In',
          icon: 'add-circle-outline',
          handler: () => {
            this.openRestock(
              'Restock In',
              'RESTOCK IN',
              'Fill Items (+)',
              'Empty Items (+)',
              mappedItems
            );
          },
        }
      );
    }

    if (this.selectedLocation === 'WAREHOUSE') {
      buttons.push(
        {
          text: 'Warehouse In',
          icon: 'arrow-down-circle-outline',
          handler: () => {
            this.openConvert(
              'Warehouse In',
              'WAREHOUSE IN',
              'Fill Items (+)',
              'Empty Items (+)',
              'WAREHOUSE',
              mappedItems
            );
          },
        },
        {
          text: 'Warehouse Restock In',
          icon: 'arrow-forward-circle-outline',
          handler: () => {
            this.openRestock(
              'Warehouse Restock In',
              'W.RESTOCK IN',
              'Fill Items (+)',
              'Empty Items (+)',
              mappedItems
            );
          },
        }
      );
    }

    // Always add cancel
    buttons.push({
      text: 'Cancel',
      role: 'cancel',
    });

    const actionSheet = await this.actionSheetController.create({
      header: 'Transfer Creation',
      buttons,
    });

    await actionSheet.present();
  }

  async openConvert(
    title: string,
    type: string,
    cart1: string,
    cart2: string,
    pullsupplier: string,
    fillitems: any[] = []
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
        fillitems: fillitems,
      },
    });
    modal.onDidDismiss().then((res) => {
      if (res.data) {
        this.zone.run(() => this.loadLowStocks(this.selectedLocation));
      }
    });
    await modal.present();
  }

  async openRestock(
    title: string,
    type: string,
    cart1: string,
    cart2: string,
    fillitems: any[] = []
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
        fillitems: fillitems,
      },
    });
    modal.onDidDismiss().then((res) => {
      if (res.data) {
        this.zone.run(() => this.loadLowStocks(this.selectedLocation));
      }
    });
    await modal.present();
  }
}

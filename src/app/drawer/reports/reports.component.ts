import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonIcon,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
} from '@ionic/angular/standalone';
import {
  ItemSoldReport,
  ReportSummary,
  ReportsDataService,
} from 'src/app/services/reports-data.service';

type ReportView = 'summary' | 'item-sold' | 'inventory' | 'floorstock';

@Component({
  selector: 'app-reports',
  standalone: true,
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonIcon,
    IonLabel,
    IonList,
    IonNote,
    IonSpinner,
  ],
})
export class ReportsComponent {
  readonly reportPageSize = 30;
  readonly today = this.localDate();

  activeView: ReportView | null = null;
  date = this.today;
  fromDate = this.today;
  toDate = this.today;
  cashier = '';
  cashiers: string[] = [];
  summary: ReportSummary | null = null;
  summaryRows: { label: string; amount: number; final?: boolean }[] = [];
  itemSold: ItemSoldReport | null = null;
  storeInventoryRows: any[] = [];
  warehouseInventoryRows: any[] = [];
  floorstockRows: any[] = [];
  itemSoldVisibleCount = this.reportPageSize;
  storeInventoryVisibleCount = this.reportPageSize;
  warehouseInventoryVisibleCount = this.reportPageSize;
  floorstockVisibleCount = this.reportPageSize;
  loading = false;
  private cashiersLoaded = false;
  private loadRequestId = 0;

  get visibleItemSoldRows(): any[] {
    return this.itemSold?.rows.slice(0, this.itemSoldVisibleCount) ?? [];
  }

  get visibleStoreInventoryRows(): any[] {
    return this.storeInventoryRows.slice(0, this.storeInventoryVisibleCount);
  }

  get visibleWarehouseInventoryRows(): any[] {
    return this.warehouseInventoryRows.slice(
      0,
      this.warehouseInventoryVisibleCount
    );
  }

  get visibleFloorstockRows(): any[] {
    return this.floorstockRows.slice(0, this.floorstockVisibleCount);
  }

  get activeViewTitle(): string {
    switch (this.activeView) {
      case 'summary':
        return 'Summary';
      case 'item-sold':
        return 'Item Sold';
      case 'inventory':
        return 'Inventory';
      case 'floorstock':
        return 'Floorstock';
      default:
        return 'Reports';
    }
  }

  private createSummaryRows(
    summary: ReportSummary
  ): { label: string; amount: number; final?: boolean }[] {
    return [
      { label: 'Total Sales', amount: summary.totalSales },
      { label: 'Total Cash', amount: summary.totalCash },
      { label: 'Total Ewallet', amount: summary.totalEwallet },
      { label: 'Total Bank Transfer', amount: summary.totalBankTransfer },
      { label: 'Total Paid', amount: summary.totalPaid },
      { label: 'Total Capital', amount: summary.totalCapital },
      { label: 'Total Discounts', amount: summary.totalDiscounts },
      {
        label: 'Total Special Discount',
        amount: summary.totalSpecialDiscount,
      },
      { label: 'Total Credit', amount: summary.totalCredit },
      { label: 'Total Purchase', amount: summary.totalPurchase },
      { label: 'Total Expense', amount: summary.totalExpense },
      { label: 'Total Salary Paid', amount: summary.totalSalaryPaid },
      { label: 'Final Total', amount: summary.finalTotal, final: true },
    ];
  }

  constructor(
    private reportsService: ReportsDataService,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef
  ) {}

  async onSelectReport(value: ReportView): Promise<void> {
    this.activeView = value;
    await this.loadActiveReport();
  }

  onBackToReports(): void {
    this.loadRequestId++;
    this.loading = false;
    this.activeView = null;
  }

  async onQuickPrint(
    report: ReportView,
    slidingItem: IonItemSliding
  ): Promise<void> {
    console.info('Quick print requested for report:', report);
    await slidingItem.close();
  }

  async loadActiveReport(): Promise<void> {
    const view = this.activeView;
    if (!view) return;

    const requestId = ++this.loadRequestId;
    this.loading = true;
    if (view === 'summary') {
      this.summary = null;
      this.summaryRows = [];
    }
    try {
      if (view === 'summary' && !this.cashiersLoaded) {
        const cashiers = await this.reportsService.getCashiers();
        if (requestId !== this.loadRequestId) return;
        this.cashiers = cashiers;
        this.cashiersLoaded = true;
      }

      switch (view) {
        case 'summary':
          {
            const summary = await this.reportsService.getSummary(
            this.date,
            this.cashier
          );
            if (requestId === this.loadRequestId) {
              this.ngZone.run(() => {
                this.summary = summary;
                this.summaryRows = this.createSummaryRows(summary);
              });
              console.info(
                `[Reports] summary value ready request=${requestId} metrics=${Object.keys(summary).length}`
              );
            }
          }
          break;
        case 'item-sold':
          this.itemSoldVisibleCount = this.reportPageSize;
          {
            const itemSold = await this.reportsService.getItemSold(
            this.fromDate,
            this.toDate
          );
            if (requestId === this.loadRequestId) this.itemSold = itemSold;
          }
          break;
        case 'inventory':
          this.storeInventoryVisibleCount = this.reportPageSize;
          this.warehouseInventoryVisibleCount = this.reportPageSize;
          {
            const [storeRows, warehouseRows] = await Promise.all([
              this.reportsService.getInventorySnapshot(this.date, 'STORE'),
              this.reportsService.getInventorySnapshot(this.date, 'WAREHOUSE'),
            ]);
            if (requestId === this.loadRequestId) {
              this.storeInventoryRows = storeRows;
              this.warehouseInventoryRows = warehouseRows;
            }
          }
          break;
        case 'floorstock':
          this.floorstockVisibleCount = this.reportPageSize;
          {
            const floorstockRows = await this.reportsService.getFloorstockSnapshot(
              this.date
            );
            if (requestId === this.loadRequestId) {
              this.floorstockRows = floorstockRows;
            }
          }
          break;
      }
    } catch (error) {
      console.error('Failed to load report:', error);
      if (requestId === this.loadRequestId) {
        if (view === 'summary') {
          this.summary = null;
          this.summaryRows = [];
        }
        if (view === 'item-sold') this.itemSold = null;
        if (view === 'inventory') {
          this.storeInventoryRows = [];
          this.warehouseInventoryRows = [];
        }
        if (view === 'floorstock') this.floorstockRows = [];
      }
    } finally {
      const isCurrentRequest = requestId === this.loadRequestId;
      console.info(
        `[Reports] load finished view=${view} request=${requestId} current=${this.loadRequestId} currentRequest=${isCurrentRequest}`
      );
      if (isCurrentRequest) {
        this.ngZone.run(() => {
          this.loading = false;
          this.changeDetector.detectChanges();
        });
      }
    }
  }

  showMoreItemSold(): void {
    this.itemSoldVisibleCount += this.reportPageSize;
  }

  showMoreStoreInventory(): void {
    this.storeInventoryVisibleCount += this.reportPageSize;
  }

  showMoreWarehouseInventory(): void {
    this.warehouseInventoryVisibleCount += this.reportPageSize;
  }

  showMoreFloorstock(): void {
    this.floorstockVisibleCount += this.reportPageSize;
  }

  private localDate(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
  }
}

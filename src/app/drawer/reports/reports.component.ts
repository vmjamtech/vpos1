import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonContent,
  IonButton,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonIcon,
  IonChip,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import {
  ItemSoldReport,
  ReportSummary,
  ReportsDataService,
} from 'src/app/services/reports-data.service';
import { CategoryService } from 'src/app/services/category.service';
import { ReportsPrintService, InventoryPrintSection } from 'src/app/services/reports-print.service';
import {
  ReportPrintOptions,
  ReportPrintOptionsComponent,
} from './modal/report-print-options/report-print-options.component';

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
    IonChip,
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
  categories: any[] = [];
  selectedCategory = '';
  itemSoldVisibleCount = this.reportPageSize;
  storeInventoryVisibleCount = this.reportPageSize;
  warehouseInventoryVisibleCount = this.reportPageSize;
  floorstockVisibleCount = this.reportPageSize;
  loading = false;
  printingReport = false;
  private cashiersLoaded = false;
  private categoriesLoaded = false;
  private loadRequestId = 0;

  get visibleItemSoldRows(): any[] {
    return this.itemSold?.rows.slice(0, this.itemSoldVisibleCount) ?? [];
  }

  get visibleStoreInventoryRows(): any[] {
    return this.filteredStoreInventoryRows.slice(
      0,
      this.storeInventoryVisibleCount
    );
  }

  get filteredStoreInventoryRows(): any[] {
    return this.filterRowsByCategory(this.storeInventoryRows);
  }

  get visibleWarehouseInventoryRows(): any[] {
    return this.filteredWarehouseInventoryRows.slice(
      0,
      this.warehouseInventoryVisibleCount
    );
  }

  get filteredWarehouseInventoryRows(): any[] {
    return this.filterRowsByCategory(this.warehouseInventoryRows);
  }

  get visibleFloorstockRows(): any[] {
    return this.filteredFloorstockRows.slice(0, this.floorstockVisibleCount);
  }

  get floorstockCashierName(): string {
    return (
      this.floorstockRows.find((row) => row.cashierName)?.cashierName ||
      'Not recorded'
    );
  }

  get filteredFloorstockRows(): any[] {
    return this.filterRowsByCategory(this.floorstockRows);
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
    private categoryService: CategoryService,
    private reportsPrintService: ReportsPrintService,
    private modalController: ModalController,
    private alertController: AlertController,
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
    if (this.printingReport) {
      await slidingItem.close();
      return;
    }

    this.printingReport = true;
    try {
      const [cashiers, categories] = await Promise.all([
        report === 'summary' ? this.reportsService.getCashiers() : [],
        report === 'inventory' || report === 'floorstock'
          ? this.categoryService.getAllCategories()
          : [],
      ]);
      const modal = await this.modalController.create({
        component: ReportPrintOptionsComponent,
        componentProps: {
          report,
          today: this.today,
          cashiers,
          categories,
        },
        cssClass: 'report-print-modal',
      });
      await modal.present();

      const { data, role } = await modal.onDidDismiss<ReportPrintOptions>();
      if (role === 'confirm' && data) {
        await this.dispatchReportPrint(report, data);
      }
    } catch (error) {
      console.error('Failed to print report:', error);
      const alert = await this.alertController.create({
        header: 'Report Print Error',
        message:
          error instanceof Error ? error.message : 'Unable to print report.',
        buttons: ['OK'],
      });
      await alert.present();
    } finally {
      this.printingReport = false;
      await slidingItem.close();
    }
  }

  private async dispatchReportPrint(
    report: ReportView,
    options: ReportPrintOptions
  ): Promise<void> {
    switch (report) {
      case 'summary': {
        const summary = await this.reportsService.getSummary(
          options.date,
          options.cashier
        );
        await this.reportsPrintService.printSummary(summary, options);
        break;
      }
      case 'item-sold': {
        const itemSold = await this.reportsService.getItemSold(
          options.fromDate,
          options.toDate
        );
        await this.reportsPrintService.printItemSold(itemSold, options);
        break;
      }
      case 'inventory': {
        const locations: ('STORE' | 'WAREHOUSE')[] =
          options.scope === 'BOTH'
            ? ['STORE', 'WAREHOUSE']
            : [options.scope];
        const sections: InventoryPrintSection[] = await Promise.all(
          locations.map(async (location) => {
            const rows = await this.reportsService.getInventorySnapshot(
              options.date,
              location
            );
            return {
              location,
              rows:
                options.category === 'ALL'
                  ? rows
                  : rows.filter((row) => row.category === options.category),
            };
          })
        );
        await this.reportsPrintService.printInventory(sections, options);
        break;
      }
      case 'floorstock': {
        const reportRows = await this.reportsService.getFloorstockSnapshot(
          options.date
        );
        const cashierName =
          reportRows.find((row) => row.cashierName)?.cashierName ??
          'Not recorded';
        const rows =
          options.category === 'ALL'
            ? reportRows
            : reportRows.filter((row) => row.category === options.category);
        await this.reportsPrintService.printFloorstock(
          rows,
          cashierName,
          options
        );
        break;
      }
    }
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

      if (view === 'inventory' || view === 'floorstock') {
        await this.loadCategories();
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

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.storeInventoryVisibleCount = this.reportPageSize;
    this.warehouseInventoryVisibleCount = this.reportPageSize;
    this.floorstockVisibleCount = this.reportPageSize;
  }

  private async loadCategories(): Promise<void> {
    if (this.categoriesLoaded) return;

    try {
      this.categories = await this.categoryService.getAllCategories();
      this.categoriesLoaded = true;
      if (!this.selectedCategory && this.categories.length > 0) {
        this.selectedCategory = this.categories[0].category;
      }
    } catch (error) {
      console.error('Failed to load report categories:', error);
    }
  }

  private filterRowsByCategory(rows: any[]): any[] {
    if (!this.selectedCategory) return [];
    return rows.filter((row) => row.category === this.selectedCategory);
  }

  private localDate(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
  }
}

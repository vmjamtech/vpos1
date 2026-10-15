import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { StoreOnlyService } from 'src/app/services/store-only.service';
import { ReportsDataService } from 'src/app/services/reports-data.service';
import {
  InventoryPrintSection,
  ReportsPrintService,
} from 'src/app/services/reports-print.service';
import {
  ReportLayoutConfig,
  ReportLayoutTab,
  readReportLayoutConfig,
} from '../report-simulator/report-layout.model';

export type ReportPrintType =
  | 'summary'
  | 'item-sold'
  | 'inventory'
  | 'floorstock';

export type InventoryPrintScope = 'STORE' | 'WAREHOUSE' | 'BOTH';

export interface ReportPrintOptions {
  date: string;
  fromDate: string;
  toDate: string;
  cashier: string;
  category: string;
  scope: InventoryPrintScope;
}

@Component({
  selector: 'app-report-print-options',
  standalone: true,
  templateUrl: './report-print-options.component.html',
  styleUrls: ['./report-print-options.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class ReportPrintOptionsComponent implements OnDestroy {
  @Input() report!: ReportPrintType;
  @Input() today = '';
  @Input() cashiers: string[] = [];
  @Input() categories: { category: string }[] = [];

  date = '';
  fromDate = '';
  toDate = '';
  cashier = '';
  category = 'ALL';
  readonly storeOnly = inject(StoreOnlyService);
  scope: InventoryPrintScope = this.storeOnly.enabled ? 'STORE' : 'BOTH';
  dateRangeError = '';
  formattedReceiptText = '';
  isPreviewLoading = false;
  isPrinting = false;
  hasDataToPrint = false;
  previewError = '';
  layoutConfig!: ReportLayoutConfig;
  private previewRequestId = 0;

  constructor(
    private modalController: ModalController,
    private reportsService: ReportsDataService,
    private reportsPrintService: ReportsPrintService,
    private appdateService: AppdateService
  ) {}

  get title(): string {
    const titles: Record<ReportPrintType, string> = {
      summary: 'Summary Report',
      'item-sold': 'Item Sold Report',
      inventory: 'Inventory Report',
      floorstock: 'Floorstock Report',
    };
    return titles[this.report];
  }

  ngOnInit(): void {
    this.date ||= this.today;
    this.fromDate ||= this.today;
    this.toDate ||= this.today;
    this.layoutConfig = readReportLayoutConfig(this.report as ReportLayoutTab);
    void this.refreshPreview();
  }

  ngOnDestroy(): void {
    this.previewRequestId++;
  }

  onOptionsChanged(): void {
    this.dateRangeError = this.dateValidationMessage();
    void this.refreshPreview();
  }

  async refreshPreview(): Promise<void> {
    const requestId = ++this.previewRequestId;
    if (!this.hasValidDates()) {
      this.formattedReceiptText = '';
      this.hasDataToPrint = false;
      this.isPreviewLoading = false;
      return;
    }

    this.isPreviewLoading = true;
    this.previewError = '';
    try {
      const options = this.currentOptions();
      const businessInfo = await this.appdateService.getReceiptBusinessInfo();

      switch (this.report) {
        case 'summary': {
          const summary = await this.reportsService.getSummary(
            options.date,
            options.cashier
          );
          if (requestId !== this.previewRequestId) return;
          this.formattedReceiptText =
            this.reportsPrintService.buildSummaryReceiptText(
              summary,
              options,
              businessInfo,
              this.layoutConfig
            );
          this.hasDataToPrint = true;
          break;
        }
        case 'item-sold': {
          const report = await this.reportsService.getItemSold(
            options.fromDate,
            options.toDate
          );
          if (requestId !== this.previewRequestId) return;
          this.formattedReceiptText =
            this.reportsPrintService.buildItemSoldReceiptText(
              report,
              options,
              businessInfo,
              this.layoutConfig
            );
          this.hasDataToPrint = report.rows.length > 0;
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
          if (requestId !== this.previewRequestId) return;
          this.formattedReceiptText =
            this.reportsPrintService.buildInventoryReceiptText(
              sections,
              options,
              businessInfo,
              this.layoutConfig
            );
          this.hasDataToPrint = sections.some((section) => section.rows.length > 0);
          break;
        }
        case 'floorstock': {
          const reportRows = await this.reportsService.getFloorstockSnapshot(
            options.date
          );
          if (requestId !== this.previewRequestId) return;
          const cashierName =
            reportRows.find((row) => row.cashierName)?.cashierName ??
            'Not recorded';
          const rows =
            options.category === 'ALL'
              ? reportRows
              : reportRows.filter((row) => row.category === options.category);
          this.formattedReceiptText =
            this.reportsPrintService.buildFloorstockReceiptText(
              rows,
              cashierName,
              options,
              businessInfo,
              this.layoutConfig
            );
          this.hasDataToPrint = rows.length > 0;
          break;
        }
      }
    } catch (error) {
      if (requestId === this.previewRequestId) {
        this.formattedReceiptText = '';
        this.hasDataToPrint = false;
        this.previewError =
          error instanceof Error ? error.message : 'Could not load preview.';
      }
    } finally {
      if (requestId === this.previewRequestId) {
        this.isPreviewLoading = false;
      }
    }
  }

  async onConfirmPrint(): Promise<void> {
    this.dateRangeError = this.dateValidationMessage();
    if (this.dateRangeError) return;
    if (this.isPreviewLoading || this.isPrinting || !this.hasDataToPrint) return;

    this.isPrinting = true;
    this.previewError = '';
    try {
      await this.reportsPrintService.printFormattedReceipt(
        this.formattedReceiptText,
        this.layoutConfig
      );
      await this.modalController.dismiss(
        { printed: true },
        'printed'
      );
    } catch (error) {
      this.previewError =
        error instanceof Error ? error.message : 'Unable to print report.';
    } finally {
      this.isPrinting = false;
    }
  }

  cancel(): void {
    this.modalController.dismiss(null, 'cancel');
  }

  confirm(): void {
    if (this.report === 'item-sold') {
      if (!this.fromDate || !this.toDate) {
        this.dateRangeError = 'Select both report dates.';
        return;
      }
      if (this.fromDate > this.toDate) {
        this.dateRangeError = 'Date From must be on or before Date To.';
        return;
      }
    } else if (!this.date) {
      this.dateRangeError = 'Select a report date.';
      return;
    }

    this.modalController.dismiss(
      {
        date: this.date,
        fromDate: this.fromDate,
        toDate: this.toDate,
        cashier: this.cashier,
        category: this.category,
        scope: this.scope,
      } satisfies ReportPrintOptions,
      'confirm'
    );
  }

  private hasValidDates(): boolean {
    return !this.dateValidationMessage();
  }

  private dateValidationMessage(): string {
    if (this.report === 'item-sold') {
      if (!this.fromDate || !this.toDate) return 'Select both report dates.';
      if (this.fromDate > this.toDate) {
        return 'Date From must be on or before Date To.';
      }
      return '';
    }
    return this.date ? '' : 'Select a report date.';
  }

  private currentOptions(): ReportPrintOptions {
    return {
      date: this.date,
      fromDate: this.fromDate,
      toDate: this.toDate,
      cashier: this.cashier,
      category: this.category,
      scope: this.scope,
    };
  }
}
import { Injectable } from '@angular/core';
import moment from 'moment';
import 'moment-timezone';
import { ReportPrintOptions } from 'src/app/drawer/reports/modal/report-print-options/report-print-options.component';
import {
  ItemSoldReport,
  ReportSummary,
} from './reports-data.service';
import { AppdateService, ReceiptBusinessInfo } from './appdate.service';
import { IminPrinterService } from './imin-printer.service';

export interface InventoryPrintSection {
  location: 'STORE' | 'WAREHOUSE';
  rows: any[];
}

@Injectable({ providedIn: 'root' })
export class ReportsPrintService {
  private readonly lineWidth = 30;
  private readonly paperWidth = 384;
  private readonly dividerWidth = this.lineWidth;
  private readonly dividerPaperWidth = this.paperWidth;
  private readonly divider = '-'.repeat(this.lineWidth);

  constructor(
    private printer: IminPrinterService,
    private appdateService: AppdateService
  ) {}

  async printSummary(
    summary: ReportSummary,
    options: ReportPrintOptions
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildSummaryReceiptText(summary, options, businessInfo)
    );
  }

  buildSummaryReceiptText(
    summary: ReportSummary,
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo
  ): string {
    const metrics: [string, number][] = [
      ['Total Sales', summary.totalSales],
      ['Total Cash', summary.totalCash],
      ['Total E-wallet', summary.totalEwallet],
      ['Bank Transfer', summary.totalBankTransfer],
      ['Total Paid', summary.totalPaid],
      ['Total Capital', summary.totalCapital],
      ['Total Discounts', summary.totalDiscounts],
      ['Special Discounts', summary.totalSpecialDiscount],
      ['Total Credit', summary.totalCredit],
      ['Total Purchase', summary.totalPurchase],
      ['Total Expense', summary.totalExpense],
      ['Total Salary Paid', summary.totalSalaryPaid],
    ];
    const body = [
      this.divider,
      this.formatTableRow(['Description', 'Amount'], [20, 10], [1]),
      this.divider,
      ...metrics.map(([label, amount]) => this.formatAmountLine(label, amount)),
      this.divider,
      this.formatAmountLine('Final Total', summary.finalTotal),
    ];
    return this.composeReceipt('SUMMARY REPORT', [
      `Target Date: ${options.date}`,
      `Cashier: ${options.cashier || 'All Cashiers'}`,
    ], body, businessInfo);
  }

  async printItemSold(report: ItemSoldReport, options: ReportPrintOptions): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildItemSoldReceiptText(report, options, businessInfo)
    );
  }

  buildItemSoldReceiptText(
    report: ItemSoldReport,
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo
  ): string {
    const itemSoldWidth = this.lineWidth;
    const itemSoldDivider = this.divider;
    const body = [
      itemSoldDivider,
      this.formatItemSoldRow('CODE', 'SIZE', 'T.QTY'),
      itemSoldDivider,
    ];
    if (report.rows.length === 0) {
      body.push(this.formatItemSoldLine('No items found.'));
    } else {
      for (const row of report.rows) {
        const size = String(row.size ?? '').trim() || 'no size';
        body.push(this.formatItemSoldRow(row.itemCode, size, row.totalItems));
      }
    }
    body.push(
      itemSoldDivider,
      this.formatItemSoldLine(`Total Items: ${report.totalItems}`),
      this.formatItemSoldLine(`Total Weight: ${report.totalKg.toFixed(2)} Kg`)
    );
    return this.composeReceipt('ITEM SOLD REPORT', [
      `Date From: ${options.fromDate}`,
      `Date To: ${options.toDate}`,
    ], body, businessInfo, itemSoldWidth, itemSoldDivider);
  }

  private formatItemSoldRow(
    code: unknown,
    size: unknown,
    quantity: unknown
  ): string {
    const format = (
      value: unknown,
      width: number,
      align: 'left' | 'right' = 'left'
    ): string => {
      const text = String(value ?? '').trim().substring(0, width);
      return align === 'right' ? text.padStart(width, ' ') : text.padEnd(width, ' ');
    };

    return `${format(code, 8)}${format(size, 14)}${format(quantity, 8, 'right')}`;
  }

  private formatItemSoldLine(value: string): string {
    return value.substring(0, this.lineWidth).padEnd(this.lineWidth, ' ');
  }

  async printInventory(
    sections: InventoryPrintSection[],
    options: ReportPrintOptions
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildInventoryReceiptText(sections, options, businessInfo)
    );
  }

  buildInventoryReceiptText(
    sections: InventoryPrintSection[],
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo
  ): string {
    const scopeLabel =
      options.scope === 'BOTH'
        ? 'Store & Warehouse'
        : options.scope === 'STORE'
          ? 'Store Only'
          : 'Warehouse Only';
    let totalFilled = 0;
    let totalEmpty = 0;
    const body: string[] = [];
    for (const section of sections) {
      body.push(
        this.divider,
        this.centerLine(section.location === 'STORE' ? 'STORE' : 'WAREHOUSE'),
        this.formatTableRow(['CODE', 'FILLED', 'EMPTY'], [10, 10, 10], [1, 2])
      );

      if (section.rows.length === 0) {
        body.push(this.formatLine('No items found.'));
      }

      for (const row of section.rows) {
        const filled = Number(row.filledQty) || 0;
        const empty = Number(row.emptyQty) || 0;
        totalFilled += filled;
        totalEmpty += empty;
        body.push(
          this.formatTableRow(
            [row.itemCode ?? '', String(filled), String(empty)],
            [10, 10, 10],
            [1, 2]
          )
        );
      }
    }

    body.push(
      this.divider,
      this.formatLine(`Total Filled: ${totalFilled}`),
      this.formatLine(`Total Empty: ${totalEmpty}`)
    );
    return this.composeReceipt('INVENTORY REPORT', [
      `As of: ${options.date}`,
      `Category: ${this.categoryLabel(options.category)}`,
      `Scope: ${scopeLabel}`,
    ], body, businessInfo);
  }

  async printFloorstock(
    rows: any[],
    cashierName: string,
    options: ReportPrintOptions
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildFloorstockReceiptText(rows, cashierName, options, businessInfo)
    );
  }

  buildFloorstockReceiptText(
    rows: any[],
    cashierName: string,
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo
  ): string {
    const widths = [9, 7, 7, 7];
    const body = [
      this.divider,
      this.formatTableRow(
        ['CODE', 'FILL', 'STOCK', 'NEED'],
        widths,
        [1, 2, 3]
      ),
      this.divider,
    ];

    if (rows.length === 0) {
      body.push(this.formatLine('No items found.'));
    }

    let itemsToRestock = 0;
    let unitsToRestock = 0;
    for (const row of rows) {
      const restockNeed = Number(row.restockNeed) || 0;
      if (restockNeed > 0) itemsToRestock += 1;
      unitsToRestock += restockNeed;
      body.push(this.formatTableRow(
        [
          row.itemCode ?? '',
          String(Number(row.filledQty) || 0),
          String(Number(row.floorstock) || 0),
          String(restockNeed),
        ],
        widths,
        [1, 2, 3]
      ));
    }

    body.push(
      this.divider,
      this.formatLine(`Items to Restock: ${itemsToRestock}`),
      this.formatLine(`Units to Restock: ${unitsToRestock}`)
    );
    return this.composeReceipt('FLOORSTOCK REPORT', [
      `As of: ${options.date}`,
      `Category: ${this.categoryLabel(options.category)}`,
      `Cashier: ${cashierName || 'Not recorded'}`,
    ], body, businessInfo);
  }

  async printFormattedReceipt(
    receiptText: string
  ): Promise<void> {
    const connected = await this.printer.connect();
    if (!connected) throw new Error('Cannot connect to the iMin printer.');

    await this.printer.resetPrinterState();
    try {
      try {
        const status = await this.printer.getPrinterStatus();
        if (status.text !== 'The printer is normal') {
          console.warn('Printer warning:', status.text);
        }
      } catch (error) {
        console.warn('Could not read printer status:', error);
      }

      const lines = receiptText.split('\n');
      const printedLineIndex = lines.findIndex((line) =>
        line.trimStart().startsWith('Printed:')
      );
      const printedLine = printedLineIndex >= 0 ? lines[printedLineIndex] : null;
      for (let index = 0; index < lines.length; index++) {
        if (index === printedLineIndex) continue;
        await this.printReceiptLine(
          lines[index]
        );
      }
      if (printedLine !== null) {
        await this.printReceiptLine(printedLine);
      }
      await this.printer.feedPaper(3);
      await this.printer.cutPaper();
    } finally {
      await this.printer.resetPrinterState();
    }
  }

  private async printReceiptLine(
    line: string
  ): Promise<void> {
    const lineWidth = this.lineWidth;
    await this.printer.setPrintWidth(this.paperWidth);
    await this.printer.printText(
      line.substring(0, lineWidth).padEnd(lineWidth, ' '),
      0
    );
  }

  private composeReceipt(
    title: string,
    details: string[],
    body: string[],
    businessInfo: ReceiptBusinessInfo,
    lineWidth = this.lineWidth,
    divider = this.divider
  ): string {
    const header = [
      ...(businessInfo.compName ? [this.centerLine(businessInfo.compName, lineWidth)] : []),
      ...(businessInfo.compName1 ? [this.centerLine(businessInfo.compName1, lineWidth)] : []),
      this.centerLine(title, lineWidth),
      divider,
      ...details.map((detail) => this.formatLine(detail, lineWidth)),
    ];
    const footer = [
      divider,
      this.formatLine('', lineWidth),
      this.centerLine(
        `Printed: ${moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss')}`,
        lineWidth
      ),
    ];
    return [...header, ...body, ...footer]
      .map((line) =>
        line === divider
          ? line
          : line.substring(0, lineWidth).padEnd(lineWidth, ' ')
      )
      .join('\n');
  }

  private formatTableRow(
    values: unknown[],
    widths: number[],
    rightAlignedColumns: number[],
    columnGap = '',
    lineWidth = this.lineWidth
  ): string {
    const line = values
      .map((value, index) => {
        const text = String(value ?? '').substring(0, widths[index]);
        return rightAlignedColumns.includes(index)
          ? text.padStart(widths[index])
          : text.padEnd(widths[index]);
      })
      .join(columnGap);
    return line.substring(0, lineWidth).padEnd(lineWidth, ' ');
  }

  private formatLine(value: string, lineWidth = this.lineWidth): string {
    return value.substring(0, lineWidth).padEnd(lineWidth, ' ');
  }

  private centerLine(value: string, lineWidth = this.lineWidth): string {
    const text = value.trim().substring(0, lineWidth);
    const leftPadding = Math.floor((lineWidth - text.length) / 2);
    return `${' '.repeat(leftPadding)}${text}`.padEnd(lineWidth, ' ');
  }

  private formatAmountLine(label: string, amount: number): string {
    const value = `₱${(Number(amount) || 0).toFixed(2)}`;
    const labelWidth = 20;
    return this.formatTableRow(
      [label, value],
      [labelWidth, this.lineWidth - labelWidth],
      [1]
    );
  }

  private categoryLabel(category: string): string {
    return category === 'ALL' ? 'All Categories' : category;
  }
}
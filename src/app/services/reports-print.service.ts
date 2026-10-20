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
import {
  ReportColumnConfig,
  ReportLayoutConfig,
  readReportLayoutConfig,
} from 'src/app/drawer/reports/modal/report-simulator/report-layout.model';
import { normalizeItemSize } from '../shared/item-size/item-size.pipe';

export interface InventoryPrintSection {
  location: 'STORE' | 'WAREHOUSE';
  rows: any[];
}

@Injectable({ providedIn: 'root' })
export class ReportsPrintService {
  constructor(
    private printer: IminPrinterService,
    private appdateService: AppdateService
  ) {}

  async printSummary(
    summary: ReportSummary,
    options: ReportPrintOptions,
    layout = readReportLayoutConfig('summary')
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildSummaryReceiptText(summary, options, businessInfo, layout),
      layout
    );
  }

  buildSummaryReceiptText(
    summary: ReportSummary,
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo,
    layout = readReportLayoutConfig('summary')
  ): string {
    const lineWidth = this.getLineWidth(layout);
    const divider = '-'.repeat(lineWidth);
    const metrics: [string, number][] = [
      ['Total Sales', summary.totalSales],
      ['Total Cash', summary.totalCash],
      ['Total E-wallet', summary.totalEwallet],
      ['Total Bank Transfer', summary.totalBankTransfer],
      ['Total Paid', summary.totalPaid],
      ['Total Capital', summary.totalCapital],
      ['Total Discounts', summary.totalDiscounts],
      ['Total Special Discounts', summary.totalSpecialDiscount],
      ['Total Credit', summary.totalCredit],
      ['Total Purchase', summary.totalPurchase],
      ['Total Expense', summary.totalExpense],
      ['Total Salary Paid', summary.totalSalaryPaid],
    ];
    const body = [
      this.formatConfiguredRow(layout.columns.map((column) => column.name), layout, true),
      divider,
      ...metrics.map(([label, amount]) =>
        this.formatConfiguredRow(
          [label, `₱${(Number(amount) || 0).toFixed(2)}`],
          layout
        )
      ),
      divider,
      this.formatConfiguredRow(
        ['Final Total', `₱${(Number(summary.finalTotal) || 0).toFixed(2)}`],
        layout
      ),
    ];
    return this.composeReceipt('SUMMARY REPORT', [
      `Target Date: ${options.date}`,
      `Cashier: ${options.cashier || 'All Cashiers'}`,
    ], body, businessInfo, lineWidth, divider);
  }

  async printItemSold(
    report: ItemSoldReport,
    options: ReportPrintOptions,
    layout = readReportLayoutConfig('item-sold')
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildItemSoldReceiptText(report, options, businessInfo, layout),
      layout
    );
  }

  buildItemSoldReceiptText(
    report: ItemSoldReport,
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo,
    layout = readReportLayoutConfig('item-sold')
  ): string {
    const lineWidth = this.getLineWidth(layout);
    const itemSoldDivider = '-'.repeat(lineWidth);
    const body = [
      itemSoldDivider,
      this.formatConfiguredRow(layout.columns.map((column) => column.name), layout, true),
      itemSoldDivider,
    ];
    if (report.rows.length === 0) {
      body.push(this.formatLine('No items found.', lineWidth));
    } else {
      for (const row of report.rows) {
        const size = normalizeItemSize(row.size);
        body.push(
          this.formatConfiguredRow([row.itemCode, size, row.totalItems], layout)
        );
      }
    }
    body.push(
      itemSoldDivider,
      this.formatLine(`Total Item: ${report.totalItems}`, lineWidth),
      this.formatLine(`Total Weight: ${report.totalKg.toFixed(2)} Kg`, lineWidth)
    );
    return this.composeReceipt('ITEM SOLD REPORT', [
      `Date From: ${options.fromDate}`,
      `Date To: ${options.toDate}`,
    ], body, businessInfo, lineWidth, itemSoldDivider);
  }

  async printInventory(
    sections: InventoryPrintSection[],
    options: ReportPrintOptions,
    layout = readReportLayoutConfig('inventory')
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildInventoryReceiptText(sections, options, businessInfo, layout),
      layout
    );
  }

  buildInventoryReceiptText(
    sections: InventoryPrintSection[],
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo,
    layout = readReportLayoutConfig('inventory')
  ): string {
    const lineWidth = this.getLineWidth(layout);
    const divider = '-'.repeat(lineWidth);
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
        divider,
        this.centerLine(section.location === 'STORE' ? 'STORE' : 'WAREHOUSE', lineWidth),
        this.formatConfiguredRow(layout.columns.map((column) => column.name), layout, true)
      );

      if (section.rows.length === 0) {
        body.push(this.formatLine('No items found.', lineWidth));
      }

      for (const row of section.rows) {
        const filled = Number(row.filledQty) || 0;
        const empty = Number(row.emptyQty) || 0;
        totalFilled += filled;
        totalEmpty += empty;
        body.push(
          this.formatConfiguredRow(
            [row.itemCode ?? '', String(filled), String(empty)],
            layout
          )
        );
      }
    }

    body.push(
      divider,
      this.formatLine(`Total Filled: ${totalFilled}`, lineWidth),
      this.formatLine(`Total Empty: ${totalEmpty}`, lineWidth)
    );
    return this.composeReceipt('INVENTORY REPORT', [
      `As of: ${options.date}`,
      `Category: ${this.categoryLabel(options.category)}`,
      `Scope: ${scopeLabel}`,
    ], body, businessInfo, lineWidth, divider);
  }

  async printFloorstock(
    rows: any[],
    cashierName: string,
    options: ReportPrintOptions,
    layout = readReportLayoutConfig('floorstock')
  ): Promise<void> {
    const businessInfo = await this.appdateService.getReceiptBusinessInfo();
    await this.printFormattedReceipt(
      this.buildFloorstockReceiptText(rows, cashierName, options, businessInfo, layout),
      layout
    );
  }

  buildFloorstockReceiptText(
    rows: any[],
    cashierName: string,
    options: ReportPrintOptions,
    businessInfo: ReceiptBusinessInfo,
    layout = readReportLayoutConfig('floorstock')
  ): string {
    const lineWidth = this.getLineWidth(layout);
    const divider = '-'.repeat(lineWidth);
    const body = [
      divider,
      this.formatConfiguredRow(layout.columns.map((column) => column.name), layout, true),
      divider,
    ];

    if (rows.length === 0) {
      body.push(this.formatLine('No items found.', lineWidth));
    }

    let itemsToRestock = 0;
    let unitsToRestock = 0;
    for (const row of rows) {
      const restockNeed = Number(row.restockNeed) || 0;
      if (restockNeed > 0) itemsToRestock += 1;
      unitsToRestock += restockNeed;
      body.push(this.formatConfiguredRow(
        [
          row.itemCode ?? '',
          String(Number(row.filledQty) || 0),
          String(Number(row.floorstock) || 0),
          String(restockNeed),
        ],
        layout
      ));
    }

    body.push(
      divider,
      this.formatConfiguredRow(['Items to Restock', itemsToRestock], layout),
      this.formatConfiguredRow(['Units to Restock', unitsToRestock], layout)
    );
    return this.composeReceipt('FLOORSTOCK REPORT', [
      `As of: ${options.date}`,
      `Category: ${this.categoryLabel(options.category)}`,
      `Cashier: ${cashierName || 'Not recorded'}`,
    ], body, businessInfo, lineWidth, divider);
  }

  async printFormattedReceipt(
    receiptText: string,
    layout: ReportLayoutConfig
  ): Promise<void> {
    layout = readReportLayoutConfig(layout.tabKey);
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
      const lineWidth = this.getLineWidth(layout);
      const divider = '-'.repeat(lineWidth);
      const headingLine = this.formatConfiguredRow(
        layout.columns.map((column) => column.name),
        layout,
        true
      ).trimEnd();
      let printingValues = false;
      for (let index = 0; index < lines.length; index++) {
        if (index === printedLineIndex) continue;
        const line = lines[index];
        const normalizedLine = line.trimEnd();
        if (normalizedLine === divider) printingValues = false;
        const isHeading = normalizedLine === headingLine;
        if (isHeading) printingValues = true;
        const textKind = isHeading ? 'heading' : printingValues ? 'value' : 'normal';
        await this.printReceiptLine(line, layout, textKind);
      }
      if (printedLine !== null) {
        await this.printReceiptLine(printedLine, layout, 'normal', true);
      }
      const feedCount = Math.max(
        0,
        Math.min(10, Math.floor(Number(layout.feedCount) || 0))
      );
      await this.printer.feedPaper(feedCount);
      await this.printer.cutPaper();
    } finally {
      await this.printer.resetPrinterState();
    }
  }

  private async printReceiptLine(
    line: string,
    layout: ReportLayoutConfig,
    textKind: 'normal' | 'heading' | 'value',
    addNewLine = false
  ): Promise<void> {
    const lineWidth = this.getLineWidth(layout);
    const characterWidth = layout.fontMode === 'Font A' ? 12 : 9;
    const pixelWidth = Math.min(576, Math.max(1, lineWidth * characterWidth));
    const textSize =
      textKind === 'heading' && layout.headingFontSize === 'double-height'
        ? 56
        : textKind === 'value' && layout.valueFontSize === 'condensed'
          ? 20
          : 28;
    const bold = textKind === 'heading' && layout.headingFontSize === 'bold';

    await this.printer.setPrintWidth(pixelWidth);
    await this.printer.setTextTypeface(layout.fontMode === 'Font A' ? 0 : 1);
    await this.printer.setTextSize(textSize);
    await this.printer.setTextStyle(bold ? 1 : 0);
    const text = line.substring(0, lineWidth).padEnd(lineWidth, ' ');
    if (addNewLine) {
      await this.printer.printTextLineOptional(text, 0, true);
    } else {
      await this.printer.printText(text, 0);
    }
  }

  private composeReceipt(
    title: string,
    details: string[],
    body: string[],
    businessInfo: ReceiptBusinessInfo,
    lineWidth: number,
    divider: string
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
        `Printed: ${moment().tz('Asia/Manila').format('YYYY-MM-DD | HH:mm:ss')}`,
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

  private getLineWidth(layout: ReportLayoutConfig): number {
    return Math.max(16, Math.min(48, Math.floor(Number(layout.totalWidth) || 32)));
  }

  private formatConfiguredRow(
    values: unknown[],
    layout: ReportLayoutConfig,
    heading = false
  ): string {
    const lineWidth = this.getLineWidth(layout);
    const line = layout.columns
      .map((column: ReportColumnConfig, index) => {
        const widthValue = heading ? column.headWidth : column.valueWidth;
        const align = heading ? column.headAlign : column.valueAlign;
        const width = Math.max(0, Math.min(48, Math.floor(Number(widthValue) || 0)));
        const text = String(values[index] ?? '').slice(0, width);
        if (align === 'right') return text.padStart(width, ' ');
        if (align === 'center') {
          const left = Math.floor((width - text.length) / 2);
          return text.padStart(text.length + left, ' ').padEnd(width, ' ');
        }
        return text.padEnd(width, ' ');
      })
      .join('');
    return line.slice(0, lineWidth).padEnd(lineWidth, ' ');
  }

  private formatLine(value: string, lineWidth: number): string {
    return value.substring(0, lineWidth).padEnd(lineWidth, ' ');
  }

  private centerLine(value: string, lineWidth: number): string {
    const text = value.trim().substring(0, lineWidth);
    const leftPadding = Math.floor((lineWidth - text.length) / 2);
    return `${' '.repeat(leftPadding)}${text}`.padEnd(lineWidth, ' ');
  }

  private categoryLabel(category: string): string {
    return category === 'ALL' ? 'All Categories' : category;
  }
}
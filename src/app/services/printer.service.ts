import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { IminPrinterService } from './imin-printer.service';
import {
  AppdateService,
  BIR_DISCLAIMER,
  ReceiptBusinessInfo,
  birHeaderLines,
} from './appdate.service';
import moment from 'moment';
import 'moment-timezone';
import { StorageService } from './storage.service';
import { loadImage } from '../utils/load-image';

export interface SalesReceiptPrintData {
  businessInfo: ReceiptBusinessInfo;
  invoiceNo: string;
  date: string;
  cashier: string;
  personnel?: string;
  customer?: string;
  address?: string;
  category?: string;
  notes?: string;
  items: Array<{ name: string; qty: number; total: number }>;
  subTotal: number;
  totalItemsCount: number;
  discountType: 'none' | 'regular' | 'special';
  discountAmount: number;
  totalAmount: number;
  cashTendered: number;
  change: number;
  vatableSales?: number;
  vatAmount?: number;
  vatExemptSales?: number;
  zeroRatedSales?: number;
}

const SALES_RECEIPT_WIDTH = 30;
const SALES_RECEIPT_DIVIDER = '-'.repeat(48);

export interface SalesReceiptPrintLine {
  text: string;
  alignment: 0 | 1;
}

function fitSalesReceiptLine(value: string): string {
  return value.trim().slice(0, SALES_RECEIPT_WIDTH);
}

function leftSalesReceiptLine(value: string): SalesReceiptPrintLine {
  return {
    text:
      value === SALES_RECEIPT_DIVIDER ? value : fitSalesReceiptLine(value),
    alignment: 0,
  };
}

function centerSalesReceiptLine(value: string): SalesReceiptPrintLine {
  return { text: fitSalesReceiptLine(value), alignment: 1 };
}

function wrapSalesReceiptText(value: string): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > SALES_RECEIPT_WIDTH) {
      if (line) lines.push(line);
      line = word.slice(0, SALES_RECEIPT_WIDTH);
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function salesReceiptColumn(label: string, value: string | number): string {
  const labelWidth = 19;
  const valueWidth = SALES_RECEIPT_WIDTH - labelWidth;
  const valueText =
    typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
  return `${label.trim().slice(0, labelWidth).padEnd(labelWidth, ' ')}${valueText
    .slice(-valueWidth)
    .padStart(valueWidth, ' ')}`;
}

export function buildSalesReceiptLines(
  data: SalesReceiptPrintData
): SalesReceiptPrintLine[] {
  const { businessInfo, items } = data;
  const isBir = businessInfo.birEnabled === true;
  const lines: SalesReceiptPrintLine[] = [];

  for (const header of [
    businessInfo.compName,
    businessInfo.compName1,
    businessInfo.receiptAddress,
    businessInfo.receiptAddress1,
    businessInfo.compContact,
    businessInfo.compContact1,
    businessInfo.compContact2,
  ]) {
    if (header?.trim()) lines.push(centerSalesReceiptLine(header));
  }
  if (isBir) {
    for (const line of birHeaderLines(businessInfo)) {
      lines.push(centerSalesReceiptLine(line));
    }
  }

  lines.push(
    leftSalesReceiptLine(SALES_RECEIPT_DIVIDER),
    leftSalesReceiptLine(`Sales Invoice: ${data.invoiceNo}`),
    leftSalesReceiptLine(SALES_RECEIPT_DIVIDER),
    leftSalesReceiptLine(
      `QTY  ITEM${'TOTAL'.padStart(SALES_RECEIPT_WIDTH - 9, ' ')}`
    ),
    leftSalesReceiptLine(SALES_RECEIPT_DIVIDER)
  );

  const itemNameWidth = SALES_RECEIPT_WIDTH - 16;
  for (const item of items) {
    const quantity = String(item.qty).slice(0, 5).padEnd(5, ' ');
    const name = String(item.name ?? '')
      .slice(0, itemNameWidth)
      .padEnd(itemNameWidth, ' ');
    const total = Number(item.total).toFixed(2).slice(-11).padStart(11, ' ');
    lines.push(leftSalesReceiptLine(`${quantity}${name}${total}`));
  }

  lines.push(leftSalesReceiptLine(SALES_RECEIPT_DIVIDER));
  lines.push(
    leftSalesReceiptLine(
      salesReceiptColumn(isBir ? 'Sub Total:' : 'Total Amount:', data.subTotal)
    ),
    leftSalesReceiptLine(
      salesReceiptColumn('Total Item(s):', String(data.totalItemsCount))
    )
  );
  if (data.discountType === 'regular' && data.discountAmount > 0) {
    lines.push(
      leftSalesReceiptLine(salesReceiptColumn('Discount:', -data.discountAmount))
    );
  }
  const receiptTotal =
    data.discountType === 'regular' ? data.totalAmount : data.subTotal;
  lines.push(
    leftSalesReceiptLine(salesReceiptColumn('Total:', receiptTotal)),
    leftSalesReceiptLine(salesReceiptColumn('CASH:', data.cashTendered)),
    leftSalesReceiptLine(salesReceiptColumn('Change:', data.change))
  );

  if (isBir) {
    const vatableSales =
      data.vatableSales ?? Number((data.totalAmount / 1.12).toFixed(2));
    const vatAmount =
      data.vatAmount ?? Number((data.totalAmount - vatableSales).toFixed(2));
    lines.push(
      leftSalesReceiptLine(salesReceiptColumn('Vatable Sales:', vatableSales)),
      leftSalesReceiptLine(salesReceiptColumn('VAT Amount:', vatAmount)),
      leftSalesReceiptLine(
        salesReceiptColumn('VAT Exempt Sales:', data.vatExemptSales ?? 0)
      ),
      leftSalesReceiptLine(
        salesReceiptColumn('Zero Rated Sales:', data.zeroRatedSales ?? 0)
      )
    );
  }

  lines.push(leftSalesReceiptLine(SALES_RECEIPT_DIVIDER));
  for (const value of [
    `Cashier: ${data.cashier}`,
    data.date ? `Date : ${data.date}` : '',
    data.category ? `Category: ${data.category}` : '',
    data.personnel ? `Personnel: ${data.personnel}` : '',
    data.customer ? `Customer: ${data.customer}` : '',
    data.address ? `Address: ${data.address}` : '',
    data.notes ? `Notes: ${data.notes}` : '',
  ]) {
    if (value) lines.push(leftSalesReceiptLine(value));
  }

  lines.push(leftSalesReceiptLine(SALES_RECEIPT_DIVIDER));
  if (!isBir) {
    lines.push(
      ...wrapSalesReceiptText(BIR_DISCLAIMER).map(centerSalesReceiptLine)
    );
    lines.push(leftSalesReceiptLine(SALES_RECEIPT_DIVIDER));
  }
  lines.push(
    centerSalesReceiptLine('THANK YOU, PLEASE COME'),
    centerSalesReceiptLine('AGAIN!')
  );
  return lines;
}

@Injectable({
  providedIn: 'root',
})
export class PrinterService {
  private readonly couponLineWidth = 42;
  private readonly couponPaperWidth = 384;

  constructor(
    private alertController: AlertController,
    private iminPrinter: IminPrinterService,
    private appdateService: AppdateService,
    private storageService: StorageService
  ) {}

  async testPrint() {
    const connected = await this.iminPrinter.connect();
    if (!connected) {
      // show error
      return;
    }

    await this.iminPrinter.initPrinter();

    // STATUS = INFO ONLY
    try {
      const status = await this.iminPrinter.getPrinterStatus();
      console.log('Printer status (info only):', status.text);
    } catch {}

    // ACTUAL VALIDATION = TRY PRINT
    try {
      await this.iminPrinter.printText(' ', 0); // wake
      await this.iminPrinter.printText('*** TEST PRINT ***', 1);
      await this.iminPrinter.feedPaper(1);
    } catch (err) {
      // REAL error handling
    }
  }

  async rePrintReceipt(sales: any, items: any[]) {
    try {
      // --- CONNECT TO PRINTER ---
      const connected = await this.iminPrinter.connect();
      console.log('Printer connection:', connected);

      if (!connected) {
        const alert = await this.alertController.create({
          header: 'Printer Error',
          message: 'Cannot connect to the printer.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }

      await this.iminPrinter.initPrinter();

      const status = await this.iminPrinter.getPrinterStatus();
      console.log('Status', status);
      if (status.text !== 'The printer is normal') {
        console.warn('Printer warning:', status.text);
      }

      // --- LOAD COMPANY SETTINGS ---
      const businessInfo = await this.appdateService.getReceiptBusinessInfo();
      const regularDiscount = Number(sales.salesdisc) || 0;
      const specialDiscount = Number(sales.specialdisc) || 0;
      const discountType =
        specialDiscount > 0
          ? 'special'
          : regularDiscount > 0
            ? 'regular'
            : 'none';
      const totalAmount = Number(sales.salestotalamount) || 0;
      const lines = buildSalesReceiptLines({
        businessInfo,
        invoiceNo: String(sales.salesrefnum ?? ''),
        date: String(sales.salesdate ?? ''),
        cashier: String(sales.salescashier ?? ''),
        personnel: [sales.salesdelby, sales.salesdelby2]
          .filter(Boolean)
          .join(', '),
        customer: String(sales.salescust ?? ''),
        address: String(sales.salescustadd ?? sales.custadd ?? ''),
        category: String(sales.salescat ?? ''),
        notes: String(sales.salesremarks ?? sales.notes ?? ''),
        items: items.map((item) => ({
          name: String(item.scitemcode ?? ''),
          qty: Number(item.scqty) || 0,
          total: Number(item.sctotal) || 0,
        })),
        subTotal: Number(
          (totalAmount + regularDiscount + specialDiscount).toFixed(2)
        ),
        totalItemsCount: Number(sales.salestotalitem) || 0,
        discountType,
        discountAmount: specialDiscount || regularDiscount,
        totalAmount,
        cashTendered: Number(sales.salestender) || 0,
        change: Number(sales.saleschange) || 0,
        vatableSales: Number(sales.salessub) || 0,
        vatAmount: Number(sales.salesvat) || 0,
        vatExemptSales: 0,
        zeroRatedSales: 0,
      });

      await this.printBusinessLogo(businessInfo);
      try {
        await this.iminPrinter.setTextSize(28);
        await this.iminPrinter.setTextTypeface(0);
        await this.iminPrinter.setTextStyle(0);
        await this.iminPrinter.setAlignment(0);
        for (const line of lines) {
          await this.iminPrinter.printText(line.text, line.alignment);
        }
        for (let blankLine = 0; blankLine < 2; blankLine++) {
          await this.iminPrinter.printText('', 0);
        }
        await this.iminPrinter.feedPaper(2);
        await this.iminPrinter.cutPaper();
      } finally {
        await this.iminPrinter.setTextSize(28);
        await this.iminPrinter.setTextTypeface(0);
        await this.iminPrinter.setTextStyle(0);
        await this.iminPrinter.setAlignment(0);
      }
    } catch (error: any) {
      console.error('Print error:', error);

      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: `Unable to print. ${error.message || error}`,
        buttons: ['OK'],
      });

      await alert.present();
    }
  }

  async printSalary(datestr: any, tenderedAmount: any, employeename: any) {
    try {
      const connected = await this.iminPrinter.connect();
      console.log('printer connection', connected);
      if (!connected) {
        const alert = await this.alertController.create({
          header: 'Printer Error',
          message: `Cannot connect to the Printer.`,
          buttons: ['OK'],
        });
        await alert.present();

        return; // stop printing
      }
      // await this.iminPrinter.connect();
      await this.iminPrinter.initPrinter();

      const status = await this.iminPrinter.getPrinterStatus();

      if (status.text !== 'The printer is normal') {
        // Show alert ONLY when there is a printer issue
      }

      const businessInfo = await this.appdateService.getReceiptBusinessInfo();

      const printReceiptContent = async () => {
        await this.printBusinessHeader(businessInfo);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(`Date: ${datestr}`, 0);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(
          this.formatLine('', 'Paid Amount:', tenderedAmount.toFixed(2)),
          2
        );

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        // === CUSTOMER INFO ===
        await this.iminPrinter.printText(`Employee Name: ${employeename}`, 0);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );
        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      await this.printBusinessLogo(businessInfo);

      await printReceiptContent();
    } catch (error: any) {
      console.error('Print error:', error);

      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: `Unable to print. ${error.message || error}`,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async printBalance(sales: any, tenderedAmount: any, balance: any) {
    try {
      const connected = await this.iminPrinter.connect();
      console.log('printer connection', connected);
      if (!connected) {
        const alert = await this.alertController.create({
          header: 'Printer Error',
          message: `Cannot connect to the Printer.`,
          buttons: ['OK'],
        });
        await alert.present();

        return; // stop printing
      }
      // await this.iminPrinter.connect();
      await this.iminPrinter.initPrinter();

      const status = await this.iminPrinter.getPrinterStatus();

      if (status.text !== 'The printer is normal') {
        // Show alert ONLY when there is a printer issue
      }

      const businessInfo = await this.appdateService.getReceiptBusinessInfo();
      const receiptEndGreet = businessInfo.receiptEndGreet;

      const printReceiptContent = async () => {
        await this.printBusinessHeader(businessInfo);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(`Date: ${sales.salesdate}`, 0);
        await this.iminPrinter.printText(
          `Reference No: ${sales.salesrefnum}`,
          0
        );
        await this.iminPrinter.printText(`Customer: ${sales.salescust}`, 0);
        await this.iminPrinter.printText(`Cashier: ${sales.salescashier}`, 0);
        await this.iminPrinter.printText(`Personnel: ${sales.salesdelby}`, 0);
        if (sales.salesdelid2) {
          await this.iminPrinter.printText(
            `Personnel 2: ${sales.salesdelby2}`,
            0
          );
        }
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(
          `Tendered Amount:  ${tenderedAmount.toFixed(2)}`,
          0
        );
        await this.iminPrinter.printText(
          `Remaining Balance:  ${balance.toFixed(2)}`,
          0
        );

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        const datestr = moment()
          .tz('Asia/Manila')
          .format('YYYY-MM-DD HH:mm:ss');
        await this.iminPrinter.printText(`Print Date:`, 0);
        await this.iminPrinter.printText(`${datestr}`, 0);

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );
        await this.iminPrinter.printText(`${receiptEndGreet}`, 1);
        await this.printBirFooter(businessInfo);
        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      await this.printBusinessLogo(businessInfo);

      await printReceiptContent();
    } catch (error: any) {
      console.error('Print error:', error);

      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: `Unable to print. ${error.message || error}`,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async printLend(sales: any, salescart: any, qty: number) {
    try {
      const connected = await this.iminPrinter.connect();
      console.log('printer connection', connected);
      if (!connected) {
        const alert = await this.alertController.create({
          header: 'Printer Error',
          message: `Cannot connect to the Printer.`,
          buttons: ['OK'],
        });
        await alert.present();

        return; // stop printing
      }
      // await this.iminPrinter.connect();
      await this.iminPrinter.initPrinter();

      const status = await this.iminPrinter.getPrinterStatus();

      if (status.text !== 'The printer is normal') {
        // Show alert ONLY when there is a printer issue
      }

      const businessInfo = await this.appdateService.getReceiptBusinessInfo();
      const receiptEndGreet = businessInfo.receiptEndGreet;
      const datestr = moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss');
      const user = await this.storageService.get<any>('login-data');
      const cashierName = user?.empname || 'ADMINISTRATOR';

      const printReceiptContent = async () => {
        await this.printBusinessHeader(businessInfo);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(`Date: ${datestr}`, 0);
        await this.iminPrinter.printText(
          `Reference No: ${sales.salesrefnum}`,
          0
        );
        await this.iminPrinter.printText(`Customer: ${sales.salescust}`, 0);
        await this.iminPrinter.printText(`Cashier: ${cashierName}`, 0);
        await this.iminPrinter.printText(`Personnel: ${sales.salesdelby}`, 0);
        if (sales.salesdelid2) {
          await this.iminPrinter.printText(
            `Personnel 2: ${sales.salesdelby2}`,
            0
          );
        }
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(
          `Item Name: ${salescart.scitemdesc}`,
          0
        );
        await this.iminPrinter.printText(`Lend Quantity: ${qty}`, 0);

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );
        await this.iminPrinter.printText(`${receiptEndGreet}`, 1);
        await this.printBirFooter(businessInfo);
        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      await this.printBusinessLogo(businessInfo);

      await printReceiptContent();
    } catch (error: any) {
      console.error('Print error:', error);

      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: `Unable to print. ${error.message || error}`,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async printBusinessDetails() {
    try {
      const connected = await this.iminPrinter.connect();
      console.log('printer connection', connected);
      if (!connected) {
        const alert = await this.alertController.create({
          header: 'Printer Error',
          message: `Cannot connect to the Printer.`,
          buttons: ['OK'],
        });
        await alert.present();

        return; // stop printing
      }
      // await this.iminPrinter.connect();
      await this.iminPrinter.initPrinter();

      const status = await this.iminPrinter.getPrinterStatus();

      if (status.text !== 'The printer is normal') {
        // Show alert ONLY when there is a printer issue
      }

      const businessInfo = await this.appdateService.getReceiptBusinessInfo();

      const printReceiptContent = async () => {
        await this.printBusinessHeader(businessInfo);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      await this.printBusinessLogo(businessInfo);

      await printReceiptContent();
    } catch (error: any) {
      console.error('Print error:', error);

      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: `Unable to print. ${error.message || error}`,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  buildCouponCard(
    discount: number,
    slotCount: number
  ): string[] {
    if (
      !Number.isFinite(discount) ||
      discount <= 0 ||
      !Number.isInteger(slotCount) ||
      slotCount < 2 ||
      slotCount > 10
    ) {
      throw new Error('Coupon requires a positive discount and 2 to 10 slots.');
    }

    const width = this.couponLineWidth;
    const center = (value: string, lineWidth = width): string => {
      const text = value.trim().substring(0, lineWidth);
      const left = Math.floor((lineWidth - text.length) / 2);
      return `${' '.repeat(left)}${text}`.padEnd(lineWidth, ' ');
    };
    const lines: string[] = [];
    const divider = '-'.repeat(width);
    const border = `+${'-'.repeat(width - 2)}+`;
    const boxed = (label: string) => `|${center(label, width - 2)}|`;
    const boxedReward = (label: string): string => {
      const text = label.trim().substring(0, width - 2);
      const padding = width - 2 - text.length;
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = padding - leftPadding;
      return `|${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}|`;
    };
    const line1 = 'Get 1 stamp per order.';
    const line2 = `Collect ${slotCount}, get ₱${Number(discount).toFixed(0)} OFF!`;
    lines.push(
      divider,
      center(line1, 42),
      center(line2, 42),
      center(''),
      border
    );

    for (let slot = 1; slot < slotCount; slot++) {
      lines.push(boxed(`(   ) SLOT ${slot}`), border);
    }
    lines.push(
      boxedReward('CLAIM DISCOUNT'),
      boxedReward(`${discount.toFixed(2)} PESOS OFF`),
      border,
      divider
    );
    return lines;
  }

  async printCouponCard(discount: number, slotCount: number): Promise<void> {
    try {
      const connected = await this.iminPrinter.connect();
      if (!connected) throw new Error('Cannot connect to printer');

      await this.iminPrinter.resetPrinterState();
      try {
        const businessInfo = await this.appdateService.getReceiptBusinessInfo();
        await this.printBusinessHeader(businessInfo);
        const lines = this.buildCouponCard(discount, slotCount);
        await this.iminPrinter.setPrintWidth(this.couponPaperWidth);
        await this.iminPrinter.setAlignment(0);
        for (const line of lines) {
          await this.iminPrinter.printText(line, 0);
        }
        await this.iminPrinter.feedPaper(3);
        await this.iminPrinter.cutPaper();
      } finally {
        await this.iminPrinter.resetPrinterState();
      }
    } catch (error: any) {
      console.error('Coupon print error:', error);
      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: error?.message || 'Unable to print coupon.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  async printPreviewToPrinter(
    previewContent: { type: string; value: string }[],
    bir?: { enabled: boolean; tin: string; min: string; sn: string }
  ) {
    try {
      const connected = await this.iminPrinter.connect();
      if (!connected) throw new Error('Cannot connect to printer');

      await this.iminPrinter.initPrinter();
      const businessInfo = await this.appdateService.getReceiptBusinessInfo();

      for (const item of previewContent) {
        if (item.type === 'text') {
          await this.iminPrinter.printText(item.value, 1); // 1 = normal font
        } else if (item.type === 'image' && item.value && businessInfo.withLogo) {
          const image = await loadImage(item.value);
          const resized = resizeImageStretch(image, 450, 250);
          await this.iminPrinter.printImage(resized, 1);
        }
      }

      for (const line of birHeaderLines({
        birEnabled: bir?.enabled,
        tin: bir?.tin,
        min: bir?.min,
        sn: bir?.sn,
      })) {
        await this.iminPrinter.printText(line, 1);
      }

      await this.iminPrinter.printText(
        '-----------------------------------------------',
        0
      );

      if (bir && !bir.enabled) {
        await this.iminPrinter.printText(BIR_DISCLAIMER, 1);
      }

      await this.iminPrinter.printText('', 0);
      await this.iminPrinter.printText('', 0);
      await this.iminPrinter.cutPaper();
    } catch (err: any) {
      console.error('Print error:', err);
      const alert = await this.alertController.create({
        header: 'Printer Error',
        message: err.message || 'Unable to print',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  private async printBusinessHeader(
    info: ReceiptBusinessInfo,
    maxLineLength?: number
  ): Promise<void> {
    const printLine = (line: string) =>
      this.iminPrinter.printText(
        maxLineLength ? line.slice(0, maxLineLength) : line,
        1
      );
    await printLine(info.compName);
    await printLine(info.compName1);
    await printLine(info.receiptAddress);
    await printLine(info.receiptAddress1);
    await printLine(info.compContact);
    await printLine(info.compContact1);
    await printLine(info.compContact2);
    for (const line of birHeaderLines(info)) {
      await printLine(line);
    }
  }

  private async printBirFooter(
    info: ReceiptBusinessInfo,
    maxLineLength?: number
  ): Promise<void> {
    if (info.birEnabled) return;
    await this.iminPrinter.printText(
      maxLineLength ? BIR_DISCLAIMER.slice(0, maxLineLength) : BIR_DISCLAIMER,
      1
    );
  }

  private async printBusinessLogo(info: ReceiptBusinessInfo): Promise<void> {
    if (!info.withLogo || !info.logoDataUrl) return;

    const image = await loadImage(info.logoDataUrl);
    const resized = resizeImageStretch(image, 450, 250);
    await this.iminPrinter.printImage(resized, 1);
  }

  // Helper function to format columns
  private formatLine(qty: string, name: string, amount: string) {
    // Adjust widths for your printer
    const qtyWidth = 3; // 3 chars for quantity
    const nameWidth = 20; // 20 chars for item name
    const amountWidth = 8; // 8 chars for amount

    // Trim or pad
    const qtyStr = qty.padStart(qtyWidth, ' ');
    const nameStr =
      name.length > nameWidth
        ? name.slice(0, nameWidth)
        : name.padEnd(nameWidth, ' ');
    const amountStr = amount.padStart(amountWidth, ' ');

    return `${qtyStr} ${nameStr} ${amountStr}`;
  }

  /**
   * Format a line for 58mm (32 chars per line)
   * Amount is ALWAYS at the far right
   */
  // helper: approximate display width (ASCII = 1, common wide chars = 2)

  formatItemLine(
    qty: number | string,
    name: string,
    amount: number | string,
    lineWidth = 32
  ) {
    qty = qty.toString();
    amount = parseFloat(amount.toString()).toFixed(2);

    const qtyWidth = 3;
    const amountWidth = 8;

    const nameWidth = lineWidth - qtyWidth - amountWidth - 2;

    const qtyStr = qty.toString().padStart(qtyWidth, ' ');

    const trimmedName =
      name.length > nameWidth ? name.slice(0, nameWidth) : name;

    const nameStr = trimmedName.padEnd(nameWidth, ' ');

    const amountStr = amount.toString().padStart(amountWidth, ' ');

    return `${qtyStr} ${nameStr} ${amountStr}`;
  }

  pad(value: string, length: number) {
    return value.length >= length
      ? value.substring(0, length - 1) + ' '
      : value + ' '.repeat(length - value.length);
  }
}
function resizeImageStretch(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth; // desired width (stretch)
  canvas.height = targetHeight; // desired height (stretch)
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // Draw the image stretched to fill the canvas
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL('image/png'); // returns base64 DataURL
}


import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { IminPrinterService } from './imin-printer.service';
import { AppdateService } from './appdate.service';
import moment from 'moment';
import 'moment-timezone';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class PrinterService {
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
      const appdate = await this.appdateService.getAllAppdate();
      const compName = appdate[0].Bname;
      const compName1 = appdate[0].ReceiptBname;
      const compAddress = appdate[0].Baddress;
      const compContact = appdate[0].ReceiptContactInfo;
      const receiptEndGreet = appdate[0].receiptendgreet;
      const withlogo = appdate[0].withlogo;
      const logoBlob = appdate[0].Blogo;

      // Helper: print receipt body
      const printReceiptContent = async () => {
        await this.iminPrinter.printText(`${compName}`, 1);
        await this.iminPrinter.printText(`${compName1}`, 1);
        await this.iminPrinter.printText(`${compAddress}`, 1);
        await this.iminPrinter.printText(`${compContact}`, 1);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(
          `Sales Invoice: ${sales.salesrefnum}`,
          0
        );
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );
        await this.iminPrinter.setAlignment(0); // left

        // HEADER
        await this.iminPrinter.printText(
          'QTY  ITEM                     TOTAL',
          0
        );
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        for (const item of items) {
          const qty = this.pad(item.scqty.toString(), 4);
          const name = this.pad(item.scitemcode, 20);
          const total = parseFloat(item.sctotal).toFixed(2);

          // Left part (qty + name)
          await this.iminPrinter.printTextLineOptional(
            `${qty}${name}`,
            0,
            false
          );

          await this.iminPrinter.printTextLineOptional(`${total}`, 2, false);
        }

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(
          this.formatLine(
            '',
            'Total Amount:',
            sales.salestotalamount.toFixed(2)
          ),
          2
        );
        await this.iminPrinter.printText(
          this.formatLine(
            '',
            'Total Item(s):',
            sales.salestotalitem.toFixed(0)
          ),
          2
        );
        await this.iminPrinter.printText(
          this.formatLine('', 'Discount:', sales.salesdisc.toFixed(2)),
          2
        );
        await this.iminPrinter.printText(
          this.formatLine(
            '',
            `${sales.salespaym.toUpperCase()}:`,
            parseFloat(sales.salestender).toFixed(2)
          ),
          2
        );
        await this.iminPrinter.printText(
          this.formatLine('', 'Change:', sales.saleschange.toFixed(2)),
          2
        );
        await this.iminPrinter.printText(
          this.formatLine('', 'Vatable Sales:', sales.salessub.toFixed(2)),
          2
        );
        await this.iminPrinter.printText(
          this.formatLine('', 'VAT:', sales.salesvat.toFixed(2)),
          2
        );

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        // CUSTOMER INFO
        await this.iminPrinter.printText(`Cashier: ${sales.salescashier}`, 0);
        await this.iminPrinter.printText(`Date : ${sales.salesdate}`, 0);
        await this.iminPrinter.printText(`Category: ${sales.salescat}`, 0);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText(`Personnel: ${sales.salesdelby}`, 0);
        if (sales.salesdelid2) {
          await this.iminPrinter.printText(
            `Personnel 2: ${sales.salesdelby2}`,
            0
          );
        }

        await this.iminPrinter.printText(
          `Customer: ${sales.salescust ?? ''}`,
          0
        );
        await this.iminPrinter.printText(`Address: ${sales.custadd ?? ''}`, 0);
        await this.iminPrinter.printText(`Notes: ${sales.notes ?? ''}`, 0);

        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );
        await this.iminPrinter.printText(`${receiptEndGreet}`, 1);

        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      // --- LOGO PRINTING (IF AVAILABLE) ---
      if (withlogo === 'Y' && logoBlob) {
        const dataUrl = bufferToDataURL(logoBlob, 'image/png');

        const img = new Image();
        img.src = dataUrl;

        img.onload = async () => {
          const resized = resizeImageStretch(img, 450, 250);
          await this.iminPrinter.printImage(resized, 1);
          await printReceiptContent();
        };

        return; // prevent 'no logo' section from printing
      }

      // --- NO LOGO ---
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

      const appdate = await this.appdateService.getAllAppdate();
      const compName = appdate[0].Bname;
      const compName1 = appdate[0].ReceiptBname;
      const compAddress = appdate[0].Baddress;
      const compContact = appdate[0].ReceiptContactInfo;
      const withlogo = appdate[0].withlogo;
      const logoBlob = appdate[0].Blogo;

      const printReceiptContent = async () => {
        await this.iminPrinter.printText(`${compName}`, 1);
        await this.iminPrinter.printText(`${compName1}`, 1);
        await this.iminPrinter.printText(`${compAddress}`, 1);
        await this.iminPrinter.printText(`${compContact}`, 1);
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

      if (withlogo === 'Y' && logoBlob) {
        const dataUrl = bufferToDataURL(logoBlob, 'image/png');

        const img = new Image();
        img.src = dataUrl;

        img.onload = async () => {
          const resized = resizeImageStretch(img, 450, 250);
          await this.iminPrinter.printImage(resized, 1);
          await printReceiptContent();
        };

        return; // prevent 'no logo' section from printing
      }

      // --- NO LOGO ---
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

      const appdate = await this.appdateService.getAllAppdate();
      const compName = appdate[0].Bname;
      const compName1 = appdate[0].ReceiptBname;
      const compAddress = appdate[0].Baddress;
      const compContact = appdate[0].ReceiptContactInfo;
      const withlogo = appdate[0].withlogo;
      const logoBlob = appdate[0].Blogo;
      const receiptEndGreet = appdate[0].receiptendgreet;

      const printReceiptContent = async () => {
        await this.iminPrinter.printText(`${compName}`, 1);
        await this.iminPrinter.printText(`${compName1}`, 1);
        await this.iminPrinter.printText(`${compAddress}`, 1);
        await this.iminPrinter.printText(`${compContact}`, 1);
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
        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      if (withlogo === 'Y' && logoBlob) {
        const dataUrl = bufferToDataURL(logoBlob, 'image/png');

        const img = new Image();
        img.src = dataUrl;

        img.onload = async () => {
          const resized = resizeImageStretch(img, 450, 250);
          await this.iminPrinter.printImage(resized, 1);
          await printReceiptContent();
        };

        return; // prevent 'no logo' section from printing
      }

      // --- NO LOGO ---
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

      const appdate = await this.appdateService.getAllAppdate();
      const compName = appdate[0].Bname;
      const compName1 = appdate[0].ReceiptBname;
      const compAddress = appdate[0].Baddress;
      const compContact = appdate[0].ReceiptContactInfo;
      const withlogo = appdate[0].withlogo;
      const logoBlob = appdate[0].Blogo;
      const receiptEndGreet = appdate[0].receiptendgreet;
      const datestr = moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss');
      const user = await this.storageService.get<any>('login-data');
      const cashierName = user?.empname || 'ADMINISTRATOR';

      const printReceiptContent = async () => {
        await this.iminPrinter.printText(`${compName}`, 1);
        await this.iminPrinter.printText(`${compName1}`, 1);
        await this.iminPrinter.printText(`${compAddress}`, 1);
        await this.iminPrinter.printText(`${compContact}`, 1);
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
        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      if (withlogo === 'Y' && logoBlob) {
        const dataUrl = bufferToDataURL(logoBlob, 'image/png');

        const img = new Image();
        img.src = dataUrl;

        img.onload = async () => {
          const resized = resizeImageStretch(img, 450, 250);
          await this.iminPrinter.printImage(resized, 1);
          await printReceiptContent();
        };

        return; // prevent 'no logo' section from printing
      }

      // --- NO LOGO ---
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

      const appdate = await this.appdateService.getAllAppdate();
      const compName = appdate[0].ReceiptBname;
      const compName1 = appdate[0].ReceiptBname1;
      const ReceiptAddress = appdate[0].ReceiptAddress;
      const ReceiptAddress1 = appdate[0].ReceiptAddress1;
      const compContact = appdate[0].ReceiptContactInfo;
      const compContact1 = appdate[0].ReceiptContactInfo1;
      const compContact2 = appdate[0].ReceiptContactInfo2;
      const logoBlob = appdate[0].Blogo;

      const printReceiptContent = async () => {
        await this.iminPrinter.printText(`${compName}`, 1);
        await this.iminPrinter.printText(`${compName1}`, 1);
        await this.iminPrinter.printText(`${ReceiptAddress}`, 1);
        await this.iminPrinter.printText(`${ReceiptAddress1}`, 1);
        await this.iminPrinter.printText(`${compContact}`, 1);
        await this.iminPrinter.printText(`${compContact1}`, 1);
        await this.iminPrinter.printText(`${compContact2}`, 1);
        await this.iminPrinter.printText(
          '-----------------------------------------------',
          0
        );

        await this.iminPrinter.printText('', 0);
        await this.iminPrinter.printText('', 0);

        await this.iminPrinter.cutPaper();
      };

      const dataUrl = bufferToDataURL(logoBlob, 'image/png');

      const img = new Image();
      img.src = dataUrl;

      img.onload = async () => {
        const resized = resizeImageStretch(img, 450, 250);
        await this.iminPrinter.printImage(resized, 1);
        await printReceiptContent();
      };

      return; // prevent 'no logo' section from printing
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

  async printPreviewToPrinter(
    previewContent: { type: string; value: string }[]
  ) {
    try {
      const connected = await this.iminPrinter.connect();
      if (!connected) throw new Error('Cannot connect to printer');

      await this.iminPrinter.initPrinter();

      for (const item of previewContent) {
        if (item.type === 'text') {
          await this.iminPrinter.printText(item.value, 1); // 1 = normal font
        } else if (item.type === 'image' && item.value) {
          const img = new Image();
          img.src = item.value;
          await new Promise<void>((resolve) => {
            img.onload = async () => {
              const resized = resizeImageStretch(img, 450, 250);
              await this.iminPrinter.printImage(resized, 1);
              resolve();
            };
          });
        }
      }

      await this.iminPrinter.printText(
        '-----------------------------------------------',
        0
      );

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
// Convert Node.js Buffer (or Blob with .data) to Data URL
function bufferToDataURL(buffer: any, mimeType: string = 'image/png'): string {
  // If you have a Buffer-like object {type: 'Buffer', data: [...]}
  const bytes = buffer.data || buffer;
  const binary = bytes.reduce(
    (acc: string, byte: number) => acc + String.fromCharCode(byte),
    ''
  );
  return `data:${mimeType};base64,${btoa(binary)}`;
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

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

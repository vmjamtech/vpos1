import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPopover,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { IminPrinterService } from 'src/app/services/imin-printer.service';
import {
  AppdateService,
  BIR_DISCLAIMER,
  ReceiptBusinessInfo,
  birHeaderLines,
} from 'src/app/services/appdate.service';
import { ReceiptPreviewComponent } from '../receipt-preview/receipt-preview.component';
import { SalesService } from 'src/app/services/sales.service';
import moment from 'moment';
import { SalescartService } from 'src/app/services/salescart.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ItemhistoryService } from 'src/app/services/itemhistory.service';
import { PersonnelTransactionService } from 'src/app/services/personnel-transaction.service';
import { CustomersService } from 'src/app/services/customers.service';
import { loadImage } from 'src/app/utils/load-image';
import { buildSalesReceiptLines } from 'src/app/services/printer.service';

@Component({
  selector: 'app-purchase-summary',
  templateUrl: './purchase-summary.component.html',
  styleUrls: ['./purchase-summary.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonIcon,
    IonLabel,
    IonItem,
    IonButton,
    IonCardContent,
    IonTitle,
    IonCardHeader,
    IonCard,
    IonCardTitle,
    IonSelectOption,
    IonSelect,
    IonText,
    IonInput,
    IonFooter,
    IonToolbar,
    IonButtons,
    IonHeader,
    IonTextarea,
    IonDatetimeButton,
    IonDatetime,
    IonCheckbox,
    IonPopover,
  ],
})
export class PurchaseSummaryComponent implements OnInit {
  @Input() posData: any;
  @Input() totalsub: number = 0;
  @Input() totalvat: number = 0;
  @Input() totalAmount: number = 0;
  @Input() totalitems: number = 0;
  @Input() cart: any[] = [];
  @Input() cashierName: string = '';
  @Input() resetPOSCallback!: () => void;

  currentDate: Date = new Date();
  paymentType: 'FULL PAYMENT' | 'PARTIAL PAYMENT' = 'FULL PAYMENT';
  paymentMethod: 'CASH' | 'EWALLET' | 'BANK TRANSFER' = 'CASH';
  tenderedAmount: string = '';
  notes: string = '';
  partialPaymentConfirmed: boolean = false;
  partialPaymentDueDate: string | null = null;
  tomorrowDate: string = '';
  @ViewChild('partialModal', { static: true }) partialModal!: IonModal;

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private iminPrinter: IminPrinterService,
    private appdateService: AppdateService,
    private loadingCtrl: LoadingController,
    private salesService: SalesService,
    private salescartService: SalescartService,
    private inventoryService: InventoryService,
    private itemHistoryService: ItemhistoryService,
    private personnelTransactionService: PersonnelTransactionService,
    private customerService: CustomersService
  ) {
    const today = new Date();
    today.setDate(today.getDate() + 1); // move to tomorrow

    this.tomorrowDate = today.toISOString().split('T')[0];
  }

  ngOnInit() {
    console.log('CART', this.cart);
  }
  // Calculate change
  // Calculate change
  getChange(): number {
    const tendered = parseFloat(this.tenderedAmount) || 0;

    // Partial payment always shows 0 change
    return this.paymentType === 'PARTIAL PAYMENT'
      ? 0
      : Number((tendered - Number(this.totalAmount.toFixed(2))).toFixed(2));
  }

  async onPartialDateChanged(event: any) {
    const pickedDate = event.detail.value;
    const formatted = new Date(pickedDate).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    // Optional: show alert or update UI
    const alert = await this.alertController.create({
      header: 'Partial Payment Notification',
      message: `Notification will be on ${formatted}`,
      buttons: ['OK'],
    });
    await alert.present();

    console.log('Notification will be on', formatted);
  }

  // Enable/disable confirm button
  canConfirm(): boolean {
    const tendered = Number(parseFloat(this.tenderedAmount) || 0);
    const totalAmount = Number(Number(this.totalAmount).toFixed(2));

    if (this.paymentType === 'FULL PAYMENT') {
      return (
        Number.isFinite(totalAmount) &&
        totalAmount >= 0 &&
        !!this.paymentMethod &&
        Number(tendered.toFixed(2)) >= totalAmount
      );
    }

    if (this.paymentType === 'PARTIAL PAYMENT') {
      return (
        totalAmount > 0 &&
        !!this.paymentMethod &&
        tendered >= 0 &&
        Number(tendered.toFixed(2)) < totalAmount
      );
    }

    return false;
  }

  // Format tendered amount and auto-switch to FULL PAYMENT if needed
  formatTenderedAmount(input?: HTMLIonInputElement) {
    let value = parseFloat(this.tenderedAmount) || 0;

    if (value < 0) value = 0;

    // Auto-switch to FULL PAYMENT if tendered >= total
    if (this.paymentType === 'PARTIAL PAYMENT' && value >= this.totalAmount) {
      this.paymentType = 'FULL PAYMENT';
    }

    this.tenderedAmount = value.toFixed(2);

    if (input) {
      input.value = this.tenderedAmount;
    }
  }

  // Reset tendered amount when payment type changes
  onPaymentTypeChange() {
    if (this.paymentType === 'PARTIAL PAYMENT') {
      this.tenderedAmount = '0';
    } else if (this.paymentType === 'FULL PAYMENT') {
      this.partialPaymentConfirmed = false;
      this.partialPaymentDueDate = null;
      this.tenderedAmount = this.totalAmount.toFixed(2);
    }
  }

  getPayDate(): string | null {
    if (this.partialPaymentConfirmed && this.partialPaymentDueDate) {
      const selected = new Date(this.partialPaymentDueDate);

      const yyyy = selected.getFullYear();
      const mm = String(selected.getMonth() + 1).padStart(2, '0'); // month 0-11
      const dd = String(selected.getDate()).padStart(2, '0');
      const hh = String(selected.getHours()).padStart(2, '0');
      const min = String(selected.getMinutes()).padStart(2, '0');
      const ss = String(selected.getSeconds()).padStart(2, '0');

      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    } else {
      return null;
    }
  }

  // Set exact tendered amount (always FULL PAYMENT)
  exactAmount() {
    this.paymentType = 'FULL PAYMENT';
    this.tenderedAmount = this.totalAmount.toFixed(2);
  }

  async confirmPayment() {
    if (!this.canConfirm()) return;

    // === FETCH APPDATE ===
    let salesreference: string = '';
    let businessInfo: ReceiptBusinessInfo;
    try {
      businessInfo = await this.appdateService.getReceiptBusinessInfo();
    } catch (err) {
      console.error('Failed to fetch appdate:', err);
      return;
    }

    const {
      compName,
      compName1,
      receiptAddress,
      receiptAddress1,
      compContact,
      compContact1,
      compContact2,
      receiptEndGreet,
      logoDataUrl,
    } = businessInfo;
    const withlogo = businessInfo.withLogo ? 'Y' : 'N';
    const { cart } = this;

    // === CONFIRM PAYMENT ALERT ===
    const alert = await this.alertController.create({
      header: 'Confirm Payment',
      subHeader: `${this.paymentMethod.toLocaleUpperCase()} : ₱${
        this.tenderedAmount
      }\nChange: ₱${this.getChange().toFixed(2)}`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Payment cancelled');
          },
        },
        {
          text: 'Confirm',
          role: 'confirm',
        },
      ],
    });
    await alert.present();

    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') {
      return; // stop if user cancels
    }

    const datestr = moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss');
    const discountAmount = Number(this.posData.discount) || 0;
    const discountType = this.posData.discountType ?? 'none';
    const regularDiscount = discountType === 'regular' ? discountAmount : 0;
    const specialDiscount = discountType === 'special' ? discountAmount : 0;

    const modalData = {
      company: {
        compName,
        compName1,
        receiptAddress,
        receiptAddress1,
        compContact,
        compContact1,
        compContact2,
        receiptEndGreet,
        logo: logoDataUrl,
      },
      transaction: {
        cart,
        datestr,
        totalAmount: this.totalAmount,
        tenderedAmount: this.tenderedAmount,
        totalItems: this.totalitems,
        cashierName: this.cashierName,
        paymentMethod: this.paymentMethod,
        changeAmount: this.getChange(),
        totalVat: this.totalvat,
        totalSub: this.totalsub,
        posData: this.posData,
      },
    };

    // ADD Loading from here until all transaction processed
    const processingLoader = await this.loadingCtrl.create({
      message: 'Processing transaction...',
      spinner: 'crescent',
      backdropDismiss: false,
    });

    await processingLoader.present();
    const tendered = parseFloat(this.tenderedAmount) || 0;
    const tenderBalance =
      this.paymentType === 'FULL PAYMENT'
        ? 0
        : Number((this.totalAmount - tendered).toFixed(2));
    const saleStatus = this.paymentType === 'FULL PAYMENT' ? 'PAID' : 'UNPAID';
    const sale = {
      salescust: modalData.transaction.posData.customerName,
      salescustadd: modalData.transaction.posData.customeraddress,
      salescustcont: modalData.transaction.posData.customerContact || '',
      salescustid: modalData.transaction.posData.customerId,
      salespaym: modalData.transaction.paymentMethod,
      salescashier: modalData.transaction.cashierName,
      salesdelby: modalData.transaction.posData.personnel1Name,
      salesdelid: modalData.transaction.posData.personnel1Id,
      salesdelby2: modalData.transaction.posData.personnel2Name,
      salesdelid2: modalData.transaction.posData.personnel2Id,
      salestotalitem: modalData.transaction.totalItems,
      salessub: this.totalsub,
      salesvat: this.totalvat,
      salestotalamount: modalData.transaction.totalAmount,
      saleschange: modalData.transaction.changeAmount,
      salesdate: datestr,
      salestender: parseFloat(modalData.transaction.tenderedAmount),
      salestatus: saleStatus,
      salescat: modalData.transaction.posData.category,
      salespaytype: this.paymentType,
      tenderbalance: tenderBalance,
      tendertotal: tenderBalance,
      salesremarks: `TRANSACTION NOTES: ${this.notes}`,
      salesdisc: regularDiscount,
      specialdisc: specialDiscount,
      bankrefnum: '',
      bankname: '',
      Custbankname: '',
      paydate: this.getPayDate(),
    };
    // Log the complete JSON
    console.log('Receipt Preview Props:', modalData);
    console.log('Data to send :', sale);
    let inventoryChanged = false;
    let inventorySnapshotCaptured = false;
    try {
      const salesresult = await this.salesService.createSaledb(sale);

      if (!salesresult) throw new Error('Failed to save sale');
      console.log('Sales Result', salesresult);

      for (const item of this.cart) {
        const unitCost =
          item.cost ??
          (item.unit === 'REFILL'
            ? item.cost_refill ?? item.itemcost ?? 0
            : item.cost_non_refill ?? item.itemcost ?? 0);
        const salesitems = {
          screfnum: salesresult.salesrefnum,
          scdate: salesresult.salesdate,
          scitemcode: item.itemcode,
          scitemdesc: item.itemname,
          scunit: item.unit,
          scprice: item.price,
          scqty: item.qty,
          sctotal: item.amount,
          scdiscount:
            this.posData.discountType === 'regular'
              ? this.posData.discount || 0
              : 0,
          sccashier: this.cashierName,
          scstats: 'PAID',
          scpackage: item.itemsize || '',
          sccost: unitCost,
          totalcost: unitCost * item.qty,
          cost_snapshot_version: 1,
        };

        const itemresult = await this.salescartService.addCartItemDb(
          salesitems
        );
        console.log('add sales Item result:', itemresult);
        const itemupdate = await this.inventoryService.updateInventoryQtydb([
          { itemid: item.itemid, qty: item.qty, unit: item.unit },
        ], false);
        inventoryChanged = true;
        console.log('itemupdate result', itemupdate);
        const itemhistorydata = {
          itemhdate: datestr,
          itemhitemc: item.itemcode,
          itemhrefnum: salesresult.salesrefnum,
          itemhorigin: 'PURCHASE ITEM - ANDROID POS',
          itemhqty: item.qty,
          itemhremarks: `DECREASE FILL QTY FROM ITEM PURCHASE REFNUM : {${salesresult.salesrefnum}`,
        };
        const itemhistory = await this.itemHistoryService.createItemHistorydb(
          itemhistorydata
        );
        console.log('itemhistory result', itemhistory);
      }

      if (inventoryChanged) {
        await this.inventoryService.captureCurrentInventorySnapshot();
        inventorySnapshotCaptured = true;
      }

      const p1Id = modalData.transaction.posData.personnel1Id;
      const p1Name = modalData.transaction.posData.personnel1Name;

      const p2Id = modalData.transaction.posData.personnel2Id;
      const p2Name = modalData.transaction.posData.personnel2Name;

      // Determine delCount
      let delCount = 0;
      if (p1Id && p2Id) {
        delCount = 2;
      } else if (p1Id || p2Id) {
        delCount = 1;
      }

      // Determine delby1 and delby2
      let delby1 = null;
      let delby2 = null;

      if (p1Id && p2Id) {
        // Both present
        delby1 = { name: p1Name, id: p1Id };
        delby2 = { name: p2Name, id: p2Id };
      } else if (p1Id) {
        // Only personnel 1
        delby1 = { name: p1Name, id: p1Id };
      } else if (p2Id) {
        // Only personnel 2
        delby1 = { name: p2Name, id: p2Id };
      }

      const personeltransaction =
        await this.personnelTransactionService.insertTransactiondb({
          cart: this.cart,
          refnum: salesresult.salesrefnum,
          custName: modalData.transaction.posData.customerName,
          custId: modalData.transaction.posData.customerId,
          cashier: this.cashierName,
          customerCat: modalData.transaction.posData.category,
          delCount,
          delby1,
          delby2,
          paymentType: saleStatus,
        });

      console.log('personel transaction result', personeltransaction);
      if (this.paymentType === 'PARTIAL PAYMENT') {
        const customerresult = await this.customerService.updateBalance(
          parseInt(modalData.transaction.posData.customerId),
          tenderBalance
        );
      }
      // loading stop here
      //then use appdateservice.showToastjs
      // ===============================
      // 🎉 STOP LOADING + SHOW TOAST
      // ===============================
      salesreference = salesresult.salesrefnum;
      await processingLoader.dismiss();
      await this.appdateService.showToastjs(
        'Transaction completed successfully!',
        'success'
      );
    } catch (error) {
      if (inventoryChanged && !inventorySnapshotCaptured) {
        await this.inventoryService.captureCurrentInventorySnapshot();
      }
      console.error('Error during transaction:', error);
      await processingLoader.dismiss();
      await this.appdateService.showToastjs(
        'Error processing transaction!',
        'danger'
      );
      return;
    }
    // === OPEN PREVIEW MODAL ===
    const preview = await this.modalCtrl.create({
      component: ReceiptPreviewComponent,
      componentProps: {
        salesreference: salesreference,
        withlogo,
        logo: logoDataUrl,
        compName,
        compName1,
        receiptAddress,
        receiptAddress1,
        compContact,
        compContact1,
        compContact2,
        receiptEndGreet,
        birLines: birHeaderLines(businessInfo),
        birDisclaimer: businessInfo.birEnabled ? '' : BIR_DISCLAIMER,
        cart,
        datestr,
        totalAmount: this.totalAmount,
        tenderedAmount: this.tenderedAmount,
        totalItems: this.totalitems,
        cashierName: this.cashierName,
        paymentMethod: this.paymentMethod,
        changeAmount: this.getChange(),
        posData: this.posData,
        notes: this.notes,
        totalVat: this.totalvat,
        totalSub: this.totalsub,
        receiptSubTotal: this.totalAmount + discountAmount,
        formatItemLine: this.formatItemLine.bind(this),
        formatLine: this.formatLine.bind(this),
      },
    });

    await preview.present();
    const previewResult = await preview.onDidDismiss();

    // === USER CLICKED CANCEL ===
    if (previewResult.role === 'confirm') {
      const loading = await this.loadingCtrl.create({
        message: 'Printing receipt...',
        spinner: 'crescent',
        backdropDismiss: false,
      });
      await loading.present();

      try {
        await this.printReceipt(
          businessInfo,
          datestr,
          salesreference
        );

        // Reset POS
        loading.dismiss();
        if (this.resetPOSCallback) this.resetPOSCallback();
      } catch (err) {
        console.error('Print error:', err);
        loading.dismiss();
        const alert = await this.alertController.create({
          header: 'Print Error',
          message: `Unable to print receipt. ${(err as Error)?.message || err}`,
          buttons: ['OK'],
        });
        await alert.present();
      }
    } else {
      // User clicked cancel
      if (this.resetPOSCallback) this.resetPOSCallback();
      this.modalCtrl.dismiss();
    }
  }

  private async printReceipt(
    businessInfo: ReceiptBusinessInfo,
    datestr: any,
    salesreference: any
  ) {
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
      await this.iminPrinter.initPrinter();
      const status = await this.iminPrinter.getPrinterStatus();
      if (status.text !== 'The printer is normal') {
        console.warn('Printer warning:', status.text);
      }

      const discountAmount = Number(this.posData.discount) || 0;
      const shouldPrintLogo = businessInfo.withLogo && !!businessInfo.logoDataUrl;
      try {
        await this.iminPrinter.setTextSize(28);
        await this.iminPrinter.setTextTypeface(0);
        await this.iminPrinter.setTextStyle(0);
        await this.iminPrinter.setAlignment(0);

        if (shouldPrintLogo) {
          const image = await loadImage(businessInfo.logoDataUrl!);
          const resizedDataURL = resizeImageStretch(image, 384, 250);
          await this.iminPrinter.printImage(resizedDataURL, 1);
        }

        const lines = buildSalesReceiptLines({
          businessInfo,
          invoiceNo: salesreference,
          date: datestr,
          cashier: this.cashierName,
          personnel: [
            this.posData.personnel1Name,
            this.posData.personnel2Name,
          ]
            .filter(Boolean)
            .join(', '),
          customer: this.posData.customerName,
          address: this.posData.customeraddress,
          category: this.posData.category,
          notes: this.notes,
          items: this.cart.map((item) => ({
            name: item.itemcode,
            qty: Number(item.qty) || 0,
            total: Number(item.amount) || 0,
          })),
          subTotal: Number((this.totalAmount + discountAmount).toFixed(2)),
          totalItemsCount: Number(this.totalitems) || 0,
          discountType: this.posData.discountType ?? 'none',
          discountAmount,
          totalAmount: Number(this.totalAmount) || 0,
          cashTendered: Number(parseFloat(this.tenderedAmount) || 0),
          change: Number(this.getChange().toFixed(2)),
          vatableSales: Number(this.totalsub) || 0,
          vatAmount: Number(this.totalvat) || 0,
          vatExemptSales: 0,
          zeroRatedSales: 0,
        });

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

    // close modal after printing
    this.dismissModal();
  }

  // Helper function to format columns
  private formatLine(qty: string, name: string, amount: string) {
    const label = `${qty ? `${qty} ` : ''}${name}`.slice(0, 18).padEnd(18, ' ');
    const value = amount.slice(0, 14).padStart(14, ' ');
    return `${label}${value}`;
  }

  pad(value: string, length: number) {
    return value.length >= length
      ? value.substring(0, length - 1) + ' '
      : value + ' '.repeat(length - value.length);
  }

  /**
   * Format a line for 58mm (32 chars per line)
   * Amount is ALWAYS at the far right
   */
  formatItemLine(
    qty: number | string,
    name: string,
    amount: number | string,
    lineWidth = 32 // total characters per line
  ) {
    qty = qty.toString();
    amount = parseFloat(amount.toString()).toFixed(2);

    // MUST MATCH total width formula:
    // qtyWidth + 1 space + nameWidth + 1 space + amountWidth = lineWidth

    const qtyWidth = 3; // same style as formatLine()
    const nameWidth = 20;
    const amountWidth = 8;

    // Format columns
    const qtyStr = qty.padStart(qtyWidth, ' ');

    const trimmedName =
      name.length > nameWidth ? name.slice(0, nameWidth) : name;

    const nameStr = trimmedName.padEnd(nameWidth, ' ');

    const amountStr = amount.padStart(amountWidth, ' ');

    // IMPORTANT: spaces between columns to keep alignment
    return `${qtyStr} ${nameStr} ${amountStr}`;
  }

  // Close modal
  dismissModal() {
    this.modalCtrl.dismiss();
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


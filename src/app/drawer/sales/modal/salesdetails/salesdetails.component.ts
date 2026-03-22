import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CustomersService } from 'src/app/services/customers.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { PersonnelTransactionService } from 'src/app/services/personnel-transaction.service';
import { PrinterService } from 'src/app/services/printer.service';
import { SalesService } from 'src/app/services/sales.service';
import { SalescartService } from 'src/app/services/salescart.service';
import { NotesComponent } from './modal/notes/notes.component';
import { PaybalanceComponent } from './modal/paybalance/paybalance.component';
import { CredithistoryComponent } from './modal/credithistory/credithistory.component';
import { EditpaymentComponent } from './modal/editpayment/editpayment.component';
import { LenditemsService } from 'src/app/services/lenditems.service';

@Component({
  selector: 'app-salesdetails',
  templateUrl: './salesdetails.component.html',
  styleUrls: ['./salesdetails.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonIcon,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonFooter,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonItemOption,
    IonItemOptions,
    IonItem,
    IonItemSliding,
  ],
})
export class SalesdetailsComponent implements OnInit {
  salesid?: number;
  screfnum?: string;
  sales: any;
  items: any;
  payments: any;
  constructor(
    private salescartService: SalescartService,
    private salesService: SalesService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private inventoryService: InventoryService,
    private customerService: CustomersService,
    private appdateService: AppdateService,
    private printService: PrinterService,
    private personelService: PersonnelTransactionService,
    private lendItemService: LenditemsService
  ) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  getPersonnel(): string {
    if (this.sales.salesdelby && this.sales.salesdelby2) {
      return this.sales.salesdelby + ' | ' + this.sales.salesdelby2;
    } else if (this.sales.salesdelby) {
      return this.sales.salesdelby;
    } else if (this.sales.salesdelby2) {
      return this.sales.salesdelby2;
    } else {
      return '';
    }
  }

  ngOnInit() {
    this.loadDetails(this.screfnum ?? '');
  }

  async loadDetails(screfnum: string) {
    if (!screfnum) return;
    this.items = await this.salescartService.getSalesDetailsByRefnum(screfnum);
    console.log('Loaded items:', this.items);
    console.log('this.sales', this.sales);
  }

  async cancelOrder() {
    const confirmAlert = await this.alertController.create({
      header: 'Cancel Order',
      message: `Are you sure you want to cancel order ${this.sales.salesrefnum}?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Yes',
          role: 'confirm',
          handler: async () => {
            const noteAlert = await this.alertController.create({
              header: 'Cancellation Note (Required)',
              inputs: [
                {
                  name: 'note',
                  type: 'text',
                  placeholder: 'Enter reason for cancellation',
                },
              ],
              buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                  text: 'Submit',
                  role: 'confirm',
                  handler: async (input) => {
                    const cancelNote = input.note?.trim() || '';

                    // 🚨 If note is empty → block submission
                    if (!cancelNote) {
                      this.appdateService.showToastjs(
                        'Cancellation note is required.',
                        'danger'
                      );
                      return false; // ⛔ prevents alert from closing
                    }

                    try {
                      await this.customerService.updateCustomerBalance(
                        this.sales.salestatus,
                        this.sales.salescustid,
                        this.sales.tenderbalance,
                        this.sales.salesrefnum,
                        cancelNote
                      );

                      await this.inventoryService.updateCancelInventoryQtyDb(
                        this.items,
                        this.sales.salesrefnum
                      );

                      await this.personelService.updatePersonnelSalary(
                        this.sales.salesrefnum,
                        this.sales.salesdelid || null,
                        this.sales.salesdelid2 || null
                      );

                      this.sales.salesremarks = this.sales.salesremarks + `CANCELLATION NOTE : ${cancelNote ?? ''}`

                      await this.appdateService.showToastjs(
                        `Order ${this.sales.salesrefnum} has been cancelled.`,
                        'success'
                      );

                      this.modalCtrl.dismiss({
                        salesid: this.sales.salesid,
                        salestatus: 'CANCELLED',
                      });

                      return true; // ✅ MUST return true so alert closes normally
                    } catch (error) {
                      console.error(error);
                      this.appdateService.showToastjs(
                        'Failed to cancel order. Please try again.',
                        'danger'
                      );

                      return false; // 🚨 error → do not close alert
                    }
                  },
                },
              ],
            });

            await noteAlert.present();
          },
        },
      ],
    });

    await confirmAlert.present();
  }

  async ReprintReceipt() {
    const alert = await this.alertController.create({
      header: 'Reprint Receipt',
      message: `Are you sure you want to reprint receipt for Order ${this.sales.salesrefnum}?`,
      buttons: [
        {
          text: 'No',
          role: 'cancel',
        },
        {
          text: 'Yes',
          role: 'confirm',
          handler: async () => {
            // Show loading
            const loading = await this.loadingController.create({
              message: 'Reprinting...',
              spinner: 'crescent',
              backdropDismiss: false,
            });

            await loading.present();

            try {
              // Execute printing
              await this.printService.rePrintReceipt(this.sales, this.items);

              // Success toast
              await this.appdateService.showToastjs(
                `Reprinting Receipt for order ${this.sales.salesrefnum}.`,
                'success'
              );
            } catch (error) {
              console.error(error);

              await this.appdateService.showToastjs(
                'Failed to reprint receipt.',
                'danger'
              );
            } finally {
              // Close loading spinner
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async openAndAddNote() {
    const modal = await this.modalCtrl.create({
      component: NotesComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0.6],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        notes: this.sales.salesremarks,
        salesrefnum: this.sales.salesrefnum,
      },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data?.newNote) {
      const added = data.newNote;

      // Save to DB
      await this.salesService.addnoteSaledb(this.sales.salesrefnum, added);

      // Update UI
      this.sales.salesremarks =
        (this.sales.salesremarks ? this.sales.salesremarks + '\n' : '') + added;

      await this.appdateService.showToastjs('Note added.', 'success');
    }
  }

  async openPayBalance() {
    const modal = await this.modalCtrl.create({
      component: PaybalanceComponent,
      initialBreakpoint: 0.63,
      breakpoints: [0.63],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        sales: this.sales,
      },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    console.log(data);

    if (data) {
      // Update UI
      this.sales.tenderbalance = this.sales.tenderbalance - data.cppay;

      if (this.sales.tenderbalance === 0) {
        this.sales.salestatus = 'PAID';
      }

      await this.appdateService.showToastjs(
        `Payment processed for ${this.sales.salescust}`,
        'success'
      );
    }
  }

  async openCreditHistory() {
    const modal = await this.modalCtrl.create({
      component: CredithistoryComponent,
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        sales: this.sales,
      },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    console.log(data);
  }

  async editPayment() {
    const modal = await this.modalCtrl.create({
      component: EditpaymentComponent,
      initialBreakpoint: 0.45,
      breakpoints: [0.45],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        sales: this.sales,
        origpaytype: this.sales.salespaytype,
      },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    console.log(data);
  }

  async lendItem(item: any, sliding?: IonItemSliding) {
    console.log('Lend item:', item);

    // 1. NON-REFILL CHECK
    if (item.scunit === 'NON-REFILL') {
      this.appdateService.showToastjs(
        'NON-REFILL Items cannot be lent!',
        'warning'
      );
      if (sliding) sliding.close();
      return;
    }

    // 2. EMPTY QTY CHECK
    const emptyQty = await this.inventoryService.loadEmptyQty(item.scitemcode);

    if (emptyQty <= 0) {
      this.appdateService.showToastjs(
        `${item.scitemcode} Empty Quantity is 0!`,
        'danger'
      );
      if (sliding) sliding.close();
      return;
    }

    // 3. LENDABLE MAX QTY (scqty - sclendqty)
    const maxLendQty = (item.scqty || 0) - (item.sclendqty || 0);

    if (maxLendQty <= 0) {
      this.appdateService.showToastjs(
        'No available lendable quantity for this item.',
        'warning'
      );
      if (sliding) sliding.close();
      return;
    }

    // 4. SHOW ALERT FOR INPUT LEND QTY
    const alert = await this.alertController.create({
      header: 'Lend Quantity',
      message: `Lendable quantity: ${maxLendQty}`,
      inputs: [
        {
          name: 'lendQty',
          type: 'number',
          min: 1,
          max: maxLendQty,
          placeholder: 'Enter lend quantity',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Next',
          handler: async (data) => {
            const lendQty = Number(data.lendQty);

            // VALIDATION
            if (!lendQty || lendQty <= 0) {
              this.appdateService.showToastjs(
                'Quantity must be greater than 0.',
                'danger'
              );
              return false; // stop dismiss
            }

            if (lendQty > maxLendQty) {
              this.appdateService.showToastjs(
                `Max lendable is ${maxLendQty}.`,
                'danger'
              );
              return false;
            }

            // PASSED VALIDATION — ASK FOR CONFIRMATION
            const confirm = await this.alertController.create({
              header: 'Confirm Lend',
              message: `Are you sure you want to lend ${lendQty} of ${item.scitemcode}?`,
              buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                  text: 'Yes, Lend',
                  handler: () => {
                    this.performLend(item, lendQty);
                  },
                },
              ],
            });

            await confirm.present();
            return true; // close the first alert
          },
        },
      ],
    });

    await alert.present();
  }

  private async performLend(item: any, lendQty: number) {
    try {
      // 1. Update inventory
      await this.inventoryService.updateLendInventoryQtyDb(
        lendQty,
        item.scitemcode,
        this.sales.salesrefnum
      );

      // 2. Add lend history
      await this.lendItemService.addLendHistory({
        refnum: this.sales.salesrefnum,
        itemcode: item.scitemcode,
        itemname: item.scitemdesc,
        qty: lendQty,
        custid: this.sales.salescustid,
        custname: this.sales.salescust,
      });

      await this.printService.printLend(this.sales, item, lendQty);
      this.items.sclendqty = lendQty;

      // 3. Optional toast
      this.appdateService.showToastjs(
        `Lended ${lendQty} of ${item.scitemcode}`,
        'success'
      );
    } catch (error) {
      console.error('Error performing lend:', error);
      this.appdateService.showToastjs('Failed to lend item!', 'danger');
    }
  }

  async cancelItem(item: any, sliding?: IonItemSliding) {
    const maxCancelQty = (item.scqty || 0) - (item.sclendqty || 0);

    if (maxCancelQty <= 0) {
      this.appdateService.showToastjs(
        'No available quantity to cancel for this item.',
        'warning'
      );
      if (sliding) sliding.close();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancel Item',
      message: `Cancelable quantity: ${maxCancelQty}`,
      inputs: [
        {
          name: 'cancelQty',
          type: 'number',
          min: 1,
          max: maxCancelQty,
          placeholder: 'Enter quantity to cancel',
        },
        {
          name: 'cancelNote',
          type: 'textarea',
          placeholder: 'Enter cancellation note (required)',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: async (data) => {
            const qty = Number(data.cancelQty);
            const note = (data.cancelNote || '').trim();

            // ---- VALIDATIONS ----
            if (!qty || qty <= 0) {
              this.appdateService.showToastjs(
                'Quantity must be greater than 0.',
                'danger'
              );
              return false;
            }

            if (qty > maxCancelQty) {
              this.appdateService.showToastjs(
                `Max cancelable is ${maxCancelQty}.`,
                'danger'
              );
              return false;
            }

            if (!note) {
              this.appdateService.showToastjs(
                'Cancellation note is required.',
                'danger'
              );
              return false;
            }

            // -----------------------
            // SHOW LOADING CONTROLLER
            // -----------------------
            const loading = await this.loadingController.create({
              message: 'Cancelling item...',
              spinner: 'crescent',
            });

            await loading.present();

            try {
              await this.cancelItemDb(item, qty, note, sliding);
            } catch (error) {
              console.error(error);
              this.appdateService.showToastjs(
                'Error cancelling item.',
                'danger'
              );
            } finally {
              loading.dismiss();
            }

            return true; // close alert
          },
        },
      ],
    });

    await alert.present();
  }

  // Separate async function to handle DB update
  private async cancelItemDb(
    item: any,
    qty: number,
    note: string,
    sliding?: IonItemSliding
  ) {
    try {
      await this.inventoryService.cancelItemUpdateDb(
        qty,
        item.scitemcode,
        item.screfnum,
        item.scunit === 'REFILL' ? 'REFILL' : 'NON-REFILL',
        note
      );

      await this.personelService.cancelDeliverySalaryUpdate(
        qty,
        item.scitemcode,
        item.screfnum,
        this.sales.salesdelid,
        this.sales.salesdelid2
      );

      const {
        newTotal,
        newTotalAmount,
        newSub,
        newVat,
        newTendered,
        newSalestatus,
        newSalesremarks,
      } = await this.salescartService.cancelSalesItem(
        item,
        qty,
        this.sales.salescustid,
        item.screfnum,
        this.sales.salestender,
        this.sales.salestotalamount,
        this.sales.salestatus,
        note
      );
      if (this.sales.salestatus === 'UNPAID') {
        this.sales.tenderbalance = newTotal;
      }
      this.sales.salestotalamount = newTotalAmount;
      this.sales.salessubtotal = newSub;
      this.sales.salesvat = newVat;
      this.sales.salestender = newTendered;
      this.sales.salesremarks = newSalesremarks;
      this.sales.salestatus = newSalestatus;
      this.appdateService.showToastjs('Item canceled.', 'success');

      if (sliding) sliding.close();
      this.loadDetails(this.screfnum ?? '');
    } catch (err) {
      console.error('Cancel item error', err);
      this.appdateService.showToastjs('Failed to cancel item.', 'danger');
    }
  }
}

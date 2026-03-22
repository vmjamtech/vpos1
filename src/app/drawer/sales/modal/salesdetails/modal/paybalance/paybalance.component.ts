import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import moment from 'moment';
import { AppdateService } from 'src/app/services/appdate.service';
import { CreditHistoryService } from 'src/app/services/credithistory.service';
import { PrinterService } from 'src/app/services/printer.service';

@Component({
  selector: 'app-paybalance',
  templateUrl: './paybalance.component.html',
  styleUrls: ['./paybalance.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonCard,
    IonCardContent,
    IonIcon,
  ],
})
export class PaybalanceComponent implements OnInit {
  balanceAfter = 0;
  tendered: number | null = null;
  paymentMethod: string = 'CASH';
  sales?: any;

  constructor(
    private modalCtrl: ModalController,
    private printService: PrinterService,
    private appdateService: AppdateService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private creditHistoryService: CreditHistoryService
  ) {}

  ngOnInit() {}

  computeBalance() {
    const tender = this.tendered || 0;
    this.balanceAfter = this.sales.tenderbalance - tender;
  }

  async payAndPrint() {
    if (!this.isValidPayment()) return;

    const alert = await this.alertController.create({
      header: 'Confirm Payment',
      message: `Are you sure you want to pay ${this.tendered?.toFixed(2)} for ${
        this.sales.salescust
      }?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          role: 'confirm',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Processing payment...',
              spinner: 'crescent',
            });
            await loading.present();

            const datestr = moment()
              .tz('Asia/Manila')
              .format('YYYY-MM-DD HH:mm:ss');
            const creditData = {
              cprefnum: this.sales.salesrefnum,
              cpcustname: this.sales.salescust,
              cpcashier: this.sales.salescashier,
              cppaydate: datestr,
              cppay: this.tendered ?? 0,
              cpcustcat: this.sales.salescat,
              cpbalance: this.sales.tenderbalance ?? 0,
              cprembal: this.balanceAfter ?? 0,
              cpcustid: this.sales.salescustid ?? 0,
              ri: this.balanceAfter ?? 0,
              cppaymethod: this.paymentMethod,
            };

            try {
              // Insert payment record and update balances
              await this.creditHistoryService.insertCreditPayment(creditData);

              // Print receipt
              loading.message = 'Printing...';
              await this.printService.printBalance(
                this.sales,
                creditData.cppay,
                creditData.cprembal
              );

              await loading.dismiss();

              // Close modal and return payment info
              this.modalCtrl.dismiss(creditData);
            } catch (error: any) {
              await loading.dismiss();
              console.error('Payment error:', error);
              const errAlert = await this.alertController.create({
                header: 'Error',
                message: `Unable to process payment: ${error.message || error}`,
                buttons: ['OK'],
              });
              await errAlert.present();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  setExactAmount() {
    this.tendered = this.sales.tenderbalance ?? 0; // or whatever your remaining balance variable is
    this.computeBalance();
  }

  isValidPayment(): boolean {
    // Button enabled only if tendered > 0, <= balance, and payment method selected
    return (
      this.tendered != null &&
      this.tendered > 0 &&
      this.tendered <= (this.sales?.tenderbalance ?? 0) &&
      !!this.paymentMethod
    );
  }

  async printBalance() {
    const alert = await this.alertController.create({
      header: 'Print Balance',
      message: `Are you sure you want to print the balance for ${this.sales.salescust}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Print',
          role: 'confirm',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Printing...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              await this.printService.printBalance(
                this.sales,
                this.tendered ?? 0,
                this.sales.tenderbalance ?? 0
              );
              await loading.dismiss();

              await this.appdateService.showToastjs(
                `Balance printed for ${this.sales.salescust}.`,
                'success'
              );
            } catch (error: any) {
              await loading.dismiss();
              console.error('Print error:', error);
              const errAlert = await this.alertController.create({
                header: 'Printer Error',
                message: `Unable to print. ${error.message || error}`,
                buttons: ['OK'],
              });
              await errAlert.present();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  close() {
    this.modalCtrl.dismiss();
  }
}

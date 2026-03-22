import { CommonModule } from '@angular/common';
import { Component, Input, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CreditHistoryService } from 'src/app/services/credithistory.service';

@Component({
  selector: 'app-editpayment',
  templateUrl: './editpayment.component.html',
  styleUrls: ['./editpayment.component.scss'],
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
  ],
})
export class EditpaymentComponent implements OnInit {
  @Input() sales: any; // Original input from parent
  localSales: any; // Local copy for editing
  origpaytype: string = '';

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private creditHistoryService: CreditHistoryService
  ) {}

  ngOnInit() {
    // Make a copy to edit locally
    this.localSales = { ...this.sales };
    this.origpaytype = this.localSales.salespaytype;
  }

  resetSales() {
    this.localSales = {
      salespaytype: '',
      salespaym: '',
      salestender: 0,
      tenderbalance: 0,
      salesrefnum: '',
      salescustid: '',
      origamount: 0,
      ntrbalance: 0,
      ptype: '',
      empname: '',
    };
  }

  close() {
    this.resetSales();
    this.modalCtrl.dismiss();
  }

  async confirmChanges() {
    const s = this.localSales;

    // Check for FULL PAYMENT on a PARTIAL record
    if (
      s.salespaytype === 'FULL PAYMENT' &&
      this.origpaytype === 'PARTIAL PAYMENT'
    ) {
      const alert = await this.alertController.create({
        header: 'Info',
        message: 'Please proceed to Pay Balance Instead!',
        buttons: ['OK'],
      });
      s.salespaytype = 'PARTIAL PAYMENT';
      await alert.present();
      return;
    }

    // Validate tendered amount
    if (!s.salestender || s.salestender <= 0) {
      const alert = await this.alertController.create({
        header: 'Invalid Input',
        message: 'Tendered amount is required!',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    // Check for insufficient amount
    if (s.salespaytype === 'FULL PAYMENT' && s.salestender < s.tenderbalance) {
      const alert = await this.alertController.create({
        header: 'Insufficient Amount',
        message: 'Tendered amount is less than total!',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    if (
      s.salespaytype === 'PARTIAL PAYMENT' &&
      s.salestender >= s.tenderbalance
    ) {
      s.salespaytype = 'FULL PAYMENT';
    }

    // Ask for confirmation
    const confirmAlert = await this.alertController.create({
      header: 'Confirm Changes',
      message: 'Are you sure you want to save these changes?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          role: 'confirm',
          handler: async () => {
            try {
              if (s.salespaytype === 'FULL PAYMENT') {
                await this.creditHistoryService.updateTransaction({
                  salesrefnum: s.salesrefnum,
                  salespaym: s.salespaym,
                  salestender: s.salestender,
                  salespaytype: s.salespaytype,
                  tenderbalance: s.tenderbalance,
                  custid: s.salescustid,
                  ptype: s.ptype,
                  tenderlbl: s.salestender,
                  empname: s.empname,
                });
              } else {
                await this.creditHistoryService.updateToUnpaid({
                  salesrefnum: s.salesrefnum,
                  salespaym: s.salespaym,
                  salestender: s.salestender,
                  salespaytype: s.salespaytype,
                  origamount: s.origamount,
                  ntrbalance: s.ntrbalance,
                  custid: s.salescustid,
                  empname: s.empname,
                });
              }

              const successAlert = await this.alertController.create({
                header: 'Success',
                message: 'Update Successful.',
                buttons: ['OK'],
              });
              await successAlert.present();

              this.modalCtrl.dismiss(true); // close modal
            } catch (error: any) {
              const errAlert = await this.alertController.create({
                header: 'Error',
                message: `Failed to update: ${error.message || error}`,
                buttons: ['OK'],
              });
              await errAlert.present();
            }
          },
        },
      ],
    });

    await confirmAlert.present();
  }
}

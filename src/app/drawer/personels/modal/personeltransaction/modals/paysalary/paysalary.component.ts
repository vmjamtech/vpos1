import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
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
import { PersonnelTransactionService } from 'src/app/services/personnel-transaction.service';
import { PrinterService } from 'src/app/services/printer.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-paysalary',
  templateUrl: './paysalary.component.html',
  styleUrls: ['./paysalary.component.scss'],
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
    IonIcon,
  ],
  providers: [DatePipe],
})
export class PaysalaryComponent implements OnInit {
  Data?: any;

  pid?: number;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  pname: string = '';
  prole = ['Driver', 'Rider', 'StoreKeeper'];
  selectedRole: string = '';
  isHave: boolean = false;
  totalsalary: number = 0;
  dailyrate: number = 0;
  incentive: number = 0;
  additional: number | null = null;
  lesspay: number | null = null;
  paymentMethod: string = '';
  tenderedAmount: number | null = null;

  constructor(
    private modalCtrl: ModalController,
    private personelTransactionService: PersonnelTransactionService,
    private appdateService: AppdateService,
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private printService: PrinterService,
    private datePipe: DatePipe
  ) {}

  async ngOnInit() {
    console.log('data', this.Data);
    if (this.Data) {
      this.pid = this.Data.pid;
      this.pname = this.Data.pname;
      this.selectedRole = this.Data.prole;
      this.currentDateFrom = this.Data.datefrom;
      this.currentDateTo = this.Data.dateto;
      this.incentive = this.Data.incentive;
    }
    this.dailyrate = await this.personelTransactionService.getDailyRate(
      this.pid ?? 0
    );
    this.totalsalary = await this.personelTransactionService.computeTotalSalary(
      this.selectedRole,
      this.pname,
      this.pid ?? 0,
      this.currentDateFrom ?? '',
      this.currentDateTo ?? '',
      false
    );
  }

  get totalPay(): number {
    return (
      (this.totalsalary || 0) +
      (this.incentive || 0) +
      (this.additional || 0) -
      (this.lesspay || 0)
    );
  }

  checkTenderedAmount() {
    if (!this.tenderedAmount) {
      this.tenderedAmount = 0;
    }

    if (this.tenderedAmount > this.totalPay) {
      this.tenderedAmount = this.totalPay;
    }
  }

  setTenderedToTotal() {
    this.tenderedAmount = this.totalPay;
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async paysalary() {
    // Validate
    if (!this.paymentMethod) {
      await this.appdateService.showToastjs(
        'Please select a payment method',
        'warning'
      );
      return;
    }

    if ((this.tenderedAmount ?? 0) <= 0) {
      await this.appdateService.showToastjs(
        'Please enter a valid tendered amount',
        'warning'
      );
      return;
    }

    this.checkTenderedAmount();

    // Confirm payment alert
    const alert = await this.alertCtrl.create({
      header: 'Confirm Payment',
      message: `Are you sure you want to pay ${this.tenderedAmount?.toLocaleString(
        'en-PH',
        { style: 'currency', currency: 'PHP' }
      )} to ${this.pname}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: async () => {
            // Show loading
            const loading = await this.loadingCtrl.create({
              message: 'Processing payment...',
            });
            await loading.present();

            try {
              const formattedFrom = this.datePipe.transform(
                this.currentDateFrom,
                'MMM dd, yyyy'
              );
              const formattedTo = this.datePipe.transform(
                this.currentDateTo,
                'MMM dd, yyyy'
              );

              const user = await this.storageService.get<any>('login-data');
              const disBy = user?.empname || 'ADMINISTRATOR';

              // Call service to save salary
              await this.personelTransactionService.insertPaySalaryHistory({
                pname: this.pname,
                pid: this.pid ?? 0,
                tendered: this.tenderedAmount ?? 0,
                totalPay: this.totalPay,
                dailyRate: this.dailyrate,
                additional: this.additional ?? 0,
                lessPay: this.lesspay ?? 0,
                incentive: this.incentive,
                remarks: `From ${formattedFrom} to ${formattedTo}`,
                paidBy: disBy,
                dateFrom: this.currentDateFrom ?? '',
                dateTo: this.currentDateTo ?? '',
                paymentMethod: this.paymentMethod,
              });

              this.printSalary(this.tenderedAmount ?? 0);

              await this.appdateService.showToastjs(
                'Salary paid successfully!',
                'success'
              );

              this.dismiss();
            } catch (error) {
              console.error('Error paying salary:', error);
              await this.appdateService.showToastjs(
                'Failed to pay salary. Try again.',
                'danger'
              );
            } finally {
              loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async printSalary(tenderedAmount: number) {
    const datestr = moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss');

    try {
      await this.printService.printSalary(datestr, tenderedAmount, this.pname);
    } catch (error) {}
  }
}

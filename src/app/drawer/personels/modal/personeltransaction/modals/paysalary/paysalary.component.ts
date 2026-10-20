import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import moment from 'moment';
import { AppdateService } from 'src/app/services/appdate.service';
import { PersonnelTransactionService } from 'src/app/services/personnel-transaction.service';
import { PersonnelIncentiveService } from 'src/app/services/personnel-incentive.service';
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
    IonButton,
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
  linkedUserid: number | null = null;
  currentDateFrom: string | null = null;
  currentDateTo: string | null = null;
  pname: string = '';
  selectedRole: string = '';
  daysCount: number = 0;
  baseSalary: number = 0;
  dailyRate: number = 0;
  commission: number = 0;
  incentive: number = 0;
  additional: number | null = 0;
  lesspay: number | null = 0;
  paymentMethod: string = '';
  tenderedAmount: number | null = 0;
  isLoading = true;
  loadError = false;
  totalPay = 0;

  constructor(
    private modalCtrl: ModalController,
    private personelTransactionService: PersonnelTransactionService,
    private personnelIncentiveService: PersonnelIncentiveService,
    private appdateService: AppdateService,
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private printService: PrinterService,
    private datePipe: DatePipe
  ) {}

  async ngOnInit() {
    if (this.Data) {
      this.pid = this.Data.pid;
      this.pname = this.Data.pname;
      this.selectedRole = this.Data.prole;
      this.currentDateFrom = this.Data.datefrom;
      this.currentDateTo = this.Data.dateto;
      this.linkedUserid = this.Data.linked_userid ?? null;
      this.commission = Number(this.Data.commission) || 0;
    }
    if (!this.pid || !this.currentDateFrom || !this.currentDateTo) {
      this.loadError = true;
      this.isLoading = false;
      return;
    }

    try {
      this.dailyRate = await this.personelTransactionService.getDailyRate(
        this.pid
      );
      this.daysCount = await this.personelTransactionService.getSalaryDays(
        this.selectedRole,
        this.pname,
        this.pid,
        this.currentDateFrom,
        this.currentDateTo,
        false,
        this.linkedUserid
      );
      this.baseSalary = this.daysCount * this.dailyRate;

      if (
        this.selectedRole === 'Cashier' ||
        this.selectedRole === 'StoreKeeper'
      ) {
        if (this.linkedUserid == null) {
          throw new Error('Cashier has no linked user account.');
        }
        const result = await this.personnelIncentiveService.getCashierIncentive(
          this.pid,
          this.linkedUserid,
          this.currentDateFrom,
          this.currentDateTo
        );
        this.incentive = result.totalIncentive;
      } else if (this.selectedRole === 'Rider') {
        const result = await this.personnelIncentiveService.getRiderIncentive(
          this.pid,
          this.currentDateFrom,
          this.currentDateTo
        );
        this.incentive = result.totalIncentive;
      } else if (this.selectedRole === 'Driver') {
        const result = await this.personnelIncentiveService.getDriverIncentive(
          this.pid,
          this.currentDateFrom,
          this.currentDateTo
        );
        this.incentive = result.totalIncentive;
      }
      this.recalculateTotals();
    } catch (error) {
      console.error('Failed to load salary calculation:', error);
      this.loadError = true;
      await this.appdateService.showToastjs(
        'Unable to calculate salary. Please try again.',
        'danger'
      );
    } finally {
      this.isLoading = false;
    }
  }

  recalculateTotals() {
    this.totalPay =
      this.baseSalary +
      this.commission +
      (this.incentive || 0) +
      (Number(this.additional) || 0) -
      (Number(this.lesspay) || 0);
  }

  checkTenderedAmount() {
    if (!this.tenderedAmount) {
      this.tenderedAmount = 0;
    }

    if ((this.tenderedAmount ?? 0) > this.totalPay) {
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
    this.recalculateTotals();
    if (this.loadError || this.isLoading || this.totalPay <= 0) {
      await this.appdateService.showToastjs(
        'Salary details are incomplete or invalid.',
        'warning'
      );
      return;
    }

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
                dailyRate: this.dailyRate,
                days: this.daysCount,
                salary: this.baseSalary,
                commission: this.commission,
                commissionPaid: Math.min(
                  this.commission,
                  this.tenderedAmount ?? 0
                ),
                additional: this.additional ?? 0,
                lessPay: this.lesspay ?? 0,
                incentive: this.incentive,
                remarks: `From ${formattedFrom} to ${formattedTo}`,
                paidBy: disBy,
                dateFrom: this.currentDateFrom ?? '',
                dateTo: this.currentDateTo ?? '',
                paymentMethod: this.paymentMethod,
              });

              await this.printSalary(this.tenderedAmount ?? 0);

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
    } catch (error) {
      console.error('Failed to print salary receipt:', error);
    }
  }
}

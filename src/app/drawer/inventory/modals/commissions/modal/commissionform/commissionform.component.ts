import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CommissionsService } from 'src/app/services/commissions.service';

@Component({
  selector: 'app-commissionform',
  templateUrl: './commissionform.component.html',
  styleUrls: ['./commissionform.component.scss'],
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
  ],
})
export class CommissionformComponent implements OnInit {
  commission!: any;

  compickup = 0;
  comdel = 0;

  constructor(
    private modalCtrl: ModalController,
    private appdateService: AppdateService,
    private commissionService: CommissionsService
  ) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  ngOnInit() {
    if (!this.commission) {
      this.dismiss();
      return;
    }

    this.compickup = this.commission.compickup ?? 0;
    this.comdel = this.commission.comdel ?? 0;
  }

  formatTwoDecimalsNumber(value: number): number {
    return Math.round((value ?? 0) * 100) / 100;
  }

  toNumber(val: any): number {
    return Number(val) || 0;
  }

  async save() {
    try {
      console.log('RAW compickup:', this.compickup, typeof this.compickup);
      console.log('RAW comdel:', this.comdel, typeof this.comdel);

      const pickupVal = this.formatTwoDecimalsNumber(this.compickup);
      const deliverVal = this.formatTwoDecimalsNumber(this.comdel);

      console.log('FORMATTED pickupVal:', pickupVal);
      console.log('FORMATTED deliverVal:', deliverVal);

      await this.commissionService.updateCommission(
        this.commission.itemid,
        pickupVal,
        deliverVal
      );

      await this.appdateService.showToastjs(
        'Commission updated successfully!',
        'success',
        'top',
        2000
      );

      this.modalCtrl.dismiss({
        ...this.commission,
        comitemid: this.commission.itemid,
        compickup: pickupVal,
        comdel: deliverVal,
      });
    } catch (error) {
      console.error(error);
      await this.appdateService.showToastjs(
        'Failed to update commission.',
        'danger',
        'top',
        2500
      );
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';

interface IncentiveItem {
  size: string;
  qty: number;
  rate: number;
  amount: number;
  soldQty?: number;
  excessQty?: number;
}

@Component({
  selector: 'app-incentive-info-modal',
  templateUrl: './incentive-info.modal.html',
  styleUrls: ['./incentive-info.modal.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, IonIcon],
})
export class IncentiveInfoModalComponent {
  @Input() role: string | null = null;
  @Input() items: IncentiveItem[] = [];
  @Input() totalIncentive = 0;
  @Input() riderQuota = 0;
  @Input() totalSoldCylinders = 0;
  @Input() totalExcessCylinders = 0;

  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}

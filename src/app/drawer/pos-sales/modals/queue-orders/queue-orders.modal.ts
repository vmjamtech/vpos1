import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-queue-orders-modal',
  templateUrl: './queue-orders.modal.html',
  styleUrls: ['./queue-orders.modal.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonTitle,
    IonToolbar,
  ],
})
export class QueueOrdersModalComponent implements OnInit {
  @Input() queuedOrders: any[] = [];
  @Input() hasActiveTransaction = false;

  selectedQueueNo: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.selectedQueueNo = this.queuedOrders[0]?.queueNo ?? null;
  }

  get selectedOrder(): any | null {
    return (
      this.queuedOrders.find(
        (order) => order.queueNo === this.selectedQueueNo
      ) ?? null
    );
  }

  selectOrder(order: any) {
    this.selectedQueueNo = order.queueNo;
  }

  getOrderUnits(order: any): string {
    const units = (order.cart ?? [])
      .map((item: any) => item.unit)
      .filter((unit: string | undefined) => !!unit);
    return [...new Set(units)]
      .map((unit) => (unit === 'REFILL' ? 'Refill' : 'Non Refill'))
      .join(', ') || '—';
  }

  getItemPrice(item: any): number {
    return Number(
      item.price ??
        (item.unit === 'REFILL' ? item.Refill : item.Non_Refill) ??
        0
    );
  }

  close() {
    return this.modalCtrl.dismiss();
  }

  async cancelSelectedOrder() {
    const selectedOrder = this.selectedOrder;
    if (!selectedOrder) return;

    const alert = await this.alertController.create({
      header: 'Cancel queued order?',
      message: `Remove ${selectedOrder.queueNo} from the queue?`,
      buttons: [
        { text: 'Keep Order', role: 'cancel' },
        { text: 'Cancel Order', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    const queuedOrders = this.queuedOrders.filter(
      (order) => order.queueNo !== selectedOrder.queueNo
    );
    await this.modalCtrl.dismiss({ queuedOrders });
  }

  async processSelectedOrder() {
    const selectedOrder = this.selectedOrder;
    if (!selectedOrder) return;

    if (this.hasActiveTransaction) {
      const alert = await this.alertController.create({
        header: 'Replace current transaction?',
        message:
          'Processing this queued order will replace the current POS transaction.',
        buttons: [
          { text: 'Keep Current Sale', role: 'cancel' },
          { text: 'Replace and Process', role: 'confirm' },
        ],
      });
      await alert.present();
      const { role } = await alert.onDidDismiss();
      if (role !== 'confirm') return;
    }

    const queuedOrders = this.queuedOrders.filter(
      (order) => order.queueNo !== selectedOrder.queueNo
    );
    await this.modalCtrl.dismiss({ restoredOrder: selectedOrder, queuedOrders });
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  ModalController,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-receipt-preview',
  templateUrl: './receipt-preview.component.html',
  styleUrls: ['./receipt-preview.component.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonButton],
})
export class ReceiptPreviewComponent {
  @Input() compName!: string;
  @Input() compName1!: string;
  @Input() receiptAddress!: string;
  @Input() receiptAddress1!: string;
  @Input() compContact!: string;
  @Input() compContact1!: string;
  @Input() compContact2!: string;
  @Input() receiptEndGreet!: string;
  @Input() withlogo!: string;
  @Input() logo?: string;

  @Input() cart!: any[];
  @Input() posData!: any;
  @Input() totalAmount: number = 0;
  @Input() tenderedAmount: number = 0;
  @Input() totalVat: number = 0;
  @Input() totalSub: number = 0;
  @Input() totalItems: number = 0;
  @Input() cashierName!: string;
  @Input() datestr!: string;

  @Input() paymentMethod!: string;
  @Input() salesreference!: string;
  @Input() notes!: string;
  @Input() changeAmount!: number;

  // @Input() formatItemLine!: any;
  @Input() formatLine!: any;
  printing = false;

  constructor(private modalCtrl: ModalController) {}

  confirm() {
    this.modalCtrl.dismiss(null, 'confirm');
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  formatItemLine(qty: string | number, name: string, amount: string | number) {
    // Convert inputs to string
    const qtyStr = String(qty);
    const amtStr = String(amount);

    // Column widths (adjust to match receipt width)
    const qtyWidth = 3; // Qty column
    const nameWidth = 20; // Item name column
    const amountWidth = 8; // Amount column

    // Pad/trim values
    const paddedQty = qtyStr.padStart(qtyWidth, ' ');
    const paddedName =
      name.length > nameWidth
        ? name.slice(0, nameWidth)
        : name.padEnd(nameWidth, ' ');
    const paddedAmount = amtStr.padStart(amountWidth, ' ');

    return `${paddedQty} ${paddedName} ${paddedAmount}`;
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { TransferService } from 'src/app/services/transfer.service';
import { ItemlistsComponent } from './modal/itemlists/itemlists.component';

@Component({
  selector: 'app-itemconvertform',
  templateUrl: './itemconvertform.component.html',
  styleUrls: ['./itemconvertform.component.scss'],
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
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonIcon,
    IonList,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonBadge,
  ],
})
export class ItemconvertformComponent implements OnInit {
  title: string = '';
  transtype: string = '';
  poutrefnum: string = '';
  pulldate: string = '';
  poutencoder: string = '';
  pullsupplier: string = '';
  cart1: string = '';
  cart2: string = '';
  fillitems: any[] = [];
  emptyitems: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    private transferService: TransferService,
    private alertController: AlertController,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  removeItem(item: any) {
    this.fillitems = this.fillitems.filter((i) => i !== item);
  }

  removeEmptyItem(item: any) {
    this.emptyitems = this.emptyitems.filter((i) => i !== item);
  }

  async onQtyChange(item: any, event: any) {
    const fieldstring =
      this.transtype === 'RESTOCK OUT' ||
      this.transtype === 'WAREHOUSE OUT' ||
      this.transtype === 'WAREHOUSE IN'
        ? 'fillqty'
        : '';

    let input = event.target;
    if (!fieldstring) {
      const value = parseInt(event.detail.value, 10) || 1;
      item.qty = value;
      input.value = value;
      return;
    }

    let val = parseInt(event.detail.value, 10);
    if (isNaN(val) || val < 1) val = 1;

    if (val > item[fieldstring]) {
      const alert = await this.alertController.create({
        header: 'Out of Stock',
        message: `Cannot exceed available stock. Only ${item[fieldstring]} available.`,
        buttons: ['OK'],
      });
      await alert.present();

      val = item[fieldstring];
    }

    item.qty = val;
    input.value = val;
  }

  // Qty handlers
  async incrementQty(item: any) {
    const fieldstring =
      this.transtype === 'USED' ||
      this.transtype === 'WAREHOUSE OUT' ||
      this.transtype === 'WAREHOUSE IN'
        ? 'fillqty'
        : '';
    if (!fieldstring) {
      item.qty = (item.qty || 0) + 1;
      return;
    }

    if ((item.qty || 0) + 1 > item[fieldstring]) {
      const alert = await this.alertController.create({
        header: 'Out of Stock',
        message: `Cannot exceed available stock. Only ${item[fieldstring]} available.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    item.qty = (item.qty || 0) + 1;
  }

  decrementQty(item: any) {
    if (item.qty > 1) {
      item.qty -= 1;
    }
  }

  async openAddFillItemModal() {
    const fieldstring =
      this.transtype === 'USED' ||
      this.transtype === 'WAREHOUSE OUT' ||
      this.transtype === 'WAREHOUSE IN'
        ? 'fillqty'
        : '';

    const isWarehouse = this.transtype === 'WAREHOUSE OUT' ? 1 : 0;

    const modal = await this.modalCtrl.create({
      component: ItemlistsComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        qtyField: fieldstring,
        isWarehouse: isWarehouse,
      },
    });

    modal.onDidDismiss().then((res) => {
      if (!res.data) return;

      const item = res.data;

      this.addCartFillItem({
        ...item,
        qty: 1,
      });
    });

    return await modal.present();
  }

  // Add item to cart
  addCartFillItem(item: any) {
    const exists = this.fillitems.some((x) => x.itemid === item.itemid);

    if (exists) {
      return;
    }

    this.fillitems.push(item);
    console.log(this.fillitems);
  }

  async openAddEmptyItemModal() {
    const fieldstring = this.transtype !== 'USED' ? 'emptyqty' : '';
    const isWarehouse = this.transtype === 'WAREHOUSE OUT' ? 1 : 0;
    const modal = await this.modalCtrl.create({
      component: ItemlistsComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        qtyField: fieldstring,
        isWarehouse: isWarehouse,
      },
    });

    modal.onDidDismiss().then((res) => {
      if (!res.data) return;

      const item = res.data;

      const cartItem = {
        ...item,
        qty: 1,
      };

      this.addCartEmptyItem(cartItem);
    });

    return await modal.present();
  }

  addCartEmptyItem(item: any) {
    this.emptyitems.push(item);
  }

  async onQtyChangeEmpty(item: any, event: any) {
    const fieldstring = this.transtype !== 'USED' ? 'emptyqty' : '';

    let input = event.target;
    if (!fieldstring) {
      const value = parseInt(event.detail.value, 10) || 1;
      item.qty = value;
      input.value = value;
      return;
    }

    let val = parseInt(event.detail.value, 10);
    if (isNaN(val) || val < 1) val = 1;

    if (val > item[fieldstring]) {
      const alert = await this.alertController.create({
        header: 'Out of Stock',
        message: `Cannot exceed available stock. Only ${item[fieldstring]} available.`,
        buttons: ['OK'],
      });
      await alert.present();

      val = item[fieldstring];
    }

    item.qty = val;
    input.value = val;
  }

  async incrementQtyEmpty(item: any) {
    const fieldstring = this.transtype !== 'USED' ? 'emptyqty' : '';
    if (!fieldstring) {
      item.qty = (item.qty || 0) + 1;
      return;
    }

    if ((item.qty || 0) + 1 > item[fieldstring]) {
      const alert = await this.alertController.create({
        header: 'Out of Stock',
        message: `Cannot exceed available stock. Only ${item[fieldstring]} available.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    item.qty = (item.qty || 0) + 1;
  }

  decrementQtyEmpty(item: any) {
    if (item.qty > 1) {
      item.qty -= 1;
    }
  }

  getFillTotalQty(): number {
    return this.fillitems.reduce((sum, item) => sum + item.qty, 0);
  }

  getEmptyTotalQty(): number {
    return this.emptyitems.reduce((sum, item) => sum + item.qty, 0);
  }

  get hasMismatchedQty(): boolean {
    if (this.transtype === 'CONVERT') {
      const fillTotal = this.fillitems.reduce((sum, item) => sum + item.qty, 0);
      const emptyTotal = this.emptyitems.reduce(
        (sum, item) => sum + item.qty,
        0
      );
      return fillTotal !== emptyTotal;
    } else {
      return false;
    }
  }

  get hasRows(): boolean {
    if (
      this.transtype === 'CONVERT' ||
      this.transtype === 'WAREHOUSE OUT' ||
      this.transtype === 'WAREHOUSE IN'
    ) {
      return this.fillitems.length > 0 || this.emptyitems.length > 0;
    } else if (this.transtype === 'CREATE') {
      return this.emptyitems.length > 0;
    } else if (this.transtype === 'USED') {
      return this.fillitems.length > 0;
    }

    // Default fallback to avoid returning undefined
    return false;
  }

  async saveTransfer() {
    // Show confirmation alert
    const alert = await this.alertController.create({
      header: `Confirm`,
      message: `Are you sure you want to save this ${this.title}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Confirm',
          handler: async () => {
            try {
              // Place your save logic here
              await this.transferService.save(
                this.poutrefnum,
                this.poutencoder,
                this.pullsupplier,
                this.pulldate,
                this.transtype,
                this.fillitems,
                this.emptyitems
              );

              await this.appdateService.showToastjs(
                'Transfer saved successfully!',
                'success'
              );
              this.modalCtrl.dismiss(true);
            } catch (error) {
              console.error('Error saving transfer:', error);

              await this.appdateService.showToastjs(
                'Failed to save transfer. Please try again.',
                'danger'
              );
            }
          },
        },
      ],
    });

    await alert.present();
  }
}

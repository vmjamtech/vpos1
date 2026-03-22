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
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { TransferService } from 'src/app/services/transfer.service';
import { ItemlistsComponent } from '../itemconvertform/modal/itemlists/itemlists.component';

@Component({
  selector: 'app-itemrestockform',
  templateUrl: './itemrestockform.component.html',
  styleUrls: ['./itemrestockform.component.scss'],
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
    IonSelect,
    IonSelectOption,
  ],
})
export class ItemrestockformComponent implements OnInit {
  title: string = '';
  transtype: string = '';
  poutrefnum: string = '';
  pulldate: string = '';
  poutencoder: string = '';
  pullsupplier: string = '';
  suppliers: any = [];
  selectedSupplier: string | null = null;
  driver: any = [];
  selectedDriver: number | null = null;
  cart1: string = '';
  cart2: string = '';
  fillitems: any[] = [];
  emptyitems: any[] = [];
  price: number | null = null;

  constructor(
    private modalCtrl: ModalController,
    private transferService: TransferService,
    private supplierService: SupplierService,
    private alertController: AlertController,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {
    this.loadSuppliers();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async loadSuppliers() {
    this.suppliers = await this.supplierService.getAllSuppliers();
    this.driver = await this.supplierService.getAllDriver();
  }

  removeItem(item: any) {
    this.fillitems = this.fillitems.filter((i) => i !== item);
  }
  removeEmptyItem(item: any) {
    this.emptyitems = this.emptyitems.filter((i) => i !== item);
  }

  async onQtyChange(item: any, event: any) {
    const fieldstring =
      this.transtype === 'RESTOCK OUT' || this.transtype === 'W.RESTOCK OUT'
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
      this.transtype === 'RESTOCK OUT' || this.transtype === 'W.RESTOCK OUT'
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
      this.transtype === 'RESTOCK OUT' || this.transtype === 'W.RESTOCK OUT'
        ? 'fillqty'
        : '';

    const isWarehouse =
      this.transtype === 'W.RESTOCK OUT' || this.transtype === 'W.RESTOCK IN'
        ? 1
        : 0;

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
  }

  async openAddEmptyItemModal() {
    const fieldstring =
      this.transtype === 'RESTOCK OUT' || this.transtype === 'W.RESTOCK OUT'
        ? 'emptyqty'
        : '';
    const isWarehouse =
      this.transtype === 'W.RESTOCK OUT' || this.transtype === 'W.RESTOCK IN'
        ? 1
        : 0;
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
    const fieldstring =
      this.transtype === 'RESTOCK OUT' || this.transtype === 'W.RESTOCK OUT'
        ? 'emptyqty'
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

  async incrementQtyEmpty(item: any) {
    const fieldstring =
      this.transtype === 'RESTOCK OUT' || this.transtype === 'W.RESTOCK OUT'
        ? 'emptyqty'
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

  get hasRows(): boolean {
    return this.fillitems.length > 0 || this.emptyitems.length > 0;
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
              await this.transferService.saveRestock(
                this.poutrefnum,
                this.poutencoder,
                this.selectedSupplier ?? '',
                this.pulldate,
                this.transtype,
                this.price ?? 0,
                this.selectedDriver ?? 0,
                this.fillitems,
                this.emptyitems
              );

              await this.appdateService.showToastjs(
                'Transfer saved successfully!',
                'success'
              );
              this.modalCtrl.dismiss(true, 'CONFIRM');
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

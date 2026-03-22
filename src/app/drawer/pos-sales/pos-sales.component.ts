import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  ModalController,
} from '@ionic/angular/standalone';
import { SelectListComponent } from './modals/select-list/select-list.component';
import { Router } from '@angular/router';
import { ItemListComponent } from './modals/item-list/item-list.component';
import { PurchaseSummaryComponent } from './modals/purchase-summary/purchase-summary.component';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-pos-sales',
  templateUrl: './pos-sales.component.html',
  styleUrls: ['./pos-sales.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonIcon,
    IonLabel,
    IonItem,
    IonList,
    IonButton,
    IonCardContent,
    IonTitle,
    IonCardHeader,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonText,
    IonNote,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonInput,
    IonBadge,
  ],
})
export class PosSalesComponent implements OnInit {
  categories = [
    { label: '1-PICK UP', value: '1-PICK UP' },
    { label: '2-DELIVERY', value: '2-DELIVERY' },
  ];

  // Selected POS inputs
  posData: any = {
    category: '1-PICK UP',
    customerId: null,
    customerName: '',
    customeraddress: '',

    personnel1Id: null,
    personnel1Name: '',

    personnel2Id: null,
    personnel2Name: '',
    discount: 0,
  };

  // Cart items
  cart: any[] = [];
  user: any = null;

  constructor(
    private modalCtrl: ModalController,
    private router: Router,
    private alertController: AlertController,
    private storageService: StorageService
  ) {
    this.storageService.get<any>('login-data').then((user) => {
      if (user) {
        console.log('User loaded:', user);
        this.user = user;
      } else {
        console.log('No user found in storage.');
      }
    });
  }

  async goHome() {
    const alert = await this.alertController.create({
      header: 'Exit POS',
      message: 'Are you sure you want to exit POS?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Yes',
          handler: () => {
            this.router.navigate(['/menu/dashboard']); // navigate to your home page
          },
        },
      ],
    });

    await alert.present();
  }

  ngOnInit() {}

  async openSelectModal(type: 'customer' | 'personnel1' | 'personnel2') {
    // Filter personnel if selecting personnel1 or personnel2
    let selectedType: 'customer' | 'personnel' = 'customer';
    let excludedIds: number[] = [];

    if (type !== 'customer') {
      selectedType = 'personnel';
      // Collect IDs of already selected personnel
      if (type === 'personnel1' && this.posData.personnel2Id) {
        excludedIds = [this.posData.personnel2Id];
      } else if (type === 'personnel2' && this.posData.personnel1Id) {
        excludedIds = [this.posData.personnel1Id];
      }
    }

    const modal = await this.modalCtrl.create({
      component: SelectListComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        title:
          type === 'customer'
            ? 'Select Customer'
            : type === 'personnel1'
            ? 'Select Personnel 1'
            : 'Select Personnel 2',

        type: selectedType,
        excludedIds, // pass excluded IDs to modal
      },
    });

    modal.onDidDismiss().then((res) => {
      if (!res.data) return;
      const data = res.data;

      if (type === 'customer') {
        this.posData.customerId = data.custid;
        this.posData.customerName = data.custname;
        this.posData.customeraddress = data.custadd;
      }

      if (type === 'personnel1') {
        this.posData.personnel1Id = data.pid;
        this.posData.personnel1Name = data.pname;
      }

      if (type === 'personnel2') {
        this.posData.personnel2Id = data.pid;
        this.posData.personnel2Name = data.pname;
      }
    });

    return modal.present();
  }

  // --- Add Item Modal ---
  async openAddItemModal() {
    const modal = await this.modalCtrl.create({
      component: ItemListComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
    });

    modal.onDidDismiss().then((res) => {
      if (!res.data) return;

      const item = res.data;

      // Set default price based on NON-REFILL
      const defaultPrice = item.Refill;

      const cartItem = {
        ...item,
        qty: 1,
        unit: 'REFILL',
        price: defaultPrice,
        amount: defaultPrice * 1,
      };

      this.addCartItem(cartItem);
    });

    return await modal.present();
  }

  // Add item to cart
  addCartItem(item: any) {
    item.amount = this.calculateAmount(item.qty, item.price);
    this.cart.push(item);
  }

  // Calculate item amount
  calculateAmount(qty: number, price: number) {
    return qty * price;
  }

  // Update qty or price (if editable)
  updateCartItem(index: number) {
    const item = this.cart[index];
    item.amount = this.calculateAmount(item.qty, item.price);
  }

  // Return current price depending on unit
  getItemPrice(item: any): number {
    return item.unit === 'REFILL' ? item.Refill : item.Non_Refill;
  }

  getTotalQty(): number {
    return this.cart.reduce((sum, item) => sum + item.qty, 0);
  }

  onUnitChange(item: any) {
    item.price = this.getItemPrice(item);
    item.amount = item.price * item.qty;
  }

  // Qty handlers
  async incrementQty(item: any) {
    if ((item.qty || 0) + 1 > item.fillqty) {
      const alert = await this.alertController.create({
        header: 'Out of Stock',
        message: `Cannot exceed available stock. Only ${item.fillqty} available.`,
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    item.qty = (item.qty || 0) + 1;
    this.updateCartTotals();
  }

  decrementQty(item: any) {
    if (item.qty > 1) {
      item.qty -= 1;
      this.updateCartTotals();
    }
  }

  async onQtyChange(item: any, event: any) {
    let val = parseInt(event.detail.value, 10);
    let input = event.target;
    if (isNaN(val) || val < 1) val = 1;

    if (val > item.fillqty) {
      const alert = await this.alertController.create({
        header: 'Out of Stock',
        message: `Cannot exceed available stock. Only ${item.fillqty} available.`,
        buttons: ['OK'],
      });
      await alert.present();
      val = item.fillqty;
    }

    item.qty = val;
    input.value = val;
    this.updateCartTotals();
  }

  removeItem(item: any) {
    this.cart = this.cart.filter((i) => i !== item);
    this.updateCartTotals();
  }

  updateCartTotals() {
    // recalc totals if needed
  }

  getTotal(): number {
    // Total including VAT
    const totalAmount = this.cart.reduce(
      (sum, item) => sum + this.getItemPrice(item) * item.qty,
      0
    );
    const discount = parseFloat(this.posData.discount || 0);
    return totalAmount - discount; // total with VAT
  }

  getVat(): number {
    // VAT portion from total
    const total = this.getTotal();
    return (total * 0.12) / 1.12; // VAT part of total
  }

  getSubTotal(): number {
    // Amount excluding VAT
    return this.getTotal() - this.getVat();
  }

  get isCheckoutDisabled(): boolean {
    return (
      this.cart.length === 0 || // no items
      !this.posData.customerId || // no customer selected
      (!this.posData.personnel1Id && !this.posData.personnel2Id) // no personnel selected
    );
  }

  async openCheckoutModal() {
    const modal = await this.modalCtrl.create({
      component: PurchaseSummaryComponent,
      componentProps: {
        posData: this.posData,
        totalsub: this.getSubTotal(),
        totalvat: this.getVat(),
        totalAmount: this.getTotal(),
        totalitems: this.getTotalQty(),
        cart: this.cart,
        cashierName: this.user.empname,
        resetPOSCallback: () => this.endTransaction(),
      },
    });
    return await modal.present();
  }

  get isResetDisabled(): boolean {
    return (
      this.cart.length === 0 &&
      !this.posData.customerId &&
      !this.posData.personnel1Id &&
      !this.posData.personnel2Id
    );
  }

  async endTransaction() {
    this.posData = {
      category: '1-PICK UP',
      customerId: null,
      customerName: '',
      customeraddress: '',
      personnel1Id: null,
      personnel1Name: '',
      personnel2Id: null,
      personnel2Name: '',
      discount: 0,
    };

    // Clear cart
    this.cart = [];

    // Optionally reset any other state, e.g., totals
    this.updateCartTotals();
  }

  async resetPOS() {
    const alert = await this.alertController.create({
      header: 'Clear',
      message: 'Are you sure you want to clear this transaction?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes',
          handler: () => {
            // Reset POS data
            this.posData = {
              category: '1-PICK UP',
              customerId: null,
              customerName: '',
              customeraddress: '',
              personnel1Id: null,
              personnel1Name: '',
              personnel2Id: null,
              personnel2Name: '',
              discount: 0,
            };

            // Clear cart
            this.cart = [];

            // Optionally reset any other state, e.g., totals
            this.updateCartTotals();
          },
        },
      ],
    });

    await alert.present();
  }
}

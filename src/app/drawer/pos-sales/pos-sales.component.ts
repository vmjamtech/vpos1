import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
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
  ToastController,
} from '@ionic/angular/standalone';
import { SelectListComponent } from './modals/select-list/select-list.component';
import { Router } from '@angular/router';
import { ItemListComponent } from './modals/item-list/item-list.component';
import { PurchaseSummaryComponent } from './modals/purchase-summary/purchase-summary.component';
import { QueueOrdersModalComponent } from './modals/queue-orders/queue-orders.modal';
import { SelectOrderModalComponent } from './modals/select-order/select-order.modal';
import { ShortcutPreset } from './shortcut-preset.model';
import { InventoryService } from 'src/app/services/inventory.service';
import { StorageService } from 'src/app/services/storage.service';
import { ShortcutPresetService } from 'src/app/services/shortcut-preset.service';
import { normalizeSalesCategory } from 'src/app/utils/sales-category';

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
    { label: 'PICK UP', value: 'PICK UP' },
    { label: 'DELIVERY', value: 'DELIVERY' },
  ];

  // Selected POS inputs
  posData: any = {
    category: 'PICK UP',
    customerId: null,
    customerName: '',
    customeraddress: '',

    personnel1Id: null,
    personnel1Name: '',

    personnel2Id: null,
    personnel2Name: '',
    discount: 0,
  };
  discountType: 'none' | 'regular' | 'special' = 'none';
  discountMode: 'fixed' | 'percent' = 'fixed';
  discountInputVal = 0;
  discountAmount = 0;

  // Cart items
  cart: any[] = [];
  queuedOrders: any[] = [];
  user: any = null;

  constructor(
    private modalCtrl: ModalController,
    private router: Router,
    private alertController: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private storageService: StorageService,
    private toastController: ToastController,
    private shortcutPresetService?: ShortcutPresetService,
    private inventoryService?: InventoryService
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

  ngOnInit() {
    this.loadQueuedOrders();
  }

  get canAddToQueue(): boolean {
    return !!this.posData.customerId && this.cart.length > 0;
  }

  get hasActiveTransaction(): boolean {
    return (
      this.cart.length > 0 ||
      !!this.posData.customerId ||
      !!this.posData.personnel1Id ||
      !!this.posData.personnel2Id ||
      this.discountType !== 'none'
    );
  }

  loadQueuedOrders() {
    try {
      const saved = localStorage.getItem('vpos_queued_orders');
      const parsed = saved ? JSON.parse(saved) : [];
      this.queuedOrders = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load queued orders:', error);
      this.queuedOrders = [];
    }
  }

  private saveQueuedOrders(orders = this.queuedOrders): boolean {
    try {
      localStorage.setItem('vpos_queued_orders', JSON.stringify(orders));
      return true;
    } catch (error) {
      console.error('Failed to save queued orders:', error);
      return false;
    }
  }

  private async showQueueToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  async addToQueue() {
    if (!this.canAddToQueue) return;

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateKey = `${year}${month}${day}`;
    const sequenceKey = `vpos_queue_sequence_${dateKey}`;
    let sequence: number;
    try {
      sequence = (Number(localStorage.getItem(sequenceKey)) || 0) + 1;
    } catch (error) {
      console.error('Failed to read queue number:', error);
      await this.showQueueToast('Unable to save order to queue.', 'danger');
      return;
    }
    const queueNo = `QN${String(sequence).padStart(6, '0')}-${month}${day}${year.slice(-2)}`;
    const queueEntry = {
      queueNo,
      timestamp: now.toISOString(),
      customer: {
        id: this.posData.customerId,
        name: this.posData.customerName,
        address: this.posData.customeraddress,
      },
      category: this.posData.category,
      personnel1: {
        id: this.posData.personnel1Id,
        name: this.posData.personnel1Name,
      },
      personnel2: {
        id: this.posData.personnel2Id,
        name: this.posData.personnel2Name,
      },
      cart: this.cart.map((item) => ({ ...item })),
      totalItems: this.getTotalQty(),
      discountType: this.discountType,
      discountMode: this.discountMode,
      discountInputVal: this.discountInputVal,
      discountAmount: this.discountAmount,
      subTotal: this.getSubTotal(),
      totalAmount: this.getTotal(),
    };
    const updatedOrders = [...this.queuedOrders, queueEntry];

    try {
      localStorage.setItem(sequenceKey, String(sequence));
    } catch (error) {
      console.error('Failed to save queue number:', error);
      await this.showQueueToast('Unable to save order to queue.', 'danger');
      return;
    }

    if (!this.saveQueuedOrders(updatedOrders)) {
      await this.showQueueToast('Unable to save order to queue.', 'danger');
      return;
    }

    this.queuedOrders = updatedOrders;
    await this.endTransaction();
    await this.showQueueToast(`Order added to Queue (${queueNo})`, 'success');
  }

  async openQueueOrdersModal() {
    const modal = await this.modalCtrl.create({
      component: QueueOrdersModalComponent,
      componentProps: {
        queuedOrders: this.queuedOrders,
        hasActiveTransaction: this.hasActiveTransaction,
      },
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (Array.isArray(data?.queuedOrders)) {
      if (this.saveQueuedOrders(data.queuedOrders)) {
        this.queuedOrders = data.queuedOrders;
      }
    }

    if (data?.restoredOrder) {
      this.restoreOrderToPOS(data.restoredOrder);
      setTimeout(() => void this.openSelectModal('personnel1'), 300);
    }
  }

  private restoreOrderToPOS(order: any) {
    this.posData = {
      ...this.posData,
      category: normalizeSalesCategory(order.category),
      customerId: order.customer?.id ?? null,
      customerName: order.customer?.name ?? '',
      customeraddress: order.customer?.address ?? '',
      personnel1Id: order.personnel1?.id ?? null,
      personnel1Name: order.personnel1?.name ?? '',
      personnel2Id: order.personnel2?.id ?? null,
      personnel2Name: order.personnel2?.name ?? '',
    };
    this.cart = (order.cart ?? []).map((item: any) => ({ ...item }));
    this.discountType = order.discountType ?? 'none';
    this.discountMode = order.discountMode ?? 'fixed';
    this.discountInputVal = Number(order.discountInputVal) || 0;
    this.calculateTotals();

    const remainingOrders = this.queuedOrders.filter(
      (queuedOrder) => queuedOrder.queueNo !== order.queueNo
    );
    if (this.saveQueuedOrders(remainingOrders)) {
      this.queuedOrders = remainingOrders;
    }
  }

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
    item.cost = this.getItemCost(item);
    item.amount = this.calculateAmount(item.qty, item.price);
    this.cart.push(item);
    this.updateCartTotals();
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

  getItemCost(item: any): number {
    const cost =
      item.unit === 'REFILL'
        ? item.cost_refill ?? item.itemcost ?? 0
        : item.cost_non_refill ?? item.itemcost ?? 0;
    return Number(cost) || 0;
  }

  getTotalQty(): number {
    return this.cart.reduce((sum, item) => sum + item.qty, 0);
  }

  onUnitChange(item: any) {
    item.price = this.getItemPrice(item);
    item.cost = this.getItemCost(item);
    item.amount = item.price * item.qty;
    this.updateCartTotals();
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
    this.calculateTotals();
  }

  private getSubTotalBeforeDiscount(): number {
    const total = this.cart.reduce(
      (sum, item) => sum + this.getItemPrice(item) * item.qty,
      0
    );
    return total - (total * 0.12) / 1.12;
  }

  calculateTotals() {
    const subTotal = Number(this.getSubTotalBeforeDiscount().toFixed(2));
    if (subTotal <= 0) {
      this.discountType = 'none';
      this.discountMode = 'fixed';
      this.discountInputVal = 0;
    }

    if (this.discountType === 'none') {
      this.discountAmount = 0;
    } else if (this.discountMode === 'percent') {
      const input = Number(this.discountInputVal);
      const calculated = Number(((subTotal * input) / 100).toFixed(2));
      this.discountAmount = Math.min(calculated, subTotal);
    } else {
      const input = Number(this.discountInputVal);
      this.discountAmount = Math.min(Number(input.toFixed(2)), subTotal);
    }

    this.posData.discount = this.discountAmount;
    this.posData.discountType = this.discountType;
    this.posData.discountMode = this.discountMode;
    this.posData.discountInputVal = this.discountInputVal;
    this.posData.regularDiscount =
      this.discountType === 'regular' ? this.discountAmount : 0;
    this.posData.specialDiscount =
      this.discountType === 'special' ? this.discountAmount : 0;
  }

  getDiscountLabel(): string {
    const label =
      this.discountType === 'special' ? 'Special Discount' : 'Discount';
    return this.discountType !== 'none' && this.discountMode === 'percent'
      ? `${label} (${this.discountInputVal}%):`
      : `${label}:`;
  }

  async promptDiscountType() {
    if (this.getSubTotalBeforeDiscount() <= 0) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select Discount Type',
      buttons: [
        {
          text: 'Discount (Regular)',
          handler: () => this.promptDiscountMode('regular'),
        },
        {
          text: 'Special Discount',
          handler: () => this.promptDiscountMode('special'),
        },
        ...(this.discountType !== 'none'
          ? [
              {
                text: 'Remove Discount',
                role: 'destructive',
                handler: () => {
                  this.discountType = 'none';
                  this.discountInputVal = 0;
                  this.discountMode = 'fixed';
                  this.calculateTotals();
                },
              },
            ]
          : []),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await actionSheet.present();
  }

  async promptDiscountMode(type: 'regular' | 'special') {
    const title = type === 'special' ? 'Special Discount' : 'Regular Discount';
    const alert = await this.alertController.create({
      header: title,
      subHeader: 'Choose calculation mode:',
      buttons: [
        {
          text: 'Fixed Amount (₱)',
          handler: () => this.promptDiscountValue(type, 'fixed'),
        },
        {
          text: 'Percentage (%)',
          handler: () => this.promptDiscountValue(type, 'percent'),
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await alert.present();
  }

  async promptDiscountValue(type: 'regular' | 'special', mode: 'fixed' | 'percent') {
    const title = type === 'special' ? 'Special Discount' : 'Regular Discount';
    const isPercent = mode === 'percent';
    const alert = await this.alertController.create({
      header: `${title} (${isPercent ? '%' : '₱'})`,
      inputs: [
        {
          name: 'value',
          type: 'number',
          placeholder: isPercent ? 'Enter percentage' : 'Enter amount',
          min: 0,
          value:
            this.discountType === type &&
            this.discountMode === mode &&
            this.discountInputVal > 0
              ? this.discountInputVal
              : '',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Apply',
          handler: (data) => {
            const value = Number(data?.value);
            if (
              !Number.isFinite(value) ||
              value <= 0 ||
              (isPercent && value > 100)
            ) {
              void this.showInvalidDiscountAlert();
              return false;
            }

            this.discountType = type;
            this.discountMode = mode;
            this.discountInputVal = value;
            this.calculateTotals();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async showInvalidDiscountAlert() {
    const alert = await this.alertController.create({
      header: 'Invalid Discount',
      message: 'Enter a positive amount or a percentage from 1 to 100.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  getTotal(): number {
    // Total including VAT
    const totalAmount = this.cart.reduce(
      (sum, item) => sum + this.getItemPrice(item) * item.qty,
      0
    );
    const discount = Number(this.posData.discount) || 0;
    return Number((totalAmount - discount).toFixed(2)); // total with VAT
  }

  getVat(): number {
    // VAT portion from total
    const total = this.getTotal();
    return Number(((total * 0.12) / 1.12).toFixed(2)); // VAT part of total
  }

  getSubTotal(): number {
    // Amount excluding VAT
    return Number((this.getTotal() - this.getVat()).toFixed(2));
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

  async openShortcutOrders() {
    try {
      const presets: ShortcutPreset[] =
        await this.shortcutPresetService?.getAll() ?? [];
      await this.presentShortcutOrders(presets);
    } catch (error) {
      console.error('Failed to load shortcut presets:', error);
      const toast = await this.toastController.create({
        message: 'Unable to load shortcut presets.',
        duration: 3000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

  private async presentShortcutOrders(presets: ShortcutPreset[]): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SelectOrderModalComponent,
      cssClass: 'select-order-modal',
      componentProps: { presets },
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.selectedPreset) {
      await this.promptShortcutCategoryPersonnel(data.selectedPreset);
    }
  }

  private async promptShortcutCategoryPersonnel(preset: ShortcutPreset) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Please Select',
      buttons: [
        {
          text: 'PICK UP',
          handler: () => {
            void this.selectShortcutPersonnel(preset, 'PICK UP');
          },
        },
        {
          text: 'DELIVERY',
          handler: () => {
            void this.selectShortcutPersonnel(preset, 'DELIVERY');
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await actionSheet.present();
  }

  private async selectShortcutPersonnel(
    preset: ShortcutPreset,
    category: string
  ) {
    const modal = await this.modalCtrl.create({
      component: SelectListComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        title: 'Select Personnel 1',
        type: 'personnel',
        excludedIds: [],
      },
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) {
      await this.executeShortcutPresetOrder(preset, category, data);
    }
  }

  async executeShortcutPresetOrder(
    preset: ShortcutPreset,
    category: string,
    personnel: any
  ) {
    const hydratedCart: any[] = [];

    for (const presetItem of preset.items) {
      let inventoryItem: any | null = null;

      try {
        inventoryItem = await this.inventoryService?.getItemForCartHydration(
          presetItem.itemid
        );
      } catch (error) {
        console.error('Failed to hydrate shortcut preset item:', error);
      }

      if (!inventoryItem) {
        hydratedCart.length = 0;
        const toast = await this.toastController.create({
          message: `Cannot process preset: Item ${presetItem.itemcode} is no longer active in inventory.`,
          duration: 3500,
          position: 'bottom',
          color: 'warning',
        });
        await toast.present();
        return;
      }

      const requiredQty = Number(presetItem.qty || 1);
      const availableFillQty = Number(inventoryItem.fillqty) || 0;
      const availableItemQty = Number(inventoryItem.itemqty) || 0;
      const isOutOfStock =
        !Number.isFinite(requiredQty) ||
        requiredQty <= 0 ||
        availableFillQty <= 0 ||
        availableFillQty < requiredQty ||
        (presetItem.unit === 'NON-REFILL' &&
          (availableItemQty <= 0 || availableItemQty < requiredQty));

      if (isOutOfStock) {
        hydratedCart.length = 0;
        const toast = await this.toastController.create({
          message: `Out of Stock: ${inventoryItem.itemname || inventoryItem.itemcode} has insufficient stock (Available: ${inventoryItem.fillqty || 0}, Required: ${presetItem.qty}).`,
          duration: 3500,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
        return;
      }

      const isRefill = presetItem.unit === 'REFILL';
      const activePrice = Number(
        isRefill ? inventoryItem.Refill : inventoryItem.Non_Refill
      );
      const activeCost = Number(
        isRefill ? inventoryItem.cost_refill : inventoryItem.cost_non_refill
      );
      const qty = requiredQty;
      const lineTotal = Number((activePrice * qty).toFixed(2));

      hydratedCart.push({
        ...inventoryItem,
        itemid: inventoryItem.itemid,
        itemcode: inventoryItem.itemcode,
        itemname: inventoryItem.itemname,
        Refill: Number(inventoryItem.Refill),
        Non_Refill: Number(inventoryItem.Non_Refill),
        cost_refill: Number(inventoryItem.cost_refill),
        cost_non_refill: Number(inventoryItem.cost_non_refill),
        unit: presetItem.unit,
        qty,
        price: activePrice,
        cost: activeCost,
        amount: lineTotal,
        total: lineTotal,
      });
    }

    if (hydratedCart.length === 0) return;

    this.posData.customerId =
      preset.customer?.custid || preset.customer?.id || null;
    this.posData.customerName =
      preset.customer?.custname || preset.customer?.name || '';
    this.posData.customeraddress =
      preset.customer?.custadd || preset.customer?.address || '';
    this.posData.category = category;
    this.posData.personnel1Id = personnel?.pid || personnel?.id || null;
    this.posData.personnel1Name = personnel?.pname || personnel?.name || '';
    this.posData.personnel2Id = null;
    this.posData.personnel2Name = '';
    const presetDiscountType = preset.discountType ?? 'none';
    const requestedDiscount = Number(preset.discountValue);
    const presetDiscountValue =
      presetDiscountType !== 'none' &&
      Number.isFinite(requestedDiscount) &&
      requestedDiscount > 0
        ? presetDiscountType === 'percentage'
          ? Math.min(requestedDiscount, 100)
          : requestedDiscount
        : 0;
    this.discountType = presetDiscountValue > 0 ? 'regular' : 'none';
    this.discountMode =
      presetDiscountType === 'percentage' ? 'percent' : 'fixed';
    this.discountInputVal = presetDiscountValue;
    this.cart = hydratedCart;
    this.calculateTotals();
    this.posData.presetDiscountType = presetDiscountType;
    this.posData.discountValue = presetDiscountValue;
    await this.openCheckoutModal();
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
    this.resetDiscount();
    this.posData = {
      category: 'PICK UP',
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
            this.resetDiscount();
            this.posData = {
              category: 'PICK UP',
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

  private resetDiscount() {
    this.discountType = 'none';
    this.discountMode = 'fixed';
    this.discountInputVal = 0;
    this.discountAmount = 0;
  }
}

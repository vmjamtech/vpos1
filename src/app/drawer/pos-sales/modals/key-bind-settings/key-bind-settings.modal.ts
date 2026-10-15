import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
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
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { ItemListComponent } from '../item-list/item-list.component';
import { SelectListComponent } from '../select-list/select-list.component';
import { ShortcutItem, ShortcutPreset } from '../../shortcut-preset.model';

@Component({
  selector: 'app-key-bind-settings-modal',
  templateUrl: './key-bind-settings.modal.html',
  styleUrls: ['./key-bind-settings.modal.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    IonTitle,
    IonToolbar,
  ],
})
export class KeyBindSettingsModalComponent implements OnInit {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() preset?: ShortcutPreset;

  codeName = '';
  customer: any = null;
  items: ShortcutItem[] = [];

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    if (!this.preset) return;
    this.codeName = this.preset.codeName;
    this.customer = { ...this.preset.customer };
    this.items = this.preset.items.map((item) => ({ ...item }));
  }

  get total(): number {
    return this.items.reduce((sum, item) => sum + this.getLineTotal(item), 0);
  }

  async selectCustomer() {
    const modal = await this.modalCtrl.create({
      component: SelectListComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        title: 'Select Customer',
        type: 'customer',
        excludedIds: [],
      },
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) this.customer = data;
  }

  async addItems() {
    const modal = await this.modalCtrl.create({
      component: ItemListComponent,
      initialBreakpoint: 0.9,
      breakpoints: [0.9],
      backdropDismiss: false,
      expandToScroll: false,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (!data) return;

    const item: ShortcutItem = {
      itemid: data.itemid,
      itemcode: data.itemcode,
      description: data.itemname,
      qty: 1,
      price: Number(data.Refill) || 0,
      cost: Number(data.cost_refill ?? data.itemcost) || 0,
      amount: Number(data.Refill) || 0,
      Refill: Number(data.Refill) || 0,
      Non_Refill: Number(data.Non_Refill) || 0,
      cost_refill: Number(data.cost_refill ?? data.itemcost) || 0,
      cost_non_refill: Number(data.cost_non_refill ?? data.itemcost) || 0,
      unit: 'REFILL',
    };
    this.items = [...this.items, item];
  }

  onUnitChange(item: ShortcutItem) {
    item.price = Number(
      item.unit === 'REFILL' ? item.Refill : item.Non_Refill
    ) || 0;
    item.cost = Number(
      item.unit === 'REFILL' ? item.cost_refill : item.cost_non_refill
    ) || 0;
    item.amount = this.getLineTotal(item);
  }

  updateAmount(item: ShortcutItem) {
    item.qty = Math.max(1, Number(item.qty) || 1);
    item.amount = this.getLineTotal(item);
  }

  getLineTotal(item: ShortcutItem): number {
    return Number((Number(item.price) * Number(item.qty)).toFixed(2));
  }

  removeItem(item: ShortcutItem) {
    this.items = this.items.filter((current) => current !== item);
  }

  dismiss() {
    return this.modalCtrl.dismiss();
  }

  async confirm() {
    const normalizedCodeName = this.codeName.trim();
    if (!normalizedCodeName || !this.customer || this.items.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'Enter a code name, select a customer, and add at least one item.',
        duration: 3000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const savedPreset: ShortcutPreset = {
      id: this.preset?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      codeName: normalizedCodeName,
      customer: this.customer,
      items: this.items.map((item) => ({
        ...item,
        amount: this.getLineTotal(item),
      })),
    };

    try {
      const stored = localStorage.getItem('vpos_shortcut_presets');
      const parsed = stored ? JSON.parse(stored) : [];
      const presets: ShortcutPreset[] = Array.isArray(parsed) ? parsed : [];
      const existingIndex = presets.findIndex(
        (item) => item.id === savedPreset.id
      );

      if (existingIndex >= 0) {
        presets[existingIndex] = savedPreset;
      } else {
        if (presets.length >= 6) {
          const toast = await this.toastCtrl.create({
            message: 'All 6 shortcut slots are in use.',
            duration: 2500,
            position: 'bottom',
            color: 'warning',
          });
          await toast.present();
          return;
        }
        presets.push(savedPreset);
      }

      localStorage.setItem('vpos_shortcut_presets', JSON.stringify(presets));
      await this.modalCtrl.dismiss({ savedPreset });
    } catch (error) {
      console.error('Failed to save shortcut preset:', error);
      const toast = await this.toastCtrl.create({
        message: 'Unable to save this shortcut preset.',
        duration: 3000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }
}
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CategoryService } from 'src/app/services/category.service';
import { InventoryService } from 'src/app/services/inventory.service';

@Component({
  selector: 'app-inventoryform',
  templateUrl: './inventoryform.component.html',
  styleUrls: ['./inventoryform.component.scss'],
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
    IonItemDivider,
    IonList,
    IonSelectOption,
    IonSelect,
    IonText,
  ],
})
export class InventoryformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() itemData?: any;

  itemcode: string = '';
  itemcodeExists: boolean = false;
  description = '';
  itemid?: number;

  sizes = [
    '',
    '250grams',
    '2.7kg',
    '3kg',
    '5kg',
    '7kg',
    '11kg',
    '15kg',
    '22kg',
    '50kg',
  ];
  selectedSize: string | null = null;

  categories: any[] = [];
  selectedCategory: string | null = null;

  fillqty = 0;
  emptyqty = 0;

  origfillqty = 0;
  origemptyqty = 0;
  origtotalqty = 0;
  totalqty = 0;

  refillPrice = 0;
  nonRefillPrice = 0;

  deliveryCommission = 0;
  pickupCommission = 0;

  itemCost = 0;
  criticalLevel = 0;

  constructor(
    private modalCtrl: ModalController,
    private categoryService: CategoryService,
    private inventoryService: InventoryService,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {
    this.loadCategories();

    if (this.mode === 'edit' && this.itemData) {
      console.log('ITEMDATA', this.itemData);
      this.itemid = this.itemData.itemid;
      this.itemcode = this.itemData.itemcode;
      this.description = this.itemData.itemname;
      this.selectedSize = this.itemData.itemsize.trim() || null;
      this.selectedCategory = this.itemData.itemcategory || null;
      this.fillqty = this.itemData.fillqty || 0;
      this.emptyqty = this.itemData.emptyqty || 0;
      this.origfillqty = this.itemData.fillqty || 0;
      this.origemptyqty = this.itemData.emptyqty || 0;
      this.origtotalqty = this.itemData.totalqty || 0;
      this.totalqty = this.itemData.itemqty || 0;
      this.refillPrice = this.itemData.Refill || 0;
      this.nonRefillPrice = this.itemData.Non_Refill || 0;
      this.deliveryCommission = this.itemData.comdel || 0;
      this.pickupCommission = this.itemData.compickup || 0;
      this.itemCost = this.itemData.itemcost || 0;
      this.criticalLevel = this.itemData.alertnum || 0;
    }
  }

  async validateItemCode() {
    if (!this.itemcode) {
      this.itemcodeExists = false;
      return;
    }

    this.itemcodeExists = await this.inventoryService.checkItemcodeExists(
      this.itemcode
    );
  }

  loadCategories() {
    this.categoryService.getAllCategories().then((res) => {
      console.log(res);
      this.categories = res;
    });
  }

  computeTotal() {
    this.totalqty = Number(this.fillqty) + Number(this.emptyqty);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    const itemData = {
      itemcode: this.itemcode,
      itemname: this.description,
      itemsize: this.selectedSize ?? '',
      itemcategory: this.selectedCategory ?? '',
      fillqty: this.fillqty,
      emptyqty: this.emptyqty,
      itemqty: this.totalqty,
      Refill: this.refillPrice,
      Non_Refill: this.nonRefillPrice,
      comdel: this.deliveryCommission,
      compickup: this.pickupCommission,
      itemcost: this.itemCost,
      alertnum: this.criticalLevel,
      lendqty: 0,
    };

    let success = false;

    if (this.mode === 'add') {
      success = await this.inventoryService.insertItem({
        ...itemData,
      });

      if (success) {
        await this.appdateService.showToastjs(
          'Item added successfully!',
          'success'
        );
        this.modalCtrl.dismiss(itemData);
      } else {
        await this.appdateService.showToastjs('Failed to add item.', 'danger');
      }
    } else if (this.mode === 'edit' && this.itemid) {
      success = await this.inventoryService.updateItem({
        itemid: this.itemid,
        itemcode: this.itemcode,
        itemname: this.description,
        itemsize: this.selectedSize ?? '',
        itemcategory: this.selectedCategory ?? '',
        fillqty: this.fillqty,
        emptyqty: this.emptyqty,
        itemqty: this.totalqty,
        Refill: this.refillPrice,
        Non_Refill: this.nonRefillPrice,
        comdel: this.deliveryCommission,
        compickup: this.pickupCommission,
        itemcost: this.itemCost,
        alertnum: this.criticalLevel,
        origfillqty: this.origfillqty,
        origemptyqty: this.origemptyqty,
        origtotalqty: this.origtotalqty,
      });
      console.log(success);
      if (success) {
        await this.appdateService.showToastjs(
          'Item updated successfully!',
          'success'
        );
        this.modalCtrl.dismiss(itemData);
      } else {
        await this.appdateService.showToastjs(
          'Failed to update item.',
          'danger'
        );
      }
    }
  }
}

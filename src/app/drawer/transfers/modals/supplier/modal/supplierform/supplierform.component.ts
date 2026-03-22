import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { SupplierService } from 'src/app/services/supplier.service';

@Component({
  selector: 'app-supplierform',
  templateUrl: './supplierform.component.html',
  styleUrls: ['./supplierform.component.scss'],
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
    IonText,
  ],
})
export class SupplierformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  suppid?: number;
  suppname: string = '';
  nameExists: boolean = false;
  supptitle = '';
  suppaddress = '';
  suppcont = '';
  suppemail = '';

  constructor(
    private modalCtrl: ModalController,
    private supplierService: SupplierService,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {
    if (this.mode === 'edit' && this.Data) {
      this.suppid = this.Data.suppid;
      this.suppname = this.Data.suppname;
      this.supptitle = this.Data.supptitle;
      this.suppaddress = this.Data.suppaddress;
      this.suppcont = this.Data.suppcont;
      this.suppemail = this.Data.suppemail;
    }
  }

  async validateName() {
    if (!this.suppname) {
      this.nameExists = false;
      return;
    }

    this.nameExists = await this.supplierService.checknameExists(this.suppname);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    const data = {
      suppname: this.suppname,
      suppaddress: this.suppaddress ?? '',
      supptitle: this.supptitle ?? '',
      suppcont: this.suppcont ?? '',
      suppemail: this.suppemail ?? '',
    };

    let success = false;

    if (this.mode === 'add') {
      success = await this.supplierService.insertSupplier({
        ...data,
      });
      if (success) {
        await this.appdateService.showToastjs(
          'Supplier added successfully!',
          'success'
        );
        this.modalCtrl.dismiss(data);
      } else {
        await this.appdateService.showToastjs(
          'Failed to add Supplier.',
          'danger'
        );
      }
    } else if (this.mode === 'edit' && this.suppid) {
      success = await this.supplierService.updateSupplier({
        id: this.suppid,
        ...data,
      });
      console.log(success);
      if (success) {
        await this.appdateService.showToastjs(
          'Supplier updated successfully!',
          'success'
        );
        const updata = {
          suppid: this.suppid,
          ...data,
        };
        console.log(updata);
        this.modalCtrl.dismiss(updata);
      } else {
        await this.appdateService.showToastjs(
          'Failed to update Supplier.',
          'danger'
        );
      }
    }
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CustomersService } from 'src/app/services/customers.service';

@Component({
  selector: 'app-customerform',
  templateUrl: './customerform.component.html',
  styleUrls: ['./customerform.component.scss'],
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
export class CustomerformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  custid?: number;
  custname: string = '';
  custnameExists: boolean = false;
  custadd = '';
  custcontnum = '';
  custemail = '';

  constructor(
    private modalCtrl: ModalController,
    private customerService: CustomersService,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {
    if (this.mode === 'edit' && this.Data) {
      this.custid = this.Data.custid;
      this.custname = this.Data.custname;
      this.custadd = this.Data.custadd;
      this.custcontnum = this.Data.custcontnum;
      this.custemail = this.Data.custemail;
    }
  }

  async validateName() {
    if (!this.custname) {
      this.custnameExists = false;
      return;
    }

    this.custnameExists = await this.customerService.checknameExists(
      this.custname
    );
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    const data = {
      custname: this.custname,
      custadd: this.custadd,
      custcontnum: this.custcontnum ?? '',
      custemail: this.custemail ?? '',
    };

    let success = false;

    if (this.mode === 'add') {
      success = await this.customerService.insert({
        ...data,
      });
      if (success) {
        await this.appdateService.showToastjs(
          'Customer added successfully!',
          'success'
        );
        this.modalCtrl.dismiss(data);
      } else {
        await this.appdateService.showToastjs(
          'Failed to add Customer.',
          'danger'
        );
      }
    } else if (this.mode === 'edit' && this.custid) {
      success = await this.customerService.update({
        custid: this.custid,
        ...data,
      });
      console.log(success);
      if (success) {
        await this.appdateService.showToastjs(
          'Customer updated successfully!',
          'success'
        );
        const updata = {
          custid: this.custid,
          custname: this.custname,
          custadd: this.custadd,
          custcontnum: this.custcontnum ?? '',
          custemail: this.custemail ?? '',
        };
        console.log(updata);
        this.modalCtrl.dismiss(updata);
      } else {
        await this.appdateService.showToastjs(
          'Failed to update Customer.',
          'danger'
        );
      }
    }
  }
}

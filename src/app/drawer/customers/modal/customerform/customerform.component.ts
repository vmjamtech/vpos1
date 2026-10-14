import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
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
    IonIcon,
    IonInput,
  ],
})
export class CustomerformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  custid?: number;
  custname: string = '';
  custnameExists: boolean = false;
  duplicateStatus: 'none' | 'active' | 'inactive' = 'none';
  custadd = '';
  custcontnum = '';
  custemail = '';
  private nameCheckRequest = 0;

  constructor(
    private modalCtrl: ModalController,
    private alertController: AlertController,
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

  async validateName(event?: Event) {
    const request = ++this.nameCheckRequest;
    const inputValue = (event?.target as HTMLInputElement | null)?.value;
    const inputName = String(inputValue ?? this.custname).trim();

    if (!inputName) {
      this.custnameExists = false;
      this.duplicateStatus = 'none';
      return;
    }

    try {
      const customer = await this.customerService.findCustomerByName(inputName);
      if (request !== this.nameCheckRequest) return;

      if (!customer) {
        this.custnameExists = false;
        this.duplicateStatus = 'none';
      } else if (customer.custstatus === 'inactive') {
        this.custnameExists = false;
        this.duplicateStatus = 'inactive';
      } else {
        this.custnameExists = true;
        this.duplicateStatus = 'active';
      }
    } catch (error) {
      if (request !== this.nameCheckRequest) return;
      console.error('Customer duplicate check failed:', error);
      this.custnameExists = false;
      this.duplicateStatus = 'none';
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    const custname = this.custname.trim();
    if (!custname) {
      await this.appdateService.showToastjs(
        'Please enter a customer name.',
        'warning'
      );
      return;
    }

    const data = {
      custname,
      custadd: this.custadd,
      custcontnum: this.custcontnum ?? '',
      custemail: this.custemail ?? '',
    };

    let success = false;

    if (this.mode === 'add') {
      const existingCustomer =
        await this.customerService.findCustomerByName(custname);

      if (existingCustomer?.custstatus === 'inactive') {
        await this.promptRestoreCustomer(existingCustomer);
        return;
      }

      if (existingCustomer) {
        this.custnameExists = true;
        await this.appdateService.showToastjs(
          'Customer already exists in the active list.',
          'warning'
        );
        return;
      }

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

  async promptRestoreCustomer(customer: any) {
    const alert = await this.alertController.create({
      header: 'Customer Inactive',
      message:
        'This customer already exists in the Inactive Customer list. Do you want to restore it?',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Yes',
          handler: async () => {
            const restored =
              await this.customerService.restoreDuplicateCustomer(
                customer.custid,
                {
                  custadd: this.custadd.trim() || undefined,
                  custcontnum: this.custcontnum.trim() || undefined,
                  custemail: this.custemail.trim() || undefined,
                }
              );

            if (!restored) {
              await this.appdateService.showToastjs(
                'Failed to restore customer.',
                'danger'
              );
              return;
            }

            await this.appdateService.showToastjs(
              'Customer restored successfully.',
              'success'
            );
            await this.modalCtrl.dismiss({
              refreshed: true,
              custid: customer.custid,
            });
          },
        },
      ],
    });

    await alert.present();
  }
}

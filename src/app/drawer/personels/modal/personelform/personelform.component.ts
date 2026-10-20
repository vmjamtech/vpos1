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
  IonSearchbar,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { PersonelsService } from 'src/app/services/personels.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-personelform',
  templateUrl: './personelform.component.html',
  styleUrls: ['./personelform.component.scss'],
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
    IonSelect,
    IonSelectOption,
    IonSearchbar,
    IonToggle,
  ],
})
export class PersonelformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  pid?: number;
  pname: string = '';
  nameExists: boolean = false;
  paddress = '';
  pcontactnum = '';
  prole = ['Cashier', 'Rider', 'Driver'];
  selectedRole: string | null = null;
  linkedUserid: number | null = null;
  isCommissionEligible = true;
  userAccounts: any[] = [];
  accountSearch = '';

  constructor(
    private modalCtrl: ModalController,
    private personelService: PersonelsService,
    private appdateService: AppdateService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    try {
      this.userAccounts = await this.userService.getUserAccountsForPersonnel();
    } catch (error) {
      console.error('Failed to load user accounts for personnel form:', error);
      await this.appdateService.showToastjs(
        'Unable to load user accounts.',
        'danger'
      );
    }

    if (this.mode === 'edit' && this.Data) {
      this.pid = this.Data.pid;
      this.pname = this.Data.pname;
      this.paddress = this.Data.paddress;
      this.pcontactnum = this.Data.pcontactnum;
      this.selectedRole =
        this.Data.prole === 'StoreKeeper' ? 'Cashier' : this.Data.prole;
      this.linkedUserid = this.Data.linked_userid ?? null;
      this.isCommissionEligible =
        this.Data.is_commission_eligible == null ||
        Number(this.Data.is_commission_eligible) === 1;
    }
  }

  get filteredUserAccounts(): any[] {
    const search = this.accountSearch.trim().toLowerCase();
    if (!search) return this.userAccounts;
    return this.userAccounts.filter((account) =>
      `${account.usern ?? ''} ${account.empname ?? ''} ${account.accnttype ?? ''}`
        .toLowerCase()
        .includes(search)
    );
  }

  async validateName() {
    if (!this.pname) {
      this.nameExists = false;
      return;
    }

    this.nameExists = await this.personelService.checknameExists(this.pname);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    const data = {
      pname: this.pname,
      paddress: this.paddress,
      pcontactnum: this.pcontactnum ?? '',
      prole: this.selectedRole ?? '',
      linked_userid:
        this.selectedRole === 'Cashier' ? this.linkedUserid : null,
      is_commission_eligible: this.isCommissionEligible ? 1 : 0,
    };

    if (this.selectedRole === 'Cashier' && this.linkedUserid == null) {
      await this.appdateService.showToastjs(
        'Please link a user account to this cashier.',
        'warning'
      );
      return;
    }

    let success = false;

    if (this.mode === 'add') {
      success = await this.personelService.insert({
        ...data,
      });
      if (success) {
        await this.appdateService.showToastjs(
          'Personnel added successfully!',
          'success'
        );
        this.modalCtrl.dismiss(data);
      } else {
        await this.appdateService.showToastjs(
          'Failed to add Personnel.',
          'danger'
        );
      }
    } else if (this.mode === 'edit' && this.pid) {
      success = await this.personelService.update({
        pid: this.pid,
        ...data,
      });
      console.log(success);
      if (success) {
        await this.appdateService.showToastjs(
          'Personnel updated successfully!',
          'success'
        );
        const updata = {
          pid: this.pid,
          ...data,
        };
        console.log(updata);
        this.modalCtrl.dismiss(updata);
      } else {
        await this.appdateService.showToastjs(
          'Failed to update Personnel.',
          'danger'
        );
      }
    }
  }
}

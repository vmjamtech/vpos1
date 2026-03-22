import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
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
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-userform',
  templateUrl: './userform.component.html',
  styleUrls: ['./userform.component.scss'],
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
    IonSelectOption,
    IonSelect,
    IonInputPasswordToggle,
  ],
})
export class UserformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  userid?: number;
  empname: string = '';
  empnameExists: boolean = false;
  usernameExists: boolean = false;
  empaddress = '';
  empcontnum = '';
  usern = '';
  passw = '';
  oldpass = '';
  confirmPassword = '';
  passwordMismatch = false;
  accntdate = '';
  accnttype = ['ADMINISTRATOR', 'CASHIER', 'SALES MANAGER'];
  selectedtype: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private userService: UserService,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {
    if (this.mode === 'edit' && this.Data) {
      this.userid = this.Data.userid;
      this.empname = this.Data.empname;
      this.empaddress = this.Data.empaddress;
      this.empcontnum = this.Data.empcontnum;
      this.selectedtype = this.Data.accnttype;
      this.usern = this.Data.usern;
      this.oldpass = this.Data.passw;
    }
  }

  checkPasswordsMatch() {
    if (this.passw && this.confirmPassword) {
      this.passwordMismatch = this.passw !== this.confirmPassword;
    } else {
      this.passwordMismatch = false;
    }
  }

  async validateName() {
    if (!this.empname) {
      this.empnameExists = false;
      return;
    }

    this.empnameExists = await this.userService.checknameExists(this.empname);
  }

  async validateUserName() {
    if (!this.usern) {
      this.usernameExists = false;
      return;
    }

    this.usernameExists = await this.userService.checknameExists(this.usern);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    const data = {
      empname: this.empname,
      usern: this.usern,
      passw: this.passw,
      accnttype: this.selectedtype ?? '',
      empaddress: this.empaddress,
      empcontnum: this.empcontnum ?? '',
    };

    let success = false;

    if (this.mode === 'add') {
      success = await this.userService.insert({
        ...data,
      });
      if (success) {
        await this.appdateService.showToastjs(
          'User added successfully!',
          'success'
        );
        this.modalCtrl.dismiss(data);
      } else {
        await this.appdateService.showToastjs('Failed to add User.', 'danger');
      }
    } else if (this.mode === 'edit' && this.userid) {
      success = await this.userService.update({
        userid: this.userid,
        ...data,
      });
      console.log(success);
      if (success) {
        await this.appdateService.showToastjs(
          'User updated successfully!',
          'success'
        );
        const updata = {
          userid: this.userid,
          empname: this.empname,
          usern: this.usern,
          passw: this.passw,
          accnttype: this.selectedtype ?? '',
          empaddress: this.empaddress,
          empcontnum: this.empcontnum ?? '',
        };
        console.log(updata);
        this.modalCtrl.dismiss(updata);
      } else {
        await this.appdateService.showToastjs(
          'Failed to update User.',
          'danger'
        );
      }
    }
  }
}

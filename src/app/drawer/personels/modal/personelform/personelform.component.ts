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
import { PersonelsService } from 'src/app/services/personels.service';

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
    IonSelectOption
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
  prole = ['Driver', 'Rider', 'StoreKeeper'];
  selectedRole: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private personelService: PersonelsService,
    private appdateService: AppdateService
  ) {}

  ngOnInit() {
    if (this.mode === 'edit' && this.Data) {
      this.pid = this.Data.pid;
      this.pname = this.Data.pname;
      this.paddress = this.Data.paddress;
      this.pcontactnum = this.Data.pcontactnum;
      this.selectedRole = this.Data.prole;
    }
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
    };

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

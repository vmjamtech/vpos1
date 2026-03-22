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
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { PersonelsService } from 'src/app/services/personels.service';
import { PettyCashService } from 'src/app/services/pettycash.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-pettycashform',
  templateUrl: './pettycashform.component.html',
  styleUrls: ['./pettycashform.component.scss'],
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
    IonSelect,
    IonSelectOption,
  ],
})
export class PettycashformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  pettylogamount: number = 0;
  pettyorigamount: number = 0;
  pettylogby: string = '';
  pettylogtype: string = '';
  pettylogremarks: string = '';
  pettypaymenthod: string = '';
  constructor(
    private modalCtrl: ModalController,
    private pettyCashService: PettyCashService,
    private appdateService: AppdateService,
    private storageService: StorageService,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    this.pettyorigamount = await this.pettyCashService.getCurrent();
    const user = await this.storageService.get<any>('login-data');
    this.pettylogby = user?.empname || 'ADMINISTRATOR';
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async savePettyCash() {
    // Show confirmation alert
    const alert = await this.alertCtrl.create({
      header: 'Confirm',
      message: 'Are you sure you want to save this petty cash entry?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('User cancelled');
          },
        },
        {
          text: 'Confirm',
          handler: async () => {
            try {
              const id = await this.pettyCashService.insertPettyCashLog({
                pettylogamount: this.pettylogamount,
                pettyorigamount: this.pettyorigamount,
                pettylogby: this.pettylogby,
                pettylogtype: this.pettylogtype,
                pettylogremarks: this.pettylogremarks,
                pettypaymenthod: this.pettypaymenthod,
              });

              await this.appdateService.showToastjs(
                'Petty Cash added successfully!',
                'success'
              );

              this.modalCtrl.dismiss(id);
            } catch (err) {
              console.error('Error inserting petty cash log:', err);
            }
          },
        },
      ],
    });

    await alert.present();
  }
}

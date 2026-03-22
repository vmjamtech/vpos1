import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonItemDivider,
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
  selector: 'app-ratesettings',
  templateUrl: './ratesettings.component.html',
  styleUrls: ['./ratesettings.component.scss'],
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
  ],
})
export class RatesettingsComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  @Input() Data?: any;

  pid?: number;
  saldaily: number = 0;
  saldiv: number = 0; 
  sal2kg: number = 0;
  sal5kg: number = 0;
  sal7kg: number = 0;
  sal11kg: number = 0;
  sal22kg: number = 0;
  sal50kg: number = 0;
  salary: any[] = [];
  pname: string = '';
  prole = ['Driver', 'Rider', 'StoreKeeper'];
  selectedRole: string | null = null;
  isHave: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private personelService: PersonelsService,
    private appdateService: AppdateService
  ) {}
  async ngOnInit() {
    if (this.mode === 'edit' && this.Data) {
      this.pid = this.Data.pid;
      this.pname = this.Data.pname;
      this.selectedRole = this.Data.prole;
    }
    await this.loadSalary();
  }

  async loadSalary() {
    if (!this.pid) return;

    this.salary = await this.personelService.getPersonelsalary(this.pid);
    console.log('result:', this.salary);

    if (this.salary && this.salary.length > 0) {
      this.isHave = true;
      const s = this.salary[0];

      this.saldaily = s.saldaily;
      this.saldiv = s.saldiv;
      this.sal2kg = s.sal2kg;
      this.sal5kg = s.sal5kg;
      this.sal7kg = s.sal7kg;
      this.sal11kg = s.sal11kg;
      this.sal22kg = s.sal22kg;
      this.sal50kg = s.sal50kg;
    } else {
      console.warn('No salary record found — clearing fields');
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveItem() {
    if (!this.pid) return;
    const data = {
      pid: this.pid,
      saldaily: this.saldaily, 
      saldiv: this.saldiv,
      sal2kg: this.sal2kg,
      sal5kg: this.sal5kg,
      sal7kg: this.sal7kg,
      sal11kg: this.sal11kg,
      sal22kg: this.sal5kg,
      sal50kg: this.sal50kg,
      isHave: this.isHave,
    };

    let success = false;

    if (this.mode === 'edit' && this.pid) {
      success = await this.personelService.updatesalary({
        ...data, 
      });
      console.log(success);
      if (success) {
        await this.appdateService.showToastjs(
          'Rate Settings updated successfully!',
          'success'
        );
        const updata = {
          ...data,
        };
        console.log(updata);
        this.modalCtrl.dismiss(updata);
      } else {
        await this.appdateService.showToastjs(
          'Failed to update Rate Settings.',
          'danger'
        );
      }
    }
  }
}

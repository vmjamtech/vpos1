import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  ModalController,
  IonToggle,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CardLayoutComponent } from './components/card-layout/card-layout.component';

@Component({
  selector: 'app-appsettings',
  templateUrl: './appsettings.component.html',
  styleUrls: ['./appsettings.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    IonContent,
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonInput,
    IonToggle,
  ],
})
export class AppsettingsComponent implements OnInit {
  Bname = '';
  Baddress = '';
  ReceiptPosName = '';
  appdateid?: number;
  Blogo: string | null = null;
  withlogo = false;

  get businessContactNumber(): string {
    return this.ReceiptPosName;
  }

  set businessContactNumber(value: string) {
    this.ReceiptPosName = value || '';
  }

  @ViewChild('logoInput') logoInput!: ElementRef<HTMLInputElement>;

  constructor(
    private appdaterService: AppdateService,
    private modalCtrl: ModalController
  ) {}

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    const settings = await this.appdaterService.getAllAppdate();
    console.log('Loaded settings:', settings);

    if (settings && settings.length > 0) {
      const row = settings[0];

      this.appdateid = row.appdateid;
      this.Bname = row.Bname;
      this.Baddress = row.Baddress;
      this.ReceiptPosName = row.ReceiptContactInfo ?? row.ReceiptPosName ?? '';
      this.withlogo = row.withlogo === 'Y';

      if (row.Blogo && Array.isArray(row.Blogo)) {
        console.log('Raw Blogo byte array length:', row.Blogo.length);
        const base64 = this.byteArrayToBase64(row.Blogo);
        this.Blogo = base64;
        console.log(
          'Converted Blogo base64:',
          this.Blogo?.substring(0, 50) + '...'
        ); // log first 50 chars
      } else if (typeof row.Blogo === 'string') {
        this.Blogo = row.Blogo;
        console.log(
          'Blogo is already string:',
          this.Blogo?.substring(0, 50) + '...'
        );
      } else {
        this.Blogo = null;
        console.log('No Blogo found');
      }
    } else {
      console.log('No settings found');
    }
  }

  byteArrayToBase64(bytes: number[]): string {
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:image/jpeg;base64,' + btoa(binary);
  }

  triggerLogoPicker() {
    this.logoInput.nativeElement.click();
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.Blogo = reader.result as string; // base64 encoded image
    };
    reader.readAsDataURL(file);
  }

  async saveSettings() {
    const contactNumber = (this.ReceiptPosName ?? '').trim();

    const data = {
      Bname: this.Bname,
      Baddress: this.Baddress,
      ReceiptPosName: contactNumber,
      ReceiptContactInfo: contactNumber,
      RecieptVATreg: 'TEST',
      Blogo: this.Blogo,
      withlogo: this.withlogo ? 'Y' : 'N',
    };

    if (this.appdateid) {
      // Update existing row and keep legacy + active fields in sync.
      await this.appdaterService.updateBusinessSettings(this.appdateid, data);
      console.log('Business settings updated');
    } else {
      // Insert new row with the active receipt field populated.
      const id = await this.appdaterService.insert(data);
      this.appdateid = id;
      console.log('Business settings inserted with ID:', id);
    }
  }

  openBusinessInfoLayout() {
    this.modalCtrl
      .create({
        component: CardLayoutComponent,
        initialBreakpoint: 0.9,
        breakpoints: [0.9],
        backdropDismiss: false,
        expandToScroll: false,
      })
      .then((modal) => {
        modal.present();
      });
    // Logic to open business info slip layout settings
    console.log('Opening Business Info Slip Layout settings...');
  }
}

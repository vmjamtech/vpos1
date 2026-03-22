import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { PrinterService } from 'src/app/services/printer.service';

interface LayoutField {
  id: string;
  label: string;
  value: string | null;
  type: 'text' | 'image';
  visible?: boolean;
  style?: {
    fontSize?: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
  };
}

@Component({
  selector: 'app-card-layout',
  templateUrl: './card-layout.component.html',
  styleUrls: ['./card-layout.component.scss'],
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
    IonIcon,
  ],
})
export class CardLayoutComponent implements OnInit {
  @ViewChild('logoInput') logoInput!: ElementRef<HTMLInputElement>;
  appdateid?: number;
  showPreview = true;
  previewContent: { type: 'text' | 'image'; value: string }[] = [];

  // Fields grouped logically for UX
  fields: LayoutField[] = [
    {
      id: 'logo',
      label: 'Business Logo',
      value: null,
      type: 'image',
      visible: true,
      style: {},
    },
    {
      id: 'compName',
      label: 'Business Name Line 1',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
    {
      id: 'compName1',
      label: 'Business Name Line 2',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
    {
      id: 'receiptAddress',
      label: 'Address Line 1',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
    {
      id: 'receiptAddress1',
      label: 'Address Line 2',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
    {
      id: 'compContact',
      label: 'Contact Line 1',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
    {
      id: 'compContact1',
      label: 'Contact Line 2',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
    {
      id: 'compContact2',
      label: 'Contact Line 3',
      value: '',
      type: 'text',
      visible: true,
      style: {},
    },
  ];

  constructor(
    private modalCtrl: ModalController,
    private appdaterService: AppdateService,
    private printerService: PrinterService,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    const settings = await this.appdaterService.getAllAppdate();
    if (!settings || settings.length === 0) return;

    const row = settings[0];

    this.appdateid = row.appdateid;

    this.fields.forEach((field) => {
      if (!field.style) field.style = {}; // ensure style object exists

      switch (field.id) {
        case 'logo':
          if (row.Blogo && Array.isArray(row.Blogo)) {
            field.value = this.byteArrayToBase64(row.Blogo);
          } else if (typeof row.Blogo === 'string') {
            field.value = row.Blogo;
          }
          break;
        case 'compName':
          field.value = row.ReceiptBname || '';
          break;
        case 'compName1':
          field.value = row.ReceiptBname1 || '';
          break;
        case 'receiptAddress':
          field.value = row.ReceiptAddress || '';
          break;
        case 'receiptAddress1':
          field.value = row.ReceiptAddress1 || '';
          break;
        case 'compContact':
          field.value = row.ReceiptContactInfo || '';
          break;
        case 'compContact1':
          field.value = row.ReceiptContactInfo1 || '';
          break;
        case 'compContact2':
          field.value = row.ReceiptContactInfo2 || '';
          break;
      }
    });
  }

  byteArrayToBase64(bytes: number[]): string {
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:image/jpeg;base64,' + btoa(binary);
  }

  // Reorder fields
  reorderItems(event: any) {
    const moved = this.fields.splice(event.detail.from, 1)[0];
    this.fields.splice(event.detail.to, 0, moved);
    event.detail.complete();

    console.log(
      'Fields reordered:',
      this.fields.map((f) => f.label)
    );
  }

  // Logo picker
  triggerLogoPicker() {
    this.logoInput.nativeElement.click();
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const logoField = this.fields.find((f) => f.id === 'logo');
      if (logoField) logoField.value = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Save layout/template
  async saveLayout() {
    if (!this.fields || this.fields.length === 0) return;

    // Show confirmation alert
    const confirm = await this.alertController.create({
      header: 'Confirm Save',
      message: 'Are you sure you want to save the business layout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Save cancelled');
          },
        },
        {
          text: 'Yes, Save',
          handler: async () => {
            // Map fields array to data object
            const data = {
              ReceiptBname: this.fields[1]?.value || '', // Business Name Line 1
              ReceiptBname1: this.fields[2]?.value || '', // Business Name Line 2
              ReceiptAddress: this.fields[3]?.value || '', // Address Line 1
              ReceiptAddress1: this.fields[4]?.value || '', // Address Line 2
              ReceiptContactInfo: this.fields[5]?.value || '', // Contact Line 1
              ReceiptContactInfo1: this.fields[6]?.value || '', // Contact Line 2
              ReceiptContactInfo2: this.fields[7]?.value || '', // Contact Line 3
              Blogo: this.fields[0]?.value || null, // Logo (base64 or blob)
            };

            try {
              if (this.appdateid) {
                await this.appdaterService.updateLayout(this.appdateid, data);
                console.log('Business settings updated');

                const successAlert = await this.alertController.create({
                  header: 'Success',
                  message: 'Business layout has been saved successfully!',
                  buttons: ['OK'],
                });
                await successAlert.present();
              }
            } catch (err) {
              console.error('Save layout error:', err);

              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Failed to save business layout. Please try again.',
                buttons: ['OK'],
              });
              await errorAlert.present();
            }
          },
        },
      ],
    });

    await confirm.present();
  }

  // Print preview
  async printPreview() {
    if (!this.fields || this.fields.length === 0) return;

    // Build preview content based on visible fields
    this.previewContent = this.fields
      .filter((f) => f.visible !== false)
      .map((f) => ({ type: f.type, value: f.value || '' }));

    this.showPreview = true;
    await this.printerService.printPreviewToPrinter(this.previewContent);
  }

  // Close modal
  dismiss() {
    this.modalCtrl.dismiss();
  }
}

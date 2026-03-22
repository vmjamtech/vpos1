import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemSliding,
  IonTitle,
  IonToolbar,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { NotesComponent } from 'src/app/drawer/sales/modal/salesdetails/modal/notes/notes.component';
import { AppdateService } from 'src/app/services/appdate.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { TransferService } from 'src/app/services/transfer.service';

@Component({
  selector: 'app-restockdetails',
  templateUrl: './restockdetails.component.html',
  styleUrls: ['./restockdetails.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonIcon,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonFooter,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonItem,
    IonItemSliding,
  ],
})
export class RestockdetailsComponent implements OnInit {
  poutrefnum?: string;
  pouttype?: string;
  pullsupplier?: string;
  fillitems: any[] = [];
  emptyitems: any[] = [];
  driver: any = [];
  drivername: string = '';
  data: any;
  cart1: string = '';
  cart2: string = '';
  constructor(
    private transferService: TransferService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private supplierService: SupplierService,
    private loadingController: LoadingController,
    private appdateService: AppdateService
  ) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  ngOnInit() {
    console.log('data', this.data);
    console.log('REF', this.poutrefnum);
    this.loadDetails(this.poutrefnum ?? '', this.pouttype ?? '');
    if (this.pouttype === 'RESTOCK OUT') {
      this.cart1 = 'Fill Items (-)';
      this.cart2 = 'Empty Items (-)';
    } else if (this.pouttype === 'RESTOCK IN') {
      this.cart1 = 'Fill Items (+)';
      this.cart2 = 'Empty Items (+)';
    } else if (this.pouttype === 'W.RESTOCK IN') {
      this.cart1 = 'Fill Items (+)';
      this.cart2 = 'Empty Items (+)';
    } else if (this.pouttype === 'W.RESTOCK OUT') {
      this.cart1 = 'Fill Items (-)';
      this.cart2 = 'Empty Items (-)';
    } else {
      this.cart1 = 'Fill Items (-)';
      this.cart2 = 'Empty Items (+)';
    }
    this.loadDrivers();
  }

  async loadDrivers() {
    this.driver = await this.supplierService.getAllDriver();

    // Find the driver where pid matches data.poutid
    const found = this.driver.find(
      (d: { pid: number }) => d.pid === this.data.poutpid
    );

    if (found) {
      this.drivername = found.pname; // optional: store driver name
    }
  }

  async loadDetails(poutrefnum: string, pouttype: string) {
    if (!poutrefnum) return;
    try {
      const { fill, empty } = await this.transferService.getTransferCart(
        poutrefnum,
        pouttype
      );
      this.fillitems = fill;
      this.emptyitems = empty;
    } catch (err) {
      console.error(err);
      await this.appdateService.showToastjs(
        'Failed to load transfer cart',
        'danger'
      );
    }
  }

  getFillTotalQty(): number {
    return this.fillitems.reduce((sum, item) => sum + item.poutqty, 0);
  }

  getEmptyTotalQty(): number {
    return this.emptyitems.reduce((sum, item) => sum + item.poutqty, 0);
  }

  async openAndAddNote() {
    const modal = await this.modalCtrl.create({
      component: NotesComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0.6],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: {
        notes: this.data.notes,
        poutrefnum: this.data.poutrefnum,
      },
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data?.newNote) {
      const added = data.newNote;

      // Save to DB
      await this.transferService.addnoteTransferdb(this.data.poutrefnum, added);

      // Update UI
      this.data.notes =
        (this.data.notes ? this.data.notes + '\n' : '') +
        'Additional Notes: ' +
        added;

      await this.appdateService.showToastjs('Note added.', 'success');
    }
  }

  async saveTransfer() {
    const alert = await this.alertController.create({
      header: `Confirm`,
      message: `Are you sure you want to CONFIRM this ${this.pouttype}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Confirm',
          handler: async () => {
            // Create and show loading spinner
            const loading = await this.loadingController.create({
              message: 'Processing transfer...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              const success = await this.confirmTransfer();
              if (success) {
                this.modalCtrl.dismiss(null, 'CONFIRMED');
              }
            } catch (error) {
              console.error('Error saving transfer:', error);
              await this.appdateService.showToastjs(
                'Failed to confirm transfer. Please try again.',
                'danger'
              );
            } finally {
              // Dismiss the loading spinner
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async confirmTransfer(): Promise<boolean> {
    const fillitems = this.fillitems.map((x) => ({
      itemcode: x.poutitemcode,
      qty: x.poutqty,
    }));

    const emptyitems = this.emptyitems.map((x) => ({
      itemcode: x.poutitemcode,
      qty: x.poutqty,
    }));

    // Helper function to update items
    const updateItems = async (
      items: any[],
      increaseCol: string | null,
      decreaseCol: string | null,
      origin: string
    ) => {
      if (increaseCol) {
        await this.transferService.updateStoreQuantity(
          true,
          items,
          increaseCol,
          origin,
          this.poutrefnum ?? ''
        );
      }
      if (decreaseCol) {
        await this.transferService.updateStoreQuantity(
          false,
          items,
          decreaseCol,
          origin,
          this.poutrefnum ?? ''
        );
      }
    };

    try {
      switch (this.pouttype) {
        case 'RESTOCK IN':
          await updateItems(fillitems, 'fillqty', null, 'RESTOCK IN');
          await updateItems(emptyitems, 'emptyqty', null, 'RESTOCK IN');
          break;

        case 'RESTOCK OUT':
          await updateItems(fillitems, null, 'fillqty', 'RESTOCK OUT');
          await updateItems(emptyitems, null, 'emptyqty', 'RESTOCK OUT');
          break;

        case 'W.RESTOCK IN':
          await updateItems(fillitems, 'whfill', null, 'WAREHOUSE RESTOCK IN');
          await updateItems(
            emptyitems,
            'whempty',
            null,
            'WAREHOUSE RESTOCK IN'
          );
          break;

        case 'W.RESTOCK OUT':
          await updateItems(fillitems, null, 'whfill', 'WAREHOUSE RESTOCK OUT');
          await updateItems(
            emptyitems,
            null,
            'whempty',
            'WAREHOUSE RESTOCK OUT'
          );
          break;

        default:
          console.warn('Unknown pouttype:', this.pouttype);
          break;
      }

      await this.appdateService.showToastjs(
        'Transfer has been successfully processed.',
        'success'
      );

      return true;
    } catch (error) {
      console.error('Transfer failed:', error);
      await this.appdateService.showToastjs(
        'Processing failed. Please try again.',
        'danger'
      );
      return false;
    }
  }

  async cancelTransfer() {
    const alert = await this.alertController.create({
      header: `Confirm`,
      message: `Are you sure you want to CANCEL this ${this.pouttype}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Confirm',
          handler: async () => {
            // Create and show loading spinner
            const loading = await this.loadingController.create({
              message: 'Processing cancel transfer...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              const success = await this.confirmCancelTransfer();
              if (success) {
                this.modalCtrl.dismiss(null, 'CANCELLED');
              }
            } catch (error) {
              console.error('Error cancelling transfer:', error);
              await this.appdateService.showToastjs(
                'Failed to cancel transfer. Please try again.',
                'danger'
              );
            } finally {
              // Dismiss the loading spinner
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async confirmCancelTransfer(): Promise<boolean> {
    const fillitems = this.fillitems.map((x) => ({
      itemcode: x.poutitemcode,
      qty: x.poutqty,
    }));

    const emptyitems = this.emptyitems.map((x) => ({
      itemcode: x.poutitemcode,
      qty: x.poutqty,
    }));

    // Helper function to update items
    const updateItems = async (
      items: any[],
      increaseCol: string | null,
      decreaseCol: string | null,
      origin: string
    ) => {
      if (increaseCol) {
        await this.transferService.updateCancelStoreQuantity(
          true,
          items,
          increaseCol,
          origin,
          this.poutrefnum ?? ''
        );
      }
      if (decreaseCol) {
        await this.transferService.updateCancelStoreQuantity(
          false,
          items,
          decreaseCol,
          origin,
          this.poutrefnum ?? ''
        );
      }
    };

    try {
      switch (this.pouttype) {
        case 'RESTOCK IN':
          await updateItems(fillitems, null, 'fillqty', 'CANCEL RESTOCK IN');
          await updateItems(emptyitems, null, 'emptyqty', 'CANCEL RESTOCK IN');
          break;

        case 'RESTOCK OUT':
          await updateItems(fillitems, 'fillqty', null, 'CANCEL RESTOCK OUT');
          await updateItems(emptyitems, 'emptyqty', null, 'CANCEL RESTOCK OUT');
          break;

        case 'W.RESTOCK IN':
          await updateItems(
            fillitems,
            null,
            'whfill',
            'CANCEL WAREHOUSE RESTOCK IN'
          );
          await updateItems(
            emptyitems,
            null,
            'whempty',
            'CANCEL WAREHOUSE RESTOCK IN'
          );
          break;

        case 'W.RESTOCK OUT':
          await updateItems(
            fillitems,
            'whfill',
            null,
            'CANCEL WAREHOUSE RESTOCK OUT'
          );
          await updateItems(
            emptyitems,
            'whempty',
            null,
            'CANCEL WAREHOUSE RESTOCK OUT'
          );
          break;

        default:
          console.warn('Unknown pouttype:', this.pouttype);
          break;
      }

      await this.appdateService.showToastjs(
        'Transfer has been successfully cancelled.',
        'success'
      );

      return true;
    } catch (error) {
      console.error('Transfer failed:', error);
      await this.appdateService.showToastjs(
        'Cancelling failed. Please try again.',
        'danger'
      );
      return false;
    }
  }
}

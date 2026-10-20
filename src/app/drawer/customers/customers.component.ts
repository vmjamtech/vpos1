import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonContent,
  IonFooter,
  IonFab,
  IonFabButton,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSkeletonText,
  LoadingController,
  ModalController,
} from '@ionic/angular/standalone';
import { CustomersService } from 'src/app/services/customers.service';
import { CustomerformComponent } from './modal/customerform/customerform.component';
import { AppdateService } from 'src/app/services/appdate.service';
import { CustomerbalanceComponent } from './modal/customerbalance/customerbalance.component';
import { LendeditemsComponent } from './modal/lendeditems/lendeditems.component';
import { InactivecustomersComponent } from './modal/inactivecustomers/inactivecustomers.component';
import { LendhistoryComponent } from './modal/lendhistory/lendhistory.component';
import { CustomertransactionsComponent } from './modal/customertransactions/customertransactions.component';
import * as XLSX from 'xlsx';
import { PermissionService } from 'src/app/services/permission.service';
import { PaginationComponent } from 'src/app/shared/pagination/pagination.component';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonIcon,
    IonLabel,
    IonItem,
    IonList,
    IonSearchbar,
    IonFooter,
    IonButton,
    IonSkeletonText,
    IonFab,
    IonFabButton,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonRefresher,
    IonRefresherContent,
    PaginationComponent,
  ],
})
export class CustomersComponent implements OnInit {
  items: any[] = [];
  filteredItems: any[] = [];

  searchValue: string = '';
  currentPage = 1;
  readonly pageSize = 50;
  totalCount = 0;
  totalPages = 1;

  isLoading = false;
  skeletonArray = Array(10);
  private loadRequestId = 0;

  searchField: 'custname' | 'custadd' = 'custname';
  searchFieldLabels: any = {
    custname: 'Customer Name',
    custadd: 'Customer Address',
  };

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor(
    private customerService: CustomersService,
    private alertController: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    private appdateService: AppdateService,
    private actionSheetController: ActionSheetController,
    public permissionService: PermissionService
  ) {}

  async ngOnInit() {
    await this.resetAndLoad();
  }

  async showOptionsSheet() {
    const actionSheet = await this.actionSheetController.create({
      buttons: [
        {
          text: 'Customers With Balance',
          icon: 'wallet-outline',
          handler: () => {
            console.log('Customers With Balance clicked');
            this.openCustomerWithBalance();
            // TODO: Add your logic here
          },
        },
        {
          text: 'Lended Items',
          icon: 'cube-outline',
          handler: () => {
            console.log('Lended Items clicked');
            this.openLendedItems();
            // TODO: Add your logic here
          },
        },
        {
          text: 'Lend History',
          icon: 'reader-outline',
          handler: () => {
            console.log('Lend History clicked');
            this.openLendHistory();
            // TODO: Add your logic here
          },
        },
        {
          text: 'Inactive Customers',
          icon: 'person-remove-outline',
          handler: () => {
            console.log('Inactive Customers clicked');
            // TODO: Add your logic here
            this.openInactiveCustomers();
          },
        },
        {
          text: 'Import Customer',
          icon: 'cloud-upload-outline',
          handler: () => {
            this.triggerCustomerImport();
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  triggerCustomerImport() {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
      this.fileInput.nativeElement.click();
    }
  }

  async onCustomerFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        await this.appdateService.showToastjs(
          'Invalid file format: No worksheet found.',
          'danger'
        );
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: '',
      });
      const headerIndex = rawRows.findIndex((row) =>
        row.some(
          (cell) => String(cell).trim().toLowerCase() === 'customer name'
        )
      );

      if (headerIndex === -1) {
        await this.appdateService.showToastjs(
          'Invalid file format: Missing "Customer Name" column.',
          'danger'
        );
        return;
      }

      const headers = rawRows[headerIndex].map((header) =>
        String(header).trim().toLowerCase()
      );
      const nameIndex = headers.indexOf('customer name');
      const addressIndex = headers.indexOf('address');
      const gasIndex = headers.indexOf('gas');
      const contactIndex = headers.indexOf('contact number');
      const cleanField = (value: unknown) => {
        const cleaned = String(value ?? '').trim();
        return /^(-----|n\/a)$/i.test(cleaned) ? '' : cleaned;
      };

      const customers = rawRows.slice(headerIndex + 1).map((row) => ({
        custname: String(row[nameIndex] ?? '').trim(),
        custadd: cleanField(row[addressIndex]),
        custemail: cleanField(row[gasIndex]),
        custcontnum: cleanField(row[contactIndex]),
      }));
      const result = await this.customerService.bulkInsertCustomers(customers);

      await this.resetAndLoad();
      const failureMessage = result.failed
        ? ` ${result.failed} could not be imported.`
        : '';
      await this.appdateService.showToastjs(
        `Import finished: ${result.added} added, ${result.skipped} skipped (already exists).${failureMessage}`,
        result.failed ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('Customer import failed:', error);
      await this.appdateService.showToastjs(
        'Customer import failed. Check the file and try again.',
        'danger'
      );
    } finally {
      input.value = '';
    }
  }

  async openCustomerWithBalance() {
    const modal = await this.modalCtrl.create({
      component: CustomerbalanceComponent,
      expandToScroll: false,
    });

    modal.onDidDismiss().then(async () => {
      await this.resetAndLoad();
    });

    return await modal.present();
  }

  async openLendedItems() {
    const modal = await this.modalCtrl.create({
      component: LendeditemsComponent,
      expandToScroll: false,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async openLendHistory() {
    const modal = await this.modalCtrl.create({
      component: LendhistoryComponent,
      expandToScroll: false,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async openInactiveCustomers() {
    const modal = await this.modalCtrl.create({
      component: InactivecustomersComponent,
      expandToScroll: false,
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }

  async doRefresh(event: any) {
    try {
      await this.loadPage(1);
    } finally {
      event.target.complete();
    }
  }

  // 🔹 When changing search field, reset pagination
  async selectSearchField() {
    const alert = await this.alertController.create({
      header: 'Search by',
      inputs: [
        {
          name: 'custname',
          type: 'radio',
          label: 'Customer Name',
          value: 'custname',
          checked: this.searchField === 'custname',
        },
        {
          name: 'custadd',
          type: 'radio',
          label: 'Customer Address',
          value: 'custadd',
          checked: this.searchField === 'custadd',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'OK',
          handler: async (value) => {
            this.searchField = value;
            await this.resetAndLoad();
          },
        },
      ],
    });

    await alert.present();
  }

  async resetAndLoad() {
    await this.loadPage(1);
  }

  async loadPage(page: number): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    try {
      const result = await this.customerService.getCustomerPage(
        page,
        this.pageSize,
        this.searchValue,
        this.searchField
      );
      if (requestId !== this.loadRequestId) return;
      this.currentPage = result.currentPage;
      this.totalCount = result.totalCount;
      this.totalPages = Math.ceil(this.totalCount / this.pageSize) || 1;
      this.items = result.rows;
      this.filteredItems = result.rows;
    } catch (error) {
      console.error('Failed to load customer page:', error);
      if (requestId === this.loadRequestId) {
        this.items = [];
        this.filteredItems = [];
      }
    } finally {
      if (requestId === this.loadRequestId) this.isLoading = false;
    }
  }

  onSearchChange() {
    void this.loadPage(1);
  }

  /** Open Add Item Modal */
  async openAddModal() {
    if (!this.permissionService.has('customer.addCustomer')) return;

    const modal = await this.modalCtrl.create({
      component: CustomerformComponent,
      initialBreakpoint: 0.5,
      breakpoints: [0.5],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'add' },
    });

    modal.onDidDismiss().then(async (res) => {
      if (res.data) {
        this.resetAndLoad();
      }
    });

    await modal.present();
  }

  async openEditModal(item: any) {
    if (!this.permissionService.has('customer.updateCustomer')) return;

    const modal = await this.modalCtrl.create({
      component: CustomerformComponent,
      initialBreakpoint: 0.5,
      breakpoints: [0.5],
      backdropDismiss: false,
      expandToScroll: false,
      componentProps: { mode: 'edit', custid: item.custid, Data: item },
    });

    modal.onDidDismiss().then((res) => {
      if (res.data) {
        void this.loadPage(this.currentPage);
      }
    });

    await modal.present();
  }

  async deleteConfirm(item: any) {
    if (!this.permissionService.has('customer.deleteCustomer')) return;

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete this customer?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Deleting customer...',
              spinner: 'crescent',
            });
            await loading.present();

            try {
              // Delete from database
              await this.customerService.delete(item.custid);

              await this.loadPage(this.currentPage);

              // Toast success
              await this.appdateService.showToastjs(
                'Customer deleted successfully!',
                'success'
              );
            } catch (err) {
              console.error('Delete failed:', err);
              await this.appdateService.showToastjs(
                'Failed to Customer item',
                'danger'
              );
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async openCustomerTransaction(item: any) {
    const modal = await this.modalCtrl.create({
      component: CustomertransactionsComponent,
      expandToScroll: false,
      componentProps: {
        custid: item.custid,
      },
    });

    modal.onDidDismiss().then((res) => {});

    return await modal.present();
  }
}

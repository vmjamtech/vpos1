import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  ModalController,
  IonToggle,
  ToastController,
  LoadingController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { StorageService } from 'src/app/services/storage.service';
import { StoreOnlyService } from 'src/app/services/store-only.service';
import { CardLayoutComponent } from './components/card-layout/card-layout.component';
import { DatabaseResetService, ResetModule } from 'src/app/services/database-reset.service';
import { DatabaseBackupService } from 'src/app/services/database-backup.service';
import { UserService } from 'src/app/services/user.service';
import { Router } from '@angular/router';
import { DailyInventorySnapshotService } from 'src/app/services/daily-inventory-snapshot.service';

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
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
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
  currentUser: any = null;
  appSettings = { store_only_mode: false };

  get isMasterAdmin(): boolean {
    return (
      this.currentUser?.userid === 'vmjamadmin' ||
      this.currentUser?.usern === 'vmjamadmin'
    );
  }

  get businessContactNumber(): string {
    return this.ReceiptPosName;
  }

  set businessContactNumber(value: string) {
    this.ReceiptPosName = value || '';
  }

  @ViewChild('logoInput') logoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('restoreFileInput') restoreFileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private appdaterService: AppdateService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private storageService: StorageService,
    private storeOnly: StoreOnlyService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private resetService: DatabaseResetService,
    private userService: UserService,
    private router: Router,
    private snapshotService: DailyInventorySnapshotService,
    private actionSheetCtrl: ActionSheetController,
    private backupService: DatabaseBackupService
  ) {}

  async ngOnInit() {
    this.appSettings.store_only_mode = this.storeOnly.enabled;
    this.currentUser = await this.storageService.get<any>('login-data');
    await this.loadSettings();
  }

  get isAdmin(): boolean {
    const user = this.currentUser;
    const username = String(user?.usern ?? '').toLowerCase();
    const userId = String(user?.userid ?? '').toLowerCase();
    const accountType = String(user?.accnttype ?? '').toLowerCase();

    return (
      username === 'vmjamadmin' ||
      username === 'adminvmjam' ||
      userId === 'vmjamadmin' ||
      accountType === 'administrator'
    );
  }

  async openResetSelectionModal() {
    if (!this.isAdmin) return;

    let selectedModules: ResetModule[] = [];
    const alert = await this.alertController.create({
      header: 'Reset System Data',
      subHeader: 'Select data modules to reset:',
      inputs: [
        {
          type: 'checkbox',
          label: 'Inventory (fill, empty, lent, and warehouse stock to 0)',
          value: 'inventory',
        },
        {
          type: 'checkbox',
          label: 'Customer (balances to 0 and active lends cleared)',
          value: 'customer',
        },
        {
          type: 'checkbox',
          label: 'Personnel (unpaid pay to 0 and histories cleared)',
          value: 'personnel',
        },
        {
          type: 'checkbox',
          label: 'Transfer (pull-out headers and lines cleared)',
          value: 'transfer',
        },
        {
          type: 'checkbox',
          label: 'Sales (transactions, queues, active lends, and balances)',
          value: 'sales',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Review & Proceed',
          role: 'confirm',
          handler: async (values: string[]) => {
            if (!Array.isArray(values) || values.length === 0) {
              await this.showToast(
                'Please select at least one module.',
                'warning'
              );
              return false;
            }
            selectedModules = values as ResetModule[];
            return true;
          },
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm' && selectedModules.length > 0) {
      await this.promptTypedConfirmationWithNotes(selectedModules);
    }
  }

  async openDatabaseActions() {
    if (!this.isAdmin) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'DATABASE',
      buttons: [
        {
          text: 'BACKUP DATA',
          icon: 'cloud-download-outline',
          handler: () => void this.createDatabaseBackup(),
        },
        {
          text: 'RESTORE DATA',
          icon: 'cloud-upload-outline',
          handler: () => this.openRestoreFilePicker(),
        },
        {
          text: 'RESET DATA',
          icon: 'trash-bin-outline',
          role: 'destructive',
          handler: () => void this.openResetSelectionModal(),
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await actionSheet.present();
  }

  private openRestoreFilePicker() {
    if (!this.isAdmin) return;
    const input = this.restoreFileInput?.nativeElement;
    if (!input) return;
    input.value = '';
    input.click();
  }

  async createDatabaseBackup() {
    if (!this.isAdmin) return;

    const loader = await this.loadingCtrl.create({
      message: 'Creating database backup...',
      backdropDismiss: false,
    });
    await loader.present();
    try {
      const filename = await this.backupService.exportBackup();
      await this.showToast(`Backup created successfully: ${filename}`, 'success');
    } catch (error) {
      console.error('Failed to create database backup:', error);
      await this.showToast('Failed to create database backup.', 'danger');
    } finally {
      await loader.dismiss();
    }
  }

  async onRestoreFileSelected(event: Event) {
    if (!this.isAdmin) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      await this.backupService.validateBackupFile(file);
    } catch {
      await this.showInvalidBackupAlert();
      return;
    }

    const confirmAlert = await this.alertController.create({
      header: '⚠️ OVERWRITE DATABASE',
      subHeader: `File: ${file.name}`,
      message:
        'Restoring this backup will replace current inventory, transactions, and customer balances with data from this file. The application will immediately log out upon completion. Proceed?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Restore & Log Out',
          role: 'destructive',
          handler: async () => {
            await this.executeRestore(file);
          },
        },
      ],
    });
    await confirmAlert.present();
  }

  private async showInvalidBackupAlert() {
    const alert = await this.alertController.create({
      header: 'Invalid Backup File',
      message: 'Invalid backup file format.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  async executeRestore(file: File) {
    if (!this.isAdmin) return;

    const loader = await this.loadingCtrl.create({
      message: 'Restoring database...',
      backdropDismiss: false,
    });
    await loader.present();
    try {
      await this.backupService.restoreBackupFromFile(file);
      await this.showToast(
        'Database restored successfully. Logging out...',
        'success'
      );
      setTimeout(() => void this.logoutAfterRestore(), 1200);
    } catch (error) {
      console.error('Failed to restore database backup:', error);
      const detail =
        error instanceof Error && error.message ? ` ${error.message}` : '';
      await this.showToast(
        `Database restore failed.${detail} No changes were committed.`,
        'danger'
      );
    } finally {
      await loader.dismiss();
    }
  }

  generateImpactNotes(modules: ResetModule[]): string {
    const selected = new Set(modules);
    const notes: string[] = [];

    if (selected.has('inventory')) {
      notes.push(
        'INVENTORY: inventorytbl.fillqty, emptyqty, lendqty, whfill, and whempty will be set to 0. Active lends and queued POS carts will also be cleared.'
      );
    }
    if (selected.has('customer')) {
      notes.push(
        'CUSTOMER: All custinfo.custbalance values will be set to 0. Active lendhistory records will be cleared, linked salescart lend counters reset, and inventorytbl.lendqty set to 0. Returned and soft-deleted lend history is retained.'
      );
    }
    if (selected.has('personnel')) {
      notes.push(
        'PERSONNEL: personeltbl.ptotalpay will be set to 0. deltransacttbl and salhistory records will be deleted.'
      );
    }
    if (selected.has('transfer')) {
      notes.push(
        'TRANSFER: All pulloutcart lines and pouttbl pull-out headers will be deleted.'
      );
    }
    if (selected.has('sales')) {
      notes.push(
        'SALES: All salescart lines, salestbl headers, and creditpaymenttbl payment history will be deleted. Active lends will be cleared, customer balances set to 0, linked lend counters reset, and queued POS carts removed. Returned and soft-deleted lend history is retained.'
      );
    }

    if (selected.has('sales') && !selected.has('customer')) {
      notes.push(
        'COMBINATION IMPACT: Sales reset also clears every customer balance, even though Customer is not selected.'
      );
    }
    if (
      (selected.has('inventory') || selected.has('sales')) &&
      !selected.has('customer')
    ) {
      notes.push(
        'COMBINATION IMPACT: Inventory or Sales reset clears active lend records and linked lend quantities to prevent orphaned lend counts.'
      );
    }

    return notes.join('\n\n');
  }

  async promptTypedConfirmationWithNotes(modules: ResetModule[]) {
    if (!this.isAdmin) return;

    const confirmAlert = await this.alertController.create({
      header: 'CRITICAL: REVIEW RESET IMPACT',
      subHeader: 'This action is irreversible. Read carefully before proceeding:',
      message: `${this.generateImpactNotes(modules)}\n\nTo confirm permanent deletion, type "RESET":`,
      inputs: [
        {
          name: 'verification',
          type: 'text',
          placeholder: 'Type RESET',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm Reset',
          role: 'destructive',
          handler: async (data: { verification?: string }) => {
            if (data?.verification !== 'RESET') {
              await this.showToast(
                'Reset aborted: Confirmation word did not match.',
                'danger'
              );
              return false;
            }
            await this.performReset(modules);
            return true;
          },
        },
      ],
    });
    await confirmAlert.present();
  }

  async performReset(modules: ResetModule[]) {
    if (!this.isAdmin) return;

    const loader = await this.loadingCtrl.create({
      message: 'Resetting database records...',
      backdropDismiss: false,
    });
    await loader.present();

    try {
      await this.resetService.executeScopedReset(modules);
      await loader.dismiss();
      await this.showToast(
        'Data reset successfully completed. Logging out...',
        'success'
      );
      setTimeout(() => void this.logoutAfterReset(), 1200);
    } catch (error) {
      console.error('Failed to reset selected data:', error);
      await loader.dismiss();
      await this.showToast(
        'Error resetting data. No database changes were committed.',
        'danger'
      );
    }
  }

  private async logoutAfterReset() {
    await this.snapshotService.captureCurrentInventory(
      this.currentUser?.empname
    );
    await this.storageService.remove('login-data');
    this.userService.clearCurrentUser();
    await this.router.navigateByUrl('/sign-in');
  }

  private async logoutAfterRestore() {
    await this.storageService.remove('login-data');
    this.userService.clearCurrentUser();
    await this.router.navigateByUrl('/sign-in');
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  onStoreOnlyModeChange() {
    if (!this.isMasterAdmin) return;
    this.storeOnly.enabled = this.appSettings.store_only_mode;
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
    const confirmation = await this.alertController.create({
      header: 'Confirm Save',
      message: 'Are you sure you want to save the Business Settings?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Save', role: 'confirm' },
      ],
    });
    await confirmation.present();

    const { role } = await confirmation.onDidDismiss();
    if (role !== 'confirm') return;

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

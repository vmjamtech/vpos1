import {
  ActionSheetController,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { DatabaseBackupService } from 'src/app/services/database-backup.service';
import { AppsettingsComponent } from './appsettings.component';

describe('AppsettingsComponent', () => {
  let appdateService: jasmine.SpyObj<AppdateService>;
  let alertController: jasmine.SpyObj<AlertController>;
  let component: AppsettingsComponent;

  beforeEach(() => {
    appdateService = jasmine.createSpyObj<AppdateService>('AppdateService', [
      'getAllAppdate',
      'insert',
      'updateBusinessSettings',
    ]);
    alertController = jasmine.createSpyObj<AlertController>(
      'AlertController',
      ['create']
    );
    alertController.create.and.resolveTo({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: 'confirm' }),
    } as any);
    component = new AppsettingsComponent(
      appdateService,
      {} as ModalController,
      alertController,
      { get: async () => null } as any,
      { enabled: false } as any,
      {} as any,
      {} as any,
      {} as any,
      { clearCurrentUser: () => undefined } as any,
      { navigateByUrl: async () => true } as any,
      { captureCurrentInventory: async () => undefined } as any,
      {} as ActionSheetController,
      {} as DatabaseBackupService
    );
  });

  it('restricts reset access to administrator identities and roles', () => {
    component.currentUser = { userid: 'cashier1', accnttype: 'Cashier' };
    expect(component.isAdmin).toBeFalse();

    component.currentUser = { accnttype: 'admin' };
    expect(component.isAdmin).toBeFalse();

    component.currentUser = { usern: 'VMJAMADMIN' };
    expect(component.isAdmin).toBeTrue();

    component.currentUser = { accnttype: 'Administrator' };
    expect(component.isAdmin).toBeTrue();
  });

  it('describes cross-module reset effects in the impact notes', () => {
    const notes = component.generateImpactNotes(['sales']);

    expect(notes).toContain('creditpaymenttbl');
    expect(notes).toContain('customer balances set to 0');
    expect(notes).toContain('Active lends will be cleared');
    expect(notes).toContain('queued POS carts removed');
  });

  it('loads the persisted receipt logo setting', async () => {
    appdateService.getAllAppdate.and.resolveTo([
      {
        appdateid: 1,
        Bname: 'Store',
        Baddress: 'Address',
        ReceiptContactInfo: '',
        Blogo: null,
        withlogo: 'Y',
      },
    ]);

    await component.loadSettings();

    expect(component.withlogo).toBeTrue();
  });

  it('defaults logo printing to off when the setting is missing', async () => {
    appdateService.getAllAppdate.and.resolveTo([
      {
        appdateid: 1,
        Bname: 'Store',
        Baddress: 'Address',
        ReceiptContactInfo: '',
        Blogo: null,
      },
    ]);

    await component.loadSettings();

    expect(component.withlogo).toBeFalse();
  });

  it('saves the disabled logo setting without changing its Y/N contract', async () => {
    component.appdateid = 1;
    component.withlogo = false;
    appdateService.updateBusinessSettings.and.resolveTo();

    await component.saveSettings();

    expect(appdateService.updateBusinessSettings).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ withlogo: 'N' })
    );
    const savedSettings = appdateService.updateBusinessSettings.calls.mostRecent().args[1];
    expect('ReceiptContactInfo1' in savedSettings).toBeFalse();
    expect('ReceiptContactInfo2' in savedSettings).toBeFalse();
  });

  it('asks for confirmation before saving Business Settings', async () => {
    component.appdateid = 1;
    appdateService.updateBusinessSettings.and.resolveTo();

    await component.saveSettings();

    expect(alertController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        header: 'Confirm Save',
        message: 'Are you sure you want to save the Business Settings?',
      })
    );
    expect(appdateService.updateBusinessSettings).toHaveBeenCalled();
  });

  it('does not save Business Settings when confirmation is canceled', async () => {
    alertController.create.and.resolveTo({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: 'cancel' }),
    } as any);
    component.appdateid = 1;

    await component.saveSettings();

    expect(appdateService.updateBusinessSettings).not.toHaveBeenCalled();
    expect(appdateService.insert).not.toHaveBeenCalled();
  });
});

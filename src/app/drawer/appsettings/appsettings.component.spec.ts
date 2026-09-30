import { ModalController } from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { AppsettingsComponent } from './appsettings.component';

describe('AppsettingsComponent', () => {
  let appdateService: jasmine.SpyObj<AppdateService>;
  let component: AppsettingsComponent;

  beforeEach(() => {
    appdateService = jasmine.createSpyObj<AppdateService>('AppdateService', [
      'getAllAppdate',
      'insert',
      'updateBusinessSettings',
    ]);
    component = new AppsettingsComponent(
      appdateService,
      {} as ModalController
    );
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
});

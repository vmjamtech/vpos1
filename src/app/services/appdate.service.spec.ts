import {
  AppdateService,
  normalizeReceiptLogo,
} from './appdate.service';

describe('normalizeReceiptLogo', () => {
  it('keeps existing image data URLs', () => {
    const dataUrl = 'data:image/jpeg;base64,AQI=';
    expect(normalizeReceiptLogo(dataUrl)).toBe(dataUrl);
  });

  it('normalizes base64 strings and byte arrays', () => {
    expect(normalizeReceiptLogo('AQI=')).toBe('data:image/png;base64,AQI=');
    expect(normalizeReceiptLogo([1, 2])).toBe('data:image/png;base64,AQI=');
  });

  it('normalizes legacy Buffer-shaped logo data', () => {
    expect(normalizeReceiptLogo({ type: 'Buffer', data: [1, 2] })).toBe(
      'data:image/png;base64,AQI='
    );
  });

  it('returns null for missing or unsupported logo data', () => {
    expect(normalizeReceiptLogo(null)).toBeNull();
    expect(normalizeReceiptLogo({ data: 'not bytes' })).toBeNull();
  });
});

describe('AppdateService.getReceiptBusinessInfo', () => {
  it('returns all Slip Layout fields and preserves blank optional fields', async () => {
    const service = Object.create(AppdateService.prototype) as AppdateService;
    spyOn(service, 'getAllAppdate').and.resolveTo([
      {
        appdateid: 7,
        ReceiptBname: 'Business',
        ReceiptBname1: 'Second line',
        ReceiptAddress: 'Address 1',
        ReceiptAddress1: 'Address 2',
        ReceiptContactInfo: 'Contact 1',
        ReceiptContactInfo1: '',
        ReceiptContactInfo2: 'Contact 3',
        withlogo: 'Y',
        Blogo: 'AQI=',
      },
    ]);

    await expectAsync(service.getReceiptBusinessInfo()).toBeResolvedTo({
      appdateid: 7,
      compName: 'Business',
      compName1: 'Second line',
      receiptAddress: 'Address 1',
      receiptAddress1: 'Address 2',
      compContact: 'Contact 1',
      compContact1: '',
      compContact2: 'Contact 3',
      receiptEndGreet: '',
      withLogo: true,
      logoDataUrl: 'data:image/png;base64,AQI=',
    });
  });

  it('falls back to legacy business fields when Slip Layout fields are absent', async () => {
    const service = Object.create(AppdateService.prototype) as AppdateService;
    spyOn(service, 'getAllAppdate').and.resolveTo([
      {
        Bname: 'Legacy business',
        Baddress: 'Legacy address',
        ReceiptPosName: 'Legacy contact',
      },
    ]);

    const info = await service.getReceiptBusinessInfo();

    expect(info.compName).toBe('Legacy business');
    expect(info.receiptAddress).toBe('Legacy address');
    expect(info.compContact).toBe('Legacy contact');
    expect(info.withLogo).toBeFalse();
    expect(info.logoDataUrl).toBeNull();
  });
});
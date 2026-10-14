import { AlertController } from '@ionic/angular/standalone';
import { AppdateService } from './appdate.service';
import { IminPrinterService } from './imin-printer.service';
import { buildSalesReceiptLines, PrinterService } from './printer.service';
import { StorageService } from './storage.service';

describe('PrinterService', () => {
  const sampleSalesReceipt = (birEnabled: boolean) =>
    buildSalesReceiptLines({
      businessInfo: {
        compName: 'Business',
        compName1: 'Second line',
        receiptAddress: 'Address',
        receiptAddress1: '',
        compContact: 'Contact',
        compContact1: '',
        compContact2: '',
        receiptEndGreet: '',
        withLogo: false,
        logoDataUrl: null,
        birEnabled,
        tin: '123',
        min: '456',
        sn: '789',
      },
      invoiceNo: 'S-1',
      date: '2026-10-14',
      cashier: 'Cashier',
      personnel: 'Staff',
      customer: 'Customer',
      items: [{ name: 'ITEM', qty: 1, total: 100 }],
      subTotal: 100,
      totalItemsCount: 1,
      discountType: 'regular',
      discountAmount: 10,
      totalAmount: 90,
      cashTendered: 100,
      change: 10,
      vatableSales: 80.36,
      vatAmount: 9.64,
    });

  it('builds a 30-character BIR-off receipt without tax or registration rows', () => {
    const lines = sampleSalesReceipt(false);
    const text = lines.map((line) => line.text);
    const isWithinReceiptWidth = (line: string) =>
      line === '-'.repeat(48) ||
      line.split('\n').every((part) => part.length <= 30);

    expect(lines.every((line) => isWithinReceiptWidth(line.text))).toBeTrue();
    expect(text).toContain('-'.repeat(48));
    expect(text.some((line) => line.includes('Total Amount:'))).toBeTrue();
    expect(text.some((line) => line.includes('Discount:'))).toBeTrue();
    expect(text.some((line) => line.includes('TIN:'))).toBeFalse();
    expect(text.some((line) => line.includes('Vatable Sales:'))).toBeFalse();
    expect(text.some((line) => line.includes('VAT Amount'))).toBeFalse();
    expect(text).toContain('THANK YOU, PLEASE COME');
    expect(text).toContain('AGAIN!');
    expect(lines.filter((line) => line.alignment === 1).length).toBeGreaterThan(0);
  });

  it('builds a BIR receipt with registration and a single-line tax breakdown', () => {
    const lines = sampleSalesReceipt(true);
    const text = lines.map((line) => line.text);

    expect(
      lines.every(
        (line) =>
          line.text === '-'.repeat(48) ||
          line.text.split('\n').every((part) => part.length <= 30)
      )
    ).toBeTrue();
    expect(text.some((line) => line.includes('TIN: 123'))).toBeTrue();
    expect(text.some((line) => line.includes('MIN: 456'))).toBeTrue();
    expect(text.some((line) => line.includes('SN: 789'))).toBeTrue();
    expect(text.some((line) => line.includes('Vatable Sales:'))).toBeTrue();
    expect(text.some((line) => line.includes('VAT Amount:'))).toBeTrue();
    expect(text.some((line) => line.includes('VAT Exempt Sales:'))).toBeTrue();
    expect(text.some((line) => line.includes('Zero Rated Sales:'))).toBeTrue();
    expect(text.some((line) => line.includes('Non-Vatable Sales'))).toBeFalse();
    expect(text.some((line) => line.includes('VAT-Amount'))).toBeFalse();
    expect(lines.filter((line) => line.alignment === 1).length).toBeGreaterThan(0);
  });

  it('builds a fixed-width coupon body and reserves the final slot as the reward', () => {
    const service = new PrinterService(
      {} as AlertController,
      {} as IminPrinterService,
      {} as AppdateService,
      {} as StorageService
    );
    const lines = service.buildCouponCard(50, 10);

    expect(lines.every((line) => line.length === 42)).toBeTrue();
    expect(lines.filter((line) => line.includes('(   ) SLOT')).length).toBe(9);
    expect(lines.some((line) => line.includes('CLAIM DISCOUNT'))).toBeTrue();
    expect(lines.some((line) => line.includes('Get 1 stamp per order.'))).toBeTrue();
    expect(lines.some((line) => line.includes('Collect 10, get ₱50 OFF!'))).toBeTrue();
    const rewardRows = lines.filter((line) =>
      line.includes('CLAIM DISCOUNT') || line.includes('PESOS OFF')
    );
    expect(rewardRows.length).toBe(2);
    expect(rewardRows.every((line) => line.startsWith('|') && line.endsWith('|'))).toBeTrue();
    expect(rewardRows.reduce((count, line) => count + (line.match(/\|/g)?.length ?? 0), 0)).toBe(4);
    expect(() => service.buildCouponCard(50, 11)).toThrowError();
  });

  it('waits for image loading and printer image output to finish', async () => {
    const image = {
      src: '',
      onload: null,
      onerror: null,
    } as unknown as HTMLImageElement;
    spyOn(window, 'Image').and.returnValue(image);

    spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue({
      drawImage: jasmine.createSpy('drawImage'),
    } as unknown as CanvasRenderingContext2D);
    spyOn(HTMLCanvasElement.prototype, 'toDataURL').and.returnValue(
      'data:image/png;base64,AA=='
    );

    let finishImagePrint!: () => void;
    const printImage = jasmine.createSpy('printImage').and.callFake(
      () =>
        new Promise<void>((resolve) => {
          finishImagePrint = resolve;
        })
    );
    const printer = {
      connect: async () => true,
      initPrinter: async () => undefined,
      printText: async () => undefined,
      printImage,
      cutPaper: async () => undefined,
    };
    const alertController = {
      create: async () => ({ present: async () => undefined }),
    };
    let logoEnabled = true;
    const service = new PrinterService(
      alertController as unknown as AlertController,
      printer as unknown as IminPrinterService,
      {
        getReceiptBusinessInfo: async () => ({ withLogo: true }),
      } as unknown as AppdateService,
      {} as StorageService
    );

    let complete = false;
    const printing = service
      .printPreviewToPrinter([
        { type: 'image', value: 'data:image/png;base64,AA==' },
      ])
      .then(() => {
        complete = true;
      });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(image.src).toBe('data:image/png;base64,AA==');
    expect(complete).toBeFalse();

    image.onload?.(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(printImage).toHaveBeenCalled();
    expect(complete).toBeFalse();

    finishImagePrint();
    await printing;
    expect(complete).toBeTrue();
  });

  it('does not print an image when the saved Logo setting is OFF', async () => {
    const printImage = jasmine.createSpy('printImage').and.resolveTo(undefined);
    const printText = jasmine.createSpy('printText').and.resolveTo(undefined);
    const printer = {
      connect: async () => true,
      initPrinter: async () => undefined,
      printText,
      printImage,
      cutPaper: async () => undefined,
    };
    const alertController = {
      create: async () => ({ present: async () => undefined }),
    };
    const service = new PrinterService(
      alertController as unknown as AlertController,
      printer as unknown as IminPrinterService,
      {
        getReceiptBusinessInfo: async () => ({ withLogo: false }),
      } as unknown as AppdateService,
      {} as StorageService
    );

    await service.printPreviewToPrinter([
      { type: 'image', value: 'data:image/png;base64,AA==' },
      { type: 'text', value: 'Receipt header' },
    ]);

    expect(printImage).not.toHaveBeenCalled();
    expect(printText).toHaveBeenCalledWith('Receipt header', 1);
  });

  it('reprints a sale with a base64 logo and all saved header fields', async () => {
    const image = {
      src: '',
      onload: null,
      onerror: null,
    } as unknown as HTMLImageElement;
    spyOn(window, 'Image').and.returnValue(image);
    spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue({
      drawImage: jasmine.createSpy('drawImage'),
    } as unknown as CanvasRenderingContext2D);
    spyOn(HTMLCanvasElement.prototype, 'toDataURL').and.returnValue(
      'data:image/png;base64,AA=='
    );

    const printText = jasmine.createSpy('printText').and.resolveTo(undefined);
    const printImage = jasmine.createSpy('printImage').and.resolveTo(undefined);
    const printer = {
      connect: async () => true,
      initPrinter: async () => undefined,
      getPrinterStatus: async () => ({ text: 'The printer is normal' }),
      printText,
      printTextLineOptional: async () => undefined,
      printImage,
      setAlignment: async () => undefined,
      setTextSize: async () => undefined,
      setTextTypeface: async () => undefined,
      setTextStyle: async () => undefined,
      feedPaper: async () => undefined,
      cutPaper: async () => undefined,
    };
    const alertController = {
      create: async () => ({ present: async () => undefined }),
    };
    let logoEnabled = true;
    const service = new PrinterService(
      alertController as unknown as AlertController,
      printer as unknown as IminPrinterService,
      {
        getReceiptBusinessInfo: async () => ({
          compName: 'Business',
          compName1: 'Second line',
          receiptAddress: 'Address 1',
          receiptAddress1: 'Address 2',
          compContact: 'Contact 1',
          compContact1: 'Contact 2',
          compContact2: 'Contact 3',
          receiptEndGreet: '',
          withLogo: logoEnabled,
          logoDataUrl: logoEnabled ? 'data:image/png;base64,AQI=' : null,
        }),
      } as unknown as AppdateService,
      {} as StorageService
    );

    const printing = service.rePrintReceipt(
      {
        salesrefnum: 'S-1',
        salestotalamount: 10,
        salestotalitem: 1,
        salesdisc: 0,
        salespaym: 'CASH',
        salestender: 10,
        saleschange: 0,
        salessub: 10,
        salesvat: 0,
        salescashier: 'Cashier',
        salesdate: '2026-09-30',
        salescat: 'Retail',
        salesdelby: 'Staff',
        salescust: 'Customer',
      },
      [{ scqty: 1, scitemcode: 'ITEM', sctotal: '10.00' }]
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(image.src).toBe('data:image/png;base64,AQI=');
    image.onload?.(new Event('load'));
    await printing;

    logoEnabled = false;
    await service.rePrintReceipt(
      {
        salesrefnum: 'S-1',
        salestotalamount: 10,
        salestotalitem: 1,
        salesdisc: 0,
        salespaym: 'CASH',
        salestender: 10,
        saleschange: 0,
        salessub: 10,
        salesvat: 0,
        salescashier: 'Cashier',
        salesdate: '2026-09-30',
        salescat: 'Retail',
        salesdelby: 'Staff',
        salescust: 'Customer',
      },
      [{ scqty: 1, scitemcode: 'ITEM', sctotal: '10.00' }]
    );

    expect(printImage).toHaveBeenCalled();
    expect(printImage).toHaveBeenCalledTimes(1);
    expect(
      printText.calls.allArgs().some(([line, alignment]) =>
        String(line).includes('Address 1') && alignment === 1
      )
    ).toBeTrue();
    expect(
      printText.calls.allArgs().some(([line, alignment]) =>
        String(line).includes('Address 2') && alignment === 1
      )
    ).toBeTrue();
    expect(
      printText.calls.allArgs().some(([line, alignment]) =>
        String(line).includes('Contact 3') && alignment === 1
      )
    ).toBeTrue();
  });
});
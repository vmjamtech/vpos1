import { AlertController } from '@ionic/angular/standalone';
import { AppdateService } from './appdate.service';
import { IminPrinterService } from './imin-printer.service';
import { PrinterService } from './printer.service';
import { StorageService } from './storage.service';

describe('PrinterService', () => {
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
    expect(printText).toHaveBeenCalledWith('Address 1', 1);
    expect(printText).toHaveBeenCalledWith('Address 2', 1);
    expect(printText).toHaveBeenCalledWith('Contact 3', 1);
  });
});
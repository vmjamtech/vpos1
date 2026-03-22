// @ts-ignore
import * as iminprinter from '../../assets/prt/iminprinter/x-imin-printer.js';
import moment from 'moment';

// -------------------- TYPES ---------------------

type PrinterStatus =
  | 'Printer Not Ready'
  | 'Printer Ready'
  | 'Printer Open'
  | 'Printer No Paper'
  | 'Printer Paper Running Out'
  | 'Other Error';

interface PrintStructure {
  title: string;
  message: string;
  flagone: string;
}

interface Flags {
  flagone?: string;
}

interface PrinterReturnValue {
  ErrCode: number;
  ErrMsg: string;
}

interface NetworkConfig {
  url: string;
  ip: string;
}

interface PrinterOptions {
  network: boolean;
}

type CommandFunction = (instance: any) => void | Promise<void>;

// --------------------------------------------------

const COMMAND_MAP: Record<string, CommandFunction> = {
  '\x1B\x61\x00': (instance) => instance.setAlignment(0),
  '\x1B\x61\x01': (instance) => instance.setAlignment(1),
  '\x1B\x61\x02': (instance) => instance.setAlignment(2),

  '\x1F\x70\x01': (instance) => instance.setTextSize(22),
  '\x1F\x70\x02': (instance) => instance.setTextSize(28),
  '\x1F\x70\x03': (instance) => instance.setTextSize(32),

  '\x1B\x4D\x00': (instance) => instance.setTextTypeface(0),
  '\x1B\x4D\x01': (instance) => instance.setTextTypeface(1),
  '\x1B\x4D\x02': (instance) => instance.setTextTypeface(2),
  '\x1B\x4D\x03': (instance) => instance.setTextTypeface(3),
  '\x1B\x4D\x04': (instance) => instance.setTextTypeface(4),

  '\x1B\x45\x01': (instance) => instance.setTextStyle(1),
  '\x1B\x45\x00': (instance) => instance.setTextStyle(0),
  '\x1B\x20\x01': (instance) => instance.setTextStyle(2),
  '\x1B\x20\x00': (instance) => instance.setTextStyle(0),

  '\x1B\x33\x00': (instance) => instance.setTextLineSpacing(1.0),
  '\x1B\x33\x01': (instance) => instance.setTextLineSpacing(1.5),
  '\x1B\x33\x02': (instance) => instance.setTextLineSpacing(2.0),

  '\x1D\x56\x42\x00': (instance) => instance.partialCut(),
};

const commandRegex = new RegExp(
  Object.keys(COMMAND_MAP)
    .map((key) => `(${key})`)
    .join('|'),
  'g'
);

// --------------------------------------------------

class clsPrint {
  public printOutStructure: PrintStructure = {
    title: '',
    message: '',
    flagone: '',
  };

  private options: PrinterOptions = { network: false };

  public networkConfig: NetworkConfig = { url: '', ip: '127.0.0.1' };

  private retval: PrinterReturnValue = { ErrCode: 0, ErrMsg: '' };

  public localPrinterIp: string = '127.0.0.1';

  IminPrintInstance!: any;

  // ------------------------ INITIALIZATION ------------------------

  private async initializePrinter(): Promise<void> {
    this.IminPrintInstance = new (iminprinter as any)(this.localPrinterIp);
    console.log('Printer Initialized');
  }

  // ------------------------ GET STATUS ------------------------

  private async getLocalPrinterStatus(instance: any): Promise<PrinterStatus> {
    return new Promise(async (resolve) => {
      setTimeout(async () => {
        const status = await instance.getPrinterStatus();
        let response: PrinterStatus;

        switch (status.value) {
          case -1:
            response = 'Printer Not Ready';
            break;
          case 0:
            response = 'Printer Ready';
            break;
          case 3:
            response = 'Printer Open';
            break;
          case 7:
            response = 'Printer No Paper';
            break;
          case 8:
            response = 'Printer Paper Running Out';
            break;
          default:
            response = 'Other Error';
            break;
        }

        resolve(response);
      }, 2000);
    });
  }

  // ------------------------ LOCAL PRINT ------------------------

  private localPrinterTextPrint(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.IminPrintInstance.setAlignment(1);

        this.IminPrintInstance.printText(
          moment().format('MM/DD/YYYY HH:mm') +
            (this.printOutStructure.flagone !== ''
              ? this.printOutStructure.flagone
              : '') +
            'n',
          0
        );

        this.IminPrintInstance.printAndFeedPaper(30);
        this.IminPrintInstance.setAlignment(1);
        this.IminPrintInstance.setTextSize(60);
        this.IminPrintInstance.printText(this.printOutStructure.title + 'n', 0);

        this.IminPrintInstance.setAlignment(1);
        this.IminPrintInstance.setTextStyle(1);
        this.IminPrintInstance.setTextSize(120);
        this.IminPrintInstance.printText(
          this.printOutStructure.message + 'n',
          0
        );

        this.IminPrintInstance.setTextSize(60);
        this.IminPrintInstance.printText('----' + 'n', 0);
        this.IminPrintInstance.printAndFeedPaper(150);

        resolve(true);
      } catch (error: any) {
        this.retval.ErrCode = -1;
        this.retval.ErrMsg = error?.message || 'Unknown error';
        resolve(false);
      }
    });
  }

  private printLocalPrinter(): Promise<PrinterReturnValue> {
    return new Promise((resolve) => {
      try {
        this.initializePrinter();

        this.IminPrintInstance.connect().then(async (isConnect: boolean) => {
          if (isConnect) {
            this.IminPrintInstance.initPrinter();

            const status = await this.getLocalPrinterStatus(
              this.IminPrintInstance
            );

            if (status === 'Printer Ready') {
              const isPrinted = await this.localPrinterTextPrint();
              if (isPrinted) {
                this.IminPrintInstance.partialCut();
                return resolve(this.retval);
              }
            } else {
              this.retval.ErrCode = -1;
              this.retval.ErrMsg = status;
              return resolve(this.retval);
            }
          }
        });
      } catch (error: any) {
        this.retval.ErrCode = -1;
        this.retval.ErrMsg = error?.message || 'Unknown error';
        resolve(this.retval);
      }
    });
  }

  // ------------------------ CHECK PRINTER ------------------------

  checkLocalPrinter(): Promise<string> {
    return new Promise((resolve) => {
      this.initializePrinter();

      this.IminPrintInstance.connect().then(async (isConnect: boolean) => {
        if (isConnect) {
          this.IminPrintInstance.initPrinter();
          const status = await this.getLocalPrinterStatus(
            this.IminPrintInstance
          );

          this.options.network = status !== 'Printer Ready';

          resolve('Done');
        }
      });
    });
  }

  // ------------------------ PRINT TABLE NUMBER ------------------------

  public printTableNumber(
    title: string,
    message: string,
    flags: Flags
  ): Promise<PrinterReturnValue> {
    return new Promise(async (resolve) => {
      this.retval = { ErrCode: 0, ErrMsg: '' };

      this.printOutStructure.flagone = flags.flagone || '';
      this.printOutStructure.title = title;
      this.printOutStructure.message = message;

      const reservedTableNumber = message;

      if (this.options.network === undefined) {
        await this.checkLocalPrinter();
      }

      if (this.options.network) {
        this.printNetwork(reservedTableNumber).then(() => resolve(this.retval));
      } else {
        this.printLocalPrinter().then(() => resolve(this.retval));
      }
    });
  }

  // ------------------------ NETWORK PRINT ------------------------

  public async printNetwork(ordernum: string): Promise<boolean> {
    const body = [{ tableNo: ordernum }];

    const response = await fetch(this.networkConfig.url + '/api/printQR', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await response.json();

    if (json['ErrCode'] === 0) {
      this.retval.ErrCode = 0;
      this.retval.ErrMsg = '';
      return true;
    } else {
      this.retval.ErrCode = -1;
      this.retval.ErrMsg = 'network printer failed';
      return false;
    }
  }

  // ------------------------ PRINT ESC/POS TEXT ------------------------

  async printText(rcptTxt: string): Promise<string> {
    console.log('PRINT TRACER', rcptTxt);

    try {
      const instance = new (iminprinter as any)(this.localPrinterIp);

      const isConnected = await this.promiseTimeout(5000, instance.connect());

      if (!isConnected) return 'Cannot Connect To Printer';

      await instance.initPrinter();

      for (let retry = 1; retry <= 3; retry++) {
        const status = await this.getLocalPrinterStatus(instance);

        if (status !== 'Printer Ready') {
          if (retry < 3) continue;
          return status;
        }

        const parts = rcptTxt.split(commandRegex).filter(Boolean);

        for (const part of parts) {
          if (COMMAND_MAP[part]) {
            await COMMAND_MAP[part](instance);
          } else {
            await instance.setTextSize(16);
            await instance.setTextTypeface(1);
            await instance.printText(part);
          }
        }

        await instance.printAndFeedPaper(120);
        return 'SUCCESS';
      }

      return 'Unknown Error';
    } catch (error: any) {
      console.error('An error occurred:', error);
      return error?.message || JSON.stringify(error);
    }
  }

  // ------------------------ UTILITY ------------------------

  private promiseTimeout(ms: number, promise: Promise<any>): Promise<any> {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject('Cannot Connect To Printer'), ms)
      ),
    ]);
  }
}

export default clsPrint;

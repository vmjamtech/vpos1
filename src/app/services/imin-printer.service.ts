import { Injectable } from '@angular/core';
declare const require: any;
const IminPrinter = require('../../assets/prt/iminprinter/x-imin-printer.js');

@Injectable({
  providedIn: 'root',
})
export class IminPrinterService {
  private printerInstance: any;

  constructor() {
    this.printerInstance = new IminPrinter('127.0.0.1');
  }

  // -------------------------------------------------------
  // Check printer server
  // -------------------------------------------------------
  async checkServer(): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:8081/websocket');
      let resolved = false;

      ws.onopen = () => {
        resolved = true;
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 1000);
    });
  }

  // -------------------------------------------------------
  // Connect printer
  // -------------------------------------------------------
  async connect(): Promise<boolean> {
    const serverOnline = await this.checkServer();
    if (!serverOnline) {
      console.warn('iMin Printer server not running.');
      return false;
    }

    try {
      const result = await this.printerInstance.connect();
      if (result !== true) return false;

      console.log('iMin Printer connected');
      return true;
    } catch (error) {
      console.error('iMin Printer connect error:', error);
      return false;
    }
  }

  // -------------------------------------------------------
  // BASIC CONTROLS
  // -------------------------------------------------------
  async initPrinter(connectType?: string): Promise<void> {
    return this.printerInstance.initPrinter(connectType);
  }

  async printText(text: string, type?: number): Promise<void> {
    return this.printerInstance.printText(text, type);
  }

  async printTextLineOptional(
    text: string,
    type?: number,
    addNewLine: boolean = true
  ): Promise<void> {
    return this.printerInstance.printTextOptional(text, type, addNewLine);
  }

  async printImage(bitmap: string, alignmentMode = 1): Promise<void> {
    return this.printerInstance.printSingleBitmap(bitmap, alignmentMode);
  }

  async cutPaper(): Promise<void> {
    return this.printerInstance.partialCut();
  }

  async getPrinterStatus() {
    return this.printerInstance.getPrinterStatus();
  }

  async feedPaper(lines: number = 3): Promise<void> {
    return this.printerInstance.printAndFeedPaper(lines);
  }

  // -------------------------------------------------------
  // ADVANCED TEXT FORMATTING (NEW!)
  // -------------------------------------------------------

  async setAlignment(align: number): Promise<void> {
    // 0 = left, 1 = center, 2 = right
    return this.printerInstance.setAlignment(align);
  }

  async setTextSize(size: number): Promise<void> {
    return this.printerInstance.setTextSize(size);
  }

  async setTextTypeface(typeface: number): Promise<void> {
    return this.printerInstance.setTextTypeface(typeface);
  }

  async setTextStyle(style: number): Promise<void> {
    // 0 NORMAL, 1 BOLD, 2 ITALIC, 3 BOLD_ITALIC
    return this.printerInstance.setTextStyle(style);
  }

  async setLineSpacing(space: number): Promise<void> {
    return this.printerInstance.setTextLineSpacing(space);
  }

  async setPrintWidth(width: number): Promise<void> {
    // 576 for 80mm printers, 384 for 58mm
    return this.printerInstance.setTextWidth(width);
  }

  // -------------------------------------------------------
  // PRINT COLUMNS (TABLE)
  // -------------------------------------------------------
  async printColumnsText(
    colTextArr: string[],
    colWidthArr: number[],
    colAlignArr: number[],
    size: number[] = [0, 0, 0], // must match number of columns
    width: number = 576
  ): Promise<void> {
    return this.printerInstance.printColumnsText(
      colTextArr,
      colWidthArr,
      colAlignArr,
      size,
      width
    );
  }
}

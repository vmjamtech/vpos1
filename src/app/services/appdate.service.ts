import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import Toastify from 'toastify-js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { App } from '@capacitor/app';
import { LoadingController, ToastController } from '@ionic/angular/standalone';
import { SqliteService } from './sqlite.service';
import { apiBaseUrl } from './api-url';

export interface AppVersionInfo {
  version: string;
  versionCode: number;
  releaseNotes: string;
  apkUrl: string;
}

export interface ReceiptBusinessInfo {
  appdateid?: number;
  compName: string;
  compName1: string;
  receiptAddress: string;
  receiptAddress1: string;
  compContact: string;
  compContact1: string;
  compContact2: string;
  receiptEndGreet: string;
  withLogo: boolean;
  logoDataUrl: string | null;
}

export function normalizeReceiptLogo(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    return normalized.startsWith('data:image/')
      ? normalized
      : `data:image/png;base64,${normalized}`;
  }

  let bytes: unknown = value;
  if (
    typeof value === 'object' &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value)
  ) {
    bytes = (value as { data?: unknown }).data ?? value;
  }

  let byteArray: Uint8Array;
  if (bytes instanceof ArrayBuffer) {
    byteArray = new Uint8Array(bytes);
  } else if (ArrayBuffer.isView(bytes)) {
    byteArray = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  } else if (
    Array.isArray(bytes) &&
    bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    byteArray = Uint8Array.from(bytes);
  } else {
    return null;
  }

  let binary = '';
  for (let offset = 0; offset < byteArray.length; offset += 8192) {
    binary += String.fromCharCode(...byteArray.subarray(offset, offset + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

@Injectable({
  providedIn: 'root',
})
export class AppdateService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private fileOpener: FileOpener,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private db: SqliteService
  ) {}

  async getAppdate(): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `${apiBaseUrl(connection.ip, connection.port)}/appdate`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }

  async getAllAppdate(): Promise<any[]> {
    const sql = `SELECT * FROM appdate`;

    try {
      return await this.db.query(sql);
    } catch (error) {
      console.error('Error fetching appdate:', error);
      throw new Error('Failed to load appdate.');
    }
  }

  async getReceiptBusinessInfo(): Promise<ReceiptBusinessInfo> {
    const row = (await this.getAllAppdate())[0] ?? {};

    return {
      appdateid: row.appdateid,
      compName: row.ReceiptBname ?? row.Bname ?? '',
      compName1: row.ReceiptBname1 ?? '',
      receiptAddress: row.ReceiptAddress ?? row.Baddress ?? '',
      receiptAddress1: row.ReceiptAddress1 ?? '',
      compContact: row.ReceiptContactInfo ?? row.ReceiptPosName ?? '',
      compContact1: row.ReceiptContactInfo1 ?? '',
      compContact2: row.ReceiptContactInfo2 ?? '',
      receiptEndGreet: row.receiptendgreet ?? '',
      withLogo: row.withlogo === 'Y',
      logoDataUrl: normalizeReceiptLogo(row.Blogo),
    };
  }

  async insert(data: {
    Bname: string;
    Baddress: string;
    ReceiptPosName: string;
    ReceiptContactInfo?: string;
    ReceiptContactInfo1?: string;
    ReceiptContactInfo2?: string;
    withlogo?: string;
    Blogo?: string | null; // keep as base64 string
  }): Promise<number> {
    let blogoBlob: Uint8Array | null = null;

    if (data.Blogo && data.Blogo.startsWith('data:image')) {
      const base64 = data.Blogo.split(',')[1];
      const binary = atob(base64);
      blogoBlob = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        blogoBlob[i] = binary.charCodeAt(i);
      }
    }

    const contactInfo = data.ReceiptContactInfo?.trim() || data.ReceiptPosName?.trim() || '';
    const sql = `
    INSERT INTO appdate (Bname, Baddress, ReceiptPosName, ReceiptContactInfo, ReceiptContactInfo1, ReceiptContactInfo2, Blogo, withlogo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const id = await this.db.insert(sql, [
      data.Bname,
      data.Baddress,
      data.ReceiptPosName,
      contactInfo,
      data.ReceiptContactInfo1 || '',
      data.ReceiptContactInfo2 || '',
      blogoBlob,
      data.withlogo ?? 'N',
    ]);

    return id;
  }

  async updateBusinessSettings(
    id: number,
    data: {
      Bname: string;
      Baddress: string;
      RecieptVATreg: string;
      ReceiptPosName: string;
      ReceiptContactInfo?: string;
      withlogo?: string;
      Blogo?: Blob | string | null; // Blob if picked from file, string if already base64
    }
  ) {
    let blogoBlob: string | null = null;

    if (data.Blogo instanceof Blob) {
      blogoBlob = await this.fileToBase64(data.Blogo);
    } else if (typeof data.Blogo === 'string') {
      blogoBlob = data.Blogo;
    }

    const Bname = data.Bname?.trim() || 'N/A';
    const Baddress = data.Baddress?.trim() || 'N/A';
    const ReceiptPosName = data.ReceiptPosName?.trim() || '';
    const ReceiptContactInfo = data.ReceiptContactInfo?.trim() || ReceiptPosName;
    const RecieptVATreg = data.RecieptVATreg?.trim() || 'N/A';

    const sql = `
    UPDATE appdate
    SET Bname = ?, Baddress = ?, ReceiptPosName = ?, ReceiptContactInfo = ?, Blogo = ?, receiptlogo = ?, withlogo = COALESCE(?, withlogo), RecieptVATreg = ?
    WHERE appdateid = ?
  `;

    try {
      const result = await this.db.execute(sql, [
        Bname,
        Baddress,
        ReceiptPosName,
        ReceiptContactInfo,
        blogoBlob,
        blogoBlob,
        data.withlogo ?? null,
        RecieptVATreg,
        id,
      ]);
    } catch (err) {
      console.error('Update error:', err);
    }
  }

  async updateReceiptLayout(
    id: number,
    data: {
      ReceiptBname: string;
      ReceiptBname1: string;
      ReceiptAddress: string;
      ReceiptAddress1: string;
      ReceiptContactInfo: string;
      ReceiptContactInfo1: string;
      ReceiptContactInfo2: string;
      Blogo?: Blob | string | null;
    }
  ) {
    try {
      let blogoBase64: string | null = null;

      // Convert Blob to Base64 if needed
      if (data.Blogo instanceof Blob) {
        blogoBase64 = await this.fileToBase64(data.Blogo);
      } else if (typeof data.Blogo === 'string') {
        blogoBase64 = data.Blogo;
      }

      // Prepare SQL with all fields
      const sql = `
      UPDATE appdate
      SET 
        ReceiptBname = ?, 
        ReceiptBname1 = ?,
        ReceiptAddress = ?, 
        ReceiptAddress1 = ?,
        ReceiptContactInfo = ?,
        ReceiptContactInfo1 = ?,
        ReceiptContactInfo2 = ?,
        Blogo = ?
      WHERE appdateid = ?
    `;

      const params = [
        data.ReceiptBname?.trim() || 'N/A',
        data.ReceiptBname1?.trim() || '',
        data.ReceiptAddress?.trim() || 'N/A',
        data.ReceiptAddress1?.trim() || '',
        data.ReceiptContactInfo?.trim() || '',
        data.ReceiptContactInfo1?.trim() || '',
        data.ReceiptContactInfo2?.trim() || '',
        blogoBase64,
        id,
      ];

      const result = await this.db.execute(sql, params);
      console.log('Update successful', result);
    } catch (err) {
      console.error('Update error:', err);
    }
  }

  async showToastjs(
    msg: string,
    color: 'success' | 'primary' | 'danger' | 'warning' = 'success',
    position: 'top' | 'bottom' = 'top',
    duration: number = 2000 // default 2s
  ): Promise<void> {
    let background = '#08510bff'; // success
    if (color === 'primary') background = '#2196f3';
    if (color === 'danger') background = '#f44336';
    if (color === 'warning') background = '#ff9800';

    Toastify({
      text: msg,
      duration,
      gravity: position,
      position: 'center',
      style: {
        background,
        borderRadius: '8px',
        padding: '8px 16px',
        color: '#fff',
        fontWeight: '500',
      },
      offset: {
        x: 0,
        y: 20,
      },
    }).showToast();
  }

  // Convert base64 string to Uint8Array
  fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file); // Result will be a Data URL (e.g., "data:image/png;base64,...")
    });
  };
}

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

export interface AppVersionInfo {
  version: string;
  versionCode: number;
  releaseNotes: string;
  apkUrl: string;
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

    const url = `http://${connection.ip}:${connection.port}/appdate`;

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

  async insert(data: {
    Bname: string;
    Baddress: string;
    ReceiptPosName: string;
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

    const sql = `
    INSERT INTO appdate (Bname, Baddress, ReceiptPosName, Blogo)
    VALUES (?, ?, ?, ?)
  `;

    const id = await this.db.insert(sql, [
      data.Bname,
      data.Baddress,
      data.ReceiptPosName,
      blogoBlob,
    ]);

    return id;
  }

  async update(
    id: number,
    data: {
      Bname: string;
      Baddress: string;
      RecieptVATreg: string;
      ReceiptPosName: string;
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
    const ReceiptPosName = data.ReceiptPosName?.trim() || null;
    const RecieptVATreg = data.RecieptVATreg?.trim() || 'N/A';

    const sql = `
    UPDATE appdate
    SET Bname = ?, Baddress = ?, ReceiptPosName = ?, Blogo = ?, receiptlogo = ?, RecieptVATreg = ?
    WHERE appdateid = ?
  `;

    try {
      const result = await this.db.execute(sql, [
        Bname,
        Baddress,
        ReceiptPosName,
        blogoBlob,
        blogoBlob,
        RecieptVATreg,
        id,
      ]);
    } catch (err) {
      console.error('Update error:', err);
    }
  }

  async updateLayout(
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

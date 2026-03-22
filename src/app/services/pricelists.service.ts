import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class PricelistsService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService
  ) {}

  async getPricelists(): Promise<any> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');

    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }

    const url = `http://${connection.ip}:${connection.port}/pricelists/all`;

    const response = await firstValueFrom(this.http.get<any>(url));
    return response;
  }
}

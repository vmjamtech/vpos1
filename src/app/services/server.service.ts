import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class ServerService {
  constructor(private http: HttpClient) {}

  ping(
    ip: string,
    port: string
  ): Observable<{ status: string; message: string }> {
    const url = `${apiBaseUrl(ip, port)}/api/ping`;
    return this.http.get<{ status: string; message: string }>(url);
  }
}

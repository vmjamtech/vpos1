import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ServerService {
  constructor(private http: HttpClient) {}

  ping(
    ip: string,
    port: string
  ): Observable<{ status: string; message: string }> {
    const url = `http://${ip}:${port}/api/ping`;
    return this.http.get<{ status: string; message: string }>(url);
  }
}

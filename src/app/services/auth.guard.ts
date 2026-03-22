import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private storageService: StorageService) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const loginData = await this.storageService.get<any>('login-data');

    if (loginData) {
      // User is logged in
      return true;
    } else {
      // Redirect to sign-in page
      return this.router.parseUrl('/sign-in');
    }
  }
}

import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./drawer/drawer.routes').then((m) => m.routes),
    canActivate: [AuthGuard],
  },
  {
    path: 'hotel-booking',
    loadComponent: () =>
      import('./templates/hotel-booking/hotel-booking.page').then(
        (m) => m.HotelBookingPage
      ),
  },
  {
    path: 'sign-in',
    loadComponent: () =>
      import('./drawer/sign-in/sign-in.component').then(
        (m) => m.SignInComponent
      ),
  },   
];

import { Routes } from '@angular/router';
import { DrawerPage } from './drawer.page';
import { TabsComponent } from './tabs/tabs.component';

export const routes: Routes = [
  {
    path: 'menu',
    component: DrawerPage,
    children: [
      {
        path: '',
        component: TabsComponent, // <- global tabs wrapper
        children: [
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./dashboard/dashboard.component').then(
                (m) => m.DashboardComponent
              ),
          },
          {
            path: 'pos-sales',
            loadComponent: () =>
              import('./pos-sales/pos-sales.component').then(
                (m) => m.PosSalesComponent
              ),
          },
          {
            path: 'inventory',
            loadComponent: () =>
              import('./inventory/inventory.component').then(
                (m) => m.InventoryComponent
              ),
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import('./notifications/notifications.component').then(
                (m) => m.NotificationsComponent
              ),
          },
          {
            path: 'transfers',
            loadComponent: () =>
              import('./transfers/transfers.component').then(
                (m) => m.TransfersComponent
              ),
          },
          {
            path: 'customers',
            loadComponent: () =>
              import('./customers/customers.component').then(
                (m) => m.CustomersComponent
              ),
          },
          {
            path: 'personnel',
            loadComponent: () =>
              import('./personels/personels.component').then(
                (m) => m.PersonelsComponent
              ),
          },
          {
            path: 'sales',
            loadComponent: () =>
              import('./sales/sales.component').then((m) => m.SalesComponent),
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./users/users.component').then((m) => m.UsersComponent),
          },
          {
            path: 'pettycash',
            loadComponent: () =>
              import('./pettycashlogs/pettycashlogs.component').then(
                (m) => m.PettycashlogsComponent
              ),
          },
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
        ],
      },
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      // {
      //   path: 'dashboard',
      //   loadComponent: () =>
      //     import('./dashboard/dashboard.component').then(
      //       (m) => m.DashboardComponent
      //     ),
      // },
      // {
      //   path: 'pos-sales',
      //   loadComponent: () =>
      //     import('./pos-sales/pos-sales.component').then(
      //       (m) => m.PosSalesComponent
      //     ),
      // },
      // {
      //   path: 'inventory',
      //   loadComponent: () =>
      //     import('./inventory/inventory.component').then(
      //       (m) => m.InventoryComponent
      //     ),
      // },

      {
        path: 'settings',
        loadComponent: () =>
          import('./appsettings/appsettings.component').then(
            (m) => m.AppsettingsComponent
          ),
      },
      {
        path: 'help',
        loadComponent: () => import('./help/help.page').then((m) => m.HelpPage),
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./feedback/feedback.page').then((m) => m.FeedbackPage),
      },
      {
        path: 'invite-friend',
        loadComponent: () =>
          import('./invite-friend/invite-friend.page').then(
            (m) => m.InviteFriendPage
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'menu/dashboard', pathMatch: 'full' },
];

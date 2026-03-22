import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  IonBadge,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabs,
} from '@ionic/angular/standalone';
import { Observable } from 'rxjs';
import { Subscription } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';
import {
  cashOutline,
  homeOutline,
  layersOutline,
  notificationsOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink, 
    IonTabs,
    IonLabel, 
    IonIcon,
    IonTabBar,
    IonBadge,
    IonRouterOutlet,
  ],
})
export class TabsComponent implements OnInit, OnDestroy {
  badgeCount$: Observable<number>;
  currentUrl = '';
  private navSub?: Subscription;
  readonly icons = {
    home: homeOutline,
    cash: cashOutline,
    layers: layersOutline,
    notifications: notificationsOutline,
  };

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.badgeCount$ = this.notificationService.badgeCount$;
  }

  ngOnInit() {
    this.currentUrl = this.router.url;
    this.navSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects || event.url;
      }
    });
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
  }

  isTabActive(path: string): boolean {
    const url = this.currentUrl.split('?')[0].split('#')[0];
    return url === path || url.startsWith(path + '/');
  }
}

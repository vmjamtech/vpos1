import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
} from '@ionic/angular/standalone';
import {
  AppNotification,
  NotificationService,
} from 'src/app/services/notification.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonList, IonItem, IonLabel, IonBadge],
})
export class NotificationsComponent implements OnInit {
  notifications: AppNotification[] = [];
  scrollTop = 0;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Sample notifications
    this.notifications = [
      // {
      //   id: 1,
      //   title: 'New Sale Completed',
      //   message: 'A new sale has been recorded in POS.',
      //   read: false,
      //   link: '/menu/tabs/sales',
      //   timestamp: new Date(),
      // },
      // {
      //   id: 2,
      //   title: 'Low Inventory Alert',
      //   message: 'Inventory for 11kg LPG tanks is below threshold.',
      //   read: false,
      //   link: '/menu/tabs/inventory',
      //   timestamp: new Date(),
      // },
      // {
      //   id: 3,
      //   title: 'New Customer Added',
      //   message: 'A new customer John Doe was added to the system.',
      //   read: true,
      //   link: '/menu/tabs/customers',
      //   timestamp: new Date(),
      // },
      // {
      //   id: 4,
      //   title: 'Petty Cash Updated',
      //   message: 'Petty cash was updated by Jane Smith.',
      //   read: false,
      //   link: '/menu/tabs/pettycash',
      //   timestamp: new Date(),
      // },
    ];

    // Also push to service so badge count updates
    this.notifications.forEach((notif) =>
      this.notificationService.addNotification(notif)
    );

    // Listen for new notifications
    this.notificationService.notification$.subscribe((notif) => {
      if (notif) this.notifications.unshift(notif);
    });

    // Restore scroll if needed
    const savedScroll = sessionStorage.getItem('notificationsScroll');
    if (savedScroll) this.scrollTop = parseInt(savedScroll, 10);
  }

  trackByFn(index: number, item: AppNotification) {
    return item.id; // optional unique id for optimization
  }

  onScroll(event: CustomEvent) {
    this.scrollTop = event.detail.scrollTop;
    sessionStorage.setItem('notificationsScroll', this.scrollTop.toString());
  }

  openNotification(notif: AppNotification) {
    if (notif.link) {
      this.router.navigateByUrl(notif.link);
    }
    this.notificationService.markAsRead(notif.id);
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  read?: boolean;
  link?: string;
  timestamp?: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications: AppNotification[] = [];
  private notificationSubject = new BehaviorSubject<AppNotification | null>(
    null
  );
  notification$ = this.notificationSubject.asObservable();

  private badgeCountSubject = new BehaviorSubject<number>(0);
  badgeCount$ = this.badgeCountSubject.asObservable();

  private idCounter = 0;

  addNotification(notif: Partial<AppNotification>) {
    const newNotif: AppNotification = {
      id: ++this.idCounter,
      title: notif.title || 'Notification',
      message: notif.message || '',
      read: false,
      link: notif.link,
      timestamp: new Date(),
    };
    this.notifications.unshift(newNotif);
    this.notificationSubject.next(newNotif);
    this.updateBadge();
  }

  getNotifications() {
    return this.notifications;
  }

  markAsRead(id: number) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
    this.updateBadge();
  }

  private updateBadge() {
    const count = this.notifications.filter((n) => !n.read).length;
    this.badgeCountSubject.next(count);
  }
}

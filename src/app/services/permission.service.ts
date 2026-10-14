import { Injectable } from '@angular/core';
import { UserService } from './user.service';
import {
  DEFAULT_PERMISSIONS,
  PermissionPath,
  UserPermissions,
} from '../models/user-permissions.model';

const PERMISSIONS_STORAGE_KEY = 'vpos-user-permissions';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private currentUser: any = null;
  private permissionMap: Record<string, Partial<UserPermissions>> | null = null;

  constructor(userService: UserService) {
    userService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
  }

  get isMasterAdmin(): boolean {
    return (
      this.currentUser?.userid === 'vmjamadmin' ||
      this.currentUser?.usern === 'vmjamadmin'
    );
  }

  get canAssignPermissions(): boolean {
    return (
      this.isMasterAdmin ||
      String(this.currentUser?.accnttype ?? '').toUpperCase() === 'ADMINISTRATOR'
    );
  }

  has(permission: PermissionPath): boolean {
    if (!this.currentUser) return false;
    const [group, key] = permission.split('.') as [keyof UserPermissions, string];
    return (this.getForUser(this.currentUser)[group] as Record<string, boolean>)[key];
  }

  getForUser(user: any): UserPermissions {
    if (user?.userid === 'vmjamadmin' || user?.usern === 'vmjamadmin') {
      return this.mergePermissions();
    }

    const all = this.readAll();
    const saved = all[this.userKey(user)];
    return this.mergePermissions(saved);
  }

  saveForUser(user: any, permissions: UserPermissions): void {
    if (!this.canAssignPermissions) {
      throw new Error('Only ADMINISTRATOR accounts can assign permissions.');
    }

    const key = this.userKey(user);
    if (!key) throw new Error('User account identifier is missing.');

    const all = this.readAll();
    all[key] = this.mergePermissions(permissions);
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(all));
    this.permissionMap = all;
  }

  private userKey(user: any): string {
    return String(user?.userid ?? user?.usern ?? '');
  }

  private readAll(): Record<string, Partial<UserPermissions>> {
    if (this.permissionMap) return this.permissionMap;
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(PERMISSIONS_STORAGE_KEY) ?? '{}'
      );
      this.permissionMap =
        stored && typeof stored === 'object' && !Array.isArray(stored)
          ? (stored as Record<string, Partial<UserPermissions>>)
          : {};
    } catch {
      this.permissionMap = {};
    }
    return this.permissionMap ?? {};
  }

  private mergePermissions(saved?: Partial<UserPermissions>): UserPermissions {
    const mergeGroup = <K extends keyof UserPermissions>(group: K): UserPermissions[K] => {
      const defaults = DEFAULT_PERMISSIONS[group] as Record<string, boolean>;
      const stored = (saved?.[group] ?? {}) as Record<string, boolean>;
      return Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, stored[key] ?? value])
      ) as UserPermissions[K];
    };

    return {
      sidePanel: mergeGroup('sidePanel'),
      inventory: mergeGroup('inventory'),
      customer: mergeGroup('customer'),
      personnel: mergeGroup('personnel'),
      transferItems: mergeGroup('transferItems'),
      warehouse: mergeGroup('warehouse'),
    };
  }
}

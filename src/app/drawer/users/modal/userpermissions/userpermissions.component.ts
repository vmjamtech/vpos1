import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import {
  PermissionPath,
  UserPermissions,
} from 'src/app/models/user-permissions.model';
import { PermissionService } from 'src/app/services/permission.service';

interface PermissionOption {
  label: string;
  path: PermissionPath;
  enabled: boolean;
}

interface PermissionGroup {
  title: string;
  options: PermissionOption[];
}

@Component({
  selector: 'app-userpermissions',
  standalone: true,
  templateUrl: './userpermissions.component.html',
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
})
export class UserpermissionsComponent implements OnInit {
  @Input() user: any;

  groups: PermissionGroup[] = [
    {
      title: 'Side Panel',
      options: [
        { label: 'Personnel', path: 'sidePanel.personnel', enabled: true },
        { label: 'User Account', path: 'sidePanel.userAccount', enabled: true },
        { label: 'Settings', path: 'sidePanel.settings', enabled: true },
      ],
    },
    {
      title: 'Inventory',
      options: [
        { label: 'Add Item', path: 'inventory.addItem', enabled: true },
        { label: 'Update/Edit Item', path: 'inventory.updateItem', enabled: true },
        { label: 'Delete Item', path: 'inventory.deleteItem', enabled: true },
        { label: 'Add Category', path: 'inventory.addCategory', enabled: true },
        { label: 'Update/Edit Category', path: 'inventory.updateCategory', enabled: true },
        { label: 'Delete Category', path: 'inventory.deleteCategory', enabled: true },
        { label: 'Edit Item Commission', path: 'inventory.editItemCommission', enabled: true },
        { label: 'View Item Cost Price', path: 'inventory.viewCostPrice', enabled: true },
      ],
    },
    {
      title: 'Customer',
      options: [
        { label: 'Add Customer', path: 'customer.addCustomer', enabled: true },
        { label: 'Update/Edit Customer', path: 'customer.updateCustomer', enabled: true },
        { label: 'Delete Customer', path: 'customer.deleteCustomer', enabled: true },
        { label: 'Delete Inactive Customer', path: 'customer.deleteInactiveCustomer', enabled: true },
        { label: 'Delete Lend/Returned', path: 'customer.deleteLendReturned', enabled: true },
      ],
    },
    {
      title: 'Personnel',
      options: [
        { label: 'Add Personnel', path: 'personnel.addPersonnel', enabled: true },
        { label: 'Update/Edit Personnel', path: 'personnel.updatePersonnel', enabled: true },
        { label: 'Delete Personnel', path: 'personnel.deletePersonnel', enabled: true },
        { label: 'View Personnel Rate Settings', path: 'personnel.viewRateSettings', enabled: true },
        { label: 'Pay Salary', path: 'personnel.paySalary', enabled: true },
      ],
    },
    {
      title: 'Transfer Items',
      options: [
        { label: 'Supplier', path: 'transferItems.supplier', enabled: true },
      ],
    },
    {
      title: 'Warehouse',
      options: [
        { label: 'Update/Edit Warehouse Item', path: 'warehouse.updateWarehouseItem', enabled: true },
      ],
    },
  ];

  constructor(
    private permissionsService: PermissionService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit(): void {
    const permissions = this.permissionsService.getForUser(this.user);
    for (const group of this.groups) {
      for (const option of group.options) {
        option.enabled = this.readPermission(permissions, option.path);
      }
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  async save(): Promise<void> {
    const confirmation = await this.alertCtrl.create({
      header: 'Confirm Permission Changes',
      message: `Save permission changes for ${this.user?.empname || this.user?.usern || 'this user'}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Save', role: 'confirm' },
      ],
    });
    await confirmation.present();
    const { role } = await confirmation.onDidDismiss();
    if (role !== 'confirm') return;

    const permissions = this.permissionsService.getForUser(this.user);
    for (const group of this.groups) {
      for (const option of group.options) {
        this.writePermission(permissions, option.path, option.enabled);
      }
    }

    try {
      this.permissionsService.saveForUser(this.user, permissions);
      await this.modalCtrl.dismiss(true);
    } catch (error: any) {
      const alert = await this.alertCtrl.create({
        header: 'Unable to Save Permissions',
        message: error?.message ?? 'Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  private readPermission(permissions: UserPermissions, path: PermissionPath): boolean {
    const [group, key] = path.split('.') as [keyof UserPermissions, string];
    return (permissions[group] as Record<string, boolean>)[key];
  }

  private writePermission(
    permissions: UserPermissions,
    path: PermissionPath,
    enabled: boolean
  ): void {
    const [group, key] = path.split('.') as [keyof UserPermissions, string];
    (permissions[group] as Record<string, boolean>)[key] = enabled;
  }
}

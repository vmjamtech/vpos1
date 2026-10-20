import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { ShortcutPreset } from '../../shortcut-preset.model';
import { KeyBindSettingsModalComponent } from '../key-bind-settings/key-bind-settings.modal';
import { PermissionService } from 'src/app/services/permission.service';
import { ShortcutPresetService } from 'src/app/services/shortcut-preset.service';

@Component({
  selector: 'app-select-order-modal',
  templateUrl: './select-order.modal.html',
  styleUrls: ['./select-order.modal.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
  ],
})
export class SelectOrderModalComponent {
  @Input() presets: ShortcutPreset[] = [];

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    public permissionService: PermissionService,
    private shortcutPresetService: ShortcutPresetService
  ) {}

  dismiss() {
    return this.modalCtrl.dismiss();
  }

  getItemCodesSummary(preset: ShortcutPreset): string {
    if (!preset.items?.length) return 'No Items';
    return preset.items
      .map((item: any) => item.itemcode || item.code || item.itemCode)
      .filter(Boolean)
      .join(', ');
  }

  choosePreset(preset: ShortcutPreset) {
    return this.modalCtrl.dismiss({ selectedPreset: preset });
  }

  async addNewPreset() {
    if (this.presets.length >= 6) return;
    await this.openPresetSettings('add');
  }

  async editPreset(preset: ShortcutPreset) {
    if (!this.permissionService.has('pos.shortcut_edit')) return;
    await this.openPresetSettings('edit', preset);
  }

  async deletePreset(preset: ShortcutPreset) {
    if (!this.permissionService.has('pos.shortcut_delete')) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete shortcut?',
      message: `Delete ${preset.codeName}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    try {
      await this.shortcutPresetService.delete(preset.id);
      this.presets = this.presets.filter((item) => item.id !== preset.id);
    } catch (error) {
      console.error('Failed to delete shortcut preset:', error);
      const failure = await this.alertCtrl.create({
        header: 'Unable to Delete Shortcut',
        message: 'Please try again.',
        buttons: ['OK'],
      });
      await failure.present();
    }
  }

  private async openPresetSettings(
    mode: 'add' | 'edit',
    preset?: ShortcutPreset
  ) {
    const modal = await this.modalCtrl.create({
      component: KeyBindSettingsModalComponent,
      componentProps: { mode, preset },
      cssClass: 'key-bind-settings-modal',
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data?.savedPreset) {
      this.presets = await this.shortcutPresetService.getAll();
    }
  }
}
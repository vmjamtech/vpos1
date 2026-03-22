import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonIcon,
  IonText,
  IonItem,
  IonTitle,
  IonToolbar,
  IonLabel,
  IonInput,
  AlertController,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { ServerService } from 'src/app/services/server.service';
import { StorageService } from 'src/app/services/storage.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [
    IonText,
    IonItem,
    IonButton,
    IonButtons,
    IonIcon,
    IonLabel,
    IonInput,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
  ],
})
export class SettingsComponent implements OnInit {
  @Output() onClose = new EventEmitter();
  errormessage: any = null;
  appVersion = '';

  connection = {
    ip: '',
    port: '',
  };

  device = {
    name: '',
    model: '',
    uuid: '',
    platform: '',
    version: '',
  };

  tables = ['USERS', 'STORES', 'USERLOC', 'MNMASTER', 'MAPICNF'];

  displayNames: Record<string, string> = {
    users: 'Users',
    stores: 'Branches',
    userloc: 'Users Locations',
    mnmaster: 'Modules',
    mapicnf: 'Settings',
  };

  showProgressModal = false;
  progressMessage = 'Downloading, please wait...';
  currentTableIndex = 0;
  latestLoading: HTMLIonLoadingElement | null = null;

  constructor(
    private alertController: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private serverService: ServerService,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    const appinfo = await App.getInfo(); // ✅ Get version and more
    this.appVersion = appinfo.version;

    const info = await Device.getInfo();
    const id = await Device.getId();
    this.device.name = info.name || '';
    this.device.model = info.model;
    this.device.platform = info.platform;
    this.device.uuid = id.identifier;
    this.device.version = info.osVersion;

    try {
      // Load saved connection from StorageService
      const saved = await this.storageService.get<{ ip: string; port: string }>(
        'connection'
      );
      if (saved) {
        this.connection.ip = saved.ip;
        this.connection.port = saved.port;
        console.log('Loaded connection from storage:', saved);
      } else {
        console.log('No saved connection found.');
      }
    } catch (err) {
      console.error('Failed to load connection from storage', err);
    }
  }

  async saveSettings() {
    const ip = this.connection.ip?.trim();
    const port = this.connection.port?.toString().trim();

    if (!ip || !port) {
      const alert = await this.alertController.create({
        header: 'Missing Fields',
        message: 'Please enter both IP address and Port.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    try {
      // Check ping first
      const response = await lastValueFrom(this.serverService.ping(ip, port));
      if (response?.status !== 'ok') {
        const alert = await this.alertController.create({
          header: 'Connection Failed',
          message: response?.message || 'Unable to reach the server.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }

      // Save connection if ping succeeds
      await this.storageService.set('connection', { ip, port });

      const alert = await this.alertController.create({
        header: 'Settings Saved',
        message: 'Your connection settings have been saved successfully.',
        buttons: ['OK'],
      });
      await alert.present();
    } catch (err) {
      console.error('Ping error:', err);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to reach server. Please check IP and port.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
}

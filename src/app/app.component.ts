import { Component, OnInit, ViewChild } from '@angular/core';
import {
  AlertController,
  IonApp,
  IonBadge,
  IonRouterOutlet,
  LoadingController,
  Platform,
} from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { SafeAreaController } from '@aashu-dubey/capacitor-statusbar-safe-area';
import { SqliteService } from './services/sqlite.service';
import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  // https://github.com/ionic-team/ionic-framework/issues/21630#issuecomment-683007162
  @ViewChild(IonRouterOutlet, { static: true }) routerOutlet?: IonRouterOutlet;

  constructor(private platform: Platform, private alertCtrl: AlertController) {
    this.platform.ready().then(async () => {
      // this.initTrialCountdown();
      const status = await Network.getStatus();

      if (status.connected) {
        this.liveupdate();
      }
    });

    SafeAreaController.injectCSSVariables();
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});

    // By default Ionic doesn't close app on back click, so we handle that here
    // this.platform.backButton.subscribeWithPriority(-1, () => {
    //   if (!this.routerOutlet?.canGoBack()) {
    //     App.exitApp();
    //   }
    // });
    this.platform.backButton.subscribeWithPriority(9999, () => {
      // Do nothing. Back button is disabled.
    });
  }

  private readonly TRIAL_DAYS = 15;
  private readonly FIRST_OPEN_KEY = 'first_open_at';

  async initTrialCountdown() {
    const now = Date.now();

    const { value } = await Preferences.get({
      key: this.FIRST_OPEN_KEY,
    });

    // First launch
    if (!value) {
      await Preferences.set({
        key: this.FIRST_OPEN_KEY,
        value: now.toString(),
      });
      return;
    }

    const firstOpen = Number(value);
    const daysPassed = Math.floor((now - firstOpen) / (1000 * 60 * 60 * 24));

    const daysLeft = Math.max(this.TRIAL_DAYS - daysPassed, 0);

    if (daysLeft <= 0) {
      await this.showExpiredAlert();
    } else {
      console.log(`Trial days left: ${daysLeft}`);
    }
  }

  async showExpiredAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Trial Expired',
      message: 'Your 15-day trial has ended.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Exit',
          handler: () => App.exitApp(),
        },
      ],
    });

    await alert.present();
  }

  async liveupdate() {
    try {
      await LiveUpdate.ready();
      this.sync();
    } catch (error) {
      console.log(error);
    }
  }

  async sync() {
    try {
      const result = await LiveUpdate.sync();

      if (result.nextBundleId) {
        // A new update is available
        const userConfirmed = await this.promptUserForUpdate();
        console.log('User confirm', userConfirmed);
        if (userConfirmed) {
          await LiveUpdate.reload();
        } else {
          console.log('User chose not to update now.');
        }
      } else {
        console.log('App is already up to date.');
      }
    } catch (error) {
      console.log(error);
    }
  }

  async promptUserForUpdate(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Update Available',
      message: 'A new version is available. Do you want to update now?',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          handler: () => false,
        },
        {
          text: 'Yes',
          handler: () => true,
        },
      ],
    });

    await alert.present();

    const { role } = await alert.onDidDismiss();
    return role !== 'cancel';
  }
}

import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  AnimationController,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonText,
  LoadingController,
  MenuController,
  Platform,
  ToastController,
} from '@ionic/angular/standalone';
import { RiveCanvas, RiveSMInput, RiveStateMachine } from 'ng-rive';
import { SettingsComponent } from './settings/settings.component';
import { Router } from '@angular/router';
import { Keyboard } from '@capacitor/keyboard';
import { UserService } from 'src/app/services/user.service';
import { StorageService } from 'src/app/services/storage.service';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { AppdateService } from 'src/app/services/appdate.service';

@Component({
  selector: 'cr-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss'],
  imports: [
    IonText,
    IonItem,
    IonInput,
    IonIcon,
    IonButton,
    FormsModule,
    RiveCanvas,
    RiveStateMachine,
    RiveSMInput,
    SettingsComponent,
    IonModal,
  ],
})
export class SignInComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() onClose = new EventEmitter();

  @ViewChild(IonModal) signInModal?: IonModal;
  @ViewChild('container', { read: ElementRef }) containerRef?: ElementRef;
  @ViewChild('closeBtn', { read: ElementRef }) closeBtnRef?: ElementRef;
  showOnBoarding = false;

  userid = '';
  password = '';
  isLoading = false;
  buttonToggle = true;
  version = '';
  updateAvailable = false;
  updateStatus: string = '';

  private keyboardShowListener: any;
  private keyboardHideListener: any;

  constructor(
    private router: Router,
    public animationCtrl: AnimationController,
    private toastCtrl: ToastController,
    private userService: UserService,
    private menu: MenuController,
    private platform: Platform,
    private storageService: StorageService,
    private appdateService: AppdateService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    // try {
    //   // Load saved connection from StorageService
    //   const saved = await this.storageService.get<{ ip: string; port: string }>(
    //     'connection'
    //   );
    //   if (!saved) {
    //     this.settingsClick();
    //   }
    // } catch (err) {
    //   console.error('Failed to load connection from storage', err);
    // }
  }

  ngAfterViewInit() {
    const container = document.querySelector(
      '.sign-in-container'
    ) as HTMLElement;

    if (!container) return;

    // ✅ Desktop/web fallback (focus events)
    container.addEventListener('focusin', () => {
      container.classList.add('active');
    });

    container.addEventListener('focusout', () => {
      setTimeout(() => {
        const focused = container.querySelector(':focus');
        if (!focused) {
          container.classList.remove('active');
        }
      }, 50);
    });

    // ✅ Mobile (Capacitor keyboard events)
    this.keyboardShowListener = Keyboard.addListener(
      'keyboardWillShow',
      (info) => {
        container.classList.add('active');
        // If you want dynamic height shift instead of CSS .active
        container.style.transform = `translateY(-${info.keyboardHeight / 2}px)`;
      }
    );

    this.keyboardHideListener = Keyboard.addListener('keyboardWillHide', () => {
      container.classList.remove('active');
      container.style.transform = 'translateY(0)'; // reset if you used dynamic shift
    });
  }

  ngOnDestroy() {
    // cleanup listeners
    this.keyboardShowListener?.remove();
    this.keyboardHideListener?.remove();
  }

  async signIn(
    success: RiveSMInput,
    failure: RiveSMInput,
    reset: RiveSMInput,
    confetti: RiveSMInput
  ) {
    this.isLoading = true;

    const username = this.userid.trim();
    const password = this.password.trim();

    // ✔ Input validation
    if (!username || !password) {
      failure?.fire();
      this.finishAnimation(reset);
      this.showToast('Please enter both User ID and Password', 'warning');
      return;
    }

    try {
      let user: any;

      // ✔ Hardcoded admin check
      if (username === 'adminvmjam' && password === 'admin@vmjam2024') {
        user = {
          userid: 'vmjamadmin',
          usern: 'vmjamadmin',
          empname: 'Administrator',
          accnttype: 'Administrator',
        };
      } else if (username === 'trial1' && password === 'trial1') {
        user = {
          userid: 'trial1',
          usern: 'trial1',
          empname: 'Trial User',
          accnttype: 'Trial User',
        };
      } else {
        // ✔ Normal login from DB
        user = await this.userService.logindb(username, password);
      }

      // ✔ If login successful
      this.finalizeLogin(user, success, reset, confetti);
    } catch (err: any) {
      console.error('Login error:', err);

      failure?.fire();
      this.finishAnimation(reset);

      let msg = err?.message || 'Login failed. Please try again.';
      this.showToast(msg, 'dark');
    }
  }

  // 🎯 Finalize login
  async finalizeLogin(
    user: any,
    success: RiveSMInput,
    reset: RiveSMInput,
    confetti: RiveSMInput
  ) {
    success?.fire();
    confetti?.fire();

    this.showToast('Login successful!', 'success');

    setTimeout(async () => {
      this.userid = '';
      this.password = '';

      // Store both user and selected location using Ionic Storage
      await this.storageService.set('login-data', user);

      this.onSettingsclose();
      await this.menu.close('main-menu');
      this.router.navigate(['/menu/dashboard']);
    }, 2000);

    this.finishAnimation(reset);
  }

  finishAnimation(reset: RiveSMInput) {
    setTimeout(() => {
      this.isLoading = false;
      reset?.fire();
    }, 2000);
  }

  onSettingsclose() {
    this.signInModal?.dismiss();
  }

  enterAnimation = (baseEl: HTMLElement) => {
    const root = baseEl.shadowRoot;
    const containerEl = this.containerRef?.nativeElement;

    const backdropAnimation = this.animationCtrl
      .create()
      .addElement(root?.querySelector('ion-backdrop')!)
      .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = this.animationCtrl
      .create()
      .addElement(root?.querySelector('.modal-wrapper')!)
      .keyframes([
        { offset: 0, opacity: '0.5', transform: 'translateY(-100vh)' },
        { offset: 1, opacity: '1', transform: 'translateY(0vh)' },
      ]);

    const onBoardingContent = this.animationCtrl
      .create()
      .addElement(containerEl!)
      .keyframes([
        { offset: 0, transform: 'translateY(0px)' },
        { offset: 1, transform: 'translateY(-50px)' },
      ]);
    const closeBtnAnim = this.animationCtrl
      .create()
      .addElement(this.closeBtnRef?.nativeElement!)
      .fromTo('transform', 'translateY(0)', 'translateY(-150px)');

    return this.animationCtrl
      .create()
      .addElement(baseEl)
      .easing('ease-in-out')
      .duration(400)
      .addAnimation([
        backdropAnimation,
        wrapperAnimation,
        onBoardingContent,
        closeBtnAnim,
      ]);
  };

  leaveAnimation = (baseEl: HTMLElement) => {
    return this.enterAnimation(baseEl).direction('reverse');
  };

  settingsClick() {
    this.buttonToggle = true;
    setTimeout(() => {
      this.signInModal?.present();
      this.resetBtnState();
    }, 300);
  }

  openSubsPage() {
    this.router.navigate(['/subscription']);
  }
  /**
   * ng-rive has issues playing one-shot animation, so this workaround removes/adds the view after every animation
   * to reset the animation state. buttonToggle false makes sure the animation doesn't auto play after view is re-added.
   * Remove after the issue is fixed!
   */
  resetBtnState() {
    this.buttonToggle = false;
    // this.showRiveBtn = false;
    // setTimeout(() => (this.showRiveBtn = true), 100);
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'dark'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    toast.present();
  }
}

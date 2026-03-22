import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  menuController,
  AnimationBuilder,
  createAnimation,
  MenuI,
  Animation,
} from '@ionic/core/components';
import {
  MenuController,
  Platform,
  IonContent,
  IonMenu,
  IonSplitPane,
  IonToolbar,
  IonAvatar,
  IonImg,
  IonLabel,
  IonList,
  IonMenuToggle,
  IonItem,
  IonFooter,
  IonRouterOutlet,
  IonRippleEffect,
  IonRouterLink,
  IonIcon,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { Observable, Subscription, filter } from 'rxjs';
import { DrawerScreen } from '../types/drawer';
import { StorageService } from '../services/storage.service';
import { AppdateService } from '../services/appdate.service';
import { PrinterService } from '../services/printer.service';
import { ChatComponent } from './dashboard/modal/chat/chat.component';

/*
 took it from main code and added my animations
 "https://github.com/ionic-team/ionic-framework/blob/main/core/src/utils/menu-controller/animations/reveal.ts"
*/
export const revealAnimation: AnimationBuilder = (
  menu: MenuI,
  anims: Animation[]
) => {
  const openedX = menu.width * (menu.isEndSide ? -1 : 1) + 'px';
  const contentOpen = createAnimation()
    .addElement(menu.contentEl!)
    .fromTo('transform', 'translateX(0px)', `translateX(${openedX})`);

  return createAnimation()
    .duration(400)
    .addAnimation(contentOpen)
    .addAnimation(anims);
};

@Component({
  selector: 'app-drawer',
  templateUrl: './drawer.page.html',
  styleUrls: ['./drawer.page.scss'],
  imports: [
    IonRouterOutlet,
    IonContent,
    IonSplitPane,
    IonMenu,
    IonMenuToggle,
    IonAvatar,
    IonImg,
    IonLabel,
    IonList,
    IonItem,
    IonRippleEffect,
    IonToolbar,
    IonFooter,
    CommonModule,
    FormsModule,
    RouterLink,
    IonRouterLink,
    IonIcon,
  ],
})
export class DrawerPage implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('userAvatar', { read: ElementRef })
  userAvatarRef?: ElementRef;
  @ViewChild('menuIcon', { read: ElementRef })
  menuIconRef?: ElementRef;
  @ViewChildren('drawerItemList', { read: ElementRef })
  drawerItemListRef?: QueryList<ElementRef>;
  isTrial = true;
  appPages: DrawerScreen[] = [
    // { name: 'Home', icon: 'home', url: '/menu/home' },
    // { name: 'Dashboard', icon: 'bar-chart-outline', url: '/menu/dashboard' },
    // { name: 'POS', icon: 'desktop-outline', url: '/menu/pos-sales' },
    // { name: 'Inventory', icon: 'cube-outline', url: '/menu/inventory' },
    { name: 'AI Assistant', icon: 'sparkles-outline', action: 'ai' },
    { name: 'Transfer Items', icon: 'repeat-outline', url: '/menu/transfers' },
    { name: 'Sales', icon: 'cash-outline', url: '/menu/sales' },
    { name: 'Customers', icon: 'people-outline', url: '/menu/customers' },
    { name: 'Personnel', icon: 'person-outline', url: '/menu/personnel' },
    { name: 'Petty Cash Logs', icon: 'wallet-outline', url: '/menu/pettycash' },
    { name: 'User Accounts', icon: 'people-outline', url: '/menu/users' },
    { name: 'Settings', icon: 'settings-outline', url: '/menu/settings' },
  ];
  drawerWidth: number = 280;
  rowWidth: number = this.drawerWidth - 64;
  activeTab = 'Dashboard';
  isSplitPane = false;
  routeChangeEvent?: Subscription;
  user: any = null;
  Blogo: string | null = null;

  constructor(
    private router: Router,
    public platform: Platform,
    private storageService: StorageService,
    private menu: MenuController,
    private appdaterService: AppdateService,
    private alertController: AlertController,
    private printerService: PrinterService,
    private modalCtrl: ModalController
  ) {
    this.widthCalculations();
    this.platform.resize.subscribe(() => {
      this.widthCalculations();
      this.initDrawerAnimation();
    });
  }

  ngAfterViewInit() {
    this.initDrawerAnimation();
  }

  ngOnInit() {
    this.storageService.get<any>('login-data').then((user) => {
      if (user) {
        this.user = user;
      }
    });

    const routerEvent = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd)
    ) as Observable<NavigationEnd>;

    this.routeChangeEvent = routerEvent.subscribe((event) => {
      this.syncActiveTab(event.urlAfterRedirects || event.url);
    });

    this.syncActiveTab(this.router.url);
    this.loadSettings();
  }

  async loadSettings() {
    const settings = await this.appdaterService.getAllAppdate();
    console.log('Loaded settings:', settings);

    if (settings && settings.length > 0) {
      const row = settings[0];

      if (row.Blogo && Array.isArray(row.Blogo)) {
        console.log('Raw Blogo byte array length:', row.Blogo.length);
        const base64 = this.byteArrayToBase64(row.Blogo);
        this.Blogo = base64;
        console.log(
          'Converted Blogo base64:',
          this.Blogo?.substring(0, 50) + '...'
        ); // log first 50 chars
      } else if (typeof row.Blogo === 'string') {
        this.Blogo = row.Blogo;
        console.log(
          'Blogo is already string:',
          this.Blogo?.substring(0, 50) + '...'
        );
      } else {
        this.Blogo = 'assets/home/defaultavatar.jpg';
        console.log('No Blogo found');
      }
    } else {
      console.log('No settings found');
    }
  }

  byteArrayToBase64(bytes: number[]): string {
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:image/jpeg;base64,' + btoa(binary);
  }

  ngOnDestroy() {
    this.routeChangeEvent?.unsubscribe();
  }

  private syncActiveTab(url: string) {
    const normalizedUrl = (url || '').split('?')[0].split('#')[0];
    for (let i = 0; i < this.appPages.length; i++) {
      const pageUrl = this.appPages[i].url;
      if (pageUrl && normalizedUrl.startsWith(pageUrl)) {
        this.activeTab = this.appPages[i].name;
        return;
      }
    }
  }

  // calculate width for drawer item's active background
  widthCalculations() {
    const deviceWidth = this.platform.width();
    this.drawerWidth = deviceWidth * 0.75;
    if (deviceWidth > 992) {
      const splitPaneWidth = (deviceWidth * 28) / 100; // default max split pane width is 28% after 992px
      this.rowWidth = splitPaneWidth - 64;
      this.isSplitPane = true;
    } else {
      this.rowWidth = this.drawerWidth - 64;
      this.isSplitPane = false;
    }
  }

  initDrawerAnimation() {
    // Avatar animation
    const avatarAnim = createAnimation()
      .addElement(this.userAvatarRef?.nativeElement)
      // .easing('cubic-bezier(0.4, 0.0, 0.2, 1.0)')
      .fromTo('transform', 'rotate(36deg) scale(0.8)', 'rotate(0deg) scale(1)');

    // Drawer Items active background
    const drawerItems: Animation[] = [];
    const itemRefArray = this.drawerItemListRef?.toArray();
    for (const itemRef of itemRefArray!) {
      const element = itemRef.nativeElement;
      const drawerItemAnim = createAnimation()
        .addElement(element.querySelector('.drawerInnerItem'))
        .fromTo(
          'transform',
          `translateX(-${this.rowWidth}px)`,
          'translateX(0px)'
        );
      drawerItems.push(drawerItemAnim);
    }

    // Menu -> arrow icon animation
    const menuElement = this.menuIconRef?.nativeElement;
    // '180.01deg' because particularly in android it's rotating opposite menu open/close (not on drag though)
    // https://stackoverflow.com/a/25694077
    const iconAnim = createAnimation()
      .addElement(menuElement.querySelector('.menu__icon'))
      .fromTo(
        'transform',
        'translate(-50%, -50%)',
        'rotate(180.01deg) translate(50%, 50%)'
      );

    const line1Anim = createAnimation()
      .addElement(menuElement.querySelector('.menu__line--1'))
      .fromTo(
        'transform',
        'translate3d(0px, 0px, 0) rotate(0deg) scaleX(1.0)',
        'translate3d(6px, 2px, 0) rotate(45deg) scaleX(0.65)'
      );

    const line3Anim = createAnimation()
      .addElement(menuElement.querySelector('.menu__line--3'))
      .fromTo(
        'transform',
        'translate3d(0px, 0px, 0) rotate(0deg) scaleX(1.0)',
        'translate3d(6px, -2px, 0) rotate(-45deg) scaleX(0.65)'
      );
    const menuIconAnim = createAnimation()
      .addElement(menuElement)
      .fromTo(
        'transform',
        'translateX(0px)',
        `translateX(${this.drawerWidth}px)`
      )
      .addAnimation(iconAnim)
      .addAnimation(line1Anim)
      .addAnimation(line3Anim);

    // Register the animation but only trigger on menu open
    this.menu.registerAnimation('my-reveal', (menu: MenuI) =>
      revealAnimation(menu, [avatarAnim, ...drawerItems, menuIconAnim])
    );
  }

  onDrawerNavigate(page: DrawerScreen) {
    if (page.action === 'ai') {
      this.openAI();
      return;
    }

    if (page.url) {
      this.activeTab = page.name;
      this.menu.close('main-menu');
    }
  }

  onMenuClick() {
    this.menu.toggle('main-menu');
  }

  async signOut() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Yes',
          handler: () => {
            this.storageService.remove('login-data');
            this.router.navigateByUrl('/sign-in');
          },
        },
      ],
    });

    await alert.present();
  }

  async printBusinessDetails() {
    await this.printerService.printBusinessDetails();
  }

  async openAI() {
    const modal = await this.modalCtrl.create({
      component: ChatComponent,
      cssClass: 'ai-modal',
    });
    await modal.present();
  }
}

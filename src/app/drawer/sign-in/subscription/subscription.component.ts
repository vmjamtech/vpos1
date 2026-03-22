import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonRadio,
  IonRow,
  IonText,
} from '@ionic/angular/standalone';
import { RiveCanvas, RiveStateMachine, RiveSMInput } from 'ng-rive';
import { SqliteService } from 'src/app/services/sqlite.service';
import { SettingsComponent } from '../settings/settings.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.scss'],
  standalone: true,
  imports: [
    CommonModule,  
    IonButton,
    FormsModule, 
    IonContent, 
  ],
})
export class SubscriptionComponent implements OnInit {
  plans = [
    {
      name: 'Trial',
      duration: '15 Days',
      priceText: 'Free',
      mostPopular: false,
      image: 'assets/subscriptions/freetrial.png',
    },
    {
      name: 'Bronze',
      duration: '1 Month',
      priceText: '₱1199',
      mostPopular: false,
      image: 'assets/subscriptions/Bronze.png',
    },
    {
      name: 'Silver',
      duration: '3 Months',
      priceText: '₱3499',
      mostPopular: true,
      image: 'assets/subscriptions/Silver.png',
    },
    {
      name: 'Gold',
      duration: '6 Months',
      priceText: '₱6899',
      mostPopular: false,
      image: 'assets/subscriptions/Gold.png',
    },
    {
      name: 'Platinum',
      duration: '12 Months',
      priceText: '₱12,499',
      mostPopular: false,
      image: 'assets/subscriptions/Platinum.png',
    },
  ];

  selectedPlan: any = null;
  isLoading = false;
  version = '1.0.0';

  constructor(private sqlite: SqliteService) {}

  ngOnInit() {
    this.checkOfflineSubscription();
  }

  selectPlan(plan: any) {
    this.selectedPlan = plan;
  }

  async subscribe() {
    if (!this.selectedPlan) return;

    this.isLoading = true;
    try {
      // Generate subscription key
      const key = this.generateKey();

      // Calculate expiry based on duration
      const now = new Date();
      let expiry = new Date(now);

      switch (this.selectedPlan.name) {
        case 'Trial':
          expiry.setDate(now.getDate() + 15);
          break;
        case 'Bronze':
          expiry.setMonth(now.getMonth() + 1);
          break;
        case 'Silver':
          expiry.setMonth(now.getMonth() + 3);
          break;
        case 'Gold':
          expiry.setMonth(now.getMonth() + 6);
          break;
        case 'Platinum':
          expiry.setFullYear(now.getFullYear() + 1);
          break;
      }

      // Save subscription offline
      // await this.sqlite.saveSubscription({
      //   key,
      //   plan: this.selectedPlan.name,
      //   expiry: expiry.toISOString(),
      //   price: this.selectedPlan.price,
      // });

      // Optional: Online verification / payment
      // const onlineResult = await this.api.verifySubscription(key);

      this.triggerSuccess();
    } catch (error) {
      console.error('Subscription activation failed:', error);
      this.triggerError();
    } finally {
      this.isLoading = false;
    }
  }

  generateKey(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async checkOfflineSubscription() {
    // const saved = await this.sqlite.getSubscription();
    // if (saved?.expiry && new Date(saved.expiry) > new Date()) {
    //   console.log('Subscription active offline:', saved.plan);
    //   this.selectedPlan = this.plans.find((p) => p.name === saved.plan);
    //   this.triggerSuccess();
    // }
  }

  triggerSuccess() {
    console.log('Subscription activated successfully!');
    // Trigger Rive success animation here
  }

  triggerError() {
    console.log('Subscription activation failed!');
    // Trigger Rive error animation here
  }
}

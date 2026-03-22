import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { CreditHistoryService } from 'src/app/services/credithistory.service';

@Component({
  selector: 'app-credithistory',
  templateUrl: './credithistory.component.html',
  styleUrls: ['./credithistory.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonIcon,
    IonList,
    IonSkeletonText,
    IonCard,
    IonCardContent,
  ],
})
export class CredithistoryComponent implements OnInit {
  offset: number = 0;
  limit: number = 30;
  sales?: any;
  items: any[] = [];
  isLoading = true;
  skeletonArray = Array(10);
  totalPaid: number = 0;

  constructor(
    private modalCtrl: ModalController,
    private creditHistoryService: CreditHistoryService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      this.isLoading = true;
      this.items = await this.creditHistoryService.getCreditHistoryByrefnumdb(
        this.sales.salesrefnum,
        this.limit,
        this.offset
      );
      this.totalPaid = this.items.reduce(
        (sum, item) => sum + (item.cppay || 0),
        0
      );
    } catch (error) {
      console.error('Failed to load credit history:', error);
      this.items = [];
    } finally {
      this.isLoading = false;
    }
  }

  /** Close modal */
  dismiss() {
    this.modalCtrl.dismiss();
  }
}

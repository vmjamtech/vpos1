import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { CustomersService } from 'src/app/services/customers.service';
import { PersonelsService } from 'src/app/services/personels.service';

@Component({
  selector: 'app-select-list',
  templateUrl: './select-list.component.html',
  styleUrls: ['./select-list.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonList,
    IonSearchbar,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonButton,
    IonSkeletonText,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
  ],
})
export class SelectListComponent implements OnInit {
  @Input() title!: string;
  @Input() type!: 'customer' | 'personnel';
  @Input() excludedIds: number[] = [];

  searchText: string = '';
  list: any[] = [];
  filteredList: any[] = [];
  loading: boolean = true;

  // Pagination defaults
  limit: number = 30;
  offset: number = 0;
  allLoaded: boolean = false; // Track if all items are loaded

  constructor(
    private modalCtrl: ModalController,
    private customerService: CustomersService,
    private personnelService: PersonelsService
  ) {}

  async ngOnInit() {
    console.log(this.excludedIds);
    await this.loadList();
  }

  async loadList() {
    if (this.allLoaded) return;

    this.loading = true;
    let newItems: any[] = [];

    try {
      if (this.type === 'customer') {
        newItems = await this.customerService.getCustomersdb(
          this.limit,
          this.offset
        );
      } else {
        newItems = await this.personnelService.getPersonelsdb(
          this.limit,
          this.offset
        );

        // Remove already selected personnel
        if (this.excludedIds && this.excludedIds.length) {
          newItems = newItems.filter((p) => !this.excludedIds.includes(p.pid));
        }
      }

      if (newItems.length < this.limit) {
        this.allLoaded = true;
      }

      this.list = [...this.list, ...newItems];
    } catch (error) {
      console.error('Failed to load list:', error);
    } finally {
      this.filteredList = this.list;
      this.loading = false;
      this.offset += this.limit;
    }
  }

  async filterList() {
    const s = this.searchText.trim();

    // Only search via API for customers
    if (this.type === 'customer') {
      if (!s) {
        // If search is empty, show all loaded list
        this.filteredList = this.list;
        return;
      }

      try {
        this.loading = true;
        // Call backend search
        this.filteredList = await this.customerService.searchCustomersOffline(s);
      } catch (error) {
        console.error('Customer search failed:', error);
        this.filteredList = [];
      } finally {
        this.loading = false;
      }
    } else {
      // For personnel, keep client-side filter
      const search = s.toLowerCase();
      this.filteredList = this.list.filter((item) => {
        const name = item.pname ?? '';
        const address = item.paddress ?? '';
        return (
          name.toLowerCase().includes(search) ||
          address.toLowerCase().includes(search)
        );
      });
    }
  }

  selectItem(item: any) {
    this.modalCtrl.dismiss(item);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async loadMore(event: any) {
    await this.loadList();
    event.target.complete();
  }
}

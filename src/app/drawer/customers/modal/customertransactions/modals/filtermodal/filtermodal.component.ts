import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPopover,
  IonRadio,
  IonRadioGroup,
  ModalController,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-filtermodal',
  templateUrl: './filtermodal.component.html',
  styleUrls: ['./filtermodal.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    FormsModule,
    IonLabel,
    IonItem,
    IonButton,
    IonPopover,
    IonDatetimeButton,
    IonDatetime,
  ],
})
export class FiltermodalComponent {
  dateFrom: string | null = null;
  dateTo: string | null = null;

  constructor(private modalCtrl: ModalController) {}

  close() {
    this.modalCtrl.dismiss(null);
  }

  applyFilter() {
    this.modalCtrl.dismiss({
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      mode: 'filter',
    });
  }

  showAll() {
    this.modalCtrl.dismiss({
      mode: 'showAll', // <- Signal to parent
    });
  }
}

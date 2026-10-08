import { Component, Input } from '@angular/core';
import { IonCol, IonGrid, IonItem, IonLabel, IonRow } from '@ionic/angular/standalone';

@Component({
  selector: 'app-date-range-display',
  templateUrl: './date-range-display.component.html',
  styleUrls: ['./date-range-display.component.scss'],
  standalone: true,
  imports: [IonGrid, IonRow, IonCol, IonItem, IonLabel],
})
export class DateRangeDisplayComponent {
  @Input() dateFrom: string | null = null;
  @Input() dateTo: string | null = null;
}

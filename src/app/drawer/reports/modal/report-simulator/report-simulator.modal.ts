import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonRange,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToast,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import {
  ReportColumnConfig,
  ReportLayoutConfig,
  ReportLayoutTab,
  ReportTextAlignment,
  getDefaultReportLayoutConfig,
} from './report-layout.model';
import { PermissionService } from 'src/app/services/permission.service';

type SimulatorView = 'both' | 'heading' | 'values' | 'positions';

@Component({
  selector: 'app-report-simulator-modal',
  standalone: true,
  templateUrl: './report-simulator.modal.html',
  styleUrls: ['./report-simulator.modal.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonRange,
    IonSelect,
    IonSelectOption,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToast,
    IonToolbar,
  ],
})
export class ReportSimulatorModalComponent implements OnInit {
  @Input() reportTab: ReportLayoutTab = 'summary';

  config!: ReportLayoutConfig;
  activeView: SimulatorView = 'both';
  toastMessage = '';
  toastOpen = false;

  constructor(
    private modalCtrl: ModalController,
    private permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    this.loadTabConfig();
  }

  loadTabConfig(): void {
    this.config = getDefaultReportLayoutConfig(this.reportTab);
    try {
      const saved = localStorage.getItem(`report_layout_${this.reportTab}`);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (this.isValidConfig(parsed, this.reportTab)) {
          this.config = {
            ...parsed,
            feedCount: parsed.feedCount ?? this.config.feedCount,
          };
        }
      }
    } catch (error) {
      console.warn('Could not load report layout settings:', error);
    }
  }

  getDefaultConfigForTab(tab: ReportLayoutTab): ReportLayoutConfig {
    return getDefaultReportLayoutConfig(tab);
  }

  get headingTotal(): number {
    return this.config.columns.reduce(
      (sum, column) => sum + (Number(column.headWidth) || 0),
      0
    );
  }

  get valueTotal(): number {
    return this.config.columns.reduce(
      (sum, column) => sum + (Number(column.valueWidth) || 0),
      0
    );
  }

  formatColText(
    text: string,
    width: number,
    align: ReportTextAlignment
  ): string {
    const safeWidth = Math.max(0, Math.min(48, Math.floor(Number(width) || 0)));
    const clean = String(text ?? '').slice(0, safeWidth);
    if (align === 'right') return clean.padStart(safeWidth, ' ');
    if (align === 'center') {
      const left = Math.floor((safeWidth - clean.length) / 2);
      return clean.padStart(clean.length + left, ' ').padEnd(safeWidth, ' ');
    }
    return clean.padEnd(safeWidth, ' ');
  }

  get simulatedHeadingLine(): string {
    return this.config.columns
      .map((column) =>
        this.formatColText(column.name, column.headWidth, column.headAlign)
      )
      .join('');
  }

  get simulatedValueLine(): string {
    return this.config.columns
      .map((column) =>
        this.formatColText(column.sample, column.valueWidth, column.valueAlign)
      )
      .join('');
  }

  get dividerLine(): string {
    return '-'.repeat(Math.max(0, Math.min(48, Number(this.config.totalWidth) || 0)));
  }

  equalize(type: 'heading' | 'values'): void {
    const key = type === 'heading' ? 'headWidth' : 'valueWidth';
    const total = Math.max(0, Math.min(48, Number(this.config.totalWidth) || 0));
    const count = this.config.columns.length;
    const base = Math.floor(total / count);
    let remainder = total % count;
    this.config.columns.forEach((column) => {
      column[key] = base + (remainder-- > 0 ? 1 : 0);
    });
  }

  addColumn(): void {
    if (this.config.columns.length >= 10) return;
    const id = Math.max(0, ...this.config.columns.map((column) => column.id)) + 1;
    this.config.columns.push({
      id,
      name: 'NEW',
      headWidth: 4,
      headAlign: 'left',
      sample: '0',
      valueWidth: 4,
      valueAlign: 'right',
    });
  }

  removeColumn(id: number): void {
    if (this.config.columns.length <= 1) return;
    this.config.columns = this.config.columns.filter((column) => column.id !== id);
  }

  async saveConfig(): Promise<void> {
    if (!this.permissionService.has('report.simulation_settings')) {
      this.toastMessage = 'You do not have permission to modify report settings.';
      this.toastOpen = true;
      return;
    }
    try {
      localStorage.setItem(
        `report_layout_${this.reportTab}`,
        JSON.stringify(this.config)
      );
      await this.modalCtrl.dismiss({ savedConfig: this.config }, 'confirm');
    } catch (error) {
      console.error('Could not save report layout settings:', error);
      this.toastMessage = 'Unable to save report settings on this device.';
      this.toastOpen = true;
    }
  }

  dismiss(): void {
    void this.modalCtrl.dismiss(undefined, 'cancel');
  }

  private isValidConfig(
    value: unknown,
    tab: ReportLayoutTab
  ): value is ReportLayoutConfig {
    if (!value || typeof value !== 'object') return false;
    const config = value as Partial<ReportLayoutConfig>;
    return (
      config.tabKey === tab &&
      Number.isFinite(config.totalWidth) &&
      config.totalWidth! >= 16 &&
      config.totalWidth! <= 48 &&
      (config.fontMode === 'Font A' || config.fontMode === 'Font B') &&
      ['normal', 'double-height', 'bold'].includes(config.headingFontSize ?? '') &&
      ['normal', 'condensed'].includes(config.valueFontSize ?? '') &&
      (config.feedCount === undefined ||
        (Number.isInteger(config.feedCount) && config.feedCount >= 0 && config.feedCount <= 10)) &&
      Array.isArray(config.columns) &&
      config.columns.length > 0 &&
      config.columns.length <= 10 &&
      config.columns.every((column) =>
        Number.isFinite(column.id) &&
        typeof column.name === 'string' &&
        typeof column.sample === 'string' &&
        Number.isFinite(column.headWidth) &&
        column.headWidth >= 0 &&
        column.headWidth <= 48 &&
        Number.isFinite(column.valueWidth) &&
        column.valueWidth >= 0 &&
        column.valueWidth <= 48 &&
        ['left', 'center', 'right'].includes(column.headAlign) &&
        ['left', 'center', 'right'].includes(column.valueAlign)
      )
    );
  }
}
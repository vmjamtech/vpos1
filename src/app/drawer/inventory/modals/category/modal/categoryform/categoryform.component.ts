import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { AppdateService } from 'src/app/services/appdate.service';
import { CategoryService } from 'src/app/services/category.service';

@Component({
  selector: 'app-categoryform',
  templateUrl: './categoryform.component.html',
  styleUrls: ['./categoryform.component.scss'],
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
    IonToggle,
    IonInput,
  ],
})
export class CategoryformComponent implements OnInit {
  mode: 'add' | 'edit' = 'add';
  category: any = null;

  categoryName: string = '';
  monitorFlag: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private appdateService: AppdateService,
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    if (this.mode === 'edit' && this.category) {
      this.categoryName = this.category.category;
      this.monitorFlag = this.category.catmonitor === 'Y';
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveCategory() {
    if (!this.categoryName.trim()) {
      const alert = await this.alertCtrl.create({
        header: 'Missing Input',
        message: 'Please enter category name.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const catmonitor = this.monitorFlag ? 'Y' : 'N';

    if (this.mode === 'add') {
      // ADD MODE
      const newId = await this.categoryService.insertCategory(
        this.categoryName,
        catmonitor
      );

      const newCategory = {
        catid: newId,
        category: this.categoryName,
        catmonitor,
      };

      // Show toast
      await this.appdateService.showToastjs(
        'Category added successfully!',
        'success'
      );

      this.modalCtrl.dismiss({ newCategory });
    } else {
      // UPDATE MODE
      await this.categoryService.updateCategory(
        this.category.catid,
        this.categoryName,
        catmonitor
      );

      const updatedCategory = {
        catid: this.category.catid,
        category: this.categoryName,
        catmonitor,
      };

      // Show toast
      await this.appdateService.showToastjs(
        'Category updated successfully!',
        'success'
      );

      this.modalCtrl.dismiss({ updatedCategory });
    }
  }
}

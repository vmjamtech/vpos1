import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonTextarea,
  IonItem,
  IonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { PosAiRestService } from 'src/app/services/offline-ai.service';

interface ChatMessage {
  role: 'user' | 'ai';
  message: SafeHtml;
  raw: string;
  createdAt: Date;
}

interface QuickPrompt {
  label: string;
  prompt: string;
  icon?: string;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    IonButton,
    IonItem,
    IonToolbar,
    IonFooter,
    IonSpinner,
    IonContent,
    IonButtons,
    IonTitle,
    IonHeader,
    IonTextarea,
    IonIcon,
    IonChip,
  ],
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild(IonContent) content!: IonContent;

  userInput = '';
  chatHistory: ChatMessage[] = [];
  isLoading = false;
  needsScroll = false;

  quickPrompts: QuickPrompt[] = [
    {
      label: 'Sales month',
      prompt: 'Total sales this month',
      icon: 'calendar-outline',
    },
    {
      label: 'Top items',
      prompt: 'Top items sold last month',
      icon: 'trending-up-outline',
    },
    {
      label: 'Low stock',
      prompt: 'Low stock items',
      icon: 'cube-outline',
    },
    {
      label: 'Stock lookup',
      prompt: 'Stock of A',
      icon: 'search-outline',
    },
    {
      label: 'Cust balance',
      prompt: 'Balance of Juan',
      icon: 'person-outline',
    },
  ];

  constructor(
    private modalCtrl: ModalController,
    private posAiService: PosAiRestService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.pushAiMessage(
      'Hi, I am your V-POS assistant. Try: "sales January 2026", "top items sold this month", "petty cash this month", "transfers today", "balance of Juan", or "stock of LPG11KG".'
    );
  }

  ngAfterViewChecked() {
    if (this.needsScroll) {
      this.needsScroll = false;
      this.scrollToBottom();
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async sendQuickPrompt(prompt: string) {
    if (this.isLoading) {
      return;
    }

    this.userInput = prompt;
    await this.sendMessage();
  }

  async sendMessage() {
    if (!this.userInput.trim() || this.isLoading) return;

    const message = this.userInput.trim();
    this.pushUserMessage(message);
    this.userInput = '';
    this.isLoading = true;
    this.needsScroll = true;

    try {
      const aiReply = await this.posAiService.ask(message);
      this.pushAiMessage(aiReply);
    } catch (err) {
      console.error(err);
      this.pushAiMessage('Error getting AI response. Please try again.');
    } finally {
      this.isLoading = false;
      this.needsScroll = true;
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  private pushUserMessage(rawText: string) {
    const safe = this.sanitizer.bypassSecurityTrustHtml(
      `<p>${this.escapeHtml(rawText)}</p>`
    );
    this.chatHistory.push({
      role: 'user',
      message: safe,
      raw: rawText,
      createdAt: new Date(),
    });
    this.needsScroll = true;
  }

  private pushAiMessage(rawHtml: string) {
    const enhanced = this.enhanceAiHtml(rawHtml);
    const safe = this.sanitizer.bypassSecurityTrustHtml(enhanced);
    this.chatHistory.push({
      role: 'ai',
      message: safe,
      raw: rawHtml,
      createdAt: new Date(),
    });
    this.needsScroll = true;
  }

  private enhanceAiHtml(html: string): string {
    const trimmed = (html || '').trim();

    // Wrap plain text replies so they render consistently in bubbles.
    if (!trimmed.includes('<')) {
      return `<p>${this.escapeHtml(trimmed)}</p>`;
    }

    // Make tables mobile-scrollable.
    const wrappedTables = trimmed.replace(
      /<table class="ai-table">/g,
      '<div class="ai-table-wrap"><table class="ai-table">'
    );

    return wrappedTables.replace(/<\/table>/g, '</table></div>');
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }
}

import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PhotoCaptureComponent } from '../../photos/photo-capture/photo-capture.component';
import { IUploadBoothPhotoResult } from '../../photos/photos.types';
import { IQuestTypeMeta, declineReasonOptions, materialColors, questTypeMeta } from '../quests.constants';
import { DeclineReason, IQuest, QuestResponse } from '../quests.types';

export type QuestCardMode = 'offer' | 'active' | 'done';

export interface IQuestResponseEvent {
  quest: IQuest;
  response: QuestResponse;
  reason?: DeclineReason;
}

@Component({
  selector: 'app-quest-card',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, PhotoCaptureComponent],
  templateUrl: './quest-card.component.html',
  styleUrl: './quest-card.component.scss',
})
export class QuestCardComponent {
  @Input({ required: true }) public quest!: IQuest;
  @Input() public mode: QuestCardMode = 'offer';
  @Input() public isBusy = false;
  @Input() public canAccept = true;
  @Output() public readonly respond = new EventEmitter<IQuestResponseEvent>();
  @Output() public readonly photoAdded = new EventEmitter<IUploadBoothPhotoResult>();

  public readonly declineReasons = declineReasonOptions;
  public isChoosingReason = false;

  public get meta(): IQuestTypeMeta {
    return questTypeMeta[this.quest.type] ?? questTypeMeta.collection;
  }

  public get materialColor(): string | null {
    return this.quest.reward.material ? materialColors[this.quest.reward.material] : null;
  }

  public get progressPercent(): number {
    const progress = this.quest.progress;

    if (!progress || progress.target <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((progress.current / progress.target) * 100));
  }

  public get quizTalkId(): string | null {
    return this.quest.type === 'quiz' && this.quest.talkId ? this.quest.talkId : null;
  }

  public get photoLocationId(): string | null {
    return this.quest.type === 'photo' && this.quest.locationId ? this.quest.locationId : null;
  }

  public get mapLocationId(): string | null {
    return this.quest.where?.locationId ?? this.quest.locationId ?? null;
  }

  public get headingId(): string {
    return `quest-${this.quest.id}-title`;
  }

  public accept(): void {
    this.respond.emit({ quest: this.quest, response: 'accept' });
  }

  public notNow(): void {
    this.respond.emit({ quest: this.quest, response: 'not_now' });
  }

  public startNotForMe(): void {
    this.isChoosingReason = true;
  }

  public cancelNotForMe(): void {
    this.isChoosingReason = false;
  }

  public notForMe(reason?: DeclineReason): void {
    this.isChoosingReason = false;
    this.respond.emit({ quest: this.quest, response: 'not_for_me', reason });
  }

  public drop(): void {
    this.respond.emit({ quest: this.quest, response: 'drop' });
  }
}

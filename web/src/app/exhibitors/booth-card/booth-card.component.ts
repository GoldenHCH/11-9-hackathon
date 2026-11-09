import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { IExhibitorCard } from '../../core/interfaces/exhibitor.interfaces';
import { exhibitorDirectorySettings } from '../exhibitors.constants';
import { ExhibitorsHelper } from '../exhibitors.helper';

@Component({
  selector: 'app-booth-card',
  imports: [MatIconModule, RouterLink],
  templateUrl: './booth-card.component.html',
  styleUrl: './booth-card.component.scss',
})
export class BoothCardComponent {
  @Input({ required: true }) public exhibitor!: IExhibitorCard;
  @Input() public compact = false;

  public get boothLabel(): string {
    return ExhibitorsHelper.boothLabel(this.exhibitor);
  }

  public get whereLine(): string {
    return ExhibitorsHelper.whereLine(this.exhibitor);
  }

  public get topics(): string[] {
    return this.exhibitor.topics.slice(0, exhibitorDirectorySettings.MAX_CARD_TOPICS);
  }

  public topicLabel(topic: string): string {
    return ExhibitorsHelper.topicLabel(topic);
  }
}

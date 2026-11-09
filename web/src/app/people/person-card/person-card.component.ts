import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IMeet, IPersonMatch } from '../../core/api.types';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { personActionIcons, personActionLabels } from '../people.constants';
import { PeopleHelper } from '../people.helper';
import { PersonAction } from '../people.types';

@Component({
  selector: 'app-person-card',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, PixelFaceComponent],
  templateUrl: './person-card.component.html',
  styleUrl: './person-card.component.scss',
})
export class PersonCardComponent {
  @Input({ required: true }) public match!: IPersonMatch;
  @Input() public meet: IMeet | undefined;
  @Input() public isBusy = false;
  @Input() public compact = false;
  @Output() public readonly propose = new EventEmitter<IPersonMatch>();
  @Output() public readonly accept = new EventEmitter<IMeet>();

  public readonly actionLabels = personActionLabels;
  public readonly actionIcons = personActionIcons;

  public get action(): PersonAction {
    return PeopleHelper.actionFor(this.match, this.meet);
  }

  public get isWelcomer(): boolean {
    return PeopleHelper.isWelcomer(this.match);
  }

  public get whereLine(): string {
    return this.match.sameRoom ? 'In the same room as you now' : 'Somewhere at the venue';
  }

  public onAction(): void {
    if (this.isBusy) {
      return;
    }

    if (this.action === 'propose') {
      this.propose.emit(this.match);
    } else if (this.action === 'accept' && this.meet) {
      this.accept.emit(this.meet);
    }
  }
}

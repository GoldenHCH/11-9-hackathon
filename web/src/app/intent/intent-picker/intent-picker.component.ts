import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { topicOptions } from '../../onboarding/onboarding.constants';
import { exploringFieldLimits, goalOptions, socialOptions } from '../intent.constants';
import { IntentHelper } from '../intent.helper';
import { AttendeeGoal, IIntentInput, SocialLevel } from '../intent.types';

@Component({
  selector: 'app-intent-picker',
  imports: [MatIconModule],
  templateUrl: './intent-picker.component.html',
  styleUrl: './intent-picker.component.scss',
})
export class IntentPickerComponent {
  @Input() public value: IIntentInput = { goals: [] };
  @Input() public socialChosen = false;
  @Input() public idPrefix = 'kq-intent';
  @Output() public readonly valueChange = new EventEmitter<IIntentInput>();
  @Output() public readonly socialChosenChange = new EventEmitter<boolean>();

  public readonly goalOptions = goalOptions;
  public readonly socialOptions = socialOptions;
  public readonly fieldOptions = topicOptions;
  public readonly fieldLimits = exploringFieldLimits;

  public get isExploring(): boolean {
    return this.value.goals.includes('exploring');
  }

  public get socialLevel(): SocialLevel {
    return this.value.socialLevel ?? IntentHelper.defaultSocialLevel(this.value.goals);
  }

  public get customField(): string {
    const field = this.value.exploringField ?? '';

    return this.fieldOptions.some((option) => option.toLowerCase() === field.toLowerCase()) ? '' : field;
  }

  public isGoalSelected(goal: AttendeeGoal): boolean {
    return this.value.goals.includes(goal);
  }

  public isFieldSelected(field: string): boolean {
    return (this.value.exploringField ?? '').toLowerCase() === field.toLowerCase();
  }

  public toggleGoal(goal: AttendeeGoal): void {
    const goals = this.isGoalSelected(goal) ? this.value.goals.filter((selected) => selected !== goal) : [...this.value.goals, goal];
    const socialLevel = this.socialChosen ? this.socialLevel : IntentHelper.defaultSocialLevel(goals);
    const next: IIntentInput = { goals, socialLevel };

    if (goals.includes('exploring') && this.value.exploringField) {
      next.exploringField = this.value.exploringField;
    }

    this._emit(next);
  }

  public pickField(field: string): void {
    this._emit({ ...this.value, exploringField: this.isFieldSelected(field) ? undefined : field });
  }

  public onCustomField(event: Event): void {
    const field = (event.target as HTMLInputElement).value;
    this._emit({ ...this.value, exploringField: field.replace(/\s+/g, ' ').slice(0, this.fieldLimits.max) });
  }

  public pickSocial(level: SocialLevel): void {
    this.socialChosen = true;
    this.socialChosenChange.emit(true);
    this._emit({ ...this.value, socialLevel: level });
  }

  private _emit(next: IIntentInput): void {
    this.value = next;
    this.valueChange.emit(next);
  }
}

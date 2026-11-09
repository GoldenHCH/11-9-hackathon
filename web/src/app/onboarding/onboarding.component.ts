import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { BlockFaceComponent } from '../profile/face/block-face.component';
import { CopyLinkComponent } from '../profile/copy-link/copy-link.component';
import { AccessibilityService } from '../profile/services/accessibility.service';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { demoAccount, handlePattern, maxTopics, onboardingSteps, topicOptions } from './onboarding.constants';
import { ISignInInput, ISignInResult, ISignUpInput, ISignUpResult, OnboardingStep } from './onboarding.types';
import { PendingScanHelper } from './pending-scan.helper';

@Component({
  selector: 'app-onboarding',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    AlertBannerComponent,
    BlockFaceComponent,
    CopyLinkComponent,
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _accessibilityService = inject(AccessibilityService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  public readonly steps = onboardingSteps;
  public readonly topicOptions = topicOptions;
  public readonly maxTopics = maxTopics;
  public readonly demoAccount = demoAccount;

  public readonly signInForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  public readonly form = new FormGroup({
    handle: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(handlePattern)] }),
    workingOn: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    spotMe: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(140)] }),
  });

  public step: OnboardingStep = 'signin';
  public signedInId = '';
  public signedInHandle = '';
  public isSigningIn = false;
  public firstKubeCon: boolean | null = null;
  public happyToWelcome: boolean | null = null;
  public meetingOn: boolean | null = null;
  public selectedTopics: string[] = [];
  public isSubmitting = false;
  public errorMessage = '';
  public handleTakenMessage = '';
  public result: ISignUpResult | null = null;

  public get stepIndex(): number {
    return this.steps.indexOf(this.step);
  }

  public get handle(): string {
    return this.form.controls.handle.value;
  }

  public get isHandleValid(): boolean {
    return this.form.controls.handle.valid && !this.handleTakenMessage;
  }

  public get isBusy(): boolean {
    return this.isSubmitting || this.isSigningIn;
  }

  public ngOnInit(): void {
    if (this._meService.attendeeId) {
      void this._router.navigateByUrl(PendingScanHelper.take(this._nextParam()) ?? '/quests', { replaceUrl: true });
    }
  }

  public onHandleInput(): void {
    const control = this.form.controls.handle;
    const normalized = control.value.toLowerCase().replace(/\s+/g, '');

    if (normalized !== control.value) {
      control.setValue(normalized);
    }

    this.handleTakenMessage = '';
  }

  public useDemoAccount(): void {
    this.signInForm.setValue({ name: this.demoAccount.name, email: this.demoAccount.email });
    this.signInForm.markAsDirty();
  }

  public async signIn(): Promise<void> {
    this.signInForm.markAllAsTouched();

    if (this.isSigningIn || this.signInForm.invalid) {
      return;
    }

    this.isSigningIn = true;
    this.errorMessage = '';

    try {
      const { name, email } = this.signInForm.getRawValue();
      const input: ISignInInput = { name: name.trim(), email: email.trim() };
      const result = await firstValueFrom(this._toolsService.call<ISignInResult>('sign_in', input, { background: true }));
      const attendee = result.attendee.attendee;

      if (!result.needsOnboarding) {
        this._meService.setAttendeeId(attendee.id);
        this.continue();
        return;
      }

      this.signedInId = attendee.id;
      this.signedInHandle = attendee.handle;
      this.form.controls.handle.setValue(attendee.handle);
      this.goTo('handle');
    } catch (error) {
      this.errorMessage = ApiErrorHelper.message(error);
    } finally {
      this.isSigningIn = false;
    }
  }

  public goTo(step: OnboardingStep): void {
    this.errorMessage = '';
    this.step = step;
  }

  public next(): void {
    if (this.step === 'signin') {
      void this.signIn();
      return;
    }

    if (this.step === 'handle') {
      this.form.controls.handle.markAsTouched();

      if (this.isHandleValid) {
        this.goTo('about');
      }

      return;
    }

    if (this.step === 'about') {
      this.goTo('topics');
      return;
    }

    if (this.step === 'topics') {
      this.goTo('meeting');
    }
  }

  public back(): void {
    const previous = this.steps[this.stepIndex - 1];

    if (previous) {
      this.goTo(previous);
    }
  }

  public setFirstKubeCon(value: boolean): void {
    this.firstKubeCon = value;

    if (value) {
      this.happyToWelcome = null;
    }
  }

  public isTopicSelected(topic: string): boolean {
    return this.selectedTopics.includes(topic);
  }

  public toggleTopic(topic: string): void {
    if (this.isTopicSelected(topic)) {
      this.selectedTopics = this.selectedTopics.filter((selected) => selected !== topic);
      return;
    }

    if (this.selectedTopics.length < this.maxTopics) {
      this.selectedTopics = [...this.selectedTopics, topic];
    }
  }

  public async submit(): Promise<void> {
    if (this.isSubmitting || this.meetingOn === null || this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const result = await firstValueFrom(
        this._toolsService.call<ISignUpResult>('sign_up', this._buildInput(), { background: true }),
      );
      this._meService.setAttendeeId(result.profile.attendee.id);
      this.result = result;
      this.step = 'done';
    } catch (error) {
      this._handleError(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  public continue(): void {
    void this._router.navigateByUrl(PendingScanHelper.take(this._nextParam()) ?? '/quests', { replaceUrl: true });
  }

  private _buildInput(): ISignUpInput {
    const { handle, workingOn, spotMe } = this.form.getRawValue();
    const firstKubeCon = this.firstKubeCon ?? false;
    const meetingOn = this.meetingOn === true;
    const input: ISignUpInput = { workingOn: workingOn.trim(), firstKubeCon, meetingOn };

    if (this.signedInId) {
      input.attendeeId = this.signedInId;
    }

    if (!this.signedInId || handle !== this.signedInHandle) {
      input.handle = handle;
    }

    if (!firstKubeCon && this.happyToWelcome !== null) {
      input.happyToWelcome = this.happyToWelcome;
    }

    if (this.selectedTopics.length > 0) {
      input.topics = this.selectedTopics;
    }

    if (meetingOn && spotMe.trim()) {
      input.spotMe = spotMe.trim();
    }

    if (this._accessibilityService.isAccessible) {
      input.accessibleMode = true;
    }

    return input;
  }

  private _handleError(error: unknown): void {
    const message = ApiErrorHelper.message(error);

    if (this._errorCode(error) === 'handle_taken') {
      this.handleTakenMessage = message;
      this.step = 'handle';
      return;
    }

    this.errorMessage = message;
  }

  private _errorCode(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return '';
    }

    const body: unknown = error.error;

    if (typeof body === 'object' && body !== null && 'error' in body) {
      const apiError: unknown = body.error;

      if (typeof apiError === 'object' && apiError !== null && 'code' in apiError && typeof apiError.code === 'string') {
        return apiError.code;
      }
    }

    return '';
  }

  private _nextParam(): string | null {
    return this._route.snapshot.queryParamMap.get('next');
  }
}

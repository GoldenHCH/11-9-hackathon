import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { IClientConfig, IUpdateLinksResult, LinkNetwork } from '../core/api.types';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { BlockFaceComponent } from '../profile/face/block-face.component';
import { CopyLinkComponent } from '../profile/copy-link/copy-link.component';
import { AccessibilityService } from '../profile/services/accessibility.service';
import { IntentPickerComponent } from '../intent/intent-picker/intent-picker.component';
import { IntentHelper } from '../intent/intent.helper';
import { IIntentInput } from '../intent/intent.types';
import { linkNetworkOptions } from '../links/links.constants';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import {
  customTopicLimits,
  demoAccount,
  handlePattern,
  importListLabels,
  importRefineDelayMs,
  maxPdfBytes,
  maxTopics,
  minImportTextChars,
  onboardingSteps,
  placeholderFaceHandle,
  topicOptions,
} from './onboarding.constants';
import { IImportedProfile, ImportListKey, ImportMode, ISignInInput, ISignInResult, ISignUpInput, ISignUpResult, OnboardingStep } from './onboarding.types';
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
    IntentPickerComponent,
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
  private readonly _http = inject(HttpClient);

  @ViewChild('customTopicInput') private _customTopicInput?: ElementRef<HTMLInputElement>;

  public readonly steps = onboardingSteps;
  public readonly topicOptions = topicOptions;
  public readonly maxTopics = maxTopics;
  public readonly demoAccount = demoAccount;
  public readonly importListKeys: readonly ImportListKey[] = ['skills', 'offers', 'asks'];
  public readonly importListLabels = importListLabels;
  public readonly linkOptions = linkNetworkOptions;

  public readonly signInForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  public readonly form = new FormGroup({
    handle: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(handlePattern)] }),
    workingOn: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    spotMe: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(140)] }),
  });

  public readonly importForm = new FormGroup({
    text: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20000)] }),
    headline: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    summary: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(600)] }),
  });

  public readonly linksForm = new FormGroup({
    linkedin: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    github: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    x: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    bluesky: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    mastodon: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    website: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  public readonly customTopicControl = new FormControl('', { nonNullable: true });

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
  public importMode: ImportMode = 'choose';
  public imported: IImportedProfile | null = null;
  public importLists: Record<ImportListKey, string[]> = { skills: [], offers: [], asks: [] };
  public isAddingTopic = false;
  public customTopicHint = '';
  public isRefiningImport = false;
  public intent: IIntentInput = { goals: [] };
  public socialChosen = false;
  public isSavingLinks = false;
  public githubVerifyEnabled = false;

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
    return this.isSubmitting || this.isSigningIn || this.isSavingLinks || this.importMode === 'loading';
  }

  public get faceHandle(): string {
    const handle = this.handle.trim();

    return handle !== '' ? handle : this.signedInHandle || placeholderFaceHandle;
  }

  public get customTopics(): string[] {
    const presets = new Set(this.topicOptions.map((topic) => topic.toLowerCase()));

    return this.selectedTopics.filter((topic) => !presets.has(topic.toLowerCase()));
  }

  public get isTopicLimitReached(): boolean {
    return this.selectedTopics.length >= this.maxTopics;
  }

  public get primaryLabel(): string {
    if (this.step === 'import') {
      return this.importMode === 'review' ? 'Looks good' : 'Skip';
    }

    if (this.step === 'goals' && this.intent.goals.length === 0) {
      return 'Skip';
    }

    if (this.step === 'links') {
      return this._hasLinks() ? 'Save links' : 'Skip';
    }

    if (this.step === 'topics' && this.selectedTopics.length === 0) {
      return 'Skip';
    }

    return this.step === 'handle' ? 'Continue' : 'Next';
  }

  public ngOnInit(): void {
    if (this._meService.attendeeId) {
      void this._router.navigateByUrl(PendingScanHelper.take(this._nextParam()) ?? '/quests', { replaceUrl: true });
      return;
    }

    this._loadConfig();
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
      this.goTo('import');
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

    if (this.step === 'import') {
      if (this.importMode === 'loading') {
        return;
      }

      if (this.importMode !== 'review') {
        this.discardImport();
      }

      this.goTo('goals');
      return;
    }

    if (this.step === 'goals') {
      this.goTo('handle');
      return;
    }

    if (this.step === 'links') {
      void this.saveLinks();
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
    return this.selectedTopics.some((selected) => selected.toLowerCase() === topic.toLowerCase());
  }

  public toggleTopic(topic: string): void {
    if (this.isTopicSelected(topic)) {
      this.removeTopic(topic);
      return;
    }

    if (!this.isTopicLimitReached) {
      this.selectedTopics = [...this.selectedTopics, topic];
    }

    this._syncCustomTopicControl();
  }

  public removeTopic(topic: string): void {
    this.selectedTopics = this.selectedTopics.filter((selected) => selected.toLowerCase() !== topic.toLowerCase());
    this.customTopicHint = '';
    this._syncCustomTopicControl();
  }

  public openCustomTopic(): void {
    this.isAddingTopic = true;
    this.customTopicHint = '';
    this._focusCustomTopic();
  }

  public cancelCustomTopic(): void {
    this.isAddingTopic = false;
    this.customTopicHint = '';
    this.customTopicControl.setValue('');
  }

  public onCustomTopicKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCustomTopic();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelCustomTopic();
    }
  }

  public addCustomTopic(): void {
    if (this.isTopicLimitReached) {
      return;
    }

    const raw = this.customTopicControl.value.replace(/\s+/g, ' ').trim();
    const cleaned = raw.replace(/[^\p{L}\p{N} +#./-]/gu, '').replace(/\s+/g, ' ').trim();

    if (/@|:\/\/|^www\./i.test(raw) || /\.(com|io|dev|org|net|me|ai|co|app)(\/|$)/i.test(cleaned)) {
      this.customTopicHint = 'Topics cannot be links or emails';
      this._focusCustomTopic();
      return;
    }

    if (cleaned.length < customTopicLimits.min || cleaned.length > customTopicLimits.max) {
      this.customTopicHint = `Use ${customTopicLimits.min} to ${customTopicLimits.max} letters, numbers or + # . / -`;
      this._focusCustomTopic();
      return;
    }

    const label = this.topicOptions.find((topic) => topic.toLowerCase() === cleaned.toLowerCase()) ?? cleaned;
    const duplicate = this.isTopicSelected(label);

    if (!duplicate) {
      this.selectedTopics = [...this.selectedTopics, label];
    }

    this.customTopicHint = duplicate ? 'Already picked' : '';
    this.customTopicControl.setValue('');
    this._focusCustomTopic();
  }

  public chooseImport(mode: ImportMode): void {
    this.errorMessage = '';
    this.importMode = mode;
  }

  public async onFileSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.errorMessage = 'That file is not a PDF. Upload a PDF, or paste the text instead.';
      return;
    }

    if (file.size > maxPdfBytes) {
      this.errorMessage = 'That PDF is over 5 MB. Try a shorter export, or paste the text instead.';
      return;
    }

    await this._runImport(() => {
      const form = new FormData();
      form.append('attendeeId', this.signedInId);
      form.append('file', file, 'profile.pdf');

      return firstValueFrom(this._toolsService.upload<IImportedProfile>('profile-import', form));
    });
  }

  public async importText(): Promise<void> {
    const text = this.importForm.controls.text.value.trim();

    if (text.length < minImportTextChars) {
      this.errorMessage = 'Paste a few lines about your work so we have something to read.';
      return;
    }

    await this._runImport(() =>
      firstValueFrom(this._toolsService.call<IImportedProfile>('import_profile', { attendeeId: this.signedInId, text }, { background: true })),
    );
  }

  public removeImportItem(key: ImportListKey, item: string): void {
    this.importLists = { ...this.importLists, [key]: this.importLists[key].filter((value) => value !== item) };
  }

  public discardImport(): void {
    this.imported = null;
    this.importLists = { skills: [], offers: [], asks: [] };
    this.importForm.reset();
    this.importMode = 'choose';
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
      this.step = 'links';
    } catch (error) {
      this._handleError(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  public onIntentChange(value: IIntentInput): void {
    this.intent = value;
  }

  public async saveLinks(): Promise<void> {
    if (this.isSavingLinks) {
      return;
    }

    if (!this._hasLinks()) {
      this.goTo('done');
      return;
    }

    this.isSavingLinks = true;
    this.errorMessage = '';

    try {
      await firstValueFrom(
        this._toolsService.call<IUpdateLinksResult>('update_links', { attendeeId: this._meService.attendeeId, links: this._linkValues() }, { background: true }),
      );
      this.goTo('done');
    } catch (error) {
      this.errorMessage = ApiErrorHelper.message(error);
    } finally {
      this.isSavingLinks = false;
    }
  }

  public async verifyGithub(): Promise<void> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      return;
    }

    if (this._hasLinks()) {
      await this.saveLinks();

      if (this.errorMessage) {
        return;
      }
    }

    window.location.assign(`/auth/github/start?attendeeId=${encodeURIComponent(attendeeId)}`);
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

    if (this.intent.goals.length > 0) {
      input.intent = IntentHelper.forSaving(this.intent);
    }

    if (this.imported) {
      if (this.imported.seniority) {
        input.seniority = this.imported.seniority;
      }

      const { headline, summary } = this.importForm.getRawValue();

      if (headline.trim()) {
        input.headline = headline.trim();
      }

      if (summary.trim()) {
        input.summary = summary.trim();
      }

      input.skills = this.importLists.skills;
      input.offers = this.importLists.offers;
      input.asks = this.importLists.asks;
    }

    return input;
  }

  private async _runImport(request: () => Promise<IImportedProfile>): Promise<void> {
    const previousMode = this.importMode;
    const previousWorkingOn = this.form.controls.workingOn.value;
    const previousTopics = [...this.selectedTopics];
    this.errorMessage = '';
    this.importMode = 'loading';

    try {
      const imported = await request();
      this._applyImport(imported, previousWorkingOn, previousTopics);
      this.importMode = 'review';

      if (imported.provider === 'fallback') {
        void this._refineImport(request, imported, previousWorkingOn, previousTopics);
      }
    } catch (error) {
      this.errorMessage = ApiErrorHelper.message(error);
      this.importMode = previousMode;
    }
  }

  private async _refineImport(request: () => Promise<IImportedProfile>, first: IImportedProfile, previousWorkingOn: string, previousTopics: string[]): Promise<void> {
    this.isRefiningImport = true;
    const listsBefore = this.importLists;

    try {
      await new Promise((resolve) => setTimeout(resolve, importRefineDelayMs));
      const refined = await request();
      const untouched = this.imported === first && this.importLists === listsBefore && this.importForm.pristine && this.step === 'import' && this.importMode === 'review';

      if (refined.provider !== 'fallback' && untouched) {
        this._applyImport(refined, previousWorkingOn, previousTopics);
      }
    } catch {
      return;
    } finally {
      this.isRefiningImport = false;
    }
  }

  private _applyImport(imported: IImportedProfile, previousWorkingOn: string, previousTopics: string[]): void {
    this.imported = imported;
    this.importLists = { skills: [...imported.skills], offers: [...imported.offers], asks: [...imported.asks] };
    this.importForm.reset({ text: '', headline: imported.headline, summary: imported.summary });
    this.form.controls.workingOn.setValue(previousWorkingOn.trim() ? previousWorkingOn : imported.workingOn);

    const merged = [...previousTopics];

    for (const topic of imported.topics) {
      if (merged.length < this.maxTopics && !merged.some((selected) => selected.toLowerCase() === topic.toLowerCase())) {
        merged.push(topic);
      }
    }

    this.selectedTopics = merged;
    this._syncCustomTopicControl();
  }

  private _linkValues(): Partial<Record<LinkNetwork, string>> {
    const values = this.linksForm.getRawValue();

    return Object.fromEntries(Object.entries(values).flatMap(([network, value]) => (value.trim() ? [[network, value.trim()]] : [])));
  }

  private _hasLinks(): boolean {
    return Object.keys(this._linkValues()).length > 0;
  }

  private _loadConfig(): void {
    if (environment.useFixtures) {
      return;
    }

    this._http.get<IClientConfig>(`${environment.apiBaseUrl}/config`).subscribe({
      next: (config) => (this.githubVerifyEnabled = config.githubVerifyEnabled === true),
      error: () => (this.githubVerifyEnabled = false),
    });
  }

  private _focusCustomTopic(): void {
    this._syncCustomTopicControl();
    setTimeout(() => this._customTopicInput?.nativeElement.focus());
  }

  private _syncCustomTopicControl(): void {
    if (this.isTopicLimitReached && this.customTopicControl.enabled) {
      this.customTopicControl.disable();
    } else if (!this.isTopicLimitReached && this.customTopicControl.disabled) {
      this.customTopicControl.enable();
    }
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

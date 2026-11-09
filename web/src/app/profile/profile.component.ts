import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { IntentPickerComponent } from '../intent/intent-picker/intent-picker.component';
import { goalOptions, socialOptions } from '../intent/intent.constants';
import { IntentHelper } from '../intent/intent.helper';
import { IIntentInput } from '../intent/intent.types';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../shared/components/state-wrapper/state-wrapper.component';
import { CopyLinkComponent } from './copy-link/copy-link.component';
import { BlockFaceComponent } from './face/block-face.component';
import { bannerIcons, githubMessages, materialInfo, moreLinks, settingOptions } from './profile.constants';
import { IInventory, IProfile, IUpdateSettingsInput, ProfileSettingKey } from './profile.types';
import { AccessibilityService } from './services/accessibility.service';

@Component({
  selector: 'app-profile',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    AlertBannerComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
    BlockFaceComponent,
    CopyLinkComponent,
    IntentPickerComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _accessibilityService = inject(AccessibilityService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  public readonly materials = materialInfo;
  public readonly githubMessages = githubMessages;
  public readonly bannerIcons = bannerIcons;
  public readonly settingOptions = settingOptions;
  public readonly moreLinks = moreLinks;

  public profile: IProfile | null = null;
  public inventory: IInventory | null = null;
  public isLoading = true;
  public errorMessage = '';
  public settingsError = '';
  public savingKey: ProfileSettingKey | null = null;
  public isEditingIntent = false;
  public isSavingIntent = false;
  public intentError = '';
  public intentDraft: IIntentInput = { goals: [] };
  public githubOutcome = '';

  public get intentSummary(): string {
    const intent = this.profile?.attendee.intent;

    if (!intent || intent.goals.length === 0) {
      return '';
    }

    const goals = goalOptions.filter((option) => intent.goals.includes(option.goal)).map((option) => option.label);
    const exploring = intent.exploringField ? ` (${intent.exploringField})` : '';

    return goals.join(', ') + exploring;
  }

  public get socialLabel(): string {
    const level = this.profile?.attendee.intent?.socialLevel ?? 'some';

    return socialOptions.find((option) => option.level === level)?.label ?? '';
  }

  public get xpPercent(): number {
    return Math.round(Math.min(1, Math.max(0, this.profile?.level.progress ?? 0)) * 100);
  }

  public get xpToNext(): number {
    const level = this.profile?.level;

    return level?.nextLevelXp ? Math.max(0, level.nextLevelXp - level.xp) : 0;
  }

  public get pdfUrl(): string {
    const attendeeId = this._meService.attendeeId;

    return attendeeId ? `${environment.apiBaseUrl}/recap/${encodeURIComponent(attendeeId)}.pdf` : '';
  }

  public get hasBlocks(): boolean {
    return (this.inventory?.totalBlocks ?? 0) > 0;
  }

  public ngOnInit(): void {
    this.githubOutcome = this._route.snapshot.queryParamMap.get('github') ?? '';
    void this.load();
  }

  public editIntent(): void {
    this.intentDraft = IntentHelper.toInput(this.profile?.attendee.intent);
    this.intentError = '';
    this.isEditingIntent = true;
  }

  public cancelIntent(): void {
    this.isEditingIntent = false;
    this.intentError = '';
  }

  public async saveIntent(): Promise<void> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId || this.isSavingIntent) {
      return;
    }

    this.isSavingIntent = true;
    this.intentError = '';

    try {
      const input: IUpdateSettingsInput = { attendeeId, intent: IntentHelper.forSaving(this.intentDraft) };
      this.profile = await firstValueFrom(this._toolsService.call<IProfile>('update_settings', input, { background: true }));
      this.isEditingIntent = false;
    } catch (error) {
      this.intentError = ApiErrorHelper.message(error);
    } finally {
      this.isSavingIntent = false;
    }
  }

  public async load(): Promise<void> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      void this._router.navigateByUrl('/onboarding', { replaceUrl: true });
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const { profile, inventory } = await firstValueFrom(
        forkJoin({
          profile: this._toolsService.call<IProfile>('get_profile', { attendeeId }),
          inventory: this._toolsService.call<IInventory>('inventory', { attendeeId }),
        }),
      );
      this.profile = profile;
      this.inventory = inventory;
      this._accessibilityService.setAccessible(profile.attendee.settings.accessibleMode);
    } catch (error) {
      if (this._isUnknownAttendee(error)) {
        this._meService.clear();
        void this._router.navigateByUrl('/onboarding', { replaceUrl: true });
        return;
      }

      this.errorMessage = ApiErrorHelper.message(error);
    } finally {
      this.isLoading = false;
    }
  }

  public settingValue(key: ProfileSettingKey): boolean {
    return this.profile?.attendee.settings[key] ?? false;
  }

  public blockCount(material: string): number {
    return this.inventory?.blocks[material as keyof IInventory['blocks']] ?? 0;
  }

  public async onSettingChange(key: ProfileSettingKey, change: MatSlideToggleChange): Promise<void> {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId || !this.profile || this.savingKey) {
      change.source.checked = this.settingValue(key);
      return;
    }

    const previous = this.settingValue(key);
    this.savingKey = key;
    this.settingsError = '';

    if (key === 'accessibleMode') {
      this._accessibilityService.setAccessible(change.checked);
    }

    try {
      const input: IUpdateSettingsInput = { attendeeId, settings: { [key]: change.checked } };
      this.profile = await firstValueFrom(this._toolsService.call<IProfile>('update_settings', input, { background: true }));
    } catch (error) {
      change.source.checked = previous;

      if (key === 'accessibleMode') {
        this._accessibilityService.setAccessible(previous);
      }

      this.settingsError = ApiErrorHelper.message(error);
    } finally {
      this.savingKey = null;
    }
  }

  public signOut(): void {
    this._meService.clear();
    void this._router.navigateByUrl('/onboarding');
  }

  private _isUnknownAttendee(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
      return false;
    }

    const body: unknown = error.error;

    return (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'code' in body.error &&
      body.error.code === 'unknown_attendee'
    );
  }
}

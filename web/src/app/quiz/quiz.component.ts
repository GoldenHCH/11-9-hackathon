import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { BossBarComponent } from '../shared/components/boss-bar/boss-bar.component';
import { ScreenToolbarComponent } from '../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../shared/components/state-wrapper/state-wrapper.component';
import { bossPollMs, bossSkipFallbackMessages } from './quiz.constants';
import { IQuestionView, IQuiz, IQuizResult, ISearchResponse, ISubmitQuizResponse, ITalk } from './quiz.types';

@Component({
  selector: 'app-quiz',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    RouterLink,
    BossBarComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.scss',
})
export class QuizComponent implements OnInit, OnDestroy {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _subscriptions = new Subscription();
  private _startedAt = new Date().toISOString();

  public readonly bossPollMs = bossPollMs;
  public talkId = '';
  public quiz: IQuiz | null = null;
  public talk: ITalk | null = null;
  public answers: (number | null)[] = [];
  public result: ISubmitQuizResponse | IQuizResult | null = null;
  public isLoading = true;
  public isSubmitting = false;
  public errorMessage = '';
  public submitError = '';
  public isSourceOpen = false;

  public get questions(): IQuestionView[] {
    const results = this.result?.results ?? [];

    return (this.quiz?.questions ?? []).map((question, index) => ({
      ...question,
      result: results.find((item) => item.questionId === question.id) ?? results[index],
    }));
  }

  public get canSubmit(): boolean {
    return !this.isSubmitting && this.answers.length > 0 && this.answers.every((answer) => answer !== null);
  }

  public get answeredCount(): number {
    return this.answers.filter((answer) => answer !== null).length;
  }

  public get bossNotice(): string {
    const result = this.result as ISubmitQuizResponse | null;

    if (!result?.bossDamageSkipped) {
      return '';
    }

    return result.bossMessage || bossSkipFallbackMessages[result.bossDamageSkipped];
  }

  public get quizSubtitle(): string {
    const count = this.quiz?.questions.length ?? 0;
    const questionsLabel = count ? `${count} ${count === 1 ? 'question' : 'questions'}` : 'Loading questions';

    return this.quiz?.isBoss ? `Boss fight · ${questionsLabel}` : `${questionsLabel} · no timer`;
  }

  public get trackLabel(): string {
    return this.talk?.track ? this.talk.track.charAt(0).toUpperCase() + this.talk.track.slice(1) : '';
  }

  public ngOnInit(): void {
    this.talkId = this._route.snapshot.paramMap.get('talkId') ?? '';
    this._load();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public retry(): void {
    this._load();
  }

  public toggleSource(): void {
    this.isSourceOpen = !this.isSourceOpen;
  }

  public choiceLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  public submit(): void {
    const attendeeId = this._meService.attendeeId;

    if (!this.quiz || !this.canSubmit) {
      return;
    }

    if (!attendeeId) {
      this._goToOnboarding();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    this._subscriptions.add(
      this._toolsService
        .call<ISubmitQuizResponse>('submit_quiz', {
          attendeeId,
          talkId: this.quiz.talkId,
          answers: this.answers,
          startedAt: this._startedAt,
        })
        .subscribe({
          next: (result) => {
            this.result = result;
            this.isSubmitting = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
          },
          error: (error: unknown) => {
            this.isSubmitting = false;

            if (this._isUnknownAttendee(error)) {
              this._meService.clear();
              this._goToOnboarding();
              return;
            }

            this.submitError = ApiErrorHelper.message(error);
          },
        }),
    );
  }

  private _load(): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      this._goToOnboarding();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this._subscriptions.add(
      this._toolsService.call<IQuiz>('quiz_for_talk', { talkId: this.talkId, attendeeId }).subscribe({
        next: (quiz) => {
          this.quiz = quiz;
          this.answers = quiz.questions.map(() => null);
          this.result = quiz.previousResult ?? null;
          this._startedAt = new Date().toISOString();
          this.isLoading = false;
          this._loadTalk(quiz);
        },
        error: (error: unknown) => {
          this.isLoading = false;

          if (this._isUnknownAttendee(error)) {
            this._meService.clear();
            this._goToOnboarding();
            return;
          }

          this.errorMessage = ApiErrorHelper.message(error);
        },
      }),
    );
  }

  private _loadTalk(quiz: IQuiz): void {
    this._subscriptions.add(
      this._toolsService
        .call<ISearchResponse>(
          'search',
          { query: quiz.talkTitle, limit: 5, filters: { kinds: ['session'] } },
          { background: true },
        )
        .pipe(catchError(() => of(null)))
        .subscribe((response) => {
          this.talk = response?.results.find((item) => item.talk?.id === quiz.talkId)?.talk ?? null;
        }),
    );
  }

  private _isUnknownAttendee(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
      return false;
    }

    const body = error.error as { error?: { code?: string } } | null;

    return body?.error?.code === 'unknown_attendee' || body?.error?.code === 'attendee_not_found';
  }

  private _goToOnboarding(): void {
    void this._router.navigate(['/onboarding'], { queryParams: { next: `/quiz/${this.talkId}` } });
  }
}

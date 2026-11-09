import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, filter, interval } from 'rxjs';
import type {
  IAskAnswer,
  IAskBooth,
  IAskCitation,
  IAskPerson,
  IAskResult,
  IAskTalk,
} from '../../../../app/src/search/search.interfaces';
import { IMeet } from '../core/api.types';
import { ApiErrorHelper } from '../core/helpers/api-error.helper';
import { MeService } from '../core/services/me.service';
import { ToolsService } from '../core/services/tools.service';
import { AlertBannerComponent } from '../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../shared/components/pixel-face/pixel-face.component';
import { searchExampleQueries, searchSettings, searchTabs } from './search.constants';
import { SearchHelper } from './search.helper';
import { AnswerState, ConnectState, IAnswerSegment, SearchTab } from './search.types';

interface IItineraryChange {
  talkId: string;
  inItinerary: boolean;
}

@Component({
  selector: 'app-search',
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, AlertBannerComponent, PixelFaceComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  private _askSubscription?: Subscription;
  private _answerSubscription?: Subscription;
  private _revealTimer?: ReturnType<typeof setInterval>;

  public readonly examples = searchExampleQueries;
  public readonly tabs = searchTabs;
  public readonly boothMapLink = { level: searchSettings.BOOTH_MAP_LEVEL };

  public query = '';
  public result: IAskResult | null = null;
  public isSearching = false;
  public errorMessage = '';
  public actionError = '';
  public activeTab: SearchTab = 'all';

  public answerState: AnswerState = 'idle';
  public answer: IAskAnswer | null = null;
  public segments: IAnswerSegment[] = [];
  public revealedWords = 0;
  public flashedId = '';

  public meetsByPartner = new Map<string, IMeet>();
  public sendingIds = new Set<string>();
  public sentIds = new Set<string>();
  public planBusyIds = new Set<string>();

  public get isSignedIn(): boolean {
    return this._meService.attendeeId !== null;
  }

  public get totalResults(): number {
    return this.result ? this.result.talks.length + this.result.people.length + this.result.booths.length : 0;
  }

  public get visibleSegments(): IAnswerSegment[] {
    let remaining = this.revealedWords;
    const visible: IAnswerSegment[] = [];

    for (const segment of this.segments) {
      if (remaining <= 0) {
        break;
      }

      if (segment.citation !== undefined) {
        visible.push(segment);
        continue;
      }

      const words = segment.text.split(/(\s+)/);
      const wordCount = words.filter((word) => word.trim() !== '').length;

      if (wordCount <= remaining) {
        visible.push(segment);
        remaining -= wordCount;
      } else {
        let taken = 0;
        let text = '';

        for (const word of words) {
          if (word.trim() !== '') {
            if (taken === remaining) {
              break;
            }

            taken += 1;
          }

          text += word;
        }

        visible.push({ text });
        remaining = 0;
      }
    }

    return visible;
  }

  public get isRevealing(): boolean {
    return this.answerState === 'ready' && this._revealTimer !== undefined;
  }

  public ngOnInit(): void {
    this._destroyRef.onDestroy(() => this.stopReveal());
    this.loadMeets();
    this.startMeetPolling();

    this._route.queryParamMap.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((params) => {
      const query = (params.get('q') ?? '').trim();

      if (query !== '' && query !== this.result?.query) {
        this.query = query;
        this.runSearch(query);
      }
    });
  }

  public submit(): void {
    const query = this.query.trim();

    if (query === '') {
      return;
    }

    if (query === this._route.snapshot.queryParamMap.get('q')) {
      this.runSearch(query);

      return;
    }

    void this._router.navigate([], { relativeTo: this._route, queryParams: { q: query } });
  }

  public useExample(example: string): void {
    this.query = example;
    this.submit();
  }

  public clear(): void {
    this.query = '';
  }

  public setTab(tab: SearchTab): void {
    this.activeTab = tab;
  }

  public shows(tab: SearchTab): boolean {
    return this.activeTab === 'all' || this.activeTab === tab;
  }

  public countFor(tab: SearchTab): number {
    if (!this.result) {
      return 0;
    }

    if (tab === 'talks') {
      return this.result.talks.length;
    }

    if (tab === 'people') {
      return this.result.people.length;
    }

    return tab === 'booths' ? this.result.booths.length : this.totalResults;
  }

  public anchor(resultId: string): string {
    return SearchHelper.anchorId(resultId);
  }

  public when(iso: string): string {
    return SearchHelper.when(iso);
  }

  public citationFor(n: number): IAskCitation | undefined {
    return this.answer?.citations.find((citation) => citation.n === n);
  }

  public goToCitation(n: number): void {
    const citation = this.citationFor(n);

    if (!citation) {
      return;
    }

    this.activeTab = 'all';
    this.flashedId = citation.resultId;

    setTimeout(() => {
      document.getElementById(this.anchor(citation.resultId))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    setTimeout(() => {
      if (this.flashedId === citation.resultId) {
        this.flashedId = '';
      }
    }, searchSettings.FLASH_MS);
  }

  public mapLink(building: string, level: string, zone?: string): Record<string, string> {
    const levelId = SearchHelper.mapLevel(building, level, zone);

    return levelId ? { level: levelId } : {};
  }

  public addToPlan(talk: IAskTalk): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      void this._router.navigate(['/onboarding']);

      return;
    }

    const toolName = talk.inItinerary ? 'remove_from_itinerary' : 'add_to_itinerary';
    this.actionError = '';
    this.planBusyIds.add(talk.id);

    this._toolsService
      .call<IItineraryChange>(toolName, { attendeeId, talkId: talk.id }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (change) => {
          talk.inItinerary = change.inItinerary;
          this.planBusyIds.delete(talk.id);
        },
        error: (error: unknown) => {
          console.error('Could not change the plan', error);
          this.actionError = ApiErrorHelper.message(error);
          this.planBusyIds.delete(talk.id);
        },
      });
  }

  public connectState(person: IAskPerson): ConnectState {
    if (this.sendingIds.has(person.publicId)) {
      return 'sending';
    }

    return SearchHelper.connectState(this.meetsByPartner.get(person.publicId));
  }

  public meetFor(person: IAskPerson): IMeet | undefined {
    return this.meetsByPartner.get(person.publicId);
  }

  public connect(person: IAskPerson): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      void this._router.navigate(['/onboarding']);

      return;
    }

    this.actionError = '';
    this.sendingIds.add(person.publicId);

    this._toolsService
      .call<IMeet>('propose_meet', { attendeeId, partnerId: person.publicId }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (meet) => {
          this.sendingIds.delete(person.publicId);
          this.sentIds.add(person.publicId);
          this.meetsByPartner = new Map(this.meetsByPartner).set(person.publicId, meet);
        },
        error: (error: unknown) => {
          console.error('Could not send the meet request', error);
          this.sendingIds.delete(person.publicId);
          this.actionError = ApiErrorHelper.message(error);
          this.loadMeets();
        },
      });
  }

  public openMeet(person: IAskPerson): void {
    const meet = this.meetFor(person);

    if (meet) {
      void this._router.navigate(['/intro', meet.id]);
    }
  }

  public boothTitle(booth: IAskBooth): string {
    return booth.boothNumber ? `${booth.name} · #${booth.boothNumber}` : booth.name;
  }

  private runSearch(query: string): void {
    this._askSubscription?.unsubscribe();
    this._answerSubscription?.unsubscribe();
    this.stopReveal();
    this.isSearching = true;
    this.errorMessage = '';
    this.actionError = '';
    this.answerState = 'idle';
    this.answer = null;
    this.segments = [];
    this.activeTab = 'all';

    this._askSubscription = this._toolsService
      .call<IAskResult>('ask', { query, attendeeId: this._meService.attendeeId ?? undefined })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.isSearching = false;
          this.fetchAnswer(result);
        },
        error: (error: unknown) => {
          console.error('Search failed', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isSearching = false;
        },
      });
  }

  private fetchAnswer(result: IAskResult, attempt = 1): void {
    if (result.topIds.length === 0) {
      this.answerState = 'fallback';

      return;
    }

    this.answerState = 'loading';
    this._answerSubscription = this._toolsService
      .call<IAskAnswer>('ask_answer', { query: result.query, resultIds: result.topIds }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (answer) => {
          if (answer.pending && attempt < searchSettings.ANSWER_ATTEMPTS && this.result === result) {
            this.fetchAnswer(result, attempt + 1);

            return;
          }

          if (answer.provider === 'fallback' || answer.citations.length === 0) {
            this.answerState = 'fallback';

            return;
          }

          this.answer = answer;
          this.segments = SearchHelper.segments(answer.answer);
          this.answerState = 'ready';
          this.startReveal(answer.answer.split(/\s+/).length);
        },
        error: (error: unknown) => {
          console.error('AI answer failed', error);
          this.answerState = 'fallback';
        },
      });
  }

  private startReveal(totalWords: number): void {
    this.stopReveal();
    this.revealedWords = 0;
    this._revealTimer = setInterval(() => {
      this.revealedWords += 1;

      if (this.revealedWords >= totalWords) {
        this.stopReveal();
        this.revealedWords = Number.MAX_SAFE_INTEGER;
      }
    }, searchSettings.REVEAL_WORD_MS);
  }

  private stopReveal(): void {
    if (this._revealTimer !== undefined) {
      clearInterval(this._revealTimer);
      this._revealTimer = undefined;
    }
  }

  private loadMeets(): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId) {
      return;
    }

    this._toolsService
      .call<IMeet[]>('list_meets', { attendeeId }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (meets) => (this.meetsByPartner = SearchHelper.meetsByPartner(meets)),
        error: (error: unknown) => console.error('Could not load meets', error),
      });
  }

  private startMeetPolling(): void {
    interval(searchSettings.MEET_POLL_MS)
      .pipe(
        filter(() => document.visibilityState === 'visible' && this.sendingIds.size === 0),
        filter(() => [...this.meetsByPartner.values()].some((meet) => meet.status === 'proposed')),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => this.loadMeets());
  }
}

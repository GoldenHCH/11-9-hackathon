import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { INotification } from '../../core/api.types';
import { MeService } from '../../core/services/me.service';
import { RelativeTimeHelper } from '../helpers/relative-time.helper';
import { notificationCopy, notificationPolling, notificationTypeLabels } from '../notifications.constants';
import { NotificationsService } from '../services/notifications.service';

@Component({
  selector: 'app-notification-bell',
  imports: [AsyncPipe, MatButtonModule, MatIconModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent implements OnInit {
  private readonly _notificationsService = inject(NotificationsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private _toastTimer?: ReturnType<typeof setTimeout>;

  @ViewChild('panel') private _panel?: ElementRef<HTMLElement>;
  @ViewChild('bellButton') private _bellButton?: ElementRef<HTMLButtonElement>;

  public readonly state$ = this._notificationsService.state$;
  public readonly typeLabels = notificationTypeLabels;
  public readonly copy = notificationCopy;
  public isOpen = false;
  public toast: INotification | null = null;

  public get isSignedIn(): boolean {
    return this._meService.attendeeId !== null;
  }

  public ngOnInit(): void {
    this._notificationsService.start();
    this._notificationsService.arrivals$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((item) => this.showToast(item));
    this._router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => {
        this.isOpen = false;
      });
    this._destroyRef.onDestroy(() => clearTimeout(this._toastTimer));
  }

  public badgeText(unread: number): string {
    return unread > 9 ? '9+' : String(unread);
  }

  public relativeTime(iso: string): string {
    return RelativeTimeHelper.since(iso);
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();

      return;
    }

    this.isOpen = true;
    this._notificationsService.refresh();
    setTimeout(() => this._panel?.nativeElement.focus());
  }

  public close(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this._bellButton?.nativeElement.focus();
  }

  public openItem(item: INotification): void {
    this.isOpen = false;
    this.dismissToast();

    if (item.readAt === null) {
      this._notificationsService.markRead([item.id]).pipe(takeUntilDestroyed(this._destroyRef)).subscribe();
    }

    void this._router.navigateByUrl(item.link);
  }

  public markAllRead(): void {
    this._notificationsService.markAllRead().pipe(takeUntilDestroyed(this._destroyRef)).subscribe();
  }

  public dismissToast(): void {
    clearTimeout(this._toastTimer);
    this.toast = null;
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    this.close();
  }

  private showToast(item: INotification): void {
    if (this.isOpen) {
      return;
    }

    clearTimeout(this._toastTimer);
    this.toast = item;
    this._toastTimer = setTimeout(() => {
      this.toast = null;
    }, notificationPolling.TOAST_MS);
  }
}

import { Component, Input, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MeService } from '../core/services/me.service';

@Component({
  selector: 'app-me-link',
  template: `<p class="app-page">Signing you in…</p>`,
})
export class MeLinkComponent implements OnInit {
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);

  @Input() public attendeeId = '';
  @Input() public next = '';

  public ngOnInit(): void {
    if (this.attendeeId) {
      this._meService.setAttendeeId(this.attendeeId);
    }

    const destination = this.next.startsWith('/') && !this.next.startsWith('//') ? this.next : '/meets';
    void this._router.navigateByUrl(destination, { replaceUrl: true });
  }
}

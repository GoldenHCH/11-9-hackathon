import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AccessKeyService, ISavedBooth } from '../../core/services/access-key.service';
import { AccessGateComponent } from '../../shared/components/access-gate/access-gate.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StaffHelper } from '../staff.helper';

@Component({
  selector: 'app-exhibitor-home',
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink, AccessGateComponent, ScreenToolbarComponent],
  templateUrl: './exhibitor-home.component.html',
  styleUrl: './exhibitor-home.component.scss',
})
export class ExhibitorHomeComponent implements OnInit {
  private readonly _accessKeyService = inject(AccessKeyService);
  private readonly _router = inject(Router);

  public savedBooths: ISavedBooth[] = [];
  public hasAdminKey = false;
  public linkError = '';
  public liveMessage = '';

  public ngOnInit(): void {
    this._refresh();
  }

  public openLink(text: string): void {
    const link = StaffHelper.parseStaffLink(text, window.location.origin);

    if (!link?.outpostId) {
      this.linkError = 'That doesn’t look like a staff link. It should end in /exhibitor/<booth>?k=…';

      return;
    }

    this.linkError = '';
    void this._router.navigate(['/exhibitor', link.outpostId], { queryParams: { k: link.key } });
  }

  public forget(booth: ISavedBooth): void {
    this._accessKeyService.forgetBooth(booth.outpostId);
    this._refresh();
    this.liveMessage = `Forgot ${booth.name} on this device`;
  }

  private _refresh(): void {
    this.savedBooths = this._accessKeyService.savedBooths;
    this.hasAdminKey = this._accessKeyService.adminKey !== null;
  }
}

import { Component, Input, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const copiedResetMs = 2000;

@Component({
  selector: 'app-copy-link',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="copy-link kq-block">
      <p class="copy-link-title kq-pixel">{{ title }}</p>
      <p class="copy-link-hint">{{ hint }}</p>
      <code class="copy-link-url">{{ link }}</code>
      <button mat-flat-button type="button" class="copy-link-button" (click)="copy()">
        <div class="btn-content">
          <mat-icon aria-hidden="true">{{ isCopied ? 'check' : 'content_copy' }}</mat-icon>
          <span>{{ isCopied ? 'Copied' : 'Copy my link' }}</span>
        </div>
      </button>
      <span class="kq-visually-hidden" aria-live="polite">{{ isCopied ? 'Link copied' : '' }}</span>
    </div>
  `,
  styles: [
    `
      .copy-link {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
      }

      .copy-link-title {
        margin: 0;
        font-size: 14px;
        color: var(--kq-accent);
      }

      .copy-link-hint {
        margin: 0;
        color: var(--kq-muted);
        font-size: 14px;
      }

      .copy-link-url {
        display: block;
        padding: 8px;
        background: var(--kq-bg);
        border: 2px solid var(--kq-border);
        font-size: 13px;
        word-break: break-all;
        user-select: all;
      }

      .copy-link-button {
        width: 100%;
      }
    `,
  ],
})
export class CopyLinkComponent implements OnDestroy {
  private _resetTimer: ReturnType<typeof setTimeout> | undefined;

  @Input({ required: true }) public link = '';
  @Input() public title = 'This link is your login. Save it';
  @Input() public hint = 'Open it on another phone or laptop to keep playing. Anyone with it can play as you.';

  public isCopied = false;

  public async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link);
    } catch {
      this._fallbackCopy();
    }

    this.isCopied = true;
    clearTimeout(this._resetTimer);
    this._resetTimer = setTimeout(() => (this.isCopied = false), copiedResetMs);
  }

  public ngOnDestroy(): void {
    clearTimeout(this._resetTimer);
  }

  private _fallbackCopy(): void {
    const textArea = document.createElement('textarea');
    textArea.value = this.link;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
    } catch (error) {
      console.error('Could not copy the link', error);
    }

    textArea.remove();
  }
}

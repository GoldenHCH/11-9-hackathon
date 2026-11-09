import { Component, Input } from '@angular/core';
import { ILinkItem, LinkNetwork } from '../../core/api.types';
import { linkNetworkColors, linkNetworkOptions } from '../links.constants';

@Component({
  selector: 'app-link-chips',
  templateUrl: './link-chips.component.html',
  styleUrl: './link-chips.component.scss',
})
export class LinkChipsComponent {
  @Input({ required: true }) public items: ILinkItem[] = [];

  public glyph(network: LinkNetwork): string {
    return linkNetworkOptions.find((option) => option.network === network)?.glyph ?? '';
  }

  public networkLabel(network: LinkNetwork): string {
    return linkNetworkOptions.find((option) => option.network === network)?.label ?? network;
  }

  public color(network: LinkNetwork): string {
    return linkNetworkColors[network];
  }
}

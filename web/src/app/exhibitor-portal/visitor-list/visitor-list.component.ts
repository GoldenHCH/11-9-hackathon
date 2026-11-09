import { Component, Input } from '@angular/core';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { IVisitorRow } from '../staff.interfaces';

@Component({
  selector: 'app-visitor-list',
  imports: [PixelFaceComponent],
  templateUrl: './visitor-list.component.html',
  styleUrl: './visitor-list.component.scss',
})
export class VisitorListComponent {
  @Input({ required: true }) public visitors: IVisitorRow[] = [];
  @Input() public label = '';
  @Input() public emptyMessage = 'Nobody yet.';
}

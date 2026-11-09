import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ScreenToolbarComponent } from '../screen-toolbar/screen-toolbar.component';

@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink, MatIconModule, ScreenToolbarComponent],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss',
})
export class ComingSoonComponent {
  @Input() public title = '';
  @Input() public icon = 'construction';
  @Input() public message = '';
}

import { Component, Input } from '@angular/core';
import { IMiniMap } from '../exhibitors.interfaces';

@Component({
  selector: 'app-expo-mini-map',
  templateUrl: './expo-mini-map.component.html',
  styleUrl: './expo-mini-map.component.scss',
})
export class ExpoMiniMapComponent {
  @Input({ required: true }) public map!: IMiniMap;
  @Input({ required: true }) public ariaLabel = '';
}

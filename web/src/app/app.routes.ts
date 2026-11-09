import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'KubeQuest',
    loadComponent: () => import('./home/home.component').then((module) => module.HomeComponent),
  },
  { path: '**', redirectTo: '' },
];

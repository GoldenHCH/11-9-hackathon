import { Type } from '@angular/core';
import { Routes } from '@angular/router';

const placeholder = (): Promise<Type<unknown>> =>
  import('./shared/components/coming-soon/coming-soon.component').then((module) => module.ComingSoonComponent);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'map' },
  {
    path: 'map',
    title: 'Map · KubeQuest',
    loadComponent: () => import('./map/venue-map/venue-map.component').then((module) => module.VenueMapComponent),
  },
  {
    path: 'here',
    title: 'Here · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Here', icon: 'place', message: 'Scan a room’s QR block to see what’s on and who’s around.' },
  },
  {
    path: 'quests',
    title: 'Quests · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Quests', icon: 'flag', message: 'Up to three quests picked for you: a talk, an outpost, a person.' },
  },
  {
    path: 'people',
    title: 'People · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'People', icon: 'group', message: 'Players working on what you’re working on, nearby first.' },
  },
  {
    path: 'board',
    title: 'Leaderboard · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Leaderboard', icon: 'leaderboard', message: 'Top players by XP. Every point opens its trace.' },
  },
  {
    path: 'signup',
    title: 'Join · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Join KubeQuest', icon: 'person_add', message: 'Pick a handle, answer two questions, get your link.' },
  },
  {
    path: 'me/:attendeeId',
    title: 'Me · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Me', icon: 'account_circle', message: 'Your face, XP, banners and personal link.' },
  },
  {
    path: 'r/:locationId',
    title: 'Check in · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Check in', icon: 'qr_code_scanner', message: 'Checking you in…' },
  },
  {
    path: 'quiz/:talkId',
    title: 'Quiz · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Quiz', icon: 'quiz', message: 'Three questions, plain text, no timer.' },
  },
  {
    path: 'intro/:introId',
    title: 'Meet · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Meet quest', icon: 'local_fire_department', message: 'Where and when to meet, and an opening line.' },
  },
  {
    path: 'exhibitors',
    title: 'Booths · KubeQuest',
    loadComponent: () =>
      import('./exhibitors/exhibitor-directory/exhibitor-directory.component').then((module) => module.ExhibitorDirectoryComponent),
  },
  {
    path: 'exhibitors/:outpostId',
    title: 'Booth · KubeQuest',
    loadComponent: () => import('./exhibitors/exhibitor-page/exhibitor-page.component').then((module) => module.ExhibitorPageComponent),
  },
  {
    path: 'exhibitor',
    title: 'Exhibitor · KubeQuest',
    loadComponent: () =>
      import('./exhibitor-portal/exhibitor-home/exhibitor-home.component').then((module) => module.ExhibitorHomeComponent),
  },
  {
    path: 'exhibitor/:outpostId',
    title: 'Booth dashboard · KubeQuest',
    loadComponent: () =>
      import('./exhibitor-portal/exhibitor-dashboard/exhibitor-dashboard.component').then(
        (module) => module.ExhibitorDashboardComponent,
      ),
  },
  {
    path: 'admin',
    title: 'Organizer · KubeQuest',
    loadComponent: () => import('./admin/admin-dashboard/admin-dashboard.component').then((module) => module.AdminDashboardComponent),
  },
  { path: 'organizer', pathMatch: 'full', redirectTo: 'admin' },
  {
    path: 'screen/:locationId',
    title: 'KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Demo screen', icon: 'qr_code_2', message: 'Live QR and top 10.' },
  },
  { path: '**', redirectTo: 'map' },
];

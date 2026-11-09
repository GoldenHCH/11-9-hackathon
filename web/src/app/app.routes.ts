import { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { meGuard } from './core/guards/me.guard';

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
    path: 'meets',
    title: 'Meet · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./meet/meets/meets.component').then((module) => module.MeetsComponent),
  },
  {
    path: 'intro/:introId',
    title: 'Meet · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./meet/meet-detail/meet-detail.component').then((module) => module.MeetDetailComponent),
  },
  {
    path: 'code',
    title: 'My code · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./handshake/my-code/my-code.component').then((module) => module.MyCodeComponent),
  },
  {
    path: 'h/:token',
    title: 'Meeting someone · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () =>
      import('./handshake/handshake-start/handshake-start.component').then((module) => module.HandshakeStartComponent),
  },
  {
    path: 'handshake/:handshakeId',
    title: 'Meet in person · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./handshake/handshake/handshake.component').then((module) => module.HandshakeComponent),
  },
  {
    path: 'r/:locationId',
    title: 'Check in · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./booth/scan-landing/scan-landing.component').then((module) => module.ScanLandingComponent),
  },
  {
    path: 'notes',
    title: 'My notes · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./booth/notes/notes.component').then((module) => module.NotesComponent),
  },
  {
    path: 'recap',
    title: 'Recap · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./recap/recap.component').then((module) => module.RecapComponent),
  },
  {
    path: 'me/:attendeeId',
    title: 'KubeQuest',
    loadComponent: () => import('./me/me-link.component').then((module) => module.MeLinkComponent),
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
    data: {
      title: 'Join KubeQuest',
      icon: 'person_add',
      message: 'Open your personal link to play. Sign-up with a handle and two questions is coming next.',
    },
  },
  {
    path: 'quiz/:talkId',
    title: 'Quiz · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Quiz', icon: 'quiz', message: 'Three questions, plain text, no timer.' },
  },
  {
    path: 'organizer',
    title: 'Organizer · KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Organizer', icon: 'insights', message: 'Room occupancy and the meet funnel.' },
  },
  {
    path: 'screen/:locationId',
    title: 'KubeQuest',
    loadComponent: placeholder,
    data: { title: 'Demo screen', icon: 'qr_code_2', message: 'Live QR and top 10.' },
  },
  { path: '**', redirectTo: 'map' },
];

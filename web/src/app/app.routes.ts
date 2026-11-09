import { Type, inject } from '@angular/core';
import { Routes } from '@angular/router';
import { meGuard } from './core/guards/me.guard';
import { MeService } from './core/services/me.service';

const placeholder = (): Promise<Type<unknown>> =>
  import('./shared/components/coming-soon/coming-soon.component').then((module) => module.ComingSoonComponent);

const entranceRedirect = (): string => (inject(MeService).attendeeId ? '/quests' : '/onboarding');

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: entranceRedirect },
  {
    path: 'onboarding',
    title: 'Join · KubeQuest',
    loadComponent: () => import('./onboarding/onboarding.component').then((module) => module.OnboardingComponent),
  },
  { path: 'signup', redirectTo: 'onboarding' },
  {
    path: 'quests',
    title: 'Quests · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () =>
      import('./quests/quest-board/quest-board.component').then((module) => module.QuestBoardComponent),
  },
  {
    path: 'itinerary',
    title: 'Itinerary · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./itinerary/itinerary.component').then((module) => module.ItineraryComponent),
  },
  {
    path: 'scan',
    title: 'Scan · KubeQuest',
    loadComponent: () => import('./scan/scanner/scanner.component').then((module) => module.ScannerComponent),
  },
  {
    path: 'board',
    title: 'Leaderboard · KubeQuest',
    loadComponent: () =>
      import('./board/leaderboard/leaderboard.component').then((module) => module.LeaderboardComponent),
  },
  {
    path: 'search',
    title: 'Search · KubeQuest',
    loadComponent: () => import('./search/search.component').then((module) => module.SearchComponent),
  },
  {
    path: 'map',
    title: 'Map · KubeQuest',
    loadComponent: () => import('./map/venue-map/venue-map.component').then((module) => module.VenueMapComponent),
  },
  {
    path: 'profile',
    title: 'Profile · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./profile/profile.component').then((module) => module.ProfileComponent),
  },
  {
    path: 'me/:attendeeId',
    title: 'KubeQuest',
    loadComponent: () => import('./me/me-link.component').then((module) => module.MeLinkComponent),
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
    path: 'notes/talks',
    title: 'Talk notes · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () =>
      import('./talk-notes/talk-notes-list/talk-notes-list.component').then((module) => module.TalkNotesListComponent),
  },
  {
    path: 'connections',
    title: 'People met · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () =>
      import('./connections/connections-list/connections-list.component').then((module) => module.ConnectionsListComponent),
  },
  {
    path: 'connections/:connectionId',
    title: 'Connection · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () =>
      import('./connections/connection-detail/connection-detail.component').then((module) => module.ConnectionDetailComponent),
  },
  {
    path: 'links',
    title: 'My links · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./links/links-editor/links-editor.component').then((module) => module.LinksEditorComponent),
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
    path: 'here',
    title: 'Here · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./here/here.component').then((module) => module.HereComponent),
  },
  {
    path: 'people',
    title: 'People · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./people/people/people.component').then((module) => module.PeopleComponent),
  },
  {
    path: 'quiz/:talkId',
    title: 'Quiz · KubeQuest',
    canActivate: [meGuard],
    loadComponent: () => import('./quiz/quiz.component').then((module) => module.QuizComponent),
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
    loadComponent: () => import('./screen/screen.component').then((module) => module.ScreenComponent),
  },
  { path: '**', redirectTo: '' },
];

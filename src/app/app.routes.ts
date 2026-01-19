import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'bitbucket',
        loadComponent: () => import('./features/bitbucket/bitbucket.component').then(m => m.BitbucketComponent)
      },
      {
        path: 'cursor',
        loadComponent: () => import('./features/cursor/cursor.component').then(m => m.CursorComponent)
      },
      {
        path: 'jira',
        loadComponent: () => import('./features/jira/jira.component').then(m => m.JiraComponent)
      },
      {
        path: 'developers',
        loadComponent: () => import('./features/developers/developers.component').then(m => m.DevelopersComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];

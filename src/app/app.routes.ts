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
        path: 'github',
        loadComponent: () => import('./features/github/github.component').then(m => m.GithubComponent)
      },
      {
        path: 'github/developer/:githubUsername',
        loadComponent: () => import('./features/github/github-developer-detail.component').then(m => m.GithubDeveloperDetailComponent)
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
        path: 'mabl',
        loadComponent: () => import('./features/mabl/mabl.component').then(m => m.MablComponent)
      },
      {
        path: 'developers',
        loadComponent: () => import('./features/developers/developers.component').then(m => m.DevelopersComponent)
      },
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent)
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

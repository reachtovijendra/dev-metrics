import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent],
  template: `
    <div class="layout" [class.sidebar-collapsed]="sidebarCollapsed()">
      <app-sidebar (collapseChange)="onSidebarCollapse($event)" />
      
      <div class="main-content">
        <app-header [pageTitle]="pageTitle()" />
        
        <main class="content-area">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      background: var(--surface-ground);
    }

    .main-content {
      flex: 1;
      margin-left: 260px;
      transition: margin-left 0.3s ease;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .sidebar-collapsed .main-content {
      margin-left: 70px;
    }

    .content-area {
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
    }

    @media (max-width: 768px) {
      .main-content {
        margin-left: 0;
      }
    }
  `]
})
export class MainLayoutComponent {
  sidebarCollapsed = signal(false);
  pageTitle = signal('Dashboard');

  onSidebarCollapse(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }
}



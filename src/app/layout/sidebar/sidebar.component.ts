import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { CredentialsService } from '../../core/services/credentials.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, TooltipModule, RippleModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-header">
        <div class="logo" *ngIf="!collapsed">
          <i class="pi pi-chart-bar"></i>
          <span>Dev Metrics</span>
        </div>
        <div class="logo-mini" *ngIf="collapsed">
          <i class="pi pi-chart-bar"></i>
        </div>
      </div>

      <nav class="sidebar-nav">
        @for (item of navItems; track item.route) {
          <a 
            [routerLink]="item.route" 
            routerLinkActive="active"
            class="nav-item"
            [pTooltip]="collapsed ? item.label : ''"
            tooltipPosition="right"
            pRipple
          >
            <i [class]="'pi ' + item.icon"></i>
            <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
            @if (item.badge && !collapsed) {
              <span class="nav-badge">{{ item.badge }}</span>
            }
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        <div class="connection-status" *ngIf="!collapsed">
          <div class="status-item" [class.connected]="credentialsService.hasBitbucketCredentials()">
            <i class="pi pi-server"></i>
            <span>Bitbucket</span>
          </div>
          <div class="status-item" [class.connected]="credentialsService.hasCursorCredentials()">
            <i class="pi pi-code"></i>
            <span>Cursor</span>
          </div>
          <div class="status-item" [class.connected]="credentialsService.hasJiraCredentials()">
            <i class="pi pi-ticket"></i>
            <span>JIRA</span>
          </div>
        </div>
        
        <button 
          pButton 
          pRipple 
          [icon]="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
          class="collapse-btn"
          (click)="toggleCollapse()"
          [pTooltip]="collapsed ? 'Expand' : 'Collapse'"
          tooltipPosition="right"
        ></button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      height: 100vh;
      background: var(--surface-card);
      border-right: 1px solid var(--surface-border);
      display: flex;
      flex-direction: column;
      transition: width 0.3s ease;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;

      &.collapsed {
        width: 70px;
      }
    }

    .sidebar-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--primary-color);
      font-size: 1.25rem;
      font-weight: 700;

      i {
        font-size: 1.5rem;
      }
    }

    .logo-mini {
      display: flex;
      justify-content: center;
      color: var(--primary-color);
      font-size: 1.5rem;
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0.75rem;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-radius: 8px;
      color: var(--text-color-secondary);
      text-decoration: none;
      transition: all 0.2s ease;
      margin-bottom: 0.25rem;

      &:hover {
        background: var(--surface-hover);
        color: var(--text-color);
      }

      &.active {
        background: var(--primary-color);
        color: var(--primary-color-text);
      }

      i {
        font-size: 1.125rem;
        width: 20px;
        text-align: center;
      }
    }

    .nav-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nav-badge {
      margin-left: auto;
      background: var(--primary-color);
      color: var(--primary-color-text);
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: 10px;
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--surface-border);
    }

    .connection-status {
      margin-bottom: 1rem;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      color: var(--text-color-secondary);
      font-size: 0.875rem;

      i {
        width: 16px;
        text-align: center;
      }

      &.connected {
        color: #22c55e;
      }
    }

    .collapse-btn {
      width: 100%;
      justify-content: center;
    }

    .collapsed {
      .nav-item {
        justify-content: center;
        padding: 0.875rem;
      }

      .collapse-btn {
        padding: 0.5rem;
      }
    }
  `]
})
export class SidebarComponent {
  credentialsService = inject(CredentialsService);
  
  collapsed = false;
  collapseChange = output<boolean>();

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'pi-home', route: '/dashboard' },
    { label: 'Bitbucket', icon: 'pi-github', route: '/bitbucket' },
    { label: 'Cursor AI', icon: 'pi-sparkles', route: '/cursor' },
    { label: 'JIRA', icon: 'pi-ticket', route: '/jira' },
    { label: 'Developers', icon: 'pi-users', route: '/developers' },
    { label: 'Settings', icon: 'pi-cog', route: '/settings' }
  ];

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapseChange.emit(this.collapsed);
  }
}




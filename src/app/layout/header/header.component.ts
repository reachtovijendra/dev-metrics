import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, ToggleSwitchModule, FormsModule],
  template: `
    <header class="header">
      <div class="header-left">
        <h1 class="page-title">{{ pageTitle() }}</h1>
      </div>

      <div class="header-right">
        <div class="theme-toggle">
          <i class="pi pi-sun" [class.active]="!themeService.isDarkMode()"></i>
          <p-toggleswitch 
            [ngModel]="themeService.isDarkMode()"
            (ngModelChange)="themeService.toggleTheme()"
          />
          <i class="pi pi-moon" [class.active]="themeService.isDarkMode()"></i>
        </div>

        <button 
          pButton 
          icon="pi pi-bell" 
          class="p-button-text p-button-rounded"
          pTooltip="Notifications"
          tooltipPosition="bottom"
        ></button>

        <button 
          pButton 
          icon="pi pi-refresh" 
          class="p-button-text p-button-rounded"
          pTooltip="Refresh Data"
          tooltipPosition="bottom"
          (click)="refreshData()"
        ></button>

        <div class="user-info">
          <span class="user-name">Admin</span>
          <div class="user-avatar">
            <i class="pi pi-user"></i>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: 64px;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      position: sticky;
      top: 0;
      z-index: 90;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1rem;
      
      i {
        color: var(--text-color-secondary);
        transition: color 0.2s ease;

        &.active {
          color: var(--primary-color);
        }
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: 0.5rem;
      padding-left: 1rem;
      border-left: 1px solid var(--surface-border);
    }

    .user-name {
      color: var(--text-color);
      font-weight: 500;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--surface-hover);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-color-secondary);
    }
  `]
})
export class HeaderComponent {
  themeService = inject(ThemeService);
  
  pageTitle = input<string>('Dashboard');

  refreshData(): void {
    // Emit refresh event - will be handled by parent components
    window.dispatchEvent(new CustomEvent('refresh-data'));
  }
}



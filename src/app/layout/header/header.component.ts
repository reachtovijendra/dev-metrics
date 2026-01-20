import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MultiSelectModule } from 'primeng/multiselect';
import { CalendarModule } from 'primeng/calendar';
import { ThemeService } from '../../core/services/theme.service';
import { FilterService } from '../../core/services/filter.service';
import { PageHeaderService } from '../../core/services/page-header.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    ToggleSwitchModule,
    MultiSelectModule,
    CalendarModule
  ],
  template: `
    <header class="header">
      <div class="header-left">
        <div class="page-title-section">
          <i class="pi" [ngClass]="pageHeaderService.pageIcon()"></i>
          <h1 class="page-title">{{ pageHeaderService.pageTitle() }}</h1>
        </div>
        
        <div class="header-filters">
          <p-multiSelect
            [options]="filterService.managerOptions()"
            [ngModel]="filterService.selectedManagers()"
            (ngModelChange)="filterService.setManagers($event)"
            placeholder="Manager"
            [showClear]="true"
            [filter]="true"
            filterPlaceholder="Search..."
            [maxSelectedLabels]="1"
            [style]="{'min-width': '10rem'}"
            appendTo="body"
          />
          <p-multiSelect
            [options]="filterService.departmentOptions()"
            [ngModel]="filterService.selectedDepartments()"
            (ngModelChange)="filterService.setDepartments($event)"
            placeholder="Department"
            [showClear]="true"
            [filter]="true"
            filterPlaceholder="Search..."
            [maxSelectedLabels]="1"
            [style]="{'min-width': '10rem'}"
            appendTo="body"
          />
          <p-multiSelect
            [options]="filterService.innovationTeamOptions()"
            [ngModel]="filterService.selectedInnovationTeams()"
            (ngModelChange)="filterService.setInnovationTeams($event)"
            placeholder="Team"
            [showClear]="true"
            [filter]="true"
            filterPlaceholder="Search..."
            [maxSelectedLabels]="1"
            [style]="{'min-width': '10rem'}"
            appendTo="body"
          />
          @if (filterService.hasActiveFilters()) {
            <button 
              pButton 
              icon="pi pi-filter-slash" 
              class="p-button-text p-button-rounded p-button-danger"
              pTooltip="Clear All Filters"
              tooltipPosition="bottom"
              (click)="filterService.clearFilters()"
            ></button>
          }
        </div>
      </div>

      <div class="header-right">
        @if (pageHeaderService.showDatePicker()) {
          <div class="date-filter">
            <p-calendar 
              [ngModel]="pageHeaderService.dateRange()"
              (ngModelChange)="onDateChange($event)"
              selectionMode="range" 
              [readonlyInput]="true"
              dateFormat="M dd, yy"
              placeholder="Select date range"
              [showIcon]="true"
            />
            <button 
              pButton
              icon="pi pi-refresh"
              class="p-button-text p-button-rounded"
              [class.p-button-loading]="pageHeaderService.loading()"
              pTooltip="Refresh Data"
              tooltipPosition="bottom"
              (click)="pageHeaderService.triggerRefresh()"
              [disabled]="pageHeaderService.loading()"
            ></button>
          </div>
        }

        <div class="theme-toggle">
          <i class="pi pi-sun" [class.active]="!themeService.isDarkMode()"></i>
          <p-toggleswitch 
            [ngModel]="themeService.isDarkMode()"
            (ngModelChange)="themeService.toggleTheme()"
          />
          <i class="pi pi-moon" [class.active]="themeService.isDarkMode()"></i>
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
      gap: 2rem;
    }

    .page-title-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      
      i {
        font-size: 1.25rem;
        color: var(--primary-color);
      }
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
      white-space: nowrap;
    }

    .header-filters {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    .date-filter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      :host ::ng-deep .p-calendar .p-inputtext {
        width: 280px;
      }
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-left: 0.75rem;
      border-left: 1px solid var(--surface-border);
      flex-shrink: 0;
      
      i {
        color: var(--text-color-secondary);
        transition: color 0.2s ease;

        &.active {
          color: var(--primary-color);
        }
      }
    }

    /* Large screens - show everything */
    @media (max-width: 1400px) {
      .header-filters {
        gap: 0.25rem;
      }
      
      :host ::ng-deep .header-filters .p-multiselect {
        min-width: 8rem !important;
      }
    }

    /* Medium screens - hide filters */
    @media (max-width: 1200px) {
      .header-filters {
        display: none;
      }
    }

    /* Small screens - hide date filter too */
    @media (max-width: 900px) {
      .date-filter {
        display: none;
      }
    }

    /* Very small screens */
    @media (max-width: 768px) {
      .header {
        padding: 0 1rem;
      }
      
      .page-title {
        font-size: 1rem;
      }
    }
  `]
})
export class HeaderComponent {
  themeService = inject(ThemeService);
  filterService = inject(FilterService);
  pageHeaderService = inject(PageHeaderService);
  
  onDateChange(range: Date[]): void {
    if (range && range.length === 2 && range[0] && range[1]) {
      this.pageHeaderService.setDateRange(range);
      // Trigger data refresh after date change
      this.pageHeaderService.triggerRefresh();
    }
  }
}

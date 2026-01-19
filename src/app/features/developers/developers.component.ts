import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogModule } from 'primeng/dialog';
import { ChartModule } from 'primeng/chart';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { CredentialsService } from '../../core/services/credentials.service';
import { BitbucketService, DeveloperBitbucketData } from '../../core/services/bitbucket.service';

interface DeveloperSummary {
  id: string;
  name: string;
  email: string;
  team: string;
  bitbucket: {
    prs: number;
    reviews: number;
    merged: number;
    linesAdded: number;
    linesRemoved: number;
  };
  cursor: {
    linesGenerated: number;
    acceptanceRate: number;
  };
  jira: {
    ticketsCompleted: number;
    defectRate: number;
  };
  overallScore: number;
}

@Component({
  selector: 'app-developers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    CalendarModule,
    DropdownModule,
    SkeletonModule,
    ProgressSpinnerModule,
    DialogModule,
    ChartModule,
    DividerModule,
    TooltipModule,
    DecimalPipe
  ],
  template: `
    <div class="developers-page">
      <div class="page-header">
        <div class="header-info">
          <h2><i class="pi pi-users"></i> Developers</h2>
          <p>Comprehensive view of all developer metrics across platforms</p>
        </div>
        
        <div class="header-actions">
          <p-calendar 
            [(ngModel)]="dateRange" 
            selectionMode="range" 
            [readonlyInput]="true"
            dateFormat="M dd, yy"
            placeholder="Select date range"
            [showIcon]="true"
            [maxDate]="maxDate"
            (onSelect)="onDateChange()"
            styleClass="date-picker"
          />
          <span class="p-input-icon-left search-wrapper">
            <i class="pi pi-search"></i>
            <input 
              pInputText 
              [(ngModel)]="searchTerm"
              placeholder="Search developers..."
              (input)="onSearch()"
            />
          </span>
          <p-dropdown 
            [options]="teamOptions" 
            [(ngModel)]="selectedTeam"
            placeholder="All Teams"
            [showClear]="true"
            (onChange)="onFilterChange()"
          />
          <p-button 
            icon="pi pi-refresh" 
            [loading]="loading()"
            (onClick)="refreshData()"
            pTooltip="Force refresh from Bitbucket (bypasses cache)"
          />
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">{{ developers.length }}</span>
          <span class="stat-label">Total Developers</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ getAverageScore() }}</span>
          <span class="stat-label">Avg Performance Score</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ getTotalPRs() }}</span>
          <span class="stat-label">Total PRs This Month</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ getTotalTickets() }}</span>
          <span class="stat-label">Tickets Completed</span>
        </div>
      </div>

      <!-- Developer Cards/Table -->
      <p-card styleClass="developers-card">
        <p-table 
          [value]="filteredDevelopers" 
          [paginator]="true" 
          [rows]="10"
          [rowsPerPageOptions]="[5, 10, 25, 50]"
          [globalFilterFields]="['name', 'email', 'team']"
          [sortField]="'overallScore'"
          [sortOrder]="-1"
          styleClass="p-datatable-sm developers-table"
        >
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="name" style="width: 25%">
                Developer <p-sortIcon field="name" />
              </th>
              <th style="width: 15%">Bitbucket</th>
              <th style="width: 15%">Cursor AI</th>
              <th style="width: 15%">JIRA</th>
              <th pSortableColumn="overallScore" style="width: 15%">
                Score <p-sortIcon field="overallScore" />
              </th>
              <th style="width: 15%">Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-dev>
            <tr class="developer-row">
              <td>
                <div class="developer-cell">
                  <div class="avatar" [style.background]="getAvatarGradient(dev.name)">
                    {{ getInitials(dev.name) }}
                  </div>
                  <div class="dev-info">
                    <span class="dev-name">{{ dev.name }}</span>
                    <p-tag [value]="dev.team" severity="info" styleClass="team-tag" />
                  </div>
                </div>
              </td>
              <td>
                <div class="platform-metrics">
                  <div class="metric-row">
                    <span class="metric-label">PRs:</span>
                    <span class="metric-value">{{ dev.bitbucket.prs }}</span>
                  </div>
                  <div class="metric-row">
                    <span class="metric-label">Reviews:</span>
                    <span class="metric-value">{{ dev.bitbucket.reviews }}</span>
                  </div>
                  <div class="metric-row">
                    <span class="metric-label">Lines:</span>
                    <span class="metric-value lines-added">+{{ dev.bitbucket.linesAdded | number }}</span>
                    <span class="metric-value lines-removed">-{{ dev.bitbucket.linesRemoved | number }}</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="platform-metrics">
                  <div class="metric-row">
                    <span class="metric-label">AI Lines:</span>
                    <span class="metric-value">{{ dev.cursor.linesGenerated | number }}</span>
                  </div>
                  <div class="metric-row">
                    <span class="metric-label">Accept Rate:</span>
                    <span class="metric-value">{{ dev.cursor.acceptanceRate }}%</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="platform-metrics">
                  <div class="metric-row">
                    <span class="metric-label">Tickets:</span>
                    <span class="metric-value">{{ dev.jira.ticketsCompleted }}</span>
                  </div>
                  <div class="metric-row">
                    <span class="metric-label">Defect Rate:</span>
                    <span class="metric-value" [class.warning]="dev.jira.defectRate > 10">{{ dev.jira.defectRate }}%</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="score-cell">
                  <div class="score-badge" [class]="getScoreClass(dev.overallScore)">
                    {{ dev.overallScore }}
                  </div>
                  <span class="score-label">{{ getScoreLabel(dev.overallScore) }}</span>
                </div>
              </td>
              <td>
                <div class="actions-cell">
                  <p-button 
                    icon="pi pi-eye" 
                    [rounded]="true" 
                    [text]="true"
                    pTooltip="View Details"
                    (onClick)="showDetailsDialog(dev)"
                  />
                  <p-button 
                    icon="pi pi-chart-bar" 
                    [rounded]="true" 
                    [text]="true"
                    pTooltip="View Charts"
                    (onClick)="showChartsDialog(dev)"
                  />
                </div>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" class="empty-message">
                @if (loading()) {
                  <p-progressSpinner strokeWidth="4" />
                  <p>Loading developers from Bitbucket...</p>
                } @else if (!credentialsService.hasBitbucketCredentials()) {
                  <i class="pi pi-exclamation-triangle"></i>
                  <p>Please configure Bitbucket credentials in Settings first.</p>
                } @else {
                  <i class="pi pi-users"></i>
                  <p>No developers found matching your criteria.</p>
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Details Dialog -->
      <p-dialog 
        [(visible)]="detailsDialogVisible" 
        [modal]="true"
        [style]="{ width: '650px' }"
        [draggable]="false"
        [resizable]="false"
        [showHeader]="false"
        styleClass="dev-details-dialog"
      >
        @if (selectedDeveloper) {
          <div class="dialog-content">
            <!-- Custom Header -->
            <div class="dialog-header">
              <div class="dev-profile">
                <div class="avatar-xl" [style.background]="getAvatarGradient(selectedDeveloper.name)">
                  {{ getInitials(selectedDeveloper.name) }}
                </div>
                <div class="profile-info">
                  <h2>{{ selectedDeveloper.name }}</h2>
                  <span class="email">{{ selectedDeveloper.email }}</span>
                  <p-tag [value]="selectedDeveloper.team" severity="secondary" styleClass="team-badge" />
                </div>
              </div>
              <div class="score-container">
                <div class="score-ring" [class]="getScoreClass(selectedDeveloper.overallScore)">
                  <span class="score-value">{{ selectedDeveloper.overallScore }}</span>
                </div>
                <span class="score-text">{{ getScoreLabel(selectedDeveloper.overallScore) }}</span>
              </div>
              <button class="close-btn" (click)="detailsDialogVisible = false">
                <i class="pi pi-times"></i>
              </button>
            </div>

            <!-- Metrics Sections -->
            <div class="metrics-panels">
              <!-- Bitbucket Section -->
              <div class="metric-panel bitbucket">
                <div class="panel-header">
                  <i class="pi pi-github"></i>
                  <span>Bitbucket</span>
                </div>
                <div class="panel-stats">
                  <div class="stat-box">
                    <span class="stat-number">{{ selectedDeveloper.bitbucket.prs }}</span>
                    <span class="stat-label">PRs Created</span>
                  </div>
                  <div class="stat-box">
                    <span class="stat-number">{{ selectedDeveloper.bitbucket.reviews }}</span>
                    <span class="stat-label">Reviews</span>
                  </div>
                  <div class="stat-box">
                    <span class="stat-number">{{ selectedDeveloper.bitbucket.merged }}</span>
                    <span class="stat-label">Merged</span>
                  </div>
                  <div class="stat-box highlight">
                    <span class="stat-number">{{ getMergeRateForDev(selectedDeveloper) }}%</span>
                    <span class="stat-label">Merge Rate</span>
                  </div>
                </div>
                <div class="lines-bar">
                  <div class="line-stat added">
                    <i class="pi pi-arrow-up"></i>
                    <span>+{{ selectedDeveloper.bitbucket.linesAdded | number }}</span>
                  </div>
                  <div class="line-stat removed">
                    <i class="pi pi-arrow-down"></i>
                    <span>-{{ selectedDeveloper.bitbucket.linesRemoved | number }}</span>
                  </div>
                </div>
              </div>

              <!-- Cursor AI Section -->
              <div class="metric-panel cursor disabled-panel">
                <div class="panel-header">
                  <i class="pi pi-code"></i>
                  <span>Cursor AI</span>
                  <p-tag value="Coming Soon" severity="warn" styleClass="soon-badge" />
                </div>
                <div class="panel-stats">
                  <div class="stat-box">
                    <span class="stat-number">--</span>
                    <span class="stat-label">AI Lines</span>
                  </div>
                  <div class="stat-box">
                    <span class="stat-number">--</span>
                    <span class="stat-label">Accept Rate</span>
                  </div>
                </div>
              </div>

              <!-- JIRA Section -->
              <div class="metric-panel jira disabled-panel">
                <div class="panel-header">
                  <i class="pi pi-ticket"></i>
                  <span>JIRA</span>
                  <p-tag value="Coming Soon" severity="warn" styleClass="soon-badge" />
                </div>
                <div class="panel-stats">
                  <div class="stat-box">
                    <span class="stat-number">--</span>
                    <span class="stat-label">Tickets</span>
                  </div>
                  <div class="stat-box">
                    <span class="stat-number">--</span>
                    <span class="stat-label">Defect Rate</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </p-dialog>

      <!-- Charts Dialog -->
      <p-dialog 
        [(visible)]="chartsDialogVisible" 
        [modal]="true"
        [style]="{ width: '750px' }"
        [draggable]="false"
        [resizable]="false"
        [showHeader]="false"
        styleClass="dev-charts-dialog"
      >
        @if (selectedDeveloper) {
          <div class="dialog-content">
            <!-- Custom Header -->
            <div class="charts-header">
              <div class="header-left">
                <div class="avatar-sm" [style.background]="getAvatarGradient(selectedDeveloper.name)">
                  {{ getInitials(selectedDeveloper.name) }}
                </div>
                <div>
                  <h2>{{ selectedDeveloper.name }}</h2>
                  <span class="subtitle">Activity Overview</span>
                </div>
              </div>
              <button class="close-btn" (click)="chartsDialogVisible = false">
                <i class="pi pi-times"></i>
              </button>
            </div>

            <!-- Charts Grid -->
            <div class="charts-grid">
              <div class="chart-panel">
                <div class="chart-title">
                  <i class="pi pi-chart-bar"></i>
                  <span>Pull Request Activity</span>
                </div>
                <div class="chart-wrapper">
                  <p-chart type="bar" [data]="developerPrChart" [options]="chartOptions" height="220" />
                </div>
              </div>
              <div class="chart-panel">
                <div class="chart-title">
                  <i class="pi pi-chart-pie"></i>
                  <span>Lines of Code</span>
                </div>
                <div class="chart-wrapper">
                  <p-chart type="doughnut" [data]="developerLinesChart" [options]="doughnutOptions" height="220" />
                </div>
              </div>
            </div>

            <!-- Quick Stats -->
            <div class="quick-stats">
              <div class="quick-stat">
                <span class="qs-value">{{ selectedDeveloper.bitbucket.prs + selectedDeveloper.bitbucket.reviews }}</span>
                <span class="qs-label">Total PR Interactions</span>
              </div>
              <div class="quick-stat">
                <span class="qs-value">{{ selectedDeveloper.bitbucket.linesAdded + selectedDeveloper.bitbucket.linesRemoved | number }}</span>
                <span class="qs-label">Total Lines Changed</span>
              </div>
              <div class="quick-stat">
                <span class="qs-value">{{ getMergeRateForDev(selectedDeveloper) }}%</span>
                <span class="qs-label">Success Rate</span>
              </div>
            </div>
          </div>
        }
      </p-dialog>
    </div>
  `,
  styles: [`
    .developers-page {
      animation: fadeIn 0.3s ease-out;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-info {
      h2 {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--text-color);
        margin-bottom: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;

        i {
          color: #8b5cf6;
        }
      }

      p {
        color: var(--text-color-secondary);
      }
    }

    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .search-wrapper {
      input {
        padding-left: 2.5rem;
        width: 250px;
      }

      i {
        left: 0.75rem;
        color: var(--text-color-secondary);
      }
    }

    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-item {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--primary-color);
    }

    .stat-label {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    :host ::ng-deep .developers-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;

      .p-card-body {
        padding: 0;
      }
    }

    :host ::ng-deep .developers-table {
      .p-datatable-thead > tr > th {
        background: var(--surface-section);
        padding: 1rem 1.25rem;
      }

      .p-datatable-tbody > tr > td {
        padding: 1rem 1.25rem;
      }
    }

    /* Pagination Dark Mode Styling */
    :host ::ng-deep .p-paginator {
      background: var(--surface-card) !important;
      border: none !important;
      border-top: 1px solid var(--surface-border) !important;
      padding: 0.75rem 1rem;

      .p-paginator-element {
        color: var(--text-color-secondary);
        background: transparent;
        border: none;
        min-width: 2.5rem;
        height: 2.5rem;
        border-radius: 8px;
        transition: all 0.2s;

        &:hover:not(.p-disabled) {
          background: rgba(139, 92, 246, 0.1);
          color: #8b5cf6;
        }

        &.p-highlight {
          background: rgba(139, 92, 246, 0.2) !important;
          color: #8b5cf6 !important;
        }
      }

      .p-dropdown {
        background: var(--surface-ground);
        border: 1px solid var(--surface-border);
        border-radius: 8px;

        .p-dropdown-label {
          color: var(--text-color);
        }

        .p-dropdown-trigger {
          color: var(--text-color-secondary);
        }
      }

      .p-paginator-current {
        color: var(--text-color-secondary);
      }
    }

    :host ::ng-deep .p-dropdown-panel {
      background: var(--surface-overlay) !important;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

      .p-dropdown-items {
        .p-dropdown-item {
          color: var(--text-color);
          padding: 0.75rem 1rem;

          &:hover {
            background: rgba(139, 92, 246, 0.1);
          }

          &.p-highlight {
            background: rgba(139, 92, 246, 0.2);
            color: #8b5cf6;
          }
        }
      }
    }

    .developer-row:hover {
      background: var(--surface-hover);
    }

    .developer-cell {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 1rem;
      flex-shrink: 0;
    }

    .dev-info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dev-name {
      font-weight: 600;
      color: var(--text-color);
      font-size: 1rem;
    }

    :host ::ng-deep .team-tag {
      font-size: 0.7rem;
    }

    .platform-metrics {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .metric-label {
      color: var(--text-color-secondary);
    }

    .metric-value {
      font-weight: 500;
      color: var(--text-color);

      &.warning {
        color: #f59e0b;
      }

      &.lines-added {
        color: #10b981;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.8rem;
      }

      &.lines-removed {
        color: #ef4444;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.8rem;
        margin-left: 0.25rem;
      }
    }

    .score-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.375rem;
    }

    .score-badge {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.125rem;
      color: white;

      &.excellent { background: linear-gradient(135deg, #22c55e, #16a34a); }
      &.good { background: linear-gradient(135deg, #3b82f6, #2563eb); }
      &.average { background: linear-gradient(135deg, #f59e0b, #d97706); }
      &.needs-improvement { background: linear-gradient(135deg, #ef4444, #dc2626); }
    }

    .score-label {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .actions-cell {
      display: flex;
      gap: 0.25rem;
    }

    .empty-message {
      text-align: center;
      padding: 3rem !important;
      color: var(--text-color-secondary);

      i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
    }

    /* ============================================
       DIALOG STYLES - Professional Dark Mode
       ============================================ */

    :host ::ng-deep .dev-details-dialog,
    :host ::ng-deep .dev-charts-dialog {
      .p-dialog {
        background: #1a1a2e;
        border: 1px solid rgba(139, 92, 246, 0.25);
        border-radius: 24px !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 
                    0 0 0 1px rgba(139, 92, 246, 0.1);
        overflow: hidden;
      }

      .p-dialog-content {
        background: transparent;
        padding: 0;
        color: #e2e8f0;
        border-radius: 24px;
      }

      .p-dialog-mask {
        backdrop-filter: blur(4px);
      }
    }

    .dialog-content {
      background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
      border-radius: 24px;
      overflow: hidden;
    }

    /* Details Dialog Header */
    .dialog-header {
      display: flex;
      align-items: center;
      padding: 1.5rem;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      position: relative;
      border-radius: 24px 24px 0 0;
    }

    .dev-profile {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }

    .avatar-xl {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 1.25rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }

    .avatar-sm {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .profile-info {
      h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #f1f5f9;
        margin: 0 0 0.25rem 0;
      }

      .email {
        font-size: 0.8rem;
        color: #94a3b8;
        display: block;
        margin-bottom: 0.5rem;
      }
    }

    :host ::ng-deep .team-badge {
      font-size: 0.65rem;
      padding: 0.2rem 0.5rem;
    }

    .score-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      margin-right: 2.5rem;
    }

    .score-ring {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        padding: 3px;
        background: linear-gradient(135deg, currentColor, transparent);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask-composite: xor;
        -webkit-mask-composite: xor;
      }

      &.excellent { color: #22c55e; background: rgba(34, 197, 94, 0.15); }
      &.good { color: #3b82f6; background: rgba(59, 130, 246, 0.15); }
      &.average { color: #f59e0b; background: rgba(245, 158, 11, 0.15); }
      &.needs-improvement { color: #ef4444; background: rgba(239, 68, 68, 0.15); }

      .score-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: inherit;
      }
    }

    .score-text {
      font-size: 0.7rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }
    }

    /* Metric Panels */
    .metrics-panels {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .metric-panel {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 1rem;
      transition: all 0.2s;

      &:hover:not(.disabled-panel) {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(139, 92, 246, 0.2);
      }

      &.disabled-panel {
        opacity: 0.5;
      }
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #94a3b8;

      i {
        font-size: 1rem;
        color: #8b5cf6;
      }
    }

    :host ::ng-deep .soon-badge {
      font-size: 0.6rem;
      padding: 0.15rem 0.4rem;
      margin-left: auto;
    }

    .panel-stats {
      display: flex;
      gap: 0.75rem;
    }

    .stat-box {
      flex: 1;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 0.75rem;
      text-align: center;

      &.highlight {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.2);

        .stat-number {
          color: #22c55e;
        }
      }
    }

    .stat-number {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1;
    }

    .stat-label {
      display: block;
      font-size: 0.65rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 0.25rem;
    }

    .lines-bar {
      display: flex;
      gap: 1rem;
      margin-top: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .line-stat {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      font-weight: 600;

      &.added {
        color: #22c55e;
      }

      &.removed {
        color: #ef4444;
      }

      i {
        font-size: 0.75rem;
      }
    }

    /* Charts Dialog */
    .charts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 24px 24px 0 0;

      .header-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        h2 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }

        .subtitle {
          font-size: 0.75rem;
          color: #64748b;
        }
      }
    }

    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      padding: 1.25rem;
    }

    .chart-panel {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 1rem;
    }

    .chart-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 0.75rem;

      i {
        color: #8b5cf6;
      }
    }

    .chart-wrapper {
      height: 220px;
    }

    .quick-stats {
      display: flex;
      gap: 1rem;
      padding: 0 1.25rem 1.25rem;
    }

    .quick-stat {
      flex: 1;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%);
      border: 1px solid rgba(139, 92, 246, 0.15);
      border-radius: 10px;
      padding: 0.875rem;
      text-align: center;

      .qs-value {
        display: block;
        font-size: 1.25rem;
        font-weight: 700;
        color: #f1f5f9;
      }

      .qs-label {
        display: block;
        font-size: 0.65rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 0.25rem;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DevelopersComponent implements OnInit {
  credentialsService = inject(CredentialsService);
  private bitbucketService = inject(BitbucketService);

  loading = signal(false);
  searchTerm = '';
  selectedTeam: string | null = null;
  
  // Date range - default to last 7 days
  dateRange: Date[] = [
    new Date(new Date().setDate(new Date().getDate() - 7)),
    new Date()
  ];
  maxDate: Date = new Date();

  teamOptions = [
    { label: 'Engineering', value: 'Engineering' },
    { label: 'Frontend', value: 'Frontend' },
    { label: 'Backend', value: 'Backend' },
    { label: 'DevOps', value: 'DevOps' },
    { label: 'QA', value: 'QA' }
  ];

  developers: DeveloperSummary[] = [];
  filteredDevelopers: DeveloperSummary[] = [];

  // Dialog state
  detailsDialogVisible = false;
  chartsDialogVisible = false;
  selectedDeveloper: DeveloperSummary | null = null;

  // Chart data
  developerPrChart: any = {};
  developerLinesChart: any = {};

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#a0a0a0' }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#a0a0a0' }
      }
    }
  };

  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#a0a0a0', padding: 15 }
      }
    }
  };

  ngOnInit(): void {
    if (this.credentialsService.hasBitbucketCredentials()) {
      this.loadDevelopers();
    }
  }

  /** Handle date range change */
  onDateChange(): void {
    if (this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      // Cache is now keyed by date range - no need to clear, just load
      // If this exact range was cached, it will be instant; otherwise fresh fetch
      this.loadDevelopers();
    }
  }

  loadDevelopers(forceRefresh: boolean = false): void {
    this.loading.set(true);
    
    // Pass actual date range to service (cache key is based on dates, project, and developers)
    const startDate = this.dateRange[0];
    const endDate = this.dateRange[1];
    
    this.bitbucketService.getConfiguredDevelopersMetrics(startDate, endDate, forceRefresh).subscribe({
      next: (devData) => {
        console.log('Loaded developers:', devData.length, forceRefresh ? '(fresh)' : '(from cache or fresh)');
        
        this.developers = devData.map((dev, index) => ({
          id: (index + 1).toString(),
          name: dev.name,
          email: dev.email,
          team: 'Engineering', // Default team since Bitbucket doesn't have team info
          bitbucket: {
            prs: dev.prsSubmitted,
            reviews: dev.prsReviewed,
            merged: dev.prsMerged,
            linesAdded: dev.linesAdded,
            linesRemoved: dev.linesRemoved
          },
          cursor: {
            linesGenerated: 0, // Will be populated from Cursor API
            acceptanceRate: 0
          },
          jira: {
            ticketsCompleted: 0, // Will be populated from JIRA API
            defectRate: 0
          },
          overallScore: this.calculateScore(dev)
        }));

        this.filteredDevelopers = [...this.developers];
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading developers:', err);
        this.loading.set(false);
      }
    });
  }

  /** Force refresh data from Bitbucket (bypasses cache) */
  refreshData(): void {
    this.loadDevelopers(true);
  }

  private calculateScore(dev: DeveloperBitbucketData): number {
    // Simple score based on PR activity (commits disabled for performance)
    const prScore = Math.min(dev.prsSubmitted * 5, 40);
    const reviewScore = Math.min(dev.prsReviewed * 2, 40);
    const mergedScore = Math.min(dev.prsMerged * 3, 20);
    return Math.min(prScore + reviewScore + mergedScore, 100);
  }

  onSearch(): void {
    this.filterDevelopers();
  }

  onFilterChange(): void {
    this.filterDevelopers();
  }

  filterDevelopers(): void {
    this.filteredDevelopers = this.developers.filter(dev => {
      const matchesSearch = !this.searchTerm || 
        dev.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        dev.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesTeam = !this.selectedTeam || dev.team === this.selectedTeam;

      return matchesSearch && matchesTeam;
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getAvatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'linear-gradient(135deg, #06b6d4, #22d3ee)',
      'linear-gradient(135deg, #22c55e, #4ade80)',
      'linear-gradient(135deg, #f59e0b, #fbbf24)',
      'linear-gradient(135deg, #ef4444, #f87171)'
    ];
    const index = name.charCodeAt(0) % gradients.length;
    return gradients[index];
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'average';
    return 'needs-improvement';
  }

  getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Average';
    return 'Improve';
  }

  getAverageScore(): number {
    const total = this.developers.reduce((sum, dev) => sum + dev.overallScore, 0);
    return Math.round(total / this.developers.length);
  }

  getTotalPRs(): number {
    return this.developers.reduce((sum, dev) => sum + dev.bitbucket.prs, 0);
  }

  getTotalTickets(): number {
    return this.developers.reduce((sum, dev) => sum + dev.jira.ticketsCompleted, 0);
  }

  // ============================================
  // DIALOG METHODS
  // ============================================

  showDetailsDialog(dev: DeveloperSummary): void {
    this.selectedDeveloper = dev;
    this.detailsDialogVisible = true;
  }

  showChartsDialog(dev: DeveloperSummary): void {
    this.selectedDeveloper = dev;
    this.buildDeveloperCharts(dev);
    this.chartsDialogVisible = true;
  }

  getMergeRateForDev(dev: DeveloperSummary): number {
    if (dev.bitbucket.prs === 0) return 0;
    return Math.round((dev.bitbucket.merged / dev.bitbucket.prs) * 100);
  }

  private buildDeveloperCharts(dev: DeveloperSummary): void {
    // PR Activity Bar Chart
    this.developerPrChart = {
      labels: ['PRs Created', 'PRs Reviewed', 'PRs Merged'],
      datasets: [{
        data: [dev.bitbucket.prs, dev.bitbucket.reviews, dev.bitbucket.merged],
        backgroundColor: ['#8b5cf6', '#06b6d4', '#22c55e'],
        borderRadius: 8,
        barThickness: 40
      }]
    };

    // Lines of Code Doughnut Chart
    this.developerLinesChart = {
      labels: ['Lines Added', 'Lines Removed'],
      datasets: [{
        data: [dev.bitbucket.linesAdded, dev.bitbucket.linesRemoved],
        backgroundColor: ['#22c55e', '#ef4444'],
        hoverOffset: 8
      }]
    };
  }
}


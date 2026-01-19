import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { CursorService } from '../../core/services/cursor.service';
import { BitbucketService } from '../../core/services/bitbucket.service';
import { forkJoin } from 'rxjs';

interface DeveloperCursorMetrics {
  name: string;
  totalLinesGenerated: number;
  acceptedLines: number;
  totalTabs: number;
  tabsAccepted: number;
  requests: number;
  activeDays: number;
  spending: number;
  billingCycleSpending: number; // Full billing cycle spending
  favoriteModel: string;
  excluded: boolean; // Whether to exclude from team totals
}

@Component({
  selector: 'app-cursor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ChartModule,
    CalendarModule,
    ButtonModule,
    TagModule,
    ProgressBarModule,
    SelectButtonModule,
    MetricCardComponent
  ],
  template: `
    <div class="cursor-page">
      <div class="page-header">
        <div class="header-info">
          <h2><i class="pi pi-sparkles"></i> Cursor AI Metrics</h2>
          <p>AI-assisted coding statistics, tab completions, and usage analytics</p>
        </div>
        
        <div class="date-filter">
          <div class="date-picker-wrapper">
            <i class="pi pi-calendar date-icon"></i>
            <p-calendar 
              [(ngModel)]="dateRange" 
              selectionMode="range" 
              [readonlyInput]="true"
              dateFormat="M dd, yy"
              placeholder="Select date range"
              [showIcon]="false"
              (onSelect)="onDateChange()"
              styleClass="custom-calendar"
            />
          </div>
          <button 
            class="refresh-btn" 
            [class.loading]="loading()"
            (click)="loadData()"
            [disabled]="loading()"
          >
            <i class="pi pi-refresh" [class.pi-spin]="loading()"></i>
          </button>
        </div>
      </div>

      <div class="view-mode-section">
        <div class="segmented-control" [class.billing-active]="spendingMode === 'billingCycle'">
          <div class="segment-slider"></div>
          <button 
            class="segment-btn" 
            [class.active]="spendingMode === 'dateRange'"
            (click)="spendingMode = 'dateRange'; onSpendingModeChange()"
          >
            <i class="pi pi-calendar-times"></i>
            <span>Date Range</span>
          </button>
          <button 
            class="segment-btn" 
            [class.active]="spendingMode === 'billingCycle'"
            (click)="spendingMode = 'billingCycle'; onSpendingModeChange()"
          >
            <i class="pi pi-wallet"></i>
            <span>Billing Cycle</span>
          </button>
        </div>
      </div>

      @if (!credentialsService.hasCursorCredentials()) {
        <div class="no-credentials">
          <i class="pi pi-lock"></i>
          <h3>Cursor API Not Connected</h3>
          <p>Configure your Cursor Admin API key in Settings to view AI metrics.</p>
          <p-button label="Go to Settings" icon="pi pi-cog" routerLink="/settings" />
        </div>
      } @else {
        <!-- KPI Summary -->
        <div class="metrics-grid">
          <app-metric-card
            label="AI Lines Generated"
            [value]="totalMetrics().linesGenerated"
            icon="pi-code"
            iconBg="#f59e0b"
          />
          <app-metric-card
            label="Tab Completions"
            [value]="totalMetrics().tabCompletions"
            icon="pi-bolt"
            iconBg="#8b5cf6"
          />
          <app-metric-card
            label="Avg Active Days"
            [value]="totalMetrics().avgActiveDays"
            icon="pi-calendar"
            iconBg="#22c55e"
            format="decimal"
          />
          <app-metric-card
            label="Team Spending"
            [value]="displaySpending()"
            icon="pi-dollar"
            iconBg="#ef4444"
            format="currency"
          />
        </div>

        <!-- Developer Table -->
        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Developer AI Usage</h3>
            </div>
          </ng-template>
          
          <p-table 
            [value]="developers" 
            [paginator]="true" 
            [rows]="10"
            [rowsPerPageOptions]="[5, 10, 25]"
            styleClass="p-datatable-sm"
            sortField="spending"
            [sortOrder]="-1"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name">Developer <p-sortIcon field="name" /></th>
                <th pSortableColumn="totalLinesGenerated">Lines Generated <p-sortIcon field="totalLinesGenerated" /></th>
                <th pSortableColumn="tabsAccepted">Tab Completions <p-sortIcon field="tabsAccepted" /></th>
                <th pSortableColumn="requests">AI Requests <p-sortIcon field="requests" /></th>
                <th pSortableColumn="activeDays">Active Days <p-sortIcon field="activeDays" /></th>
                <th pSortableColumn="spending">Spending <p-sortIcon field="spending" /></th>
                <th pSortableColumn="favoriteModel">Favorite Model <p-sortIcon field="favoriteModel" /></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-dev>
              <tr [class.excluded-row]="dev.excluded">
                <td>
                  <div class="developer-cell">
                    <div class="avatar" [class.excluded]="dev.excluded">{{ getInitials(dev.name) }}</div>
                    <span class="dev-name" [class.excluded]="dev.excluded">{{ dev.name }}</span>
                    <div class="exclude-toggle-wrapper" (click)="toggleDeveloperExclusion(dev); $event.stopPropagation()">
                      @if (dev.excluded) {
                        <span class="excluded-badge">
                          <i class="pi pi-eye-slash"></i>
                          Excluded
                        </span>
                      } @else {
                        <span class="include-badge">
                          <i class="pi pi-eye"></i>
                        </span>
                      }
                    </div>
                  </div>
                </td>
                <td>
                  <span class="metric-value" [class.excluded]="dev.excluded">{{ dev.totalLinesGenerated | number }}</span>
                </td>
                <td><span class="metric-value" [class.excluded]="dev.excluded">{{ dev.tabsAccepted | number }}</span></td>
                <td><span class="metric-value" [class.excluded]="dev.excluded">{{ dev.requests | number }}</span></td>
                <td>
                  <span class="metric-value" [class.excluded]="dev.excluded">{{ dev.activeDays }}</span>
                </td>
                <td>
                  <span class="spending-amount" [class.excluded]="dev.excluded">\${{ getDevSpending(dev).toFixed(2) }}</span>
                </td>
                <td>
                  <span class="model-name" [class.excluded]="dev.excluded">{{ dev.favoriteModel }}</span>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <!-- Charts -->
        <div class="charts-row">
          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>AI Code Generation Trends</h3>
              </div>
            </ng-template>
            <p-chart type="line" [data]="generationTrendChart" [options]="lineChartOptions" height="280" />
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Tab Completions by Developer</h3>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="tabCompletionsChart" [options]="horizontalBarOptions" height="280" />
          </p-card>
        </div>

        <!-- Spending Breakdown -->
        <div class="spending-row">
          <p-card styleClass="spending-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Usage Breakdown</h3>
              </div>
            </ng-template>
            <div class="spending-grid">
              <div class="spending-item">
                <span class="spending-label">Composer Requests</span>
                <span class="spending-value">{{ totalMetrics().composerRequests | number }}</span>
              </div>
              <div class="spending-item">
                <span class="spending-label">Chat Requests</span>
                <span class="spending-value">{{ totalMetrics().chatRequests | number }}</span>
              </div>
              <div class="spending-item">
                <span class="spending-label">Agent Requests</span>
                <span class="spending-value">{{ totalMetrics().agentRequests | number }}</span>
              </div>
              <div class="spending-item">
                <span class="spending-label">Usage-Based Requests</span>
                <span class="spending-value">{{ totalMetrics().usageBasedRequests | number }}</span>
              </div>
              <div class="spending-item company-spending">
                <span class="spending-label">Company Total (Billing Cycle)</span>
                <span class="spending-value highlight">\${{ totalMetrics().companyTotalSpending.toFixed(2) | number:'1.2-2' }}</span>
              </div>
            </div>
          </p-card>
        </div>
      }
    </div>
  `,
  styles: [`
    .cursor-page {
      animation: fadeIn 0.3s ease-out;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    
    .view-mode-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      gap: 1rem;
    }

    .segmented-control {
      position: relative;
      display: flex;
      background: linear-gradient(145deg, #1a1a2e, #16162a);
      border-radius: 14px;
      padding: 5px;
      border: 1px solid rgba(139, 92, 246, 0.2);
      box-shadow: 
        inset 0 2px 4px rgba(0, 0, 0, 0.3),
        0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .segment-slider {
      position: absolute;
      top: 5px;
      left: 5px;
      width: calc(50% - 5px);
      height: calc(100% - 10px);
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      border-radius: 10px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 
        0 4px 15px rgba(139, 92, 246, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .segmented-control.billing-active .segment-slider {
      transform: translateX(100%);
      background: linear-gradient(135deg, #22c55e, #16a34a);
      box-shadow: 
        0 4px 15px rgba(34, 197, 94, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .segment-btn {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1.5rem;
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.3s ease;
      white-space: nowrap;

      i {
        font-size: 1rem;
        transition: transform 0.3s ease;
      }

      &:hover:not(.active) {
        color: rgba(255, 255, 255, 0.75);
      }

      &.active {
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

        i {
          transform: scale(1.1);
        }
      }
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
          color: #f59e0b;
        }
      }

      p {
        color: var(--text-color-secondary);
      }
    }

    .date-filter {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .date-picker-wrapper {
      display: flex;
      align-items: center;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 0.5rem 1rem;
      gap: 0.75rem;
      
      .date-icon {
        color: #8b5cf6;
        font-size: 1rem;
      }
    }

    :host ::ng-deep .custom-calendar {
      .p-inputtext {
        background: transparent;
        border: none;
        padding: 0;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-color);
        width: auto;
        min-width: 180px;
        
        &:focus {
          box-shadow: none;
        }
      }
    }

    .refresh-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: 1px solid var(--surface-border);
      background: var(--surface-card);
      color: var(--text-color-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover:not(:disabled) {
        background: var(--surface-hover);
        color: var(--text-color);
        border-color: #8b5cf6;
      }
      
      &:disabled {
        cursor: not-allowed;
        opacity: 0.7;
      }
      
      &.loading {
        background: rgba(139, 92, 246, 0.15);
        border-color: #8b5cf6;
        color: #8b5cf6;
      }
      
      i {
        font-size: 1rem;
      }
    }

    .no-credentials {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;

      i {
        font-size: 4rem;
        color: var(--text-color-secondary);
        margin-bottom: 1.5rem;
      }

      h3 {
        font-size: 1.5rem;
        color: var(--text-color);
        margin-bottom: 0.5rem;
      }

      p {
        color: var(--text-color-secondary);
        margin-bottom: 1.5rem;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
      }
    }

    .spending-row {
      margin-bottom: 1.5rem;
    }

    :host ::ng-deep .chart-card,
    :host ::ng-deep .table-card,
    :host ::ng-deep .spending-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;

      .p-card-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--surface-border);
      }

      .p-card-body {
        padding: 1.5rem;
      }
    }

    .card-title h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }

    .spending-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .spending-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--surface-hover);
      border-radius: 8px;

      .spending-label {
        color: var(--text-color-secondary);
        font-size: 0.875rem;
      }

      .spending-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-color);

        &.highlight {
          color: #ef4444;
        }
      }

      &.company-spending {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
        border: 1px solid rgba(239, 68, 68, 0.2);
      }
    }

    .developer-cell {
      display: flex;
      align-items: center;
      gap: 1rem;
      position: relative;
    }

    .exclude-toggle-wrapper {
      position: relative;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .developer-cell:hover .exclude-toggle-wrapper {
      opacity: 1;
    }

    .excluded-badge {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15));
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 20px;
      color: #ef4444;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      transition: all 0.2s ease;

      i {
        font-size: 0.65rem;
      }

      &:hover {
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.15));
        border-color: rgba(34, 197, 94, 0.4);
        color: #22c55e;
      }
    }

    /* Always show excluded badge */
    .developer-cell .exclude-toggle-wrapper:has(.excluded-badge) {
      opacity: 1;
    }

    .include-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 50%;
      color: #22c55e;
      font-size: 0.75rem;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(239, 68, 68, 0.15);
        border-color: rgba(239, 68, 68, 0.4);
        color: #ef4444;
      }
    }

    .excluded-row {
      opacity: 0.6;
    }

    .dev-name.excluded,
    .metric-value.excluded,
    .spending-amount.excluded,
    .model-name.excluded {
      text-decoration: line-through;
      opacity: 0.5;
    }

    .avatar.excluded {
      opacity: 0.4;
      filter: grayscale(100%);
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #fbbf24);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .dev-name {
      font-weight: 600;
      color: var(--text-color);
    }

    /* Table Styling */
    :host ::ng-deep .p-datatable {
      .p-datatable-thead > tr > th {
        background: var(--surface-section);
        padding: 1rem 1.25rem;
        font-weight: 600;
        color: var(--text-color);
      }

      .p-datatable-tbody > tr > td {
        padding: 1rem 1.25rem;
        vertical-align: middle;
      }

      .p-datatable-tbody > tr {
        transition: background 0.2s;

        &:hover {
          background: var(--surface-hover);
        }
      }
    }

    .accepted-count {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      margin-left: 0.5rem;
    }

    .model-name {
      font-size: 0.85rem;
      color: var(--text-color-secondary);
      background: var(--surface-ground);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-family: 'Fira Code', 'Consolas', monospace;
    }

    .metric-value {
      font-weight: 600;
      color: #8b5cf6;
    }

    .spending-amount {
      font-weight: 600;
      color: #ef4444;
    }

    /* Pagination Styling */
    :host ::ng-deep .p-paginator {
      background: var(--surface-card) !important;
      border: none !important;
      border-top: 1px solid var(--surface-border) !important;
      padding: 0.75rem 1rem;

      .p-paginator-element {
        color: var(--text-color-secondary);
        background: transparent;
        border: none;

        &.p-highlight {
          background: var(--primary-color) !important;
          color: var(--primary-color-text) !important;
          border-radius: var(--border-radius);
        }

        &:not(.p-disabled):hover {
          background: rgba(139, 92, 246, 0.1);
          color: var(--primary-color);
        }
      }

      .p-dropdown {
        .p-dropdown-label {
          color: var(--text-color-secondary);
        }
        .p-dropdown-trigger {
          color: var(--text-color-secondary);
        }
      }
    }

    :host ::ng-deep .p-dropdown-panel {
      background: var(--surface-overlay);
      border: 1px solid var(--surface-border);

      .p-dropdown-item {
        color: var(--text-color);
        padding: 0.75rem 1rem;

        &:hover {
          background: rgba(139, 92, 246, 0.1);
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class CursorComponent implements OnInit {
  credentialsService = inject(CredentialsService);
  private cursorService = inject(CursorService);
  private bitbucketService = inject(BitbucketService);

  loading = signal(false);
  dateRange: Date[] = [
    new Date(new Date().setDate(new Date().getDate() - 7)), // Default to last 7 days
    new Date()
  ];

  // Store user's custom date range (to restore when switching back from billing cycle)
  private userDateRange: Date[] = [...this.dateRange];

  // Spending mode toggle
  spendingMode: 'dateRange' | 'billingCycle' = 'dateRange';
  spendingModeOptions = [
    { label: 'Date Range', value: 'dateRange' },
    { label: 'Billing Cycle', value: 'billingCycle' }
  ];

  // Billing cycle info and dates
  billingCycleInfo = signal<string | null>(null);
  billingCycleSpendingTotal = signal(0);
  private billingCycleStartDate: Date | null = null;
  private billingCycleEndDate: Date | null = null;

  totalMetrics = signal({
    linesGenerated: 0,
    avgActiveDays: 0,
    tabCompletions: 0,
    spending: 0,
    billingCycleTeamSpending: 0, // Full billing cycle team spending
    companyTotalSpending: 0,
    composerRequests: 0,
    chatRequests: 0,
    agentRequests: 0,
    usageBasedRequests: 0
  });

  // Computed spending based on mode
  displaySpending = computed(() => {
    return this.spendingMode === 'billingCycle' 
      ? this.totalMetrics().billingCycleTeamSpending 
      : this.totalMetrics().spending;
  });

  developers: DeveloperCursorMetrics[] = [];
  
  // Store configured developers for API calls
  private configuredDevelopers: { name: string; email: string }[] = [];

  generationTrendChart: any = {
    labels: [],
    datasets: [
      {
        label: 'Lines Generated',
        data: [],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Lines Accepted',
        data: [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  tabCompletionsChart: any = {
    labels: [],
    datasets: [
      {
        label: 'Acceptance Rate (%)',
        data: [],
        backgroundColor: ['#f59e0b', '#22c55e', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899', '#14b8a6']
      }
    ]
  };

  lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#a0a0a0' }
      }
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

  horizontalBarOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#a0a0a0' },
        max: 100
      },
      y: {
        grid: { display: false },
        ticks: { color: '#a0a0a0' }
      }
    }
  };

  ngOnInit(): void {
    this.loadDevelopersAndData();
  }

  onDateChange(): void {
    if (this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      // Save user's custom date range
      this.userDateRange = [...this.dateRange];
      // Reset to date range mode when user manually changes dates
      this.spendingMode = 'dateRange';
      this.cursorService.clearCache();
      this.loadData(true);
    }
  }

  loadDevelopersAndData(): void {
    // Load developers from config file first
    this.bitbucketService.getConfiguredDevelopers().subscribe({
      next: (config) => {
        this.configuredDevelopers = config.developers.map(dev => ({
          name: dev.name,
          email: dev.email
        }));
        
        // Now load Cursor data
        if (this.credentialsService.hasCursorCredentials()) {
          this.loadData(false);
        } else {
          // Initialize with empty data if no credentials
          this.initializeEmptyData();
        }
      },
      error: (err) => {
        console.error('Error loading developers config:', err);
        this.initializeEmptyData();
      }
    });
  }

  private initializeEmptyData(): void {
    this.developers = this.configuredDevelopers.map(dev => ({
      name: dev.name,
      totalLinesGenerated: 0,
      acceptedLines: 0,
      totalTabs: 0,
      tabsAccepted: 0,
      requests: 0,
      activeDays: 0,
      spending: 0,
      billingCycleSpending: 0,
      favoriteModel: '—',
      excluded: false
    }));

    this.updateCharts();
  }

  getDevSpending(dev: DeveloperCursorMetrics): number {
    return this.spendingMode === 'billingCycle' ? dev.billingCycleSpending : dev.spending;
  }

  onSpendingModeChange(): void {
    if (this.spendingMode === 'billingCycle') {
      // Switch to billing cycle dates
      if (this.billingCycleStartDate && this.billingCycleEndDate) {
        // Save user's current date range before switching
        this.userDateRange = [...this.dateRange];
        // Update date range to billing cycle
        this.dateRange = [this.billingCycleStartDate, this.billingCycleEndDate];
        // Reload all data with billing cycle dates
        this.loadData();
      }
    } else {
      // Switch back to user's custom date range
      this.dateRange = [...this.userDateRange];
      // Reload all data with user's date range
      this.loadData();
    }
  }

  loadData(forceRefresh = false): void {
    if (!this.credentialsService.hasCursorCredentials()) {
      return;
    }

    this.loading.set(true);
    
    // Clear current data while loading to show user that data is being refreshed
    this.developers = [];
    this.totalMetrics.set({
      linesGenerated: 0,
      avgActiveDays: 0,
      tabCompletions: 0,
      spending: 0,
      billingCycleTeamSpending: 0,
      companyTotalSpending: 0,
      composerRequests: 0,
      chatRequests: 0,
      agentRequests: 0,
      usageBasedRequests: 0
    });

    // First fetch spending data to get the actual billing cycle start date
    this.cursorService.getAllSpendingData().subscribe({
      next: (spending) => {
        // Get actual billing cycle date range from API response
        const billingCycleStart = new Date(spending.subscriptionCycleStart);
        // Calculate actual billing cycle end date (one month from start)
        const billingCycleEnd = new Date(billingCycleStart);
        billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1);
        
        // Store billing cycle dates for mode switching and display
        this.billingCycleStartDate = billingCycleStart;
        this.billingCycleEndDate = billingCycleEnd;

        // Set billing cycle info for display
        const startStr = billingCycleStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const endStr = billingCycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        this.billingCycleInfo.set(`${startStr} - ${endStr}`);
        
        // Determine the date range to use for API calls
        // When in billing cycle mode, use billing cycle dates (capped for API limits)
        // When in date range mode, use user's selected date range
        let dateRange: { startDate: Date; endDate: Date };
        let billingCycleRange: { startDate: Date; endDate: Date };
        
        if (this.spendingMode === 'billingCycle') {
          // For billing cycle mode, use billing cycle dates but cap at 30 days (Analytics API limit)
          // and today (can't get future data)
          const today = new Date();
          const maxApiEnd = new Date(billingCycleStart);
          maxApiEnd.setDate(maxApiEnd.getDate() + 30);
          const apiEndDate = new Date(Math.min(billingCycleEnd.getTime(), today.getTime(), maxApiEnd.getTime()));
          dateRange = { startDate: billingCycleStart, endDate: apiEndDate };
          billingCycleRange = dateRange; // Same as dateRange in billing cycle mode
        } else {
          // For date range mode, use user's selected date range
          dateRange = {
            startDate: this.dateRange[0],
            endDate: this.dateRange[1]
          };
          // Billing cycle range is for calculating full billing cycle metrics
          const today = new Date();
          const maxApiEnd = new Date(billingCycleStart);
          maxApiEnd.setDate(maxApiEnd.getDate() + 30);
          const apiEndDate = new Date(Math.min(billingCycleEnd.getTime(), today.getTime(), maxApiEnd.getTime()));
          billingCycleRange = { startDate: billingCycleStart, endDate: apiEndDate };
        }

        // Now fetch all metrics with actual billing cycle dates
        // Try Analytics API first (matches CSV exports exactly)
        // Fall back to Admin API if Analytics API fails
        forkJoin({
          summary: this.cursorService.getTeamSummary(dateRange),
          // Use Analytics API for accurate CSV-matching metrics
          analyticsMetrics: this.cursorService.getMetricsFromAnalyticsAPI(
            this.configuredDevelopers,
            dateRange
          ),
          // Still need Admin API for request counts
          adminMetrics: this.cursorService.getMetricsForConfiguredDevelopers(
            this.configuredDevelopers,
            dateRange,
            forceRefresh
          ),
          billingCycleMetrics: this.cursorService.getMetricsForConfiguredDevelopers(
            this.configuredDevelopers,
            billingCycleRange,
            false
          )
        }).subscribe({
          next: ({ summary, analyticsMetrics, adminMetrics, billingCycleMetrics }) => {
            // Merge Analytics API data (lines, tabs) with Admin API data (requests)
            const metrics = analyticsMetrics.map((analytics, idx) => {
              const admin = adminMetrics[idx];
              return {
                ...analytics,
                // Use Analytics API for lines and tabs (matches CSV!)
                // Use Admin API for requests
                totalRequests: admin?.totalRequests || 0,
                activeDays: admin?.activeDays || 0
              };
            });
            // Map billing cycle spending by email
            const billingSpendingByEmail = new Map(
              spending.teamMemberSpend.map(s => [
                s.email.toLowerCase(), 
                (s.overallSpendCents || s.spendCents || 0) / 100
              ])
            );

            // Map billing cycle requests by email (to calculate proportion)
            const billingCycleRequestsByEmail = new Map(
              billingCycleMetrics.map(m => [m.email.toLowerCase(), m.totalRequests])
            );

            // Calculate company-wide total spending (billing cycle)
            const companyTotalSpending = spending.teamMemberSpend.reduce(
              (sum, member) => sum + (member.overallSpendCents || member.spendCents || 0), 0
            ) / 100;

            // Build developers array with both DATE RANGE and BILLING CYCLE spending
            this.developers = metrics.map(m => {
              const emailLower = m.email.toLowerCase();
              const billingCycleSpend = billingSpendingByEmail.get(emailLower) || 0;
              const billingCycleRequests = billingCycleRequestsByEmail.get(emailLower) || 0;
              const dateRangeRequests = m.totalRequests;

              // Calculate date range spending based on request proportion
              let dateRangeSpend = 0;
              if (billingCycleRequests > 0 && dateRangeRequests > 0) {
                const proportion = dateRangeRequests / billingCycleRequests;
                dateRangeSpend = billingCycleSpend * proportion;
              }

              return {
                name: m.name,
                totalLinesGenerated: m.totalLinesGenerated,
                acceptedLines: m.acceptedLinesAdded,
                totalTabs: m.totalTabsShown,
                tabsAccepted: m.totalTabsAccepted,
                requests: m.totalRequests,
                activeDays: m.activeDays,
                spending: dateRangeSpend,
                billingCycleSpending: billingCycleSpend, // Store full billing cycle spending
                favoriteModel: m.favoriteModel || '—',
                excluded: false
              };
            }).sort((a, b) => {
              // Sort by displayed spending (highest first) - depends on current mode
              const aSpending = this.spendingMode === 'billingCycle' ? a.billingCycleSpending : a.spending;
              const bSpending = this.spendingMode === 'billingCycle' ? b.billingCycleSpending : b.spending;
              return bSpending - aSpending;
            });

            // Calculate total spending for configured developers
            const dateRangeTeamSpending = this.developers.reduce(
              (sum, dev) => sum + dev.spending, 0
            );
            const billingCycleTeamSpending = this.developers.reduce(
              (sum, dev) => sum + dev.billingCycleSpending, 0
            );

            // Calculate average active days per team member
            const activeDevelopers = this.developers.filter(d => d.activeDays > 0);
            const avgActiveDays = activeDevelopers.length > 0
              ? this.developers.reduce((sum, dev) => sum + dev.activeDays, 0) / this.developers.length
              : 0;

            // Calculate totals from configured developers only (not entire team)
            const teamLinesGenerated = this.developers.reduce((sum, dev) => sum + dev.totalLinesGenerated, 0);
            const teamTabCompletions = this.developers.reduce((sum, dev) => sum + dev.tabsAccepted, 0);
            const teamRequests = this.developers.reduce((sum, dev) => sum + dev.requests, 0);

            this.totalMetrics.set({
              linesGenerated: teamLinesGenerated,
              avgActiveDays: avgActiveDays,
              tabCompletions: teamTabCompletions,
              spending: dateRangeTeamSpending,
              billingCycleTeamSpending: billingCycleTeamSpending,
              companyTotalSpending: companyTotalSpending,
              composerRequests: summary.composerRequests,
              chatRequests: summary.chatRequests,
              agentRequests: summary.agentRequests,
              usageBasedRequests: summary.usageBasedRequests
            });

            this.updateCharts();
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Error fetching Cursor metrics:', err);
            this.initializeEmptyData();
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error fetching spending data:', err);
        this.initializeEmptyData();
        this.loading.set(false);
      }
    });
  }

  private updateCharts(): void {
    // Filter to only include non-excluded developers for charts
    const includedDevs = this.developers.filter(d => !d.excluded);
    
    // Update tab completions chart
    this.tabCompletionsChart = {
      labels: includedDevs.map(d => d.name),
      datasets: [{
        label: 'Tab Completions',
        data: includedDevs.map(d => d.tabsAccepted),
        backgroundColor: ['#f59e0b', '#22c55e', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899', '#14b8a6']
      }]
    };

    // Update trend chart (simplified - shows totals per developer)
    this.generationTrendChart = {
      labels: includedDevs.map(d => d.name),
      datasets: [
        {
          label: 'Lines Generated',
          data: includedDevs.map(d => d.totalLinesGenerated),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Lines Accepted',
          data: includedDevs.map(d => d.acceptedLines),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  refreshData(): void {
    this.cursorService.clearCache();
    this.loadData(true);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  toggleDeveloperExclusion(dev: DeveloperCursorMetrics): void {
    dev.excluded = !dev.excluded;
    this.recalculateTotals();
    this.updateCharts();
  }

  private recalculateTotals(): void {
    // Filter to only include non-excluded developers
    const includedDevs = this.developers.filter(d => !d.excluded);
    
    const teamLinesGenerated = includedDevs.reduce((sum, dev) => sum + dev.totalLinesGenerated, 0);
    const teamTabCompletions = includedDevs.reduce((sum, dev) => sum + dev.tabsAccepted, 0);
    const dateRangeTeamSpending = includedDevs.reduce((sum, dev) => sum + dev.spending, 0);
    const billingCycleTeamSpending = includedDevs.reduce((sum, dev) => sum + dev.billingCycleSpending, 0);
    const avgActiveDays = includedDevs.length > 0
      ? includedDevs.reduce((sum, dev) => sum + dev.activeDays, 0) / includedDevs.length
      : 0;

    this.totalMetrics.set({
      ...this.totalMetrics(),
      linesGenerated: teamLinesGenerated,
      tabCompletions: teamTabCompletions,
      avgActiveDays: avgActiveDays,
      spending: dateRangeTeamSpending,
      billingCycleTeamSpending: billingCycleTeamSpending
    });
  }
}



import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { CursorService } from '../../core/services/cursor.service';
import { BitbucketService } from '../../core/services/bitbucket.service';

interface DeveloperCursorMetrics {
  name: string;
  totalLinesGenerated: number;
  acceptedLines: number;
  acceptanceRate: number;
  totalTabs: number;
  tabsAccepted: number;
  requests: number;
  spending: number;
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
          <p-calendar 
            [(ngModel)]="dateRange" 
            selectionMode="range" 
            [readonlyInput]="true"
            dateFormat="M dd, yy"
            placeholder="Select date range"
            [showIcon]="true"
            (onSelect)="onDateChange()"
          />
          <p-button 
            icon="pi pi-refresh" 
            [outlined]="true"
            (onClick)="loadData()"
            [loading]="loading()"
          />
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
            label="Lines Accepted"
            [value]="totalMetrics().linesAccepted"
            icon="pi-check"
            iconBg="#22c55e"
          />
          <app-metric-card
            label="Tab Completions"
            [value]="totalMetrics().tabCompletions"
            icon="pi-bolt"
            iconBg="#8b5cf6"
          />
          <app-metric-card
            label="Total Spending"
            [value]="totalMetrics().spending"
            icon="pi-dollar"
            iconBg="#ef4444"
            format="currency"
          />
        </div>

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
                <h3>Acceptance Rate by Developer</h3>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="acceptanceRateChart" [options]="horizontalBarOptions" height="280" />
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
            </div>
          </p-card>
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
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name">Developer <p-sortIcon field="name" /></th>
                <th pSortableColumn="totalLinesGenerated">Lines Generated <p-sortIcon field="totalLinesGenerated" /></th>
                <th pSortableColumn="acceptanceRate">Acceptance Rate <p-sortIcon field="acceptanceRate" /></th>
                <th pSortableColumn="totalTabs">Tab Completions <p-sortIcon field="totalTabs" /></th>
                <th pSortableColumn="requests">AI Requests <p-sortIcon field="requests" /></th>
                <th pSortableColumn="spending">Spending <p-sortIcon field="spending" /></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-dev>
              <tr>
                <td>
                  <div class="developer-cell">
                    <div class="avatar">{{ getInitials(dev.name) }}</div>
                    <span class="dev-name">{{ dev.name }}</span>
                  </div>
                </td>
                <td>
                  <strong>{{ dev.totalLinesGenerated | number }}</strong>
                  <span class="accepted-count">({{ dev.acceptedLines | number }} accepted)</span>
                </td>
                <td>
                  <div class="acceptance-cell">
                    <p-progressBar 
                      [value]="dev.acceptanceRate" 
                      [showValue]="false"
                      styleClass="acceptance-bar"
                    />
                    <span class="acceptance-value">{{ dev.acceptanceRate }}%</span>
                  </div>
                </td>
                <td>{{ dev.totalTabs | number }}</td>
                <td>{{ dev.requests | number }}</td>
                <td>
                  <span class="spending-amount">\${{ dev.spending.toFixed(2) }}</span>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
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
      }
    }

    .developer-cell {
      display: flex;
      align-items: center;
      gap: 1rem;
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

    .acceptance-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    :host ::ng-deep .acceptance-bar {
      width: 80px;
      height: 6px;
      border-radius: 3px;
      
      .p-progressbar-value {
        background: linear-gradient(90deg, #f59e0b, #22c55e);
      }
    }

    .acceptance-value {
      font-weight: 600;
      color: var(--text-color);
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
    new Date(new Date().setDate(new Date().getDate() - 30)),
    new Date()
  ];

  totalMetrics = signal({
    linesGenerated: 0,
    linesAccepted: 0,
    tabCompletions: 0,
    spending: 0,
    composerRequests: 0,
    chatRequests: 0,
    agentRequests: 0,
    usageBasedRequests: 0
  });

  developers: DeveloperCursorMetrics[] = [];

  generationTrendChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Lines Generated',
        data: [8500, 12200, 11800, 13180],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Lines Accepted',
        data: [6200, 8900, 8400, 8650],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  acceptanceRateChart: any = {
    labels: [],
    datasets: [
      {
        label: 'Acceptance Rate (%)',
        data: [],
        backgroundColor: ['#f59e0b', '#22c55e', '#8b5cf6', '#06b6d4', '#ef4444']
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
    this.loadDevelopers();
  }

  onDateChange(): void {
    if (this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      this.loadData();
    }
  }

  loadDevelopers(): void {
    // Load developers from config file
    this.bitbucketService.getConfiguredDevelopers().subscribe({
      next: (config) => {
        // Initialize with placeholder data (Cursor API not yet integrated)
        this.developers = config.developers.map(dev => ({
          name: dev.name,
          totalLinesGenerated: 0,
          acceptedLines: 0,
          acceptanceRate: 0,
          totalTabs: 0,
          tabsAccepted: 0,
          requests: 0,
          spending: 0
        }));

        // Update chart with developer names
        this.acceptanceRateChart = {
          ...this.acceptanceRateChart,
          labels: config.developers.map(d => d.name),
          datasets: [{
            label: 'Acceptance Rate (%)',
            data: config.developers.map(() => 0),
            backgroundColor: ['#f59e0b', '#22c55e', '#8b5cf6', '#06b6d4', '#ef4444']
          }]
        };
      },
      error: (err) => console.error('Error loading developers:', err)
    });
  }

  loadData(): void {
    this.loading.set(true);
    // Cursor API integration would go here
    setTimeout(() => this.loading.set(false), 500);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}



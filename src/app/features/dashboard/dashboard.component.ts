import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { CalendarModule } from 'primeng/calendar';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { BitbucketService, DeveloperBitbucketData } from '../../core/services/bitbucket.service';
import { CursorService } from '../../core/services/cursor.service';
import { JiraService } from '../../core/services/jira.service';
import { DateRange, MetricsSummary } from '../../core/models/developer.model';
import { Subscription } from 'rxjs';

interface TopDeveloper {
  name: string;
  prs: number;
  reviews: number;
  merged: number;
  aiLines: number;
  tickets: number;
  trend: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ChartModule,
    TableModule,
    CalendarModule,
    ButtonModule,
    SkeletonModule,
    TagModule,
    MetricCardComponent
  ],
  template: `
    <div class="dashboard">
      <!-- Header with Date Filter -->
      <div class="dashboard-header">
        <div class="header-info">
          <h2>Overview</h2>
          <p>Track your team's development metrics across all platforms</p>
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
            (onClick)="loadMetrics()"
            [loading]="loading()"
          />
        </div>
      </div>

      <!-- Connection Status Warning -->
      @if (!hasAnyCredentials()) {
        <div class="no-credentials-banner">
          <i class="pi pi-info-circle"></i>
          <div>
            <strong>No API connections configured</strong>
            <p>Go to Settings to configure your Bitbucket, Cursor, and JIRA credentials.</p>
          </div>
          <p-button label="Go to Settings" icon="pi pi-cog" routerLink="/settings" />
        </div>
      }

      <!-- KPI Cards -->
      <div class="metrics-grid">
        <app-metric-card
          label="Total PRs"
          [value]="summary().totalPrs"
          icon="pi-code"
          iconBg="#8b5cf6"
          [change]="12"
        />
        <app-metric-card
          label="Code Reviews"
          [value]="summary().totalPrsReviewed"
          icon="pi-eye"
          iconBg="#10b981"
          [change]="8"
        />
        <app-metric-card
          label="AI Lines Generated"
          [value]="summary().totalAiLinesGenerated"
          icon="pi-sparkles"
          iconBg="#f59e0b"
          [change]="24"
        />
        <app-metric-card
          label="Tickets Completed"
          [value]="summary().totalTicketsCompleted"
          icon="pi-check-square"
          iconBg="#06b6d4"
          [change]="-3"
        />
      </div>

      <!-- Charts Row -->
      <div class="charts-row">
        <p-card styleClass="chart-card">
          <ng-template pTemplate="header">
            <div class="chart-header">
              <h3>Activity Trends</h3>
              <div class="chart-legend">
                <span class="legend-item"><span class="dot prs"></span>PRs</span>
                <span class="legend-item"><span class="dot reviews"></span>Reviews</span>
                <span class="legend-item"><span class="dot tickets"></span>Tickets</span>
              </div>
            </div>
          </ng-template>
          <p-chart type="line" [data]="activityChartData" [options]="chartOptions" height="300" />
        </p-card>

        <p-card styleClass="chart-card">
          <ng-template pTemplate="header">
            <div class="chart-header">
              <h3>Metrics Distribution</h3>
            </div>
          </ng-template>
          <p-chart type="doughnut" [data]="distributionChartData" [options]="doughnutOptions" height="300" />
        </p-card>
      </div>

      <!-- Top Developers Table -->
      <p-card styleClass="table-card">
        <ng-template pTemplate="header">
          <div class="table-header">
            <h3>Top Contributors</h3>
            <p-button label="View All" icon="pi pi-arrow-right" [text]="true" routerLink="/developers" />
          </div>
        </ng-template>
        
        <p-table [value]="topDevelopers" [rows]="5" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th>Developer</th>
              <th>PRs</th>
              <th>Reviews</th>
              <th>AI Lines</th>
              <th>Tickets</th>
              <th>Status</th>
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
              <td><strong>{{ dev.prs }}</strong></td>
              <td>{{ dev.reviews }}</td>
              <td>{{ dev.aiLines | number }}</td>
              <td>{{ dev.tickets }}</td>
              <td>
                <p-tag 
                  [value]="dev.trend" 
                  [severity]="dev.trend === 'Improving' ? 'success' : dev.trend === 'Stable' ? 'info' : 'warn'"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" class="empty-message">
                <i class="pi pi-inbox"></i>
                <p>No developer data available. Configure your API credentials in Settings.</p>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>
  `,
  styles: [`
    .dashboard {
      animation: fadeIn 0.3s ease-out;
    }

    .dashboard-header {
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

    .no-credentials-banner {
      background: rgba(96, 165, 250, 0.1);
      border: 1px solid rgba(96, 165, 250, 0.3);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;

      i {
        font-size: 1.5rem;
        color: var(--primary-color);
      }

      strong {
        display: block;
        color: var(--text-color);
        margin-bottom: 0.25rem;
      }

      p {
        color: var(--text-color-secondary);
        margin: 0;
        font-size: 0.875rem;
      }

      p-button {
        margin-left: auto;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .charts-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
      }
    }

    :host ::ng-deep .chart-card,
    :host ::ng-deep .table-card {
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

    .chart-header,
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
      }
    }

    .chart-legend {
      display: flex;
      gap: 1rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      color: var(--text-color-secondary);

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.prs { background: #8b5cf6; }
        &.reviews { background: #10b981; }
        &.tickets { background: #06b6d4; }
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
      background: linear-gradient(135deg, #8b5cf6, #06b6d4);
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

    .empty-message {
      text-align: center;
      padding: 3rem !important;
      color: var(--text-color-secondary);

      i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      p {
        margin: 0;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private credentialsService = inject(CredentialsService);
  private bitbucketService = inject(BitbucketService);
  private cursorService = inject(CursorService);
  private jiraService = inject(JiraService);
  private subscriptions = new Subscription();

  loading = signal(false);
  dateRange: Date[] = [
    new Date(new Date().setDate(new Date().getDate() - 30)),
    new Date()
  ];

  summary = signal<MetricsSummary>({
    totalDevelopers: 0,
    totalLinesOfCode: 0,
    totalPrs: 0,
    totalPrsReviewed: 0,
    totalCommits: 0,
    totalAiLinesGenerated: 0,
    totalAiLinesAccepted: 0,
    totalTicketsCompleted: 0,
    totalDefectsFixed: 0,
    dateRange: { startDate: new Date(), endDate: new Date() }
  });

  topDevelopers: TopDeveloper[] = [];

  activityChartData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'PRs',
        data: [12, 19, 15, 22],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Reviews',
        data: [28, 35, 42, 38],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Tickets',
        data: [15, 22, 18, 25],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  distributionChartData = {
    labels: ['Bitbucket', 'Cursor AI', 'JIRA'],
    datasets: [
      {
        data: [45, 30, 25],
        backgroundColor: ['#8b5cf6', '#f59e0b', '#06b6d4'],
        borderWidth: 0
      }
    ]
  };

  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#a0a0a0'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#a0a0a0'
        }
      }
    }
  };

  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#a0a0a0',
          padding: 20
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadMetrics();
    
    // Listen for refresh events from header
    window.addEventListener('refresh-data', () => this.loadMetrics());
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  hasAnyCredentials(): boolean {
    return this.credentialsService.hasAnyCredentials();
  }

  onDateChange(): void {
    if (this.dateRange.length === 2 && this.dateRange[0] && this.dateRange[1]) {
      this.loadMetrics();
    }
  }

  loadMetrics(): void {
    this.loading.set(true);

    const range: DateRange = {
      startDate: this.dateRange[0],
      endDate: this.dateRange[1]
    };

    // Load developers from config and get their metrics
    this.bitbucketService.getConfiguredDevelopersMetrics(
      this.dateRange[0],
      this.dateRange[1],
      false
    ).subscribe({
      next: (devs: DeveloperBitbucketData[]) => {
        // Map to TopDeveloper format
        this.topDevelopers = devs.map(dev => ({
          name: dev.name,
          prs: dev.prsSubmitted,
          reviews: dev.prsReviewed,
          merged: dev.prsMerged,
          aiLines: 0, // Will be populated from Cursor API
          tickets: 0, // Will be populated from JIRA API
          trend: this.getTrend(dev)
        }));

        // Calculate summary totals
        const totalPrs = devs.reduce((sum, d) => sum + d.prsSubmitted, 0);
        const totalReviews = devs.reduce((sum, d) => sum + d.prsReviewed, 0);

        this.summary.update(s => ({
          ...s,
          totalDevelopers: devs.length,
          totalPrs,
          totalPrsReviewed: totalReviews,
          totalAiLinesGenerated: 0, // Will be populated from Cursor API
          totalTicketsCompleted: 0, // Will be populated from JIRA API
          dateRange: range
        }));

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading metrics:', err);
        this.loading.set(false);
      }
    });
  }

  private getTrend(dev: DeveloperBitbucketData): string {
    // Simple trend based on merge rate
    if (dev.prsSubmitted === 0) return 'Stable';
    const mergeRate = dev.prsMerged / dev.prsSubmitted;
    if (mergeRate >= 0.8) return 'Improving';
    if (mergeRate >= 0.5) return 'Stable';
    return 'Declining';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}



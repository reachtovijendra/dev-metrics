import { Component, inject, signal, OnInit, OnDestroy, effect, untracked, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { JiraService } from '../../core/services/jira.service';
import { BitbucketService, ConfiguredDeveloper } from '../../core/services/bitbucket.service';
import { EnvironmentService } from '../../core/services/environment.service';
import { FilterService } from '../../core/services/filter.service';
import { PageHeaderService } from '../../core/services/page-header.service';

interface DeveloperJiraMetrics {
  name: string;
  ticketsDevDone: number;
  ticketsQaDone: number;
  defectsInjected: number;
  defectsFixed: number;
  avgResolutionHours: number;
  inProgress: number;
  // Filter fields
  manager: string;
  department: string;
  innovationTeam: string;
}

@Component({
  selector: 'app-jira',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    TableModule,
    ChartModule,
    ButtonModule,
    TagModule,
    ProgressBarModule,
    MetricCardComponent
  ],
  template: `
    <div class="jira-page">
      @if (!isConfigured()) {
        <div class="no-credentials">
          <i class="pi pi-lock"></i>
          <h3>JIRA Not Connected</h3>
          <p>Configure your JIRA Cloud credentials in Settings to view ticket metrics.</p>
        </div>
      } @else {
        <!-- KPI Summary -->
        <div class="metrics-grid">
          <app-metric-card
            label="Tickets Completed"
            [value]="totalMetrics().ticketsCompleted"
            icon="pi-check-square"
            iconBg="#22c55e"
          />
          <app-metric-card
            label="In Progress"
            [value]="totalMetrics().inProgress"
            icon="pi-spinner"
            iconBg="#f59e0b"
          />
          <app-metric-card
            label="Defects Fixed"
            [value]="totalMetrics().defectsFixed"
            icon="pi-wrench"
            iconBg="#06b6d4"
          />
          <app-metric-card
            label="Defects Injected"
            [value]="totalMetrics().defectsInjected"
            icon="pi-exclamation-triangle"
            iconBg="#ef4444"
          />
        </div>

        <!-- Charts -->
        <div class="charts-row">
          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Ticket Completion Trends</h3>
              </div>
            </ng-template>
            <p-chart type="line" [data]="completionTrendChart" [options]="lineChartOptions" height="280" />
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Defect Analysis</h3>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="defectAnalysisChart" [options]="barChartOptions" height="280" />
          </p-card>
        </div>

        <!-- Quality Metrics -->
        <div class="quality-row">
          <p-card styleClass="quality-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Quality Indicators</h3>
              </div>
            </ng-template>
            <div class="quality-grid">
              <div class="quality-item">
                <div class="quality-header">
                  <span class="quality-label">Defect Rate</span>
                  <span class="quality-value" [class.good]="totalMetrics().defectRate < 10" [class.warning]="totalMetrics().defectRate >= 10 && totalMetrics().defectRate < 20" [class.bad]="totalMetrics().defectRate >= 20">
                    {{ totalMetrics().defectRate }}%
                  </span>
                </div>
                <p-progressBar [value]="totalMetrics().defectRate" [showValue]="false" styleClass="defect-bar" />
              </div>
              <div class="quality-item">
                <div class="quality-header">
                  <span class="quality-label">Avg Resolution Time</span>
                  <span class="quality-value">{{ totalMetrics().avgResolutionHours }}h</span>
                </div>
                <p-progressBar [value]="getResolutionScore()" [showValue]="false" styleClass="resolution-bar" />
              </div>
              <div class="quality-item">
                <div class="quality-header">
                  <span class="quality-label">Sprint Velocity</span>
                  <span class="quality-value">{{ totalMetrics().velocity }} pts</span>
                </div>
                <p-progressBar [value]="getVelocityScore()" [showValue]="false" styleClass="velocity-bar" />
              </div>
              <div class="quality-item">
                <div class="quality-header">
                  <span class="quality-label">Bug Fix Rate</span>
                  <span class="quality-value good">{{ getBugFixRate() }}%</span>
                </div>
                <p-progressBar [value]="getBugFixRate()" [showValue]="false" styleClass="fix-bar" />
              </div>
            </div>
          </p-card>
        </div>

        <!-- Developer Table -->
        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Developer Performance</h3>
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
                <th pSortableColumn="ticketsDevDone">Dev Done <p-sortIcon field="ticketsDevDone" /></th>
                <th pSortableColumn="ticketsQaDone">QA Done <p-sortIcon field="ticketsQaDone" /></th>
                <th pSortableColumn="defectsFixed">Defects Fixed <p-sortIcon field="defectsFixed" /></th>
                <th pSortableColumn="defectsInjected">Defects Injected <p-sortIcon field="defectsInjected" /></th>
                <th>Quality Score</th>
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
                <td><strong>{{ dev.ticketsDevDone }}</strong></td>
                <td>{{ dev.ticketsQaDone }}</td>
                <td>
                  <span class="defect-fixed">{{ dev.defectsFixed }}</span>
                </td>
                <td>
                  <span class="defect-injected" [class.high]="dev.defectsInjected > 3">{{ dev.defectsInjected }}</span>
                </td>
                <td>
                  <p-tag 
                    [value]="getQualityLabel(dev)" 
                    [severity]="getQualitySeverity(dev)"
                  />
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
  styles: [`
    .jira-page {
      animation: fadeIn 0.3s ease-out;
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

    .quality-row {
      margin-bottom: 1.5rem;
    }

    :host ::ng-deep .chart-card,
    :host ::ng-deep .table-card,
    :host ::ng-deep .quality-card {
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

    .quality-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
    }

    .quality-item {
      padding: 1rem;
      background: var(--surface-hover);
      border-radius: 8px;
    }

    .quality-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .quality-label {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }

    .quality-value {
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--text-color);

      &.good { color: #22c55e; }
      &.warning { color: #f59e0b; }
      &.bad { color: #ef4444; }
    }

    :host ::ng-deep .defect-bar .p-progressbar-value { background: #ef4444; }
    :host ::ng-deep .resolution-bar .p-progressbar-value { background: #f59e0b; }
    :host ::ng-deep .velocity-bar .p-progressbar-value { background: #8b5cf6; }
    :host ::ng-deep .fix-bar .p-progressbar-value { background: #22c55e; }

    .developer-cell {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #06b6d4, #22d3ee);
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

    .defect-fixed {
      color: #22c55e;
      font-weight: 600;
    }

    .defect-injected {
      color: var(--text-color);
      font-weight: 600;

      &.high {
        color: #ef4444;
      }
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
export class JiraComponent implements OnInit, OnDestroy {
  credentialsService = inject(CredentialsService);
  private jiraService = inject(JiraService);
  private bitbucketService = inject(BitbucketService);
  private environmentService = inject(EnvironmentService);

  /**
   * Check if JIRA API is configured - either:
   * - In production (Vercel serverless handles auth via env vars)
   * - Or has local credentials configured in Settings
   */
  isConfigured(): boolean {
    return this.environmentService.isProduction() || this.credentialsService.hasJiraCredentials();
  }
  private filterService = inject(FilterService);
  private pageHeaderService = inject(PageHeaderService);
  private injector = inject(Injector);

  loading = signal(false);

  totalMetrics = signal({
    ticketsCompleted: 0,
    inProgress: 0,
    defectsFixed: 0,
    defectsInjected: 0,
    defectRate: 0,
    avgResolutionHours: 0,
    velocity: 0
  });

  developers: DeveloperJiraMetrics[] = [];
  
  // All developers (unfiltered) for filtering
  private allDevelopers: DeveloperJiraMetrics[] = [];
  
  // Store configured developers for filter fields
  private configuredDevelopers: ConfiguredDeveloper[] = [];

  completionTrendChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Dev Done',
        data: [28, 35, 32, 32],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'QA Done',
        data: [5, 8, 6, 7],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  defectAnalysisChart = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Defects Fixed',
        data: [5, 8, 7, 8],
        backgroundColor: '#22c55e'
      },
      {
        label: 'Defects Injected',
        data: [3, 4, 2, 3],
        backgroundColor: '#ef4444'
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

  barChartOptions = {
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

  ngOnInit(): void {
    // Set page header info
    this.pageHeaderService.setPageInfo('JIRA Metrics', 'pi-ticket', true);
    
    // Register refresh callback
    this.pageHeaderService.registerRefreshCallback(() => this.loadData());
    
    // Setup filter effect with proper injection context
    effect(() => {
      // Read the signals to track them
      const managers = this.filterService.selectedManagers();
      const departments = this.filterService.selectedDepartments();
      const teams = this.filterService.selectedInnovationTeams();
      
      // Use untracked to prevent signal writes from causing re-runs
      untracked(() => {
        if (this.allDevelopers.length > 0) {
          this.applyFilters();
        }
      });
    }, { injector: this.injector });
    
    this.loadDevelopers();
  }

  ngOnDestroy(): void {
    this.pageHeaderService.unregisterRefreshCallback();
  }

  loadDevelopers(): void {
    // Load developers from config file
    this.bitbucketService.getConfiguredDevelopers().subscribe({
      next: (config) => {
        this.configuredDevelopers = config.developers;
        
        // Initialize with placeholder data (JIRA API not yet integrated)
        this.allDevelopers = config.developers.map(dev => ({
          name: dev.name,
          ticketsDevDone: 0,
          ticketsQaDone: 0,
          defectsInjected: 0,
          defectsFixed: 0,
          avgResolutionHours: 0,
          inProgress: 0,
          manager: dev.manager || '',
          department: dev.department || '',
          innovationTeam: dev.innovationTeam || ''
        }));
        
        this.applyFilters();
      },
      error: (err) => console.error('Error loading developers:', err)
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.pageHeaderService.setLoading(true);
    // JIRA API integration would go here
    setTimeout(() => {
      this.loading.set(false);
      this.pageHeaderService.setLoading(false);
    }, 500);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getResolutionScore(): number {
    // Lower is better, scale to 100
    return Math.max(0, 100 - (this.totalMetrics().avgResolutionHours * 2));
  }

  getVelocityScore(): number {
    // Assume 60 is max velocity
    return Math.min(100, (this.totalMetrics().velocity / 60) * 100);
  }

  getBugFixRate(): number {
    const metrics = this.totalMetrics();
    const total = metrics.defectsFixed + metrics.defectsInjected;
    return total > 0 ? Math.round((metrics.defectsFixed / total) * 100) : 0;
  }

  getQualityLabel(dev: DeveloperJiraMetrics): string {
    const ratio = dev.defectsFixed / Math.max(1, dev.defectsInjected);
    if (ratio >= 2) return 'Excellent';
    if (ratio >= 1) return 'Good';
    return 'Needs Improvement';
  }

  getQualitySeverity(dev: DeveloperJiraMetrics): 'success' | 'info' | 'warn' {
    const ratio = dev.defectsFixed / Math.max(1, dev.defectsInjected);
    if (ratio >= 2) return 'success';
    if (ratio >= 1) return 'info';
    return 'warn';
  }

  // Filter methods - uses global FilterService
  applyFilters(): void {
    this.developers = this.filterService.applyAllFilters([...this.allDevelopers]);
  }
}



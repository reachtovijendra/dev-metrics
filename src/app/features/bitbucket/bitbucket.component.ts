import { Component, inject, signal, OnInit, OnDestroy, effect, untracked, DestroyRef, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { BitbucketService, DeveloperBitbucketData, ConfiguredDeveloper } from '../../core/services/bitbucket.service';
import { FilterService } from '../../core/services/filter.service';
import { EnvironmentService } from '../../core/services/environment.service';
import { PageHeaderService } from '../../core/services/page-header.service';
import { DateRange } from '../../core/models/developer.model';

interface DeveloperBitbucketMetrics {
  name: string;
  email: string;
  username: string;
  prsSubmitted: number;
  prsReviewed: number;
  prsMerged: number;
  commentsAdded: number;
  commentsReceived: number;
  linesAdded: number;
  linesRemoved: number;
  commitCount?: number;
  // Filter fields
  manager: string;
  department: string;
  innovationTeam: string;
}

@Component({
  selector: 'app-bitbucket',
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
    SkeletonModule,
    ProgressBarModule,
    MetricCardComponent
  ],
  template: `
    <div class="bitbucket-page">
      @if (!isConfigured()) {
        <div class="no-credentials">
          <i class="pi pi-lock"></i>
          <h3>Bitbucket Not Connected</h3>
          <p>Configure your Bitbucket Data Center credentials in Settings to view metrics.</p>
          <p-button label="Go to Settings" icon="pi pi-cog" routerLink="/settings" />
        </div>
      } @else {
        <!-- KPI Summary -->
        <div class="metrics-grid">
          <app-metric-card
            label="Total PRs"
            [value]="totalMetrics().totalPrs"
            icon="pi-code"
            iconBg="#8b5cf6"
          />
          <app-metric-card
            label="PRs Merged"
            [value]="totalMetrics().prsMerged"
            icon="pi-check"
            iconBg="#22c55e"
          />
          <app-metric-card
            label="Lines Added"
            [value]="totalMetrics().linesAdded"
            icon="pi-plus"
            iconBg="#10b981"
          />
          <app-metric-card
            label="Lines Removed"
            [value]="totalMetrics().linesRemoved"
            icon="pi-minus"
            iconBg="#ef4444"
          />
        </div>

        <!-- Charts -->
        <div class="charts-row">
          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>PR Activity Over Time</h3>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="prActivityChart" [options]="barChartOptions" height="280" />
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Review Distribution</h3>
              </div>
            </ng-template>
            <p-chart type="pie" [data]="reviewDistributionChart" [options]="pieChartOptions" height="280" />
          </p-card>
        </div>

        <!-- Developer Table -->
        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Developer Breakdown</h3>
            </div>
          </ng-template>
          
          <p-table 
            [value]="developers" 
            [paginator]="true" 
            [rows]="10"
            [rowsPerPageOptions]="[5, 10, 25]"
            [globalFilterFields]="['name', 'username']"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name">Developer <p-sortIcon field="name" /></th>
                <th pSortableColumn="prsSubmitted">PRs <p-sortIcon field="prsSubmitted" /></th>
                <th pSortableColumn="prsReviewed">Reviews <p-sortIcon field="prsReviewed" /></th>
                <th pSortableColumn="prsMerged">Merged <p-sortIcon field="prsMerged" /></th>
                <th pSortableColumn="linesAdded">Lines Added <p-sortIcon field="linesAdded" /></th>
                <th pSortableColumn="linesRemoved">Lines Removed <p-sortIcon field="linesRemoved" /></th>
                <th>Activity</th>
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
                <td><strong>{{ dev.prsSubmitted }}</strong></td>
                <td>{{ dev.prsReviewed }}</td>
                <td>
                  <span class="merged-count">{{ dev.prsMerged }}</span>
                  <span class="merge-rate">({{ getMergeRate(dev) }}%)</span>
                </td>
                <td class="lines-added">+{{ dev.linesAdded | number }}</td>
                <td class="lines-removed">-{{ dev.linesRemoved | number }}</td>
                <td>
                  <p-progressBar 
                    [value]="getActivityScore(dev)" 
                    [showValue]="false"
                    styleClass="activity-bar"
                  />
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="7" class="empty-message">
                  <i class="pi pi-inbox"></i>
                  <p>No data available. Click refresh to load from Bitbucket.</p>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
  styles: [`
    .bitbucket-page {
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
      grid-template-columns: 1.5fr 1fr;
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

    .card-title h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
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
      background: linear-gradient(135deg, #8b5cf6, #a855f7);
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

    .merged-count {
      color: #22c55e;
      font-weight: 600;
    }

    .merge-rate {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      margin-left: 0.25rem;
    }

    .lines-added {
      color: #10b981;
      font-weight: 600;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    .lines-removed {
      color: #ef4444;
      font-weight: 600;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    :host ::ng-deep .activity-bar {
      height: 6px;
      border-radius: 3px;
      
      .p-progressbar-value {
        background: linear-gradient(90deg, #8b5cf6, #06b6d4);
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
    }

    /* Table Styling - Match Developers Page */
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

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class BitbucketComponent implements OnInit, OnDestroy {
  credentialsService = inject(CredentialsService);
  private bitbucketService = inject(BitbucketService);
  private filterService = inject(FilterService);
  private environmentService = inject(EnvironmentService);

  /**
   * Check if Bitbucket API is configured - either:
   * - In production (Vercel serverless handles auth via env vars)
   * - Or has local credentials configured in Settings
   */
  isConfigured(): boolean {
    return this.environmentService.isProduction() || this.credentialsService.hasBitbucketCredentials();
  }
  private pageHeaderService = inject(PageHeaderService);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);

  totalMetrics = signal({
    totalPrs: 0,
    prsMerged: 0,
    reviews: 0,
    comments: 0,
    linesAdded: 0,
    linesRemoved: 0
  });

  developers: DeveloperBitbucketMetrics[] = [];
  
  // All developers (unfiltered) for filtering
  private allDevelopers: DeveloperBitbucketMetrics[] = [];
  
  // Store configured developers for filter fields
  private configuredDevelopers: ConfiguredDeveloper[] = [];

  prActivityChart: any = {
    labels: [],
    datasets: [
      { label: 'PRs Created', data: [], backgroundColor: '#8b5cf6' },
      { label: 'PRs Merged', data: [], backgroundColor: '#22c55e' }
    ]
  };

  reviewDistributionChart: any = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'] }]
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

  pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { color: '#a0a0a0', padding: 15 }
      }
    }
  };

  ngOnInit(): void {
    // Set page header info
    this.pageHeaderService.setPageInfo('Bitbucket Metrics', 'pi-github', true);
    
    // Register refresh callback
    this.pageHeaderService.registerRefreshCallback(() => this.loadData(true));
    
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
    
    this.loadConfigAndData();
  }

  ngOnDestroy(): void {
    this.pageHeaderService.unregisterRefreshCallback();
  }

  private loadConfigAndData(): void {
    // Load developers config first
    this.bitbucketService.getConfiguredDevelopers().subscribe({
      next: (config) => {
        this.configuredDevelopers = config.developers;
        
        if (this.isConfigured()) {
          this.loadData();
        }
      },
      error: (err) => {
        console.error('Error loading developers config:', err);
        if (this.isConfigured()) {
          this.loadData();
        }
      }
    });
  }

  loadData(forceRefresh: boolean = false): void {
    this.loading.set(true);
    this.pageHeaderService.setLoading(true);
    
    // Pass actual date range to service (cache key is based on dates, project, and developers)
    const range = this.pageHeaderService.dateRange();
    const startDate = range[0];
    const endDate = range[1];
    
    this.bitbucketService.getConfiguredDevelopersMetrics(startDate, endDate, forceRefresh).subscribe({
      next: (devs) => {
        console.log('Loaded Bitbucket metrics:', devs.length, forceRefresh ? '(fresh)' : '(from cache or fresh)');
        
        // Map to component interface with filter fields
        this.allDevelopers = devs.map(d => {
          // Find configured developer to get filter fields
          const configDev = this.configuredDevelopers.find(
            cd => cd.email.toLowerCase() === d.email.toLowerCase()
          );
          
          return {
            name: d.name,
            email: d.email,
            username: d.username,
            prsSubmitted: d.prsSubmitted,
            prsReviewed: d.prsReviewed,
            prsMerged: d.prsMerged,
            commentsAdded: d.commentsAdded,
            commentsReceived: d.commentsReceived,
            linesAdded: d.linesAdded,
            linesRemoved: d.linesRemoved,
            commitCount: d.commitCount,
            manager: configDev?.manager || '',
            department: configDev?.department || '',
            innovationTeam: configDev?.innovationTeam || ''
          };
        });

        // Apply filters to populate displayed developers
        this.applyFilters();

        // Update total metrics
        const totals = this.developers.reduce((acc, dev) => ({
          totalPrs: acc.totalPrs + dev.prsSubmitted,
          prsMerged: acc.prsMerged + dev.prsMerged,
          reviews: acc.reviews + dev.prsReviewed,
          comments: acc.comments + dev.commentsAdded,
          linesAdded: acc.linesAdded + dev.linesAdded,
          linesRemoved: acc.linesRemoved + dev.linesRemoved
        }), { totalPrs: 0, prsMerged: 0, reviews: 0, comments: 0, linesAdded: 0, linesRemoved: 0 });
        
        this.totalMetrics.set(totals);

        // Update charts with real data
        this.updateCharts();
        
        this.loading.set(false);
        this.pageHeaderService.setLoading(false);
      },
      error: (err) => {
        console.error('Error loading Bitbucket data:', err);
        this.loading.set(false);
        this.pageHeaderService.setLoading(false);
      }
    });
  }

  private updateCharts(): void {
    // Update review distribution chart (top 8 developers by reviews)
    const topReviewers = [...this.developers]
      .sort((a, b) => b.prsReviewed - a.prsReviewed)
      .slice(0, 8);

    this.reviewDistributionChart = {
      labels: topReviewers.map(d => d.name.split(' ')[0]), // First name only
      datasets: [{
        data: topReviewers.map(d => d.prsReviewed),
        backgroundColor: ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316']
      }]
    };

    // Update PR activity chart (mock weekly data based on totals)
    const totalPrs = this.totalMetrics().totalPrs;
    const totalMerged = this.totalMetrics().prsMerged;
    this.prActivityChart = {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'PRs Created',
          data: [
            Math.round(totalPrs * 0.2),
            Math.round(totalPrs * 0.3),
            Math.round(totalPrs * 0.25),
            Math.round(totalPrs * 0.25)
          ],
          backgroundColor: '#8b5cf6'
        },
        {
          label: 'PRs Merged',
          data: [
            Math.round(totalMerged * 0.2),
            Math.round(totalMerged * 0.3),
            Math.round(totalMerged * 0.25),
            Math.round(totalMerged * 0.25)
          ],
          backgroundColor: '#22c55e'
        }
      ]
    };
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getMergeRate(dev: DeveloperBitbucketMetrics): number {
    return dev.prsSubmitted > 0 ? Math.round((dev.prsMerged / dev.prsSubmitted) * 100) : 0;
  }

  getActivityScore(dev: DeveloperBitbucketMetrics): number {
    if (this.developers.length === 0) return 0;
    const maxActivity = Math.max(...this.developers.map(d => (d.prsSubmitted || 0) + (d.prsReviewed || 0) + (d.commitCount || 0)));
    const devActivity = (dev.prsSubmitted || 0) + (dev.prsReviewed || 0) + (dev.commitCount || 0);
    return maxActivity > 0 ? Math.round((devActivity / maxActivity) * 100) : 0;
  }

  // Filter methods - uses global FilterService
  applyFilters(): void {
    const filtered = this.filterService.applyAllFilters([...this.allDevelopers]);
    this.developers = filtered;
    this.recalculateTotals();
    this.updateCharts();
  }

  private recalculateTotals(): void {
    const totals = this.developers.reduce((acc, dev) => ({
      totalPrs: acc.totalPrs + dev.prsSubmitted,
      prsMerged: acc.prsMerged + dev.prsMerged,
      reviews: acc.reviews + dev.prsReviewed,
      comments: acc.comments + dev.commentsAdded,
      linesAdded: acc.linesAdded + dev.linesAdded,
      linesRemoved: acc.linesRemoved + dev.linesRemoved
    }), { totalPrs: 0, prsMerged: 0, reviews: 0, comments: 0, linesAdded: 0, linesRemoved: 0 });
    
    this.totalMetrics.set(totals);
  }
}


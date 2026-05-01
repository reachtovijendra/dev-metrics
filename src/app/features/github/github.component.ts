import { ChangeDetectionStrategy, Component, Injector, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { EnvironmentService } from '../../core/services/environment.service';
import { FilterService } from '../../core/services/filter.service';
import { GithubMetricsLoadResult, GithubService } from '../../core/services/github.service';
import {
  ConfiguredGithubDeveloper,
  DeveloperGithubMetrics,
  getTopRepositories,
  getWeeklyActivity,
  sortDevelopersByLineChanges
} from '../../core/services/github-metrics.mapper';
import { PageHeaderService } from '../../core/services/page-header.service';

@Component({
  selector: 'app-github',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    TableModule,
    ChartModule,
    TagModule,
    ProgressBarModule,
    MetricCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="github-page">
      @if (!isConfigured()) {
        <div class="no-credentials">
          <i class="pi pi-lock"></i>
          <h3>GitHub Not Connected</h3>
          <p>Configure your GitHub organization and personal access token in Settings to view metrics.</p>
        </div>
      } @else {
        @if (searchLimitExceeded()) {
          <div class="warning-banner">
            <i class="pi pi-exclamation-triangle"></i>
            <span>GitHub returned more than 1,000 search results. Narrow the date range for complete metrics.</span>
          </div>
        }

        <div class="metrics-grid">
          <app-metric-card
            label="PRs Submitted"
            [value]="totalMetrics().totalPrs"
            icon="pi-code"
            iconBg="#8b5cf6"
          />
          <app-metric-card
            label="PRs Reviewed"
            [value]="totalMetrics().prsReviewed"
            icon="pi-eye"
            iconBg="#06b6d4"
          />
          <app-metric-card
            label="Lines Changed"
            [value]="totalLineChanges()"
            icon="pi-pencil"
            iconBg="#10b981"
          />
          <app-metric-card
            label="Unique Repositories"
            [value]="totalMetrics().uniqueRepositories"
            icon="pi-sitemap"
            iconBg="#f59e0b"
          />
        </div>

        <div class="charts-row">
          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Weekly PR Activity</h3>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="weeklyActivityChart()" [options]="barChartOptions" height="280" />
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Top Repositories</h3>
              </div>
            </ng-template>
            <p-chart type="doughnut" [data]="repositoryChart()" [options]="doughnutOptions" height="280" />
          </p-card>
        </div>

        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Developer Breakdown</h3>
            </div>
          </ng-template>

          <p-table
            [value]="developers()"
            [paginator]="true"
            [rows]="10"
            [rowsPerPageOptions]="[5, 10, 25]"
            [globalFilterFields]="['name', 'username', 'githubUsername']"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name">Developer <p-sortIcon field="name" /></th>
                <th pSortableColumn="prsSubmitted">PRs <p-sortIcon field="prsSubmitted" /></th>
                <th pSortableColumn="prsReviewed">Reviews <p-sortIcon field="prsReviewed" /></th>
                <th pSortableColumn="prsMerged">Merged <p-sortIcon field="prsMerged" /></th>
                <th pSortableColumn="uniqueRepositories">Repos <p-sortIcon field="uniqueRepositories" /></th>
                <th pSortableColumn="linesAdded">Lines <p-sortIcon field="linesAdded" /></th>
                <th pSortableColumn="avgPrSize">Avg PR Size <p-sortIcon field="avgPrSize" /></th>
                <th>Activity</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-dev>
              <tr>
                <td>
                  <div class="developer-cell">
                    <div class="avatar">{{ getInitials(dev.name) }}</div>
                    <div>
                      <a class="dev-name dev-link" [routerLink]="['/github/developer', dev.githubUsername]">{{ dev.name }}</a>
                      <span class="github-login">&#64;{{ dev.githubUsername }}</span>
                    </div>
                  </div>
                </td>
                <td><strong>{{ dev.prsSubmitted }}</strong></td>
                <td>{{ dev.prsReviewed }}</td>
                <td>
                  <span class="merged-count">{{ dev.prsMerged }}</span>
                  <span class="merge-rate">({{ getMergeRate(dev) }}%)</span>
                </td>
                <td>{{ dev.uniqueRepositories }}</td>
                <td>
                  <span class="lines-added">+{{ dev.linesAdded | number }}</span>
                  <span class="lines-removed">-{{ dev.linesRemoved | number }}</span>
                </td>
                <td>{{ dev.avgPrSize | number }}</td>
                <td>
                  <p-progressBar
                    [value]="dev.activityScore"
                    [showValue]="false"
                    styleClass="activity-bar"
                  />
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="8" class="empty-message">
                  <i class="pi pi-inbox"></i>
                  <p>No data available. Click refresh to load from GitHub.</p>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
  styles: [`
    .github-page {
      animation: fadeIn 0.3s ease-out;
    }

    .no-credentials,
    .warning-banner {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
    }

    .no-credentials {
      text-align: center;
      padding: 4rem 2rem;

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
      }
    }

    .warning-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #f59e0b;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
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
      background: linear-gradient(135deg, #24292f, #57606a);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .dev-name,
    .github-login {
      display: block;
    }

    .dev-name {
      font-weight: 600;
      color: var(--text-color);
    }

    .dev-link {
      text-decoration: none;
      transition: color 0.2s ease;

      &:hover {
        color: #60a5fa;
      }
    }

    .github-login,
    .merge-rate {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }

    .merge-rate {
      margin-left: 0.25rem;
    }

    .merged-count {
      color: #22c55e;
      font-weight: 600;
    }

    .lines-added,
    .lines-removed {
      display: block;
      font-weight: 600;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    .lines-added {
      color: #10b981;
    }

    .lines-removed {
      color: #ef4444;
    }

    :host ::ng-deep .activity-bar {
      height: 6px;
      border-radius: 3px;

      .p-progressbar-value {
        background: linear-gradient(90deg, #24292f, #06b6d4);
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

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class GithubComponent implements OnInit, OnDestroy {
  credentialsService = inject(CredentialsService);
  private githubService = inject(GithubService);
  private filterService = inject(FilterService);
  private environmentService = inject(EnvironmentService);
  private pageHeaderService = inject(PageHeaderService);
  private injector = inject(Injector);

  loading = signal(false);
  searchLimitExceeded = signal(false);
  developers = signal<DeveloperGithubMetrics[]>([]);
  totalMetrics = signal({
    totalPrs: 0,
    prsReviewed: 0,
    prsMerged: 0,
    openPrs: 0,
    uniqueRepositories: 0,
    linesAdded: 0,
    linesRemoved: 0,
    changedFiles: 0
  });
  weeklyActivityChart = signal<any>({ labels: [], datasets: [] });
  repositoryChart = signal<any>({ labels: [], datasets: [] });

  private allDevelopers: DeveloperGithubMetrics[] = [];
  private configuredDevelopers: ConfiguredGithubDeveloper[] = [];

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

  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'right',
        labels: { color: '#a0a0a0', padding: 15 }
      }
    }
  };

  ngOnInit(): void {
    this.pageHeaderService.setPageInfo('GitHub Metrics', 'pi-github', true);
    this.pageHeaderService.registerRefreshCallback(() => this.loadData(true));

    effect(() => {
      this.filterService.selectedManagers();
      this.filterService.selectedDepartments();
      this.filterService.selectedInnovationTeams();

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

  isConfigured(): boolean {
    return this.environmentService.isProduction() || this.credentialsService.hasGithubCredentials();
  }

  totalLineChanges(): number {
    return this.totalMetrics().linesAdded + this.totalMetrics().linesRemoved;
  }

  loadData(forceRefresh = false): void {
    if (!this.isConfigured()) {
      return;
    }

    this.loading.set(true);
    this.pageHeaderService.setLoading(true);
    const range = this.pageHeaderService.dateRange();

    this.githubService.getConfiguredDevelopersMetrics(range[0], range[1], forceRefresh).subscribe({
      next: result => {
        this.searchLimitExceeded.set(result.searchLimitExceeded);
        this.allDevelopers = result.developers.map(dev => {
          const configDev = this.configuredDevelopers.find(
            configured => (configured.githubUsername || configured.username).toLowerCase() === dev.githubUsername.toLowerCase()
          );
          return {
            ...dev,
            manager: configDev?.manager || dev.manager,
            department: configDev?.department || dev.department,
            innovationTeam: configDev?.innovationTeam || dev.innovationTeam
          };
        });
        this.applyFilters();
        this.loading.set(false);
        this.pageHeaderService.setLoading(false);
      },
      error: err => {
        console.error('Error loading GitHub data:', err);
        this.loading.set(false);
        this.pageHeaderService.setLoading(false);
      }
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getMergeRate(dev: DeveloperGithubMetrics): number {
    return dev.prsSubmitted > 0 ? Math.round((dev.prsMerged / dev.prsSubmitted) * 100) : 0;
  }

  private loadConfigAndData(): void {
    this.githubService.getConfiguredDevelopers().subscribe({
      next: config => {
        this.configuredDevelopers = config.developers;
        this.loadData();
      },
      error: err => {
        console.error('Error loading developers config:', err);
        this.loadData();
      }
    });
  }

  private applyFilters(): void {
    const filtered = sortDevelopersByLineChanges(this.filterService.applyAllFilters([...this.allDevelopers]));
    this.developers.set(filtered);
    this.recalculateTotals(filtered);
    this.updateCharts(filtered);
  }

  private recalculateTotals(developers: DeveloperGithubMetrics[]): void {
    const totals = developers.reduce((acc, dev) => ({
      totalPrs: acc.totalPrs + dev.prsSubmitted,
      prsReviewed: acc.prsReviewed + dev.prsReviewed,
      prsMerged: acc.prsMerged + dev.prsMerged,
      openPrs: acc.openPrs + dev.openPrs,
      uniqueRepositories: acc.uniqueRepositories,
      linesAdded: acc.linesAdded + dev.linesAdded,
      linesRemoved: acc.linesRemoved + dev.linesRemoved,
      changedFiles: acc.changedFiles + dev.changedFiles
    }), {
      totalPrs: 0,
      prsReviewed: 0,
      prsMerged: 0,
      openPrs: 0,
      uniqueRepositories: 0,
      linesAdded: 0,
      linesRemoved: 0,
      changedFiles: 0
    });
    totals.uniqueRepositories = new Set(developers.flatMap(dev => dev.repositories)).size;
    this.totalMetrics.set(totals);
  }

  private updateCharts(developers: DeveloperGithubMetrics[]): void {
    const authoredPullRequests = developers.flatMap(dev => dev.authoredPullRequests || []);
    const activityPullRequests = developers.flatMap(dev => dev.activityPullRequests || []);
    const weeklyActivity = getWeeklyActivity(authoredPullRequests);
    const topRepositories = getTopRepositories(activityPullRequests);

    this.weeklyActivityChart.set({
      labels: weeklyActivity.map(item => item.label),
      datasets: [
        { label: 'PRs Submitted', data: weeklyActivity.map(item => item.prsSubmitted), backgroundColor: '#8b5cf6' },
        { label: 'PRs Merged', data: weeklyActivity.map(item => item.prsMerged), backgroundColor: '#22c55e' }
      ]
    });

    this.repositoryChart.set({
      labels: topRepositories.map(item => item.repo),
      datasets: [{
        data: topRepositories.map(item => item.activityCount),
        backgroundColor: ['#24292f', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']
      }]
    });
  }
}

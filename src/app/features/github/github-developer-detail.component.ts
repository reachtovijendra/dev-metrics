import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { GithubService } from '../../core/services/github.service';
import {
  DeveloperGithubMetrics,
  GithubRepositoryBreakdown,
  getDeveloperRepositoryBreakdown,
  getWeeklyLineChanges
} from '../../core/services/github-metrics.mapper';
import { PageHeaderService } from '../../core/services/page-header.service';

@Component({
  selector: 'app-github-developer-detail',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ChartModule,
    TableModule,
    TagModule,
    MetricCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="github-detail-page">
      <a routerLink="/github" class="back-link">
        <i class="pi pi-arrow-left"></i>
        Back to GitHub Metrics
      </a>

      @if (loading()) {
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Loading six-month GitHub detail...</span>
        </div>
      } @else if (!developer()) {
        <div class="empty-state">
          <i class="pi pi-user"></i>
          <h3>Developer Not Found</h3>
          <p>No GitHub metrics were found for this developer in the configured roster.</p>
        </div>
      } @else {
        <section class="detail-hero">
          <div class="hero-person">
            <div class="avatar">{{ getInitials(developer()!.name) }}</div>
            <div>
              <p class="eyebrow">GitHub Developer Drill-Down</p>
              <h2>{{ developer()!.name }}</h2>
              <span class="github-login">&#64;{{ developer()!.githubUsername }}</span>
            </div>
          </div>
          <div class="hero-meta">
            <p-tag [value]="developer()!.manager || 'No manager'" severity="info" />
            <p-tag [value]="developer()!.department || 'No department'" severity="secondary" />
            <p-tag [value]="developer()!.innovationTeam || 'No team'" severity="success" />
          </div>
        </section>

        <div class="metrics-grid">
          <app-metric-card label="Lines Changed" [value]="totalLineChanges()" icon="pi-pencil" iconBg="#10b981" />
          <app-metric-card label="PRs Submitted" [value]="developer()!.prsSubmitted" icon="pi-code" iconBg="#8b5cf6" />
          <app-metric-card label="PRs Reviewed" [value]="developer()!.prsReviewed" icon="pi-eye" iconBg="#06b6d4" />
          <app-metric-card label="Unique Repositories" [value]="developer()!.uniqueRepositories" icon="pi-sitemap" iconBg="#f59e0b" />
        </div>

        <div class="insight-grid">
          <p-card styleClass="insight-card">
            <span class="insight-label">Merge Rate</span>
            <strong>{{ mergeRate() }}%</strong>
            <p>{{ developer()!.prsMerged }} merged of {{ developer()!.prsSubmitted }} submitted PRs</p>
          </p-card>
          <p-card styleClass="insight-card">
            <span class="insight-label">Average PR Size</span>
            <strong>{{ developer()!.avgPrSize | number }}</strong>
            <p>Average additions plus deletions per submitted PR</p>
          </p-card>
          <p-card styleClass="insight-card">
            <span class="insight-label">Review Balance</span>
            <strong>{{ reviewBalance() }}</strong>
            <p>Reviews per submitted PR</p>
          </p-card>
          <p-card styleClass="insight-card">
            <span class="insight-label">Largest PR</span>
            <strong>{{ largestPrSize() | number }}</strong>
            <p>Largest single authored PR by line changes</p>
          </p-card>
        </div>

        <div class="charts-row">
          <p-card styleClass="chart-card wide">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Weekly Lines Changed</h3>
                <p>Authored PR additions plus deletions grouped by the week containing each PR created date.</p>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="weeklyLineChart()" [options]="barChartOptions" height="320" />
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Repository Mix</h3>
                <p>Unique repositories touched by submitted or reviewed PRs.</p>
              </div>
            </ng-template>
            <div class="repo-chip-list">
              @for (repo of repositoryBreakdown(); track repo.repo) {
                <span class="repo-chip">{{ repo.repo }}</span>
              }
            </div>
          </p-card>
        </div>

        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Repository Breakdown</h3>
            </div>
          </ng-template>
          <p-table [value]="repositoryBreakdown()" styleClass="p-datatable-sm" [rows]="10">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="repo">Repository <p-sortIcon field="repo" /></th>
                <th pSortableColumn="activityCount">Activity <p-sortIcon field="activityCount" /></th>
                <th pSortableColumn="prsSubmitted">Submitted <p-sortIcon field="prsSubmitted" /></th>
                <th pSortableColumn="prsReviewed">Reviewed <p-sortIcon field="prsReviewed" /></th>
                <th pSortableColumn="lineChanges">Lines <p-sortIcon field="lineChanges" /></th>
                <th pSortableColumn="changedFiles">Files <p-sortIcon field="changedFiles" /></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-repo>
              <tr>
                <td>{{ repo.repo }}</td>
                <td>{{ repo.activityCount }}</td>
                <td>{{ repo.prsSubmitted }}</td>
                <td>{{ repo.prsReviewed }}</td>
                <td>{{ repo.lineChanges | number }}</td>
                <td>{{ repo.changedFiles | number }}</td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Authored Pull Requests</h3>
            </div>
          </ng-template>
          <p-table [value]="developer()!.authoredPullRequests" styleClass="p-datatable-sm" [paginator]="true" [rows]="10">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="repo">Repository <p-sortIcon field="repo" /></th>
                <th pSortableColumn="number">PR <p-sortIcon field="number" /></th>
                <th pSortableColumn="createdAt">Created <p-sortIcon field="createdAt" /></th>
                <th pSortableColumn="additions">Added <p-sortIcon field="additions" /></th>
                <th pSortableColumn="deletions">Removed <p-sortIcon field="deletions" /></th>
                <th pSortableColumn="changedFiles">Files <p-sortIcon field="changedFiles" /></th>
                <th>Status</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-pr>
              <tr>
                <td>{{ pr.repo }}</td>
                <td>#{{ pr.number }}</td>
                <td>{{ pr.createdAt | date: 'mediumDate' }}</td>
                <td class="lines-added">+{{ pr.additions | number }}</td>
                <td class="lines-removed">-{{ pr.deletions | number }}</td>
                <td>{{ pr.changedFiles | number }}</td>
                <td>
                  <p-tag [value]="pr.mergedAt ? 'Merged' : 'Open'" [severity]="pr.mergedAt ? 'success' : 'warning'" />
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
  styles: [`
    .github-detail-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      animation: fadeIn 0.3s ease-out;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #60a5fa;
      font-weight: 700;
      text-decoration: none;
      width: fit-content;
    }

    .detail-hero {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.5rem;
      border: 1px solid var(--surface-border);
      border-radius: 18px;
      background:
        radial-gradient(circle at top left, rgba(96, 165, 250, 0.18), transparent 35%),
        linear-gradient(135deg, var(--surface-card), var(--surface-ground));
    }

    .hero-person,
    .hero-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .avatar {
      display: grid;
      width: 4rem;
      height: 4rem;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(135deg, #24292f, #06b6d4);
      color: white;
      font-size: 1.25rem;
      font-weight: 800;
    }

    .eyebrow,
    .github-login,
    .card-title p,
    .insight-card p {
      color: var(--text-color-secondary);
    }

    .eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2,
    h3,
    p {
      margin: 0;
    }

    h2 {
      color: var(--text-color);
      font-size: 2rem;
      font-weight: 800;
    }

    .metrics-grid,
    .insight-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }

    .insight-label {
      display: block;
      color: var(--text-color-secondary);
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .insight-card strong {
      display: block;
      margin: 0.35rem 0;
      color: var(--text-color);
      font-size: 1.5rem;
    }

    .charts-row {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.5fr);
      gap: 1rem;
    }

    :host ::ng-deep .chart-card,
    :host ::ng-deep .table-card,
    :host ::ng-deep .insight-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
    }

    :host ::ng-deep .p-card-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .card-title h3 {
      color: var(--text-color);
      font-size: 1.05rem;
      font-weight: 800;
    }

    .repo-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .repo-chip {
      padding: 0.45rem 0.7rem;
      border: 1px solid rgba(96, 165, 250, 0.32);
      border-radius: 999px;
      background: rgba(96, 165, 250, 0.12);
      color: var(--text-color);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .lines-added {
      color: #10b981;
      font-weight: 700;
    }

    .lines-removed {
      color: #ef4444;
      font-weight: 700;
    }

    .loading-state,
    .empty-state {
      display: grid;
      place-items: center;
      min-height: 18rem;
      color: var(--text-color-secondary);
      text-align: center;
    }

    .loading-state {
      display: flex;
      gap: 0.75rem;
    }

    @media (max-width: 1100px) {
      .metrics-grid,
      .insight-grid,
      .charts-row {
        grid-template-columns: 1fr;
      }

      .detail-hero {
        flex-direction: column;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class GithubDeveloperDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private githubService = inject(GithubService);
  private pageHeader = inject(PageHeaderService);

  loading = signal(false);
  developer = signal<DeveloperGithubMetrics | null>(null);
  repositoryBreakdown = signal<GithubRepositoryBreakdown[]>([]);
  weeklyLineChart = signal<any>({ labels: [], datasets: [] });

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
        ticks: { color: '#a0a0a0', maxRotation: 45, minRotation: 45 }
      },
      y: {
        beginAtZero: true,
        position: 'left',
        title: { display: true, text: 'Lines changed', color: '#a0a0a0' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#a0a0a0' }
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        title: { display: true, text: 'PRs submitted', color: '#a0a0a0' },
        grid: { drawOnChartArea: false },
        ticks: { color: '#a0a0a0', precision: 0 }
      }
    }
  };

  ngOnInit(): void {
    this.pageHeader.setPageInfo('GitHub Developer Detail', 'pi-github', true);
    this.pageHeader.registerRefreshCallback(() => this.loadDeveloper(true));
    this.loadDeveloper(false);
  }

  ngOnDestroy(): void {
    this.pageHeader.unregisterRefreshCallback();
  }

  totalLineChanges(): number {
    const dev = this.developer();
    return dev ? dev.linesAdded + dev.linesRemoved : 0;
  }

  mergeRate(): number {
    const dev = this.developer();
    return dev && dev.prsSubmitted > 0 ? Math.round((dev.prsMerged / dev.prsSubmitted) * 100) : 0;
  }

  reviewBalance(): string {
    const dev = this.developer();
    if (!dev || dev.prsSubmitted === 0) {
      return '0.0x';
    }
    return `${(dev.prsReviewed / dev.prsSubmitted).toFixed(1)}x`;
  }

  largestPrSize(): number {
    const dev = this.developer();
    if (!dev) {
      return 0;
    }
    return Math.max(0, ...dev.authoredPullRequests.map(pr => pr.additions + pr.deletions));
  }

  getInitials(name: string): string {
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
  }

  private loadDeveloper(forceRefresh: boolean): void {
    const githubUsername = this.route.snapshot.paramMap.get('githubUsername')?.toLowerCase();
    if (!githubUsername) {
      this.developer.set(null);
      return;
    }

    this.loading.set(true);
    this.pageHeader.setLoading(true);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    this.githubService.getDeveloperMetrics(githubUsername, startDate, endDate, forceRefresh).subscribe({
      next: developer => {
        this.developer.set(developer);

        if (developer) {
          this.repositoryBreakdown.set(getDeveloperRepositoryBreakdown(developer.activityPullRequests, developer.githubUsername));
          this.updateWeeklyLineChart(developer);
          this.pageHeader.setPageInfo(`${developer.name} GitHub Detail`, 'pi-github', true);
        }

        this.loading.set(false);
        this.pageHeader.setLoading(false);
      },
      error: err => {
        console.error('Error loading GitHub developer detail:', err);
        this.loading.set(false);
        this.pageHeader.setLoading(false);
      }
    });
  }

  private updateWeeklyLineChart(developer: DeveloperGithubMetrics): void {
    const history = getWeeklyLineChanges(developer.authoredPullRequests, new Date(), 6);
    this.weeklyLineChart.set({
      labels: history.map(item => item.label),
      datasets: [
        { label: 'Lines Changed', data: history.map(item => item.linesChanged), backgroundColor: '#10b981', yAxisID: 'y' },
        { label: 'PRs Submitted', data: history.map(item => item.prsSubmitted), backgroundColor: '#8b5cf6', yAxisID: 'y1' }
      ]
    });
  }
}

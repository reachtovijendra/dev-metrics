import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MetricCardComponent } from '../../shared/components/metric-card/metric-card.component';
import { CredentialsService } from '../../core/services/credentials.service';
import { MablService } from '../../core/services/mabl.service';
import { EnvironmentService } from '../../core/services/environment.service';
import { PageHeaderService } from '../../core/services/page-header.service';
import {
  MablAggregatedMetrics,
  MablTestRun,
  MablApplication,
  MablEnvironment,
  MablDailyTrend
} from '../../core/models/mabl.model';
import { DateRange } from '../../core/models/developer.model';

interface TestRunDisplay {
  testName: string;
  status: string;
  success: boolean;
  duration: number;
  browser: string;
  environment: string;
  application: string;
  startTime: Date;
  failureCategory: string;
}

@Component({
  selector: 'app-mabl',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ChartModule,
    ButtonModule,
    TagModule,
    ProgressBarModule,
    SelectModule,
    TooltipModule,
    MetricCardComponent
  ],
  template: `
    <div class="mabl-page">
      @if (!isConfigured()) {
        <div class="no-credentials">
          <i class="pi pi-lock"></i>
          <h3>MABL API Not Connected</h3>
          <p>Configure your MABL API credentials in Settings to view test automation metrics.</p>
        </div>
      } @else {
        <!-- KPI Summary -->
        <div class="metrics-grid">
          <app-metric-card
            label="Total Test Runs"
            [value]="metrics().totalTestRuns"
            icon="pi-play"
            iconBg="#3b82f6"
          />
          <app-metric-card
            label="Pass Rate"
            [value]="metrics().passRate"
            icon="pi-check-circle"
            iconBg="#22c55e"
            format="percent"
          />
          <app-metric-card
            label="Failed Tests"
            [value]="metrics().failedTests"
            icon="pi-times-circle"
            iconBg="#ef4444"
          />
          <app-metric-card
            label="Avg Run Time"
            [value]="avgRunTimeSeconds()"
            icon="pi-clock"
            iconBg="#8b5cf6"
            format="decimal"
            [decimals]="1"
            [subtitle]="'seconds'"
          />
        </div>

        <!-- Charts Row -->
        <div class="charts-row">
          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Pass/Fail Trend</h3>
              </div>
            </ng-template>
            <div class="chart-container">
              <p-chart type="line" [data]="trendChartData" [options]="lineChartOptions" />
            </div>
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Failure Categories</h3>
              </div>
            </ng-template>
            <div class="chart-container">
              @if (hasFailureCategories()) {
                <p-chart type="doughnut" [data]="failureCategoriesChart" [options]="doughnutOptions" />
              } @else {
                <div class="no-data-message">
                  <i class="pi pi-check-circle"></i>
                  <span>No failures in selected period</span>
                </div>
              }
            </div>
          </p-card>
        </div>

        <!-- Distribution Charts Row -->
        <div class="charts-row">
          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Tests by Application</h3>
              </div>
            </ng-template>
            <div class="chart-container">
              @if (hasApplicationData()) {
                <p-chart type="bar" [data]="applicationChart" [options]="barChartOptions" />
              } @else {
                <div class="no-data-message">
                  <i class="pi pi-inbox"></i>
                  <span>No test data available</span>
                </div>
              }
            </div>
          </p-card>

          <p-card styleClass="chart-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Browser Coverage</h3>
              </div>
            </ng-template>
            <div class="chart-container">
              @if (hasBrowserData()) {
                <p-chart type="doughnut" [data]="browserChart" [options]="doughnutOptions" />
              } @else {
                <div class="no-data-message">
                  <i class="pi pi-inbox"></i>
                  <span>No browser data available</span>
                </div>
              }
            </div>
          </p-card>
        </div>

        <!-- Accessibility Metrics -->
        @if (hasAccessibilityData()) {
          <p-card styleClass="accessibility-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Accessibility Violations</h3>
              </div>
            </ng-template>
            <div class="accessibility-grid">
              <div class="violation-item critical">
                <span class="violation-count">{{ metrics().accessibilityViolations.critical }}</span>
                <span class="violation-label">Critical</span>
              </div>
              <div class="violation-item serious">
                <span class="violation-count">{{ metrics().accessibilityViolations.serious }}</span>
                <span class="violation-label">Serious</span>
              </div>
              <div class="violation-item moderate">
                <span class="violation-count">{{ metrics().accessibilityViolations.moderate }}</span>
                <span class="violation-label">Moderate</span>
              </div>
              <div class="violation-item minor">
                <span class="violation-count">{{ metrics().accessibilityViolations.minor }}</span>
                <span class="violation-label">Minor</span>
              </div>
            </div>
          </p-card>
        }

        <!-- Test Results Table -->
        <p-card styleClass="table-card">
          <ng-template pTemplate="header">
            <div class="card-title">
              <h3>Recent Test Runs</h3>
              <span class="test-count">{{ testRuns().length }} tests</span>
            </div>
          </ng-template>
          
          <p-table 
            [value]="testRunsDisplay()" 
            [paginator]="true" 
            [rows]="10"
            [rowsPerPageOptions]="[5, 10, 25, 50]"
            styleClass="p-datatable-sm"
            sortField="startTime"
            [sortOrder]="-1"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="testName">Test Name <p-sortIcon field="testName" /></th>
                <th pSortableColumn="status">Status <p-sortIcon field="status" /></th>
                <th pSortableColumn="duration">Duration <p-sortIcon field="duration" /></th>
                <th pSortableColumn="browser">Browser <p-sortIcon field="browser" /></th>
                <th pSortableColumn="environment">Environment <p-sortIcon field="environment" /></th>
                <th pSortableColumn="startTime">Run Time <p-sortIcon field="startTime" /></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-test>
              <tr>
                <td>
                  <div class="test-name-cell">
                    <span class="test-name">{{ test.testName }}</span>
                    @if (test.failureCategory) {
                      <span class="failure-category">{{ test.failureCategory }}</span>
                    }
                  </div>
                </td>
                <td>
                  <p-tag 
                    [value]="test.success ? 'Passed' : 'Failed'" 
                    [severity]="test.success ? 'success' : 'danger'"
                  />
                </td>
                <td>
                  <span class="duration">{{ formatDuration(test.duration) }}</span>
                </td>
                <td>
                  <span class="browser-name">{{ test.browser }}</span>
                </td>
                <td>
                  <span class="environment-name">{{ test.environment }}</span>
                </td>
                <td>
                  <span class="run-time">{{ test.startTime | date:'short' }}</span>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <!-- Most Failed Tests -->
        @if (mostFailedTests().length > 0) {
          <p-card styleClass="table-card">
            <ng-template pTemplate="header">
              <div class="card-title">
                <h3>Most Failed Tests</h3>
              </div>
            </ng-template>
            
            <p-table 
              [value]="mostFailedTests()" 
              styleClass="p-datatable-sm"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th>Test Name</th>
                  <th>Failures</th>
                  <th>Total Runs</th>
                  <th>Failure Rate</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-test>
                <tr>
                  <td><span class="test-name">{{ test.testName }}</span></td>
                  <td><span class="failure-count">{{ test.failureCount }}</span></td>
                  <td>{{ test.totalRuns }}</td>
                  <td>
                    <p-progressBar 
                      [value]="(test.failureCount / test.totalRuns) * 100" 
                      [showValue]="true"
                      styleClass="failure-bar"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>
        }
      }
    </div>
  `,
  styles: [`
    .mabl-page {
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
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    :host ::ng-deep .chart-card {
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

    .chart-container {
      height: 300px;
    }

    .no-data-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-color-secondary);
      gap: 0.75rem;

      i {
        font-size: 2.5rem;
        color: #22c55e;
      }

      span {
        font-size: 0.9rem;
      }
    }

    :host ::ng-deep .table-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      margin-bottom: 1.5rem;

      .p-card-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--surface-border);
      }

      .p-card-body {
        padding: 1.5rem;
      }
    }

    :host ::ng-deep .accessibility-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      margin-bottom: 1.5rem;

      .p-card-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--surface-border);
      }

      .p-card-body {
        padding: 1.5rem;
      }
    }

    .card-title {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
      }

      .test-count {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
    }

    .accessibility-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .violation-item {
      text-align: center;
      padding: 1.5rem;
      border-radius: 8px;
      background: var(--surface-ground);

      .violation-count {
        display: block;
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }

      .violation-label {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }

      &.critical {
        .violation-count { color: #dc2626; }
        border-left: 4px solid #dc2626;
      }

      &.serious {
        .violation-count { color: #ea580c; }
        border-left: 4px solid #ea580c;
      }

      &.moderate {
        .violation-count { color: #f59e0b; }
        border-left: 4px solid #f59e0b;
      }

      &.minor {
        .violation-count { color: #3b82f6; }
        border-left: 4px solid #3b82f6;
      }
    }

    .test-name-cell {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .test-name {
      font-weight: 500;
      color: var(--text-color);
    }

    .failure-category {
      font-size: 0.75rem;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      width: fit-content;
    }

    .duration {
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.875rem;
    }

    .browser-name, .environment-name {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .run-time {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .failure-count {
      font-weight: 600;
      color: #ef4444;
    }

    :host ::ng-deep .failure-bar {
      height: 8px;
      
      .p-progressbar-value {
        background: linear-gradient(90deg, #ef4444, #dc2626);
      }
    }

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

    :host ::ng-deep .p-paginator {
      background: var(--surface-card) !important;
      border: none !important;
      border-top: 1px solid var(--surface-border) !important;
      padding: 0.75rem 1rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .charts-row {
        grid-template-columns: 1fr;
      }

      .accessibility-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class MablComponent implements OnInit, OnDestroy {
  private credentialsService = inject(CredentialsService);
  private mablService = inject(MablService);
  private environmentService = inject(EnvironmentService);
  private pageHeaderService = inject(PageHeaderService);

  loading = signal(false);
  metrics = signal<MablAggregatedMetrics>(this.emptyMetrics());
  testRuns = signal<MablTestRun[]>([]);
  mostFailedTests = signal<{ testId: string; testName: string; failureCount: number; totalRuns: number }[]>([]);

  testRunsDisplay = computed(() => {
    return this.testRuns().map(test => ({
      testName: test.test_name,
      status: test.status,
      success: test.success,
      duration: test.run_time,
      browser: test.browser || 'Unknown',
      environment: test.environment_name || 'Unknown',
      application: test.application_name || 'Unknown',
      startTime: new Date(test.start_time),
      failureCategory: test.success ? '' : test.failure_category
    }));
  });

  avgRunTimeSeconds = computed(() => this.metrics().averageRunTime / 1000);

  hasAccessibilityData = computed(() => {
    const violations = this.metrics().accessibilityViolations;
    return violations.critical > 0 || violations.serious > 0 || 
           violations.moderate > 0 || violations.minor > 0;
  });

  hasFailureCategories = computed(() => {
    return Object.keys(this.metrics().failureCategories).length > 0;
  });

  hasApplicationData = computed(() => {
    return Object.keys(this.metrics().testsByApplication).length > 0;
  });

  hasBrowserData = computed(() => {
    return Object.keys(this.metrics().testsByBrowser).length > 0;
  });

  trendChartData: any = { labels: [], datasets: [] };
  failureCategoriesChart: any = { labels: [], datasets: [] };
  applicationChart: any = { labels: [], datasets: [] };
  browserChart: any = { labels: [], datasets: [] };

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
        position: 'right',
        labels: { color: '#a0a0a0' }
      }
    }
  };

  isConfigured(): boolean {
    return this.environmentService.isProduction() || this.credentialsService.hasMablCredentials();
  }

  ngOnInit(): void {
    this.pageHeaderService.setPageInfo('MABL Test Automation', 'pi-bolt', true);
    
    this.pageHeaderService.registerRefreshCallback(() => {
      this.mablService.clearCache();
      this.loadData(true);
    });
    
    if (this.isConfigured()) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.pageHeaderService.unregisterRefreshCallback();
  }

  loadData(forceRefresh = false): void {
    if (!this.isConfigured()) {
      return;
    }

    this.loading.set(true);
    this.pageHeaderService.setLoading(true);

    const dateRange = this.pageHeaderService.dateRange();
    const range: DateRange = {
      startDate: dateRange[0],
      endDate: dateRange[1]
    };

    this.mablService.getAggregatedMetrics(range, forceRefresh).subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
        this.updateCharts(metrics);
        this.loading.set(false);
        this.pageHeaderService.setLoading(false);
      },
      error: (err) => {
        console.error('Error fetching MABL metrics:', err);
        this.metrics.set(this.emptyMetrics());
        this.loading.set(false);
        this.pageHeaderService.setLoading(false);
      }
    });

    this.mablService.getTestRuns(range).subscribe({
      next: (runs) => {
        this.testRuns.set(runs);
      },
      error: (err) => {
        console.error('Error fetching MABL test runs:', err);
        this.testRuns.set([]);
      }
    });

    this.mablService.getMostFailedTests(range, 10).subscribe({
      next: (tests) => {
        this.mostFailedTests.set(tests);
      },
      error: (err) => {
        console.error('Error fetching most failed tests:', err);
        this.mostFailedTests.set([]);
      }
    });
  }

  private updateCharts(metrics: MablAggregatedMetrics): void {
    this.updateTrendChart(metrics.dailyTrends);
    this.updateFailureCategoriesChart(metrics.failureCategories);
    this.updateApplicationChart(metrics.testsByApplication);
    this.updateBrowserChart(metrics.testsByBrowser);
  }

  private updateTrendChart(trends: MablDailyTrend[]): void {
    this.trendChartData = {
      labels: trends.map(t => t.date),
      datasets: [
        {
          label: 'Passed',
          data: trends.map(t => t.passed),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Failed',
          data: trends.map(t => t.failed),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  private updateFailureCategoriesChart(categories: Record<string, number>): void {
    const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const colors = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

    this.failureCategoriesChart = {
      labels: entries.map(([name]) => name || 'Unknown'),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: colors.slice(0, entries.length)
      }]
    };
  }

  private updateApplicationChart(apps: Record<string, number>): void {
    const entries = Object.entries(apps).sort((a, b) => b[1] - a[1]).slice(0, 10);

    this.applicationChart = {
      labels: entries.map(([name]) => name),
      datasets: [{
        label: 'Test Runs',
        data: entries.map(([, count]) => count),
        backgroundColor: '#3b82f6'
      }]
    };
  }

  private updateBrowserChart(browsers: Record<string, number>): void {
    const entries = Object.entries(browsers).sort((a, b) => b[1] - a[1]);
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444'];

    this.browserChart = {
      labels: entries.map(([name]) => name),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: colors.slice(0, entries.length)
      }]
    };
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }

  private emptyMetrics(): MablAggregatedMetrics {
    return {
      totalTestRuns: 0,
      passedTests: 0,
      failedTests: 0,
      passRate: 0,
      failRate: 0,
      averageRunTime: 0,
      totalRunTime: 0,
      testsByApplication: {},
      testsByEnvironment: {},
      testsByBrowser: {},
      testsByStatus: {},
      failureCategories: {},
      accessibilityViolations: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      performanceMetrics: { avgSpeedIndex: 0, avgApiResponseTime: 0 },
      dailyTrends: []
    };
  }
}

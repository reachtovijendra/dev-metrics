import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  template: `
    <div class="metric-card" [class]="'trend-' + trend()">
      <div class="metric-header">
        <div class="metric-icon" [style.background]="iconBg()">
          <i [class]="'pi ' + icon()"></i>
        </div>
        <span class="metric-label">{{ label() }}</span>
      </div>
      
      <div class="metric-value">{{ formattedValue() }}</div>
      
      @if (change() !== undefined) {
        <div class="metric-change" [class.positive]="change()! >= 0" [class.negative]="change()! < 0">
          <i [class]="change()! >= 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"></i>
          <span>{{ Math.abs(change()!) }}%</span>
          <span class="change-period">vs last period</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .metric-card {
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 1.5rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    }

    .metric-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .metric-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      
      i {
        font-size: 1.25rem;
        color: white;
      }
    }

    .metric-label {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-color);
      margin-bottom: 0.5rem;
    }

    .metric-change {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;

      i {
        font-size: 0.75rem;
      }

      &.positive {
        color: #22c55e;
      }

      &.negative {
        color: #ef4444;
      }

      .change-period {
        color: var(--text-color-secondary);
        margin-left: 0.25rem;
      }
    }
  `]
})
export class MetricCardComponent {
  label = input.required<string>();
  value = input.required<number>();
  icon = input<string>('pi-chart-line');
  iconBg = input<string>('#60a5fa');
  change = input<number>();
  trend = input<'up' | 'down' | 'neutral'>('neutral');
  format = input<'number' | 'currency' | 'percent' | 'decimal'>('number');
  decimals = input<number>(1);

  Math = Math;

  formattedValue(): string {
    const val = this.value();
    switch (this.format()) {
      case 'currency':
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'percent':
        return val.toFixed(1) + '%';
      case 'decimal':
        return val.toFixed(this.decimals());
      default:
        return val.toLocaleString();
    }
  }
}




import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PageHeaderService {
  // Page title
  pageTitle = signal<string>('Dashboard');
  pageIcon = signal<string>('pi-home');
  
  // Date range
  dateRange = signal<Date[]>([
    new Date(new Date().setDate(new Date().getDate() - 7)),
    new Date()
  ]);
  
  // Show date picker (some pages might not need it)
  showDatePicker = signal<boolean>(true);
  
  // Loading state for refresh button
  loading = signal<boolean>(false);
  
  // Refresh callback
  private refreshCallback: (() => void) | null = null;

  setPageInfo(title: string, icon: string, showDatePicker: boolean = true): void {
    this.pageTitle.set(title);
    this.pageIcon.set(icon);
    this.showDatePicker.set(showDatePicker);
  }

  setDateRange(range: Date[]): void {
    this.dateRange.set(range);
  }

  setLoading(loading: boolean): void {
    this.loading.set(loading);
  }

  registerRefreshCallback(callback: () => void): void {
    this.refreshCallback = callback;
  }

  unregisterRefreshCallback(): void {
    this.refreshCallback = null;
  }

  triggerRefresh(): void {
    if (this.refreshCallback) {
      this.refreshCallback();
    }
  }
}





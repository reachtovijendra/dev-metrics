import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'dev_metrics_theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = signal<ThemeMode>(this.loadFromStorage());

  readonly isDarkMode = () => this.currentTheme() === 'dark';
  readonly theme = this.currentTheme.asReadonly();

  constructor() {
    // Apply theme on initialization and changes
    effect(() => {
      this.applyTheme(this.currentTheme());
    });
  }

  private loadFromStorage(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (e) {
      console.error('Failed to load theme from storage:', e);
    }
    return 'dark'; // Default to dark mode
  }

  private applyTheme(theme: ThemeMode): void {
    // Apply to document root (html) for PrimeNG dark mode support
    const root = document.documentElement;
    const body = document.body;
    
    if (theme === 'dark') {
      root.classList.remove('light-mode');
      root.classList.add('dark-mode');
      body.classList.remove('light-mode');
      body.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
      root.classList.add('light-mode');
      body.classList.remove('dark-mode');
      body.classList.add('light-mode');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }

  toggleTheme(): void {
    this.currentTheme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): void {
    this.currentTheme.set(theme);
  }
}




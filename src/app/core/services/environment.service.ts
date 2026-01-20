import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  /**
   * Detect if running in production (Vercel deployment)
   * In production, we use serverless API proxies that handle authentication
   */
  readonly isProduction = signal<boolean>(this.detectProduction());
  
  /**
   * Check if server-side credentials are available
   * This is determined by successfully calling a health check endpoint
   */
  readonly hasServerCredentials = signal<boolean>(false);

  private detectProduction(): boolean {
    // Check if running on Vercel or other production environments
    const hostname = window.location.hostname;
    return !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
  }

  /**
   * Get the appropriate base URL for Cursor API
   * - Development: /cursor-api (uses proxy.conf.json + local credentials)
   * - Production: /api/cursor (uses Vercel serverless function)
   */
  getCursorApiUrl(): string {
    return this.isProduction() ? '/api/cursor' : '/cursor-api';
  }

  /**
   * Get the appropriate base URL for JIRA API
   * - Development: /jira-api (uses proxy.conf.json + local credentials)
   * - Production: /api/jira (uses Vercel serverless function)
   */
  getJiraApiUrl(): string {
    return this.isProduction() ? '/api/jira' : '/jira-api';
  }

  /**
   * Get the appropriate base URL for Bitbucket API
   * - Development: /rest/api/latest (uses proxy.conf.json + local credentials)
   * - Production: /api/bitbucket (uses Vercel serverless function)
   */
  getBitbucketApiUrl(): string {
    return this.isProduction() ? '/api/bitbucket' : '/rest/api/latest';
  }

  /**
   * Check if authentication should be handled client-side
   * In production, the serverless functions handle auth
   */
  shouldAddClientAuth(): boolean {
    return !this.isProduction();
  }

  /**
   * Mark that server credentials are available
   */
  setServerCredentialsAvailable(available: boolean): void {
    this.hasServerCredentials.set(available);
  }
}


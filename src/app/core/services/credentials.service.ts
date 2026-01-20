import { Injectable, signal, computed } from '@angular/core';
import { AllCredentials, BitbucketCredentials, CursorCredentials, JiraCredentials } from '../models/credentials.model';

const STORAGE_KEY = 'dev_metrics_credentials';

@Injectable({
  providedIn: 'root'
})
export class CredentialsService {
  private credentials = signal<AllCredentials>(this.loadFromStorage());

  readonly hasBitbucketCredentials = computed(() => !!this.credentials().bitbucket);
  readonly hasCursorCredentials = computed(() => !!this.credentials().cursor);
  readonly hasJiraCredentials = computed(() => !!this.credentials().jira);
  readonly hasAnyCredentials = computed(() => 
    this.hasBitbucketCredentials() || this.hasCursorCredentials() || this.hasJiraCredentials()
  );

  private loadFromStorage(): AllCredentials {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load credentials from storage:', e);
    }
    return {};
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.credentials()));
    } catch (e) {
      console.error('Failed to save credentials to storage:', e);
    }
  }

  getBitbucketCredentials(): BitbucketCredentials | undefined {
    return this.credentials().bitbucket;
  }

  getCursorCredentials(): CursorCredentials | undefined {
    return this.credentials().cursor;
  }

  getJiraCredentials(): JiraCredentials | undefined {
    return this.credentials().jira;
  }

  setBitbucketCredentials(creds: BitbucketCredentials): void {
    this.credentials.update(c => ({ ...c, bitbucket: creds }));
    this.saveToStorage();
  }

  setCursorCredentials(creds: CursorCredentials): void {
    this.credentials.update(c => ({ ...c, cursor: creds }));
    this.saveToStorage();
  }

  setJiraCredentials(creds: JiraCredentials): void {
    this.credentials.update(c => ({ ...c, jira: creds }));
    this.saveToStorage();
  }

  clearBitbucketCredentials(): void {
    this.credentials.update(c => {
      const { bitbucket, ...rest } = c;
      return rest;
    });
    this.saveToStorage();
  }

  clearCursorCredentials(): void {
    this.credentials.update(c => {
      const { cursor, ...rest } = c;
      return rest;
    });
    this.saveToStorage();
  }

  clearJiraCredentials(): void {
    this.credentials.update(c => {
      const { jira, ...rest } = c;
      return rest;
    });
    this.saveToStorage();
  }

  clearAllCredentials(): void {
    this.credentials.set({});
    localStorage.removeItem(STORAGE_KEY);
  }
}







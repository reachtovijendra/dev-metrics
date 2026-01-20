import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { CredentialsService } from '../../core/services/credentials.service';
import { BitbucketService } from '../../core/services/bitbucket.service';
import { CursorService } from '../../core/services/cursor.service';
import { JiraService } from '../../core/services/jira.service';
import { PageHeaderService } from '../../core/services/page-header.service';
import { BitbucketCredentials, CursorCredentials, JiraCredentials } from '../../core/models/credentials.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    DividerModule,
    ToastModule,
    TagModule
  ],
  providers: [MessageService],
  template: `
    <div class="settings-page">
      <div class="settings-grid">
        <!-- Bitbucket Data Center -->
        <p-card styleClass="settings-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <div class="header-info">
                <i class="pi pi-server"></i>
                <span>Bitbucket Data Center</span>
              </div>
              <p-tag 
                [value]="credentialsService.hasBitbucketCredentials() ? 'Connected' : 'Not Connected'"
                [severity]="credentialsService.hasBitbucketCredentials() ? 'success' : 'danger'"
              />
            </div>
          </ng-template>

          <div class="form-group">
            <label for="bb-server">Server URL</label>
            <input 
              pInputText 
              id="bb-server" 
              [(ngModel)]="bitbucketForm.serverUrl"
              placeholder="https://bitbucket.yourcompany.com"
              class="w-full"
            />
          </div>

          <div class="form-group">
            <label for="bb-username">Username</label>
            <input 
              pInputText 
              id="bb-username" 
              [(ngModel)]="bitbucketForm.username"
              placeholder="Your username"
              class="w-full"
            />
          </div>

          <div class="form-group">
            <label for="bb-password">Password / Access Token</label>
            <p-password 
              id="bb-password" 
              [(ngModel)]="bitbucketForm.password"
              placeholder="Password or Personal Access Token"
              [toggleMask]="true"
              [feedback]="false"
              styleClass="w-full"
            />
          </div>

          <div class="card-actions">
            <p-button 
              label="Test Connection" 
              icon="pi pi-check-circle" 
              [outlined]="true"
              [loading]="testingBitbucket()"
              (onClick)="testBitbucketConnection()"
            />
            <p-button 
              label="Save" 
              icon="pi pi-save"
              (onClick)="saveBitbucketCredentials()"
            />
          </div>
        </p-card>

        <!-- Cursor Admin API -->
        <p-card styleClass="settings-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <div class="header-info">
                <i class="pi pi-sparkles"></i>
                <span>Cursor Admin API</span>
              </div>
              <p-tag 
                [value]="credentialsService.hasCursorCredentials() ? 'Connected' : 'Not Connected'"
                [severity]="credentialsService.hasCursorCredentials() ? 'success' : 'danger'"
              />
            </div>
          </ng-template>

          <div class="form-group">
            <label for="cursor-key">API Key</label>
            <p-password 
              id="cursor-key" 
              [(ngModel)]="cursorForm.apiKey"
              placeholder="Your Cursor Admin API Key"
              [toggleMask]="true"
              [feedback]="false"
              styleClass="w-full"
            />
            <small class="hint">Find your API key in Cursor Team Settings</small>
          </div>

          <div class="card-actions">
            <p-button 
              label="Test Connection" 
              icon="pi pi-check-circle" 
              [outlined]="true"
              [loading]="testingCursor()"
              (onClick)="testCursorConnection()"
            />
            <p-button 
              label="Save" 
              icon="pi pi-save"
              (onClick)="saveCursorCredentials()"
            />
          </div>
        </p-card>

        <!-- JIRA Cloud -->
        <p-card styleClass="settings-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <div class="header-info">
                <i class="pi pi-ticket"></i>
                <span>JIRA Cloud</span>
              </div>
              <p-tag 
                [value]="credentialsService.hasJiraCredentials() ? 'Connected' : 'Not Connected'"
                [severity]="credentialsService.hasJiraCredentials() ? 'success' : 'danger'"
              />
            </div>
          </ng-template>

          <div class="form-group">
            <label for="jira-domain">Domain</label>
            <div class="domain-input">
              <span class="domain-prefix">https://</span>
              <input 
                pInputText 
                id="jira-domain" 
                [(ngModel)]="jiraForm.domain"
                placeholder="yourcompany"
              />
              <span class="domain-suffix">.atlassian.net</span>
            </div>
          </div>

          <div class="form-group">
            <label for="jira-email">Email</label>
            <input 
              pInputText 
              id="jira-email" 
              [(ngModel)]="jiraForm.email"
              placeholder="your.email@company.com"
              class="w-full"
            />
          </div>

          <div class="form-group">
            <label for="jira-token">API Token</label>
            <p-password 
              id="jira-token" 
              [(ngModel)]="jiraForm.apiToken"
              placeholder="Your JIRA API Token"
              [toggleMask]="true"
              [feedback]="false"
              styleClass="w-full"
            />
            <small class="hint">
              Generate at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank">Atlassian Account</a>
            </small>
          </div>

          <div class="card-actions">
            <p-button 
              label="Test Connection" 
              icon="pi pi-check-circle" 
              [outlined]="true"
              [loading]="testingJira()"
              (onClick)="testJiraConnection()"
            />
            <p-button 
              label="Save" 
              icon="pi pi-save"
              (onClick)="saveJiraCredentials()"
            />
          </div>
        </p-card>
      </div>

      <p-divider />

      <div class="danger-zone">
        <h3>Danger Zone</h3>
        <p>Clear all stored credentials. This action cannot be undone.</p>
        <p-button 
          label="Clear All Credentials" 
          icon="pi pi-trash" 
          severity="danger"
          [outlined]="true"
          (onClick)="clearAllCredentials()"
        />
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      max-width: 1200px;
      margin: 0 auto;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    :host ::ng-deep .settings-card {
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

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 600;
      font-size: 1.1rem;

      i {
        color: var(--primary-color);
        font-size: 1.25rem;
      }
    }

    .form-group {
      margin-bottom: 1.25rem;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-color);
      }

      :host ::ng-deep .p-password {
        width: 100%;
        
        input {
          width: 100%;
        }
      }
    }

    .hint {
      display: block;
      margin-top: 0.375rem;
      color: var(--text-color-secondary);
      font-size: 0.875rem;

      a {
        color: var(--primary-color);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .domain-input {
      display: flex;
      align-items: center;
      background: var(--surface-ground);
      border: 1px solid var(--surface-border);
      border-radius: 6px;
      overflow: hidden;

      .domain-prefix,
      .domain-suffix {
        padding: 0.75rem;
        color: var(--text-color-secondary);
        background: var(--surface-hover);
        font-size: 0.875rem;
      }

      input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 0.75rem;
        color: var(--text-color);
        
        &:focus {
          outline: none;
        }
      }
    }

    .card-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .danger-zone {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;

      h3 {
        color: #ef4444;
        margin-bottom: 0.5rem;
      }

      p {
        color: var(--text-color-secondary);
        margin-bottom: 1rem;
      }
    }

    .w-full {
      width: 100%;
    }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  credentialsService = inject(CredentialsService);
  private bitbucketService = inject(BitbucketService);
  private cursorService = inject(CursorService);
  private jiraService = inject(JiraService);
  private messageService = inject(MessageService);
  private pageHeaderService = inject(PageHeaderService);

  ngOnInit(): void {
    // Set page header info - Settings page doesn't need date picker
    this.pageHeaderService.setPageInfo('Settings', 'pi-cog', false);
  }

  ngOnDestroy(): void {
    // Settings page doesn't use refresh callback
  }

  testingBitbucket = signal(false);
  testingCursor = signal(false);
  testingJira = signal(false);

  bitbucketForm: BitbucketCredentials = {
    serverUrl: 'https://acapgit.acacceptance.com',
    username: '',
    password: ''
  };

  cursorForm: CursorCredentials = {
    apiKey: ''
  };

  jiraForm: JiraCredentials = {
    domain: 'acacceptance',
    email: '',
    apiToken: ''
  };

  constructor() {
    // Load existing credentials
    const bbCreds = this.credentialsService.getBitbucketCredentials();
    if (bbCreds) {
      this.bitbucketForm = { ...bbCreds };
    }

    const cursorCreds = this.credentialsService.getCursorCredentials();
    if (cursorCreds) {
      this.cursorForm = { ...cursorCreds };
    }

    const jiraCreds = this.credentialsService.getJiraCredentials();
    if (jiraCreds) {
      this.jiraForm = { ...jiraCreds };
    }
  }

  saveBitbucketCredentials(): void {
    if (!this.bitbucketForm.serverUrl || !this.bitbucketForm.username || !this.bitbucketForm.password) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all Bitbucket fields'
      });
      return;
    }

    this.credentialsService.setBitbucketCredentials(this.bitbucketForm);
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Bitbucket credentials saved successfully'
    });
  }

  saveCursorCredentials(): void {
    if (!this.cursorForm.apiKey) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please enter your Cursor API key'
      });
      return;
    }

    this.credentialsService.setCursorCredentials(this.cursorForm);
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'Cursor credentials saved successfully'
    });
  }

  saveJiraCredentials(): void {
    if (!this.jiraForm.domain || !this.jiraForm.email || !this.jiraForm.apiToken) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all JIRA fields'
      });
      return;
    }

    this.credentialsService.setJiraCredentials(this.jiraForm);
    this.messageService.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'JIRA credentials saved successfully'
    });
  }

  async testBitbucketConnection(): Promise<void> {
    this.testingBitbucket.set(true);
    this.saveBitbucketCredentials();

    this.bitbucketService.testConnection().subscribe({
      next: (success) => {
        this.testingBitbucket.set(false);
        if (success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Connection Successful',
            detail: 'Successfully connected to Bitbucket Data Center'
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Connection Failed',
            detail: 'Could not connect to Bitbucket. Please check your credentials.'
          });
        }
      },
      error: () => {
        this.testingBitbucket.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Connection Failed',
          detail: 'Could not connect to Bitbucket. Please check your credentials.'
        });
      }
    });
  }

  async testCursorConnection(): Promise<void> {
    this.testingCursor.set(true);
    this.saveCursorCredentials();

    this.cursorService.testConnection().subscribe({
      next: (success) => {
        this.testingCursor.set(false);
        if (success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Connection Successful',
            detail: 'Successfully connected to Cursor Admin API'
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Connection Failed',
            detail: 'Could not connect to Cursor. Please check your API key.'
          });
        }
      },
      error: () => {
        this.testingCursor.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Connection Failed',
          detail: 'Could not connect to Cursor. Please check your API key.'
        });
      }
    });
  }

  async testJiraConnection(): Promise<void> {
    this.testingJira.set(true);
    this.saveJiraCredentials();

    this.jiraService.testConnection().subscribe({
      next: (success) => {
        this.testingJira.set(false);
        if (success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Connection Successful',
            detail: 'Successfully connected to JIRA Cloud'
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Connection Failed',
            detail: 'Could not connect to JIRA. Please check your credentials.'
          });
        }
      },
      error: () => {
        this.testingJira.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Connection Failed',
          detail: 'Could not connect to JIRA. Please check your credentials.'
        });
      }
    });
  }

  clearAllCredentials(): void {
    this.credentialsService.clearAllCredentials();
    this.bitbucketForm = { serverUrl: '', username: '', password: '' };
    this.cursorForm = { apiKey: '' };
    this.jiraForm = { domain: '', email: '', apiToken: '' };
    
    this.messageService.add({
      severity: 'info',
      summary: 'Cleared',
      detail: 'All credentials have been cleared'
    });
  }
}


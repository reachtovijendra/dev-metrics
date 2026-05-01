import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfiguredDeveloper, DeveloperConfig, DeveloperConfigService } from '../../core/services/developer-config.service';
import { PageHeaderService } from '../../core/services/page-header.service';

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    ToastModule
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />

    <div class="admin-page">
      <section class="admin-hero">
        <div>
          <p class="eyebrow">Shared Developer Config</p>
          <h2>Manage Developers</h2>
          <p class="hero-copy">
            Maintain developers, managers, and reporting relationships from the shared developer config. Local development saves
            write directly to <code>developers.config.json</code>; copy or download remains available as a fallback.
          </p>
        </div>

        <div class="hero-actions">
          <p-button
            label="Reset changes"
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            [disabled]="changedCount() === 0"
            (onClick)="resetChanges()"
          />
          <p-button
            label="Copy JSON"
            icon="pi pi-copy"
            severity="secondary"
            [outlined]="true"
            [disabled]="!canExport()"
            (onClick)="copyUpdatedConfig()"
          />
          <p-button
            label="Download JSON"
            icon="pi pi-download"
            [disabled]="!canExport()"
            (onClick)="downloadUpdatedConfig()"
          />
        </div>
      </section>

      <div class="summary-grid">
        <p-card styleClass="summary-card">
          <span class="summary-label">Developers</span>
          <strong>{{ developers().length }}</strong>
        </p-card>
        <p-card styleClass="summary-card">
          <span class="summary-label">Managers</span>
          <strong>{{ managers().length }}</strong>
        </p-card>
        <p-card styleClass="summary-card">
          <span class="summary-label">Pending Changes</span>
          <strong>{{ changedCount() }}</strong>
        </p-card>
        <p-card styleClass="summary-card">
          <span class="summary-label">Validation</span>
          <strong [class.warning-text]="validationErrors().length > 0">
            {{ validationErrors().length === 0 ? 'Ready' : validationErrors().length + ' issue(s)' }}
          </strong>
        </p-card>
      </div>

      @if (savingConfig()) {
        <div class="pending-export-banner saving-banner">
          <i class="pi pi-spin pi-spinner"></i>
          <div>
            <strong>Saving roster changes to developers.config.json...</strong>
            <p>The local config writer is updating the shared project config file.</p>
          </div>
        </div>
      } @else if (changedCount() > 0) {
        <div class="pending-export-banner">
          <i class="pi pi-exclamation-circle"></i>
          <div>
            <strong>{{ changedCount() }} pending change(s) are not saved to the project file yet.</strong>
            <p>
              Start the app with <code>npm start</code> to enable direct local saves, or copy/download the updated JSON
              and replace the shared config file manually.
            </p>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="loading-state">
          <p-progressSpinner strokeWidth="4" />
          <p>Loading developer configuration...</p>
        </div>
      } @else if (loadError()) {
        <div class="error-state">
          <i class="pi pi-exclamation-triangle"></i>
          <h3>Unable to load developer configuration</h3>
          <p>{{ loadError() }}</p>
          <p-button label="Try again" icon="pi pi-refresh" (onClick)="loadConfig()" />
        </div>
      } @else {
        <div class="admin-grid">
          <p-card styleClass="manager-card">
            <ng-template pTemplate="header">
              <div class="card-header">
                <div>
                  <h3>Manager List</h3>
                  <p>Shared manager list. Assigned managers cannot be removed until developers are reassigned.</p>
                </div>
              </div>
            </ng-template>

            <div class="add-manager">
              <input
                pInputText
                type="text"
                placeholder="Add manager name"
                [value]="newManagerName()"
                (input)="newManagerName.set($any($event.target).value)"
                (keyup.enter)="addManager()"
              />
              <p-button label="Add" icon="pi pi-plus" (onClick)="addManager()" />
            </div>

            <div class="manager-tags">
              @for (manager of managers(); track manager) {
                <span class="manager-chip">
                  <span>{{ manager }}</span>
                  <button
                    type="button"
                    class="chip-remove"
                    [disabled]="isManagerAssigned(manager)"
                    [attr.aria-label]="'Remove manager ' + manager"
                    [title]="isManagerAssigned(manager) ? 'Reassign developers before removing this manager' : 'Remove manager'"
                    (click)="removeManager(manager)"
                  >
                    <i class="pi pi-times"></i>
                  </button>
                </span>
              }
            </div>
          </p-card>

          <p-card styleClass="validation-card">
            <ng-template pTemplate="header">
              <div class="card-header">
                <div>
                  <h3>Export Readiness</h3>
                  <p>Every developer must have a manager before export.</p>
                </div>
              </div>
            </ng-template>

            @if (validationErrors().length === 0) {
              <div class="ready-state">
                <i class="pi pi-check-circle"></i>
                <span>Configuration is valid and ready to export.</span>
              </div>
            } @else {
              <ul class="validation-list">
                @for (error of validationErrors(); track error) {
                  <li>{{ error }}</li>
                }
              </ul>
            }
          </p-card>
        </div>

        <p-card styleClass="add-developer-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <div>
                <h3>Add Developer</h3>
                <p>Add a developer to the shared roster before exporting the updated config.</p>
              </div>
            </div>
          </ng-template>

          <div class="developer-form-grid">
            <label class="form-field">
              <span>Name</span>
              <input
                pInputText
                type="text"
                placeholder="Full name"
                [value]="newDeveloper().name"
                (input)="updateNewDeveloperField('name', $any($event.target).value)"
              />
            </label>
            <label class="form-field">
              <span>Username</span>
              <input
                pInputText
                type="text"
                placeholder="Enterprise username"
                [value]="newDeveloper().username"
                (input)="updateNewDeveloperField('username', $any($event.target).value)"
              />
            </label>
            <label class="form-field">
              <span>GitHub Username</span>
              <input
                pInputText
                type="text"
                placeholder="Optional GitHub username"
                [value]="newDeveloper().githubUsername || ''"
                (input)="updateNewDeveloperField('githubUsername', $any($event.target).value)"
              />
            </label>
            <label class="form-field">
              <span>Email</span>
              <input
                pInputText
                type="email"
                placeholder="developer@example.com"
                [value]="newDeveloper().email"
                (input)="updateNewDeveloperField('email', $any($event.target).value)"
              />
            </label>
            <label class="form-field">
              <span>Manager</span>
              <select
                class="manager-select"
                [value]="newDeveloper().manager || ''"
                (change)="updateNewDeveloperField('manager', $any($event.target).value)"
              >
                <option value="">Select manager</option>
                @for (manager of managers(); track manager) {
                  <option [value]="manager">{{ manager }}</option>
                }
              </select>
            </label>
            <label class="form-field">
              <span>Department</span>
              <input
                pInputText
                type="text"
                placeholder="Department"
                [value]="newDeveloper().department || ''"
                (input)="updateNewDeveloperField('department', $any($event.target).value)"
              />
            </label>
            <label class="form-field">
              <span>Innovation Team</span>
              <input
                pInputText
                type="text"
                placeholder="Innovation team"
                [value]="newDeveloper().innovationTeam || ''"
                (input)="updateNewDeveloperField('innovationTeam', $any($event.target).value)"
              />
            </label>
            <div class="form-actions">
              <p-button label="Add Developer" icon="pi pi-user-plus" (onClick)="addDeveloper()" />
            </div>
          </div>
        </p-card>

        <p-card styleClass="mapping-card">
          <ng-template pTemplate="header">
            <div class="table-header">
              <div>
                <h3>Developer Roster</h3>
                <p>Edit manager assignments or remove developers from the export config.</p>
              </div>
              <span class="p-input-icon-left search-box">
                <i class="pi pi-search"></i>
                <input
                  pInputText
                  type="search"
                  placeholder="Search developers, usernames, managers"
                  [value]="searchTerm()"
                  (input)="searchTerm.set($any($event.target).value)"
                />
              </span>
            </div>
          </ng-template>

          <p-table
            [value]="filteredDevelopers()"
            [paginator]="true"
            [rows]="15"
            [rowsPerPageOptions]="[10, 15, 25, 50]"
            [sortField]="'name'"
            [sortOrder]="1"
            styleClass="p-datatable-sm mapping-table"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name">Developer <p-sortIcon field="name" /></th>
                <th pSortableColumn="username">Username <p-sortIcon field="username" /></th>
                <th pSortableColumn="githubUsername">GitHub Username <p-sortIcon field="githubUsername" /></th>
                <th pSortableColumn="manager">Current Manager <p-sortIcon field="manager" /></th>
                <th>Editable Manager</th>
                <th>Actions</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-developer>
              <tr [class.changed-row]="isChanged(developer.username)">
                <td>
                  <div class="developer-cell">
                    <div class="avatar">{{ getInitials(developer.name) }}</div>
                    <span>{{ developer.name }}</span>
                  </div>
                </td>
                <td>{{ developer.username }}</td>
                <td>{{ developer.githubUsername || 'Not mapped' }}</td>
                <td>{{ getOriginalManager(developer.username) }}</td>
                <td>
                  <select
                    class="manager-select"
                    [value]="developer.manager || ''"
                    (change)="updateManager(developer.username, $any($event.target).value)"
                    [attr.aria-label]="'Manager for ' + developer.name"
                  >
                    <option value="">Select manager</option>
                    @for (manager of managers(); track manager) {
                      <option [value]="manager">{{ manager }}</option>
                    }
                  </select>
                </td>
                <td>
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    [outlined]="true"
                    [rounded]="true"
                    [attr.aria-label]="'Remove developer ' + developer.name"
                    (onClick)="removeDeveloper(developer.username)"
                  />
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="empty-message">
                  No developer mappings match the current search.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
  styles: [`
    .admin-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .admin-hero {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.5rem;
      border: 1px solid var(--surface-border);
      border-radius: 20px;
      background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 34%),
        linear-gradient(135deg, var(--surface-card) 0%, var(--surface-ground) 58%, rgba(14, 165, 233, 0.08) 100%);
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
    }

    .eyebrow {
      margin: 0 0 0.35rem;
      color: #38bdf8;
      font-size: 0.78rem;
      font-weight: 700;
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
      font-size: 1.85rem;
      font-weight: 800;
    }

    h3 {
      color: var(--text-color);
      font-size: 1rem;
      font-weight: 800;
    }

    .hero-copy,
    .card-header p,
    .table-header p {
      margin-top: 0.35rem;
      color: var(--text-color-secondary);
      line-height: 1.5;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }

    .summary-card :host ::ng-deep .p-card-body {
      padding: 1rem;
    }

    .summary-label {
      display: block;
      color: var(--text-color-secondary);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .summary-card strong {
      display: block;
      margin-top: 0.35rem;
      color: var(--text-color);
      font-size: 1.5rem;
    }

    .warning-text {
      color: #f59e0b;
    }

    .pending-export-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.8rem;
      padding: 1rem 1.1rem;
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 16px;
      background: rgba(245, 158, 11, 0.12);
      color: var(--text-color);
    }

    .pending-export-banner i {
      margin-top: 0.15rem;
      color: #f59e0b;
      font-size: 1.15rem;
    }

    .pending-export-banner p {
      margin-top: 0.25rem;
      color: var(--text-color-secondary);
      line-height: 1.45;
    }

    .pending-export-banner code {
      color: var(--text-color);
      font-weight: 700;
    }

    .saving-banner {
      border-color: rgba(14, 165, 233, 0.35);
      background: rgba(14, 165, 233, 0.12);
    }

    .saving-banner i {
      color: #38bdf8;
    }

    .admin-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.6fr);
      gap: 1rem;
    }

    .card-header,
    .table-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1rem 0;
    }

    .add-manager {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .add-manager input,
    .form-field input,
    .search-box input {
      width: 100%;
    }

    .manager-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .manager-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.45rem 0.35rem 0.7rem;
      border: 1px solid rgba(14, 165, 233, 0.32);
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.12);
      color: var(--text-color);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .chip-remove {
      display: inline-grid;
      width: 1.45rem;
      height: 1.45rem;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.16);
      color: var(--text-color);
      cursor: pointer;
    }

    .chip-remove:disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }

    .developer-form-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      color: var(--text-color-secondary);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .form-actions {
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
    }

    .ready-state,
    .error-state,
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-height: 9rem;
      color: var(--text-color-secondary);
      text-align: center;
    }

    .ready-state {
      min-height: 4rem;
      justify-content: flex-start;
      color: #22c55e;
      font-weight: 700;
    }

    .ready-state i,
    .error-state i {
      font-size: 1.5rem;
    }

    .error-state {
      flex-direction: column;
      padding: 2rem;
      border-radius: 18px;
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
    }

    .validation-list {
      margin: 0;
      padding-left: 1.2rem;
      color: #f59e0b;
    }

    .search-box {
      min-width: min(100%, 24rem);
    }

    .developer-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      color: var(--text-color);
    }

    .avatar {
      display: grid;
      width: 2.2rem;
      height: 2.2rem;
      place-items: center;
      border-radius: 50%;
      background: linear-gradient(135deg, #0ea5e9, #1d4ed8);
      color: #ffffff;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .manager-select {
      width: 100%;
      min-width: 14rem;
      padding: 0.55rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: var(--surface-ground);
      color: var(--text-color);
      font: inherit;
    }

    .manager-select:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.14);
      outline: none;
    }

    .changed-row {
      background: rgba(245, 158, 11, 0.10);
    }

    .empty-message {
      padding: 2rem;
      color: var(--text-color-secondary);
      text-align: center;
    }

    @media (max-width: 1100px) {
      .admin-hero,
      .table-header {
        flex-direction: column;
      }

      .hero-actions {
        justify-content: flex-start;
      }

      .summary-grid,
      .admin-grid,
      .developer-form-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AdminComponent implements OnInit, OnDestroy {
  private configService = inject(DeveloperConfigService);
  private pageHeader = inject(PageHeaderService);
  private messageService = inject(MessageService);

  originalConfig = signal<DeveloperConfig | null>(null);
  workingConfig = signal<DeveloperConfig | null>(null);
  managers = signal<string[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  savingConfig = signal(false);
  newManagerName = signal('');
  searchTerm = signal('');
  newDeveloper = signal<ConfiguredDeveloper>({
    name: '',
    username: '',
    githubUsername: '',
    email: '',
    manager: '',
    department: '',
    innovationTeam: ''
  });

  developers = computed(() => this.workingConfig()?.developers ?? []);
  filteredDevelopers = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const developers = this.developers();

    if (!search) {
      return developers;
    }

    return developers.filter(developer => [
      developer.name,
      developer.username,
      developer.githubUsername ?? '',
      developer.email,
      developer.manager ?? ''
    ].some(value => value.toLowerCase().includes(search)));
  });
  changedUsernames = computed(() => {
    const original = this.originalConfig();
    const working = this.workingConfig();
    const changed = new Set<string>();

    if (!original || !working) {
      return changed;
    }

    const originalManagers = new Map(
      original.developers.map(developer => [developer.username, developer.manager?.trim() ?? ''])
    );

    for (const developer of working.developers) {
      if ((developer.manager?.trim() ?? '') !== (originalManagers.get(developer.username) ?? '')) {
        changed.add(developer.username);
      }
    }

    return changed;
  });
  changedCount = computed(() => {
    const original = this.originalConfig();
    const working = this.workingConfig();

    if (!original || !working) {
      return 0;
    }

    const originalByUsername = new Map(
      original.developers.map(developer => [developer.username.toLowerCase(), developer])
    );
    const workingByUsername = new Map(
      working.developers.map(developer => [developer.username.toLowerCase(), developer])
    );
    let count = 0;

    for (const developer of working.developers) {
      const originalDeveloper = originalByUsername.get(developer.username.toLowerCase());

      if (!originalDeveloper) {
        count++;
        continue;
      }

      if ((developer.manager?.trim() ?? '') !== (originalDeveloper.manager?.trim() ?? '')) {
        count++;
      }
    }

    for (const developer of original.developers) {
      if (!workingByUsername.has(developer.username.toLowerCase())) {
        count++;
      }
    }

    if (this.getManagerKey(original.managers ?? []) !== this.getManagerKey(working.managers ?? [])) {
      count++;
    }

    return count;
  });
  validationErrors = computed(() => {
    const config = this.workingConfig();
    return config ? this.configService.validateConfig(config) : [];
  });
  canExport = computed(() => !!this.workingConfig() && this.validationErrors().length === 0);

  ngOnInit(): void {
    this.pageHeader.setPageInfo('Manage Developers', 'pi-shield', false);
    this.pageHeader.registerRefreshCallback(() => this.loadConfig());
    this.loadConfig();
  }

  ngOnDestroy(): void {
    this.pageHeader.unregisterRefreshCallback();
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeRefresh(event: BeforeUnloadEvent): void {
    if (this.changedCount() === 0) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  }

  loadConfig(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.configService.loadConfig().subscribe({
      next: config => {
        const original = this.configService.cloneConfig(config);
        this.originalConfig.set(original);
        this.workingConfig.set(this.configService.cloneConfig(config));
        this.managers.set(this.configService.getManagers(config));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Check that src/assets/developers.config.json is available and valid JSON.');
        this.loading.set(false);
      }
    });
  }

  addManager(): void {
    const manager = this.newManagerName().trim();
    const config = this.workingConfig();
    if (!manager || !config) {
      return;
    }

    const updatedConfig = this.configService.addManager(config, manager);
    const nextManagers = this.configService.getManagers(updatedConfig);
    const alreadyExists = nextManagers.length === this.managers().length;

    this.newManagerName.set('');

    if (alreadyExists) {
      this.messageService.add({
        severity: 'info',
        summary: 'Manager already exists',
        detail: `${manager} is already in the list.`
      });
      return;
    }

    this.applyConfigChange(updatedConfig, 'Manager added', `${manager} was saved to developers.config.json.`);
  }

  removeManager(manager: string): void {
    const config = this.workingConfig();
    if (!config) {
      return;
    }

    if (this.isManagerAssigned(manager)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Manager is assigned',
        detail: 'Reassign developers before removing this manager.'
      });
      return;
    }

    const updatedConfig = this.configService.removeManager(config, manager);
    this.applyConfigChange(updatedConfig, 'Manager removed', `${manager} was removed from developers.config.json.`);
  }

  updateNewDeveloperField(field: keyof ConfiguredDeveloper, value: string): void {
    this.newDeveloper.update(developer => ({
      ...developer,
      [field]: value
    }));
  }

  addDeveloper(): void {
    const config = this.workingConfig();
    const developer = this.newDeveloper();

    if (!config) {
      return;
    }

    const requiredFields: Array<keyof ConfiguredDeveloper> = ['name', 'username', 'email', 'manager'];
    const missingFields = requiredFields.filter(field => !developer[field]?.trim());

    if (missingFields.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Developer not added',
        detail: `Complete required fields: ${missingFields.join(', ')}.`
      });
      return;
    }

    const usernameKey = developer.username.trim().toLowerCase();
    const duplicate = config.developers.some(existingDeveloper => (
      existingDeveloper.username.trim().toLowerCase() === usernameKey
    ));

    if (duplicate) {
      this.messageService.add({
        severity: 'error',
        summary: 'Developer not added',
        detail: `${developer.username.trim()} already exists in the roster.`
      });
      return;
    }

    const updatedConfig = this.configService.addDeveloper(config, developer);
    this.newDeveloper.set({
      name: '',
      username: '',
      githubUsername: '',
      email: '',
      manager: '',
      department: '',
      innovationTeam: ''
    });
    this.applyConfigChange(updatedConfig, 'Developer added', `${developer.name.trim()} was saved to developers.config.json.`);
  }

  updateManager(username: string, manager: string): void {
    const config = this.workingConfig();
    if (!config) {
      return;
    }

    const updatedConfig = this.configService.updateDeveloperManager(config, username, manager);
    this.applyConfigChange(updatedConfig, 'Manager updated', 'Developer manager assignment was saved to developers.config.json.');
  }

  removeDeveloper(username: string): void {
    const config = this.workingConfig();
    const developer = config?.developers.find(dev => dev.username === username);

    if (!config || !developer) {
      return;
    }

    if (!window.confirm(`Remove ${developer.name} from developers.config.json?`)) {
      return;
    }

    const updatedConfig = this.configService.removeDeveloper(config, username);
    this.applyConfigChange(updatedConfig, 'Developer removed', `${developer.name} was removed from developers.config.json.`);
  }

  resetChanges(): void {
    const original = this.originalConfig();
    if (!original) {
      return;
    }

    this.workingConfig.set(this.configService.cloneConfig(original));
    this.managers.set(this.configService.getManagers(original));
    this.messageService.add({
      severity: 'info',
      summary: 'Changes reset',
      detail: 'Developer manager mappings were reset to the loaded config.'
    });
  }

  async copyUpdatedConfig(): Promise<void> {
    const json = this.getExportJson();
    if (!json) {
      return;
    }

    try {
      await navigator.clipboard.writeText(json);
      this.messageService.add({
        severity: 'success',
        summary: 'Copied',
        detail: 'Updated developers.config.json copied to clipboard.'
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Copy failed',
        detail: 'Use Download JSON or copy from browser permissions-enabled context.'
      });
    }
  }

  downloadUpdatedConfig(): void {
    const json = this.getExportJson();
    if (!json) {
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'developers.config.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  private applyConfigChange(config: DeveloperConfig, successSummary: string, successDetail: string): void {
    this.workingConfig.set(config);
    this.managers.set(this.configService.getManagers(config));
    this.savingConfig.set(true);

    this.configService.saveConfig(config).subscribe({
      next: savedConfig => {
        const savedOriginal = this.configService.cloneConfig(savedConfig);
        this.originalConfig.set(savedOriginal);
        this.workingConfig.set(this.configService.cloneConfig(savedConfig));
        this.managers.set(this.configService.getManagers(savedConfig));
        this.savingConfig.set(false);
        this.messageService.add({
          severity: 'success',
          summary: successSummary,
          detail: successDetail
        });
      },
      error: () => {
        this.savingConfig.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Change pending export',
          detail: 'The local config writer is not available. Start the app with npm start or export the JSON manually.'
        });
      }
    });
  }

  isChanged(username: string): boolean {
    return this.changedUsernames().has(username);
  }

  isManagerAssigned(manager: string): boolean {
    const managerKey = manager.trim().toLowerCase();
    return this.developers().some(developer => developer.manager?.trim().toLowerCase() === managerKey);
  }

  getOriginalManager(username: string): string {
    const original = this.originalConfig();
    const developer = original?.developers.find(dev => dev.username === username);
    return developer?.manager?.trim() || 'New developer';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private getExportJson(): string | null {
    const config = this.workingConfig();
    if (!config) {
      return null;
    }

    const errors = this.configService.validateConfig(config);
    if (errors.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Export blocked',
        detail: 'Resolve missing manager assignments before exporting.'
      });
      return null;
    }

    return this.configService.serializeConfig(config);
  }

  private getManagerKey(managers: string[]): string {
    return this.configService.normalizeManagers(managers)
      .map(manager => manager.toLowerCase())
      .join('|');
  }
}

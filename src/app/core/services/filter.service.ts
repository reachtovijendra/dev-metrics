import { Injectable, signal, computed } from '@angular/core';
import { BitbucketService, ConfiguredDeveloper } from './bitbucket.service';

const STORAGE_KEY = 'dev_metrics_filters';

export interface FilterState {
  selectedManagers: string[];
  selectedDepartments: string[];
  selectedInnovationTeams: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {
  // Filter options (populated from config)
  managerOptions = signal<{ label: string; value: string }[]>([]);
  departmentOptions = signal<{ label: string; value: string }[]>([]);
  innovationTeamOptions = signal<{ label: string; value: string }[]>([]);

  // Selected filter values
  selectedManagers = signal<string[]>([]);
  selectedDepartments = signal<string[]>([]);
  selectedInnovationTeams = signal<string[]>([]);

  // All configured developers (for filtering)
  private configuredDevelopers = signal<ConfiguredDeveloper[]>([]);

  // Computed: check if any filters are active
  hasActiveFilters = computed(() => 
    (this.selectedManagers()?.length ?? 0) > 0 ||
    (this.selectedDepartments()?.length ?? 0) > 0 ||
    (this.selectedInnovationTeams()?.length ?? 0) > 0
  );

  constructor(private bitbucketService: BitbucketService) {
    this.loadFromStorage();
    this.loadFilterOptions();
  }

  private loadFilterOptions(): void {
    this.bitbucketService.getConfiguredDevelopers().subscribe({
      next: (config) => {
        this.configuredDevelopers.set(config.developers);
        this.buildFilterOptions(config.developers);
      },
      error: (err) => console.error('Error loading developers config for filters:', err)
    });
  }

  private buildFilterOptions(developers: ConfiguredDeveloper[]): void {
    const managers = new Set<string>();
    const departments = new Set<string>();
    const innovationTeams = new Set<string>();

    for (const dev of developers) {
      if (dev.manager) managers.add(dev.manager);
      if (dev.department) departments.add(dev.department);
      if (dev.innovationTeam) innovationTeams.add(dev.innovationTeam);
    }

    this.managerOptions.set(Array.from(managers).sort().map(m => ({ label: m, value: m })));
    this.departmentOptions.set(Array.from(departments).sort().map(d => ({ label: d, value: d })));
    this.innovationTeamOptions.set(Array.from(innovationTeams).sort().map(t => ({ label: t, value: t })));
  }

  // Filter a list of items by the current filter selections
  filterByManager<T extends { manager?: string }>(items: T[]): T[] {
    const managers = this.selectedManagers() ?? [];
    if (managers.length === 0) return items;
    return items.filter(item => item.manager && managers.includes(item.manager));
  }

  filterByDepartment<T extends { department?: string }>(items: T[]): T[] {
    const departments = this.selectedDepartments() ?? [];
    if (departments.length === 0) return items;
    return items.filter(item => item.department && departments.includes(item.department));
  }

  filterByInnovationTeam<T extends { innovationTeam?: string }>(items: T[]): T[] {
    const teams = this.selectedInnovationTeams() ?? [];
    if (teams.length === 0) return items;
    return items.filter(item => item.innovationTeam && teams.includes(item.innovationTeam));
  }

  // Apply all filters to a list of items
  applyAllFilters<T extends { manager?: string; department?: string; innovationTeam?: string }>(items: T[]): T[] {
    let filtered = items;
    filtered = this.filterByManager(filtered);
    filtered = this.filterByDepartment(filtered);
    filtered = this.filterByInnovationTeam(filtered);
    return filtered;
  }

  // Update filter selections (PrimeNG MultiSelect can pass null when clearing)
  setManagers(managers: string[] | null): void {
    this.selectedManagers.set(managers ?? []);
    this.saveToStorage();
  }

  setDepartments(departments: string[] | null): void {
    this.selectedDepartments.set(departments ?? []);
    this.saveToStorage();
  }

  setInnovationTeams(teams: string[] | null): void {
    this.selectedInnovationTeams.set(teams ?? []);
    this.saveToStorage();
  }

  clearFilters(): void {
    this.selectedManagers.set([]);
    this.selectedDepartments.set([]);
    this.selectedInnovationTeams.set([]);
    this.saveToStorage();
  }

  // Persistence
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: FilterState = JSON.parse(stored);
        this.selectedManagers.set(state.selectedManagers || []);
        this.selectedDepartments.set(state.selectedDepartments || []);
        this.selectedInnovationTeams.set(state.selectedInnovationTeams || []);
      }
    } catch (e) {
      console.error('Failed to load filter state from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const state: FilterState = {
        selectedManagers: this.selectedManagers(),
        selectedDepartments: this.selectedDepartments(),
        selectedInnovationTeams: this.selectedInnovationTeams()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save filter state to storage:', e);
    }
  }
}




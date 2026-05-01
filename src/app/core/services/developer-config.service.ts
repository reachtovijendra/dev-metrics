import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const LOCAL_CONFIG_API_URL = 'http://localhost:4311/developer-config-api/developers.config.json';

export interface ConfiguredDeveloper {
  name: string;
  username: string;
  githubUsername?: string;
  email: string;
  manager?: string;
  department?: string;
  innovationTeam?: string;
}

export interface DeveloperConfig {
  projectKey: string;
  managers?: string[];
  developers: ConfiguredDeveloper[];
}

@Injectable({
  providedIn: 'root'
})
export class DeveloperConfigService {
  private http = inject(HttpClient);

  loadConfig(): Observable<DeveloperConfig> {
    return this.http.get<DeveloperConfig>('/assets/developers.config.json');
  }

  saveConfig(config: DeveloperConfig): Observable<DeveloperConfig> {
    return this.http.put<DeveloperConfig>(LOCAL_CONFIG_API_URL, config);
  }

  cloneConfig(config: DeveloperConfig): DeveloperConfig {
    return JSON.parse(JSON.stringify(config)) as DeveloperConfig;
  }

  getManagers(config: DeveloperConfig): string[] {
    return this.normalizeManagers([
      ...config.developers.map(developer => developer.manager ?? ''),
      ...(config.managers ?? [])
    ]);
  }

  normalizeManagers(managers: string[]): string[] {
    const managerByKey = new Map<string, string>();

    for (const managerName of managers) {
      const manager = managerName.trim();
      if (!manager) {
        continue;
      }
      const key = manager.toLowerCase();
      if (!managerByKey.has(key)) {
        managerByKey.set(key, manager);
      }
    }

    return Array.from(managerByKey.values()).sort((a, b) => a.localeCompare(b));
  }

  updateDeveloperManager(config: DeveloperConfig, username: string, manager: string): DeveloperConfig {
    const nextConfig = this.cloneConfig(config);
    const developer = nextConfig.developers.find(dev => dev.username === username);

    if (!developer) {
      return nextConfig;
    }

    developer.manager = manager.trim();
    nextConfig.managers = this.normalizeManagers([...(nextConfig.managers ?? []), developer.manager]);
    return nextConfig;
  }

  addManager(config: DeveloperConfig, manager: string): DeveloperConfig {
    const nextConfig = this.cloneConfig(config);
    nextConfig.managers = this.normalizeManagers([...(nextConfig.managers ?? []), manager]);
    return nextConfig;
  }

  removeManager(config: DeveloperConfig, manager: string): DeveloperConfig {
    const nextConfig = this.cloneConfig(config);
    const managerKey = manager.trim().toLowerCase();

    const isAssigned = nextConfig.developers.some(
      developer => developer.manager?.trim().toLowerCase() === managerKey
    );

    if (isAssigned) {
      return nextConfig;
    }

    nextConfig.managers = this.normalizeManagers(
      (nextConfig.managers ?? []).filter(existingManager => existingManager.trim().toLowerCase() !== managerKey)
    );
    return nextConfig;
  }

  addDeveloper(config: DeveloperConfig, developer: ConfiguredDeveloper): DeveloperConfig {
    const nextConfig = this.cloneConfig(config);
    const nextDeveloper: ConfiguredDeveloper = {
      name: developer.name.trim(),
      username: developer.username.trim(),
      email: developer.email.trim(),
      manager: developer.manager?.trim() ?? '',
      department: developer.department?.trim() ?? '',
      innovationTeam: developer.innovationTeam?.trim() ?? ''
    };

    const githubUsername = developer.githubUsername?.trim();
    if (githubUsername) {
      nextDeveloper.githubUsername = githubUsername;
    }

    nextConfig.developers = [...nextConfig.developers, nextDeveloper];
    nextConfig.managers = this.normalizeManagers([...(nextConfig.managers ?? []), nextDeveloper.manager ?? '']);
    return nextConfig;
  }

  removeDeveloper(config: DeveloperConfig, username: string): DeveloperConfig {
    const nextConfig = this.cloneConfig(config);
    const usernameKey = username.trim().toLowerCase();
    nextConfig.developers = nextConfig.developers.filter(
      developer => developer.username.trim().toLowerCase() !== usernameKey
    );
    return nextConfig;
  }

  validateConfig(config: DeveloperConfig): string[] {
    const errors: string[] = [];
    const usernames = new Set<string>();

    for (const developer of config.developers) {
      const displayName = developer.username?.trim() || developer.name?.trim() || 'Developer';

      if (!developer.name?.trim()) {
        errors.push(`${displayName} is missing a name`);
      }

      if (!developer.username?.trim()) {
        errors.push(`${displayName} is missing a username`);
      }

      if (!developer.email?.trim()) {
        errors.push(`${displayName} is missing an email`);
      }

      if (!developer.manager?.trim()) {
        errors.push(`${displayName} is missing a manager`);
      }

      const usernameKey = developer.username?.trim().toLowerCase();
      if (!usernameKey) {
        continue;
      }

      if (usernames.has(usernameKey)) {
        errors.push(`Duplicate username: ${developer.username}`);
      } else {
        usernames.add(usernameKey);
      }
    }

    return errors;
  }

  serializeConfig(config: DeveloperConfig): string {
    return `${JSON.stringify(config, null, 2)}\n`;
  }
}

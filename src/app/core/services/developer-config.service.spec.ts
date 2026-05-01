import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeveloperConfig, DeveloperConfigService } from './developer-config.service';

describe('DeveloperConfigService', () => {
  let service: DeveloperConfigService;
  let httpMock: HttpTestingController;

  const config: DeveloperConfig = {
    projectKey: 'SER',
    managers: ['Grace Hopper', 'Katherine Johnson'],
    developers: [
      {
        name: 'Ada Lovelace',
        username: 'Ada.Lovelace',
        githubUsername: 'Ada-Lovelace_acaccept',
        email: 'ada@example.com',
        manager: 'Grace Hopper',
        department: 'Engineering',
        innovationTeam: 'Platform'
      },
      {
        name: 'Linus Torvalds',
        username: 'Linus.Torvalds',
        githubUsername: 'Linus-Torvalds_acaccept',
        email: 'linus@example.com',
        manager: 'grace hopper',
        department: 'Engineering',
        innovationTeam: 'Kernel'
      },
      {
        name: 'Margaret Hamilton',
        username: 'Margaret.Hamilton',
        githubUsername: 'Margaret-Hamilton_acaccept',
        email: 'margaret@example.com',
        manager: 'Katherine Johnson',
        department: 'Engineering',
        innovationTeam: 'Apollo'
      }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DeveloperConfigService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(DeveloperConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads unique manager names case-insensitively', () => {
    const configWithDuplicateManagers: DeveloperConfig = {
      ...config,
      managers: ['Katherine Johnson', 'grace hopper']
    };

    expect(service.getManagers(configWithDuplicateManagers)).toEqual(['Grace Hopper', 'Katherine Johnson']);
  });

  it('updates one developer manager without mutating the original config', () => {
    const updated = service.updateDeveloperManager(config, 'Ada.Lovelace', 'Katherine Johnson');

    expect(updated.developers[0].manager).toBe('Katherine Johnson');
    expect(config.developers[0].manager).toBe('Grace Hopper');
    expect(updated.developers[0].email).toBe('ada@example.com');
  });

  it('adds a new manager to the shared manager list', () => {
    const updated = service.addManager(config, 'Dorothy Vaughan');

    expect(updated.managers).toEqual(['Dorothy Vaughan', 'Grace Hopper', 'Katherine Johnson']);
    expect(config.managers).toEqual(['Grace Hopper', 'Katherine Johnson']);
  });

  it('removes an unassigned manager from the shared manager list', () => {
    const configWithUnassignedManager: DeveloperConfig = {
      ...config,
      managers: ['Grace Hopper', 'Katherine Johnson', 'Dorothy Vaughan']
    };
    const updated = service.removeManager(configWithUnassignedManager, 'Dorothy Vaughan');

    expect(updated.managers).toEqual(['Grace Hopper', 'Katherine Johnson']);
    expect(config.managers).toEqual(['Grace Hopper', 'Katherine Johnson']);
  });

  it('keeps a manager when they are assigned to a developer', () => {
    const updated = service.removeManager(config, 'Grace Hopper');

    expect(updated.managers).toEqual(['Grace Hopper', 'Katherine Johnson']);
  });

  it('adds a new developer without mutating the original config', () => {
    const updated = service.addDeveloper(config, {
      name: '  Dorothy Vaughan  ',
      username: 'Dorothy.Vaughan',
      githubUsername: 'Dorothy-Vaughan_acaccept',
      email: 'dorothy@example.com',
      manager: 'Dorothy Vaughan',
      department: 'Engineering',
      innovationTeam: 'Research'
    });

    expect(updated.developers.length).toBe(4);
    expect(updated.developers[3]).toEqual({
      name: 'Dorothy Vaughan',
      username: 'Dorothy.Vaughan',
      githubUsername: 'Dorothy-Vaughan_acaccept',
      email: 'dorothy@example.com',
      manager: 'Dorothy Vaughan',
      department: 'Engineering',
      innovationTeam: 'Research'
    });
    expect(updated.managers).toContain('Dorothy Vaughan');
    expect(config.developers.length).toBe(3);
  });

  it('removes a developer without mutating the original config', () => {
    const updated = service.removeDeveloper(config, 'Linus.Torvalds');

    expect(updated.developers.map(developer => developer.username)).toEqual([
      'Ada.Lovelace',
      'Margaret.Hamilton'
    ]);
    expect(config.developers.length).toBe(3);
  });

  it('keeps assigned managers available for export', () => {
    const updated = service.updateDeveloperManager(config, 'Ada.Lovelace', 'Dorothy Vaughan');

    expect(updated.managers).toContain('Dorothy Vaughan');
  });

  it('serializes valid updated config JSON', () => {
    const updated = service.updateDeveloperManager(config, 'Linus.Torvalds', 'Grace Hopper');
    const serialized = service.serializeConfig(updated);
    const parsed = JSON.parse(serialized) as DeveloperConfig;

    expect(parsed.developers[1].manager).toBe('Grace Hopper');
    expect(serialized.endsWith('\n')).toBeTrue();
  });

  it('saves config through the local developer config API', () => {
    service.saveConfig(config).subscribe(savedConfig => {
      expect(savedConfig).toEqual(config);
    });

    const request = httpMock.expectOne('http://localhost:4311/developer-config-api/developers.config.json');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(config);
    request.flush(config);
  });

  it('validates required developer identity fields and duplicate usernames', () => {
    const invalidConfig: DeveloperConfig = {
      projectKey: 'SER',
      managers: ['Grace Hopper'],
      developers: [
        {
          name: '',
          username: 'Ada.Lovelace',
          email: '',
          manager: ''
        },
        {
          name: 'Duplicate Ada',
          username: 'ada.lovelace',
          email: 'duplicate@example.com',
          manager: 'Grace Hopper'
        }
      ]
    };

    expect(service.validateConfig(invalidConfig)).toEqual([
      'Ada.Lovelace is missing a name',
      'Ada.Lovelace is missing an email',
      'Ada.Lovelace is missing a manager',
      'Duplicate username: ada.lovelace'
    ]);
  });
});

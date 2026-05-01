import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { fakeAsync, tick } from '@angular/core/testing';
import { CursorService } from './cursor.service';

describe('CursorService', () => {
  let service: CursorService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CursorService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CursorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches all usage-event pages sequentially with a delay between requests', fakeAsync(() => {
    const progressMessages: string[] = [];
    const dateRange = {
      startDate: new Date('2026-04-01T00:00:00Z'),
      endDate: new Date('2026-04-29T00:00:00Z')
    };
    let result: { email: string; totalCents: number; eventCount: number }[] | undefined;

    service.getAllUsageEventsSpending(dateRange, (_current, _total, message) => {
      progressMessages.push(message);
    }).subscribe(spending => {
      result = spending;
    });

    const page1 = httpMock.expectOne('/cursor-api/teams/filtered-usage-events');
    expect(page1.request.method).toBe('POST');
    expect(page1.request.body.page).toBe(1);
    page1.flush({
      totalUsageEventsCount: 30000,
      pagination: {
        numPages: 3,
        currentPage: 1,
        pageSize: 500,
        hasNextPage: true,
        hasPreviousPage: false
      },
      usageEvents: [],
      period: {
        startDate: dateRange.startDate.getTime(),
        endDate: dateRange.endDate.getTime()
      }
    });

    httpMock.expectNone(req => (
      req.url === '/cursor-api/teams/filtered-usage-events' && req.body?.page === 2
    ));
    tick(3000);

    const page2 = httpMock.expectOne(req => (
      req.url === '/cursor-api/teams/filtered-usage-events' && req.body?.page === 2
    ));
    page2.flush({
      totalUsageEventsCount: 30000,
      pagination: {
        numPages: 3,
        currentPage: 2,
        pageSize: 500,
        hasNextPage: true,
        hasPreviousPage: true
      },
      usageEvents: [
        {
          userEmail: 'ada@example.com',
          tokenUsage: { totalCents: 12 },
          cursorTokenFee: 3
        }
      ],
      period: {
        startDate: dateRange.startDate.getTime(),
        endDate: dateRange.endDate.getTime()
      }
    });

    httpMock.expectNone(req => (
      req.url === '/cursor-api/teams/filtered-usage-events' && req.body?.page === 3
    ));
    tick(3000);

    const page3 = httpMock.expectOne(req => (
      req.url === '/cursor-api/teams/filtered-usage-events' && req.body?.page === 3
    ));
    page3.flush({
      totalUsageEventsCount: 30000,
      pagination: {
        numPages: 3,
        currentPage: 3,
        pageSize: 500,
        hasNextPage: false,
        hasPreviousPage: true
      },
      usageEvents: [
        {
          userEmail: 'ada@example.com',
          tokenUsage: { totalCents: 5 },
          cursorTokenFee: 0
        }
      ],
      period: {
        startDate: dateRange.startDate.getTime(),
        endDate: dateRange.endDate.getTime()
      }
    });

    expect(result).toEqual([
      { email: 'ada@example.com', totalCents: 20, eventCount: 2 }
    ]);
    expect(progressMessages).toContain('Page 1/3 (~6s)');
    expect(progressMessages).toContain('Complete');
  }));
});

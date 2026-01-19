import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CredentialsService } from '../services/credentials.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const credentialsService = inject(CredentialsService);
  
  let modifiedReq = req;
  
  // Bitbucket Data Center - use HTTP Access Token with Bearer auth
  if (req.url.includes('/rest/api/') || req.url.includes('/rest/search/')) {
    const bitbucketCreds = credentialsService.getBitbucketCredentials();
    if (bitbucketCreds && bitbucketCreds.password) {
      // HTTP Access Tokens use Bearer authentication
      modifiedReq = req.clone({
        setHeaders: { 
          'Authorization': `Bearer ${bitbucketCreds.password}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } else if (req.url.includes('/cursor-api') || req.url.includes('api.cursor.com')) {
    // Cursor Admin API (via proxy or direct)
    const cursorCreds = credentialsService.getCursorCredentials();
    if (cursorCreds && cursorCreds.apiKey) {
      const authHeader = 'Basic ' + btoa(`${cursorCreds.apiKey}:`);
      modifiedReq = req.clone({
        setHeaders: { 
          'Authorization': authHeader,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
    }
  } else if (req.url.includes('/jira-api') || req.url.includes('atlassian.net')) {
    // JIRA Cloud (via proxy or direct)
    const jiraCreds = credentialsService.getJiraCredentials();
    if (jiraCreds && jiraCreds.email && jiraCreds.apiToken) {
      const authHeader = 'Basic ' + btoa(`${jiraCreds.email}:${jiraCreds.apiToken}`);
      modifiedReq = req.clone({
        setHeaders: { 
          'Authorization': authHeader,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
    }
  }
  
  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.error('Authentication failed. Please check your credentials.');
      }
      return throwError(() => error);
    })
  );
};


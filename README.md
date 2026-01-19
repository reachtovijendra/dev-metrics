# Dev Metrics Dashboard

A professional Angular dashboard for tracking developer productivity metrics across Bitbucket Data Center, Cursor AI, and JIRA Cloud.

## Features

- **Bitbucket Data Center Metrics**
  - Pull requests submitted and reviewed
  - Code review comments
  - Lines of code changed
  - PR merge rates

- **Cursor AI Metrics**
  - AI-generated lines of code
  - Tab completion acceptance rates
  - Request usage and spending
  - Active developer days

- **JIRA Cloud Metrics**
  - Tickets completed (Dev/QA)
  - Defect tracking (injected vs fixed)
  - Resolution time analytics
  - Quality scoring

- **UI/UX**
  - Dark mode by default (with light mode toggle)
  - PrimeNG components
  - Responsive design
  - Interactive charts with Chart.js

## Prerequisites

- Node.js 18+ 
- Angular CLI 19
- Access to Bitbucket Data Center, Cursor Admin API, and JIRA Cloud

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Configuration

### API Credentials

Configure your API credentials through the Settings page (`/settings`) in the application:

1. **Bitbucket Data Center**
   - Server URL (e.g., `https://bitbucket.yourcompany.com`)
   - Username
   - Password or Personal Access Token

2. **Cursor Admin API**
   - API Key (from Cursor Team Settings)

3. **JIRA Cloud**
   - Domain (e.g., `yourcompany` for `yourcompany.atlassian.net`)
   - Email
   - API Token (from Atlassian Account)

### Proxy Configuration

For development, update `proxy.conf.json` with your actual server URLs:

```json
{
  "/bitbucket-api": {
    "target": "https://your-actual-bitbucket-server.com",
    "changeOrigin": true
  }
}
```

## Project Structure

```
src/app/
├── core/
│   ├── guards/         # Route guards
│   ├── interceptors/   # HTTP interceptors
│   ├── models/         # TypeScript interfaces
│   └── services/       # API services
├── features/
│   ├── dashboard/      # Overview dashboard
│   ├── bitbucket/      # Bitbucket metrics
│   ├── cursor/         # Cursor AI metrics
│   ├── jira/           # JIRA metrics
│   ├── developers/     # Developer list
│   └── settings/       # API configuration
├── layout/
│   ├── header/         # App header
│   ├── sidebar/        # Navigation sidebar
│   └── main-layout/    # Layout wrapper
└── shared/
    └── components/     # Reusable components
```

## API Endpoints Used

### Bitbucket Data Center
- `GET /rest/api/latest/projects` - List projects
- `GET /rest/api/latest/projects/{key}/repos` - List repositories
- `GET /rest/api/latest/projects/{key}/repos/{slug}/pull-requests` - List PRs
- `GET /rest/api/latest/projects/{key}/repos/{slug}/pull-requests/{id}/activities` - PR activities

### Cursor Admin API
- `GET /teams/members` - Team members
- `POST /teams/daily-usage-data` - Usage metrics

### JIRA Cloud
- `GET /rest/api/3/search` - Search issues with JQL
- `GET /rest/api/3/myself` - Current user

## Security Notes

- API credentials are stored in browser localStorage
- Credentials are cleared on logout or manual clear
- Use HTTPS for all API communications
- Consider using a backend proxy for production deployments

## License

Proprietary - ACA Internal Use Only

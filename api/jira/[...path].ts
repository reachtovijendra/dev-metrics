import type { VercelRequest, VercelResponse } from '@vercel/node';

const JIRA_API_BASE = 'https://acacceptance.atlassian.net/rest/api/3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  
  if (!email || !apiToken) {
    return res.status(500).json({ error: 'JIRA credentials not configured' });
  }

  // Get the path after /api/jira/
  const pathSegments = req.query.path;
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';
  
  // Build query string from remaining query params (exclude 'path')
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path') {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v));
      } else if (value) {
        queryParams.append(key, value);
      }
    }
  }
  
  const queryString = queryParams.toString();
  const targetUrl = `${JIRA_API_BASE}/${path}${queryString ? '?' + queryString : ''}`;
  
  try {
    // JIRA Cloud uses Basic Auth with email:apiToken
    const authHeader = 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
    
    const headers: HeadersInit = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const fetchOptions: RequestInit = {
      method: req.method,
      headers
    };

    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('JIRA API proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to JIRA API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


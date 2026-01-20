import type { VercelRequest, VercelResponse } from '@vercel/node';

// Bitbucket Data Center server URL
const BITBUCKET_SERVER = process.env.BITBUCKET_SERVER_URL || 'https://acapgit.acacceptance.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.BITBUCKET_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: 'Bitbucket token not configured' });
  }

  // Get the path after /api/bitbucket/
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
  const targetUrl = `${BITBUCKET_SERVER}/rest/api/latest/${path}${queryString ? '?' + queryString : ''}`;
  
  try {
    // Bitbucket Data Center uses Bearer token (HTTP Access Token)
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
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
    console.error('Bitbucket API proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to Bitbucket API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


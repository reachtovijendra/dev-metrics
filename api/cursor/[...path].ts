import type { VercelRequest, VercelResponse } from '@vercel/node';

const CURSOR_API_BASE = 'https://api.cursor.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.CURSOR_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Cursor API key not configured' });
  }

  // Get the path after /api/cursor/
  const pathSegments = req.query.path;
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';
  
  // Build the target URL
  const targetUrl = `${CURSOR_API_BASE}/${path}`;
  
  try {
    // Prepare headers - Cursor uses Basic Auth with apiKey as username
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');
    
    const headers: HeadersInit = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    // Forward the request
    const fetchOptions: RequestInit = {
      method: req.method,
      headers
    };

    // Include body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    // Get response data
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Return the response
    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('Cursor API proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to Cursor API',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


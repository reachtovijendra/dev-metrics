import { VercelRequest, VercelResponse } from '@vercel/node';

const CURSOR_API_BASE = 'https://api.cursor.com';

module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.CURSOR_API_KEY;
  
  console.log('CURSOR_API_KEY exists:', !!apiKey);
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Cursor API key not configured' });
  }

  // Get the path from the URL - extract everything after /api/cursor
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const fullPath = url.pathname;
  const path = fullPath.replace(/^\/api\/cursor\/?/, '');
  
  // Build query string from URL search params
  const queryString = url.search;
  
  // Build the target URL
  const targetUrl = `${CURSOR_API_BASE}/${path}${queryString}`;
  
  console.log('Proxying to:', targetUrl);
  
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
    
    console.log('Cursor API response status:', response.status);
    
    // Get response data
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log('Cursor API response type:', typeof data);

    // Return the response
    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('Cursor API proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error stack:', errorStack);
    return res.status(500).json({ 
      error: 'Failed to proxy request to Cursor API',
      details: errorMessage,
      targetUrl: targetUrl
    });
  }
};

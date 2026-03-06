const MABL_API_BASE = 'https://api.mabl.com';

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // MABL uses client-provided API key (passed in Authorization header)
  const authHeader = req.headers.authorization;
  
  console.log('MABL Authorization header exists:', !!authHeader);
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  
  if (!authHeader) {
    return res.status(401).json({ error: 'MABL API key not provided in Authorization header' });
  }

  // Get the path from Vercel's rewrite (passed as query param) or from URL
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  
  // Vercel passes the captured path as a query parameter
  let path = req.query.path;
  if (Array.isArray(path)) {
    path = path.join('/');
  }
  path = path || '';
  
  // Build query string, excluding the 'path' param added by Vercel rewrite
  const searchParams = new URLSearchParams(url.search);
  searchParams.delete('path');
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
  
  // Build the target URL
  const targetUrl = `${MABL_API_BASE}/${path}${queryString}`;
  
  console.log('Proxying to:', targetUrl);
  
  try {
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Forward the request
    const fetchOptions = {
      method: req.method,
      headers
    };

    // Include body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    console.log('MABL API response status:', response.status);
    
    // Get response data
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    console.log('MABL API response type:', typeof data);

    // Return the response
    if (typeof data === 'string') {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(response.status).send(data);
    }
    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('MABL API proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to MABL API',
      details: error.message || 'Unknown error',
      targetUrl: targetUrl
    });
  }
};

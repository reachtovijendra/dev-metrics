// Bitbucket Data Center server URL
const BITBUCKET_SERVER = process.env.BITBUCKET_SERVER_URL || 'https://acapgit.acacceptance.com';

module.exports = async function handler(req: any, res: any) {
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

  // Get the path from the URL - extract everything after /api/bitbucket
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const fullPath = url.pathname;
  const path = fullPath.replace(/^\/api\/bitbucket\/?/, '');
  
  // Build query string from URL search params
  const queryString = url.search;
  
  // Build the target URL
  const targetUrl = `${BITBUCKET_SERVER}/rest/api/latest/${path}${queryString}`;
  
  console.log('Proxying to:', targetUrl);
  
  try {
    // Bitbucket Data Center uses Bearer token (HTTP Access Token)
    const headers: any = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const fetchOptions: any = {
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
    
  } catch (error: any) {
    console.error('Bitbucket API proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to Bitbucket API',
      details: error?.message || 'Unknown error'
    });
  }
};

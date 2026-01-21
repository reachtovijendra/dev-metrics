const JIRA_API_BASE = 'https://acacceptance.atlassian.net/rest/api/3';

module.exports = async function handler(req, res) {
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
  const targetUrl = `${JIRA_API_BASE}/${path}${queryString}`;
  
  console.log('Proxying to:', targetUrl);
  
  try {
    // JIRA Cloud uses Basic Auth with email:apiToken
    const authHeader = 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
    
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const fetchOptions = {
      method: req.method,
      headers
    };

    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('JIRA API proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to JIRA API',
      details: error.message || 'Unknown error'
    });
  }
};


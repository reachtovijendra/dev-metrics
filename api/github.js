const GITHUB_API_BASE = 'https://api.github.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const url = new URL(req.url || '', `https://${req.headers.host}`);

  let path = req.query.path;
  if (Array.isArray(path)) {
    path = path.join('/');
  }
  path = path || '';

  const searchParams = new URLSearchParams(url.search);
  searchParams.delete('path');
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const targetUrl = `${GITHUB_API_BASE}/${path}${queryString}`;

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
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
    console.error('GitHub API proxy error:', error);
    return res.status(500).json({
      error: 'Failed to proxy request to GitHub API',
      details: error.message || 'Unknown error'
    });
  }
};

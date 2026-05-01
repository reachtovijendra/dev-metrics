const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.DEVELOPER_CONFIG_API_PORT || 4311);
const CONFIG_PATH = path.resolve(__dirname, '..', 'src', 'assets', 'developers.config.json');

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(payload);
}

function isDeveloperConfig(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.projectKey === 'string' &&
    Array.isArray(value.developers)
  );
}

async function readRequestJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.url !== '/developer-config-api/developers.config.json') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (req.method === 'GET') {
      const file = await fs.readFile(CONFIG_PATH, 'utf8');
      sendJson(res, 200, JSON.parse(file));
      return;
    }

    if (req.method !== 'PUT') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const config = await readRequestJson(req);
    if (!isDeveloperConfig(config)) {
      sendJson(res, 400, { error: 'Invalid developer config payload' });
      return;
    }

    await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    sendJson(res, 200, config);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unable to update developer config'
    });
  }
});

server.listen(PORT, () => {
  console.log(`[developer-config-api] Listening on http://localhost:${PORT}`);
  console.log(`[developer-config-api] Writing ${CONFIG_PATH}`);
});

const PROXY_CONFIG = {
  "/rest": {
    target: "https://acapgit.acacceptance.com/",
    secure: false,
    changeOrigin: false,  // Keep original host for NTLM auth
    logLevel: "debug"
    // Don't strip WWW-Authenticate - needed for Windows Integrated Auth
  },
  "/cursor-api": {
    target: "https://api.cursor.com",
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      "^/cursor-api": ""
    },
    logLevel: "debug",
    onProxyRes: function(proxyRes, req, res) {
      delete proxyRes.headers['www-authenticate'];
    }
  },
  "/jira-api": {
    target: "https://acacceptance.atlassian.net/",
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      "^/jira-api": "/rest/api/3"
    },
    logLevel: "debug",
    onProxyRes: function(proxyRes, req, res) {
      delete proxyRes.headers['www-authenticate'];
    }
  },
  "/mabl-api": {
    target: "https://api.mabl.com",
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      "^/mabl-api": ""
    },
    logLevel: "debug",
    onProxyReq: function(proxyReq, req, res) {
      console.log('[MABL Proxy] Request:', req.method, proxyReq.path);
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    },
    onProxyRes: function(proxyRes, req, res) {
      console.log('[MABL Proxy] Response:', proxyRes.statusCode);
      delete proxyRes.headers['www-authenticate'];
    },
    onError: function(err, req, res) {
      console.error('[MABL Proxy] ERROR:', err.code, err.message);
    }
  }
};

module.exports = PROXY_CONFIG;


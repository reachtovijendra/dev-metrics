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
  }
};

module.exports = PROXY_CONFIG;


const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/leetcode',
    createProxyMiddleware({
      target: 'https://leetcode.com',
      changeOrigin: true,
      secure: true,
      pathRewrite: { '^/leetcode': '' },
      logLevel: 'warn',
      headers: {
        Referer: 'https://leetcode.com',
        Origin: 'https://leetcode.com',
      },
    })
  );
};

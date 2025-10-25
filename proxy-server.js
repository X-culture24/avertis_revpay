const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Proxy middleware configuration
const proxyOptions = {
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
  secure: false,
  timeout: 30000,
  proxyTimeout: 30000,
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.url} -> http://127.0.0.1:8000${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`Response ${proxyRes.statusCode} for ${req.method} ${req.url}`);
  }
};

// Create proxy middleware
const proxy = createProxyMiddleware(proxyOptions);

// Use proxy for all requests
app.use('/', proxy);

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Proxying requests to Django server at http://127.0.0.1:8000`);
  console.log(`📱 Mobile app should connect to: http://10.0.2.2:${PORT}`);
});

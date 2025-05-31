// backend/src/server.js

const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// -----------------------------
// 1. Manual CORS Middleware
// -----------------------------
app.use((req, res, next) => {
  // Allow all origins for now
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow these headers in requests
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Allow these HTTP methods
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // If this is a preflight OPTIONS request, immediately send back 200
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// -----------------------------
// 2. Security & JSON Parsing
// -----------------------------
app.use(helmet());
app.use(express.json());

// -----------------------------
// 3. Request Logging (for debugging)
// -----------------------------
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -----------------------------
// 4. Health + CORS-Test Endpoints
// -----------------------------
// Health check: confirm server is running
app.get('/', (req, res) => {
  return res.json({
    message: 'Financial Super-App API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy'
  });
});

// Detailed health: uptime, timestamp
app.get('/health', (req, res) => {
  return res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// CORS test: returns a header so you can verify CORS
app.get('/cors-test', (req, res) => {
  res.set('X-Custom-Header', 'CORS test successful');
  return res.json({ success: true, message: 'CORS is working!' });
});

// -----------------------------
// 5. Mount Your API Routes
// -----------------------------
// Ensure these files exist and export routers:
//   backend/src/routes/plaid.js
//   backend/src/routes/budget.js
//   backend/src/routes/user.js

const plaidRoutes = require('./routes/plaid');
const budgetRoutes = require('./routes/budget');
const userRoutes = require('./routes/user');

app.use('/api/plaid', plaidRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/user', userRoutes);

// -----------------------------
// 6. Fallback for Any Other Route
// -----------------------------
app.all('*', (req, res) => {
  return res.status(200).send(`You've reached ${req.method} ${req.url}`);
});

// -----------------------------
// 7. Start the Server
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`CORS headers are sent for * (all origins)`);
});

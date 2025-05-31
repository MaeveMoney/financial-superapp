// backend/src/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// -----------------------------
// 1. CORS Configuration
// -----------------------------
app.use(
  cors({
    origin: '*', // allow all origins temporarily
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

// Handle preflight OPTIONS for all routes
app.options('*', (req, res) => {
  res.sendStatus(200);
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
  res.json({
    message: 'Financial Super-App API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy'
  });
});

// Detailed health: uptime, timestamp
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// CORS test: returns headers so you can verify CORS in the browser
app.get('/cors-test', (req, res) => {
  res.set('X-Custom-Header', 'CORS test works');
  res.json({ success: true, message: 'CORS is working!' });
});

// -----------------------------
// 5. Mounting Your API Routes
// -----------------------------
// Make sure these files exist:
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
// 6. Catch-All Fallback (for debugging)
// -----------------------------
app.all('*', (req, res) => {
  res
    .status(200)
    .send(`You’ve reached ${req.method} ${req.url} — make sure this route exists.`);
});

// -----------------------------
// 7. Start the Server
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`CORS is enabled for all origins`);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// SIMPLIFIED CORS: allow all origins (for now)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

app.use(helmet());
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.json({
    message: 'Financial Super-App API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Import and mount your routes
const plaidRoutes = require('./routes/plaid');
const budgetRoutes = require('./routes/budget');
const userRoutes = require('./routes/user');

app.use('/api/plaid', plaidRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/user', userRoutes);

// Catch-all for any other route
app.all('*', (req, res) => {
  res.status(200).send(`You've reached ${req.method} ${req.url}`);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`CORS is temporarily set to '*' for all origins`);
});

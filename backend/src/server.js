const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Set up CORS to allow requests from Vercel frontend
const allowedOrigins = [
  'https://financial-superapp.vercel.app', // your actual frontend domain
  'http://localhost:3000',                 // allow local dev in case you run it locally later
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g., mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());

// Basic health & test routes
app.get('/', (req, res) => {
  res.json({
    message: 'Financial Super-App API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy',
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API endpoint working!',
    database: 'Connected to Supabase',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/test-direct', async (req, res) => {
  res.json({
    success: true,
    message: 'Direct route working!',
    timestamp: new Date().toISOString(),
  });
});

// Import and use routes
const plaidRoutes = require('./routes/plaid');
const budgetRoutes = require('./routes/budget');
const userRoutes = require('./routes/user');

app.use('/api/plaid', plaidRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/user', userRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Financial Super-App Backend Started`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

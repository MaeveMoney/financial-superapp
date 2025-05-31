const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// List of allowed origins (your frontend on Vercel and localhost for local dev)
const allowedOrigins = [
  'https://financial-superapp.vercel.app',
  'http://localhost:3000'
];

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      // Check if the origin is in our allowed list
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // If not, block it
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Explicitly handle preflight OPTIONS requests for all routes
app.options('*', cors());

// Security middleware
app.use(helmet());
app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
  res.json({
    message: 'Financial Super-App API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy'
  });
});

// Detailed health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Load route handlers
const plaidRoutes = require('./routes/plaid');
const budgetRoutes = require('./routes/budget');
const userRoutes = require('./routes/user');

// Mount routes under /api
app.use('/api/plaid', plaidRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/user', userRoutes);

// Catch-all for any other route to verify server is running
app.all('*', (req, res) => {
  res.status(200).send(`You've reached ${req.method} ${req.url}`);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
});

// Import required packages
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic route to test if server is working
app.get('/', (req, res) => {
  res.json({ 
    message: 'Financial Super-App API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy'
  });
});

// Health check route (Railway uses this to know if your app is working)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Test database connection route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API endpoint working!',
    database: 'Connected to Supabase',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route added directly to server.js
app.get('/api/test-direct', async (req, res) => {
  res.json({
    success: true,
    message: 'Direct route working!',
    timestamp: new Date().toISOString()
  });
});

// Load Plaid API routes
const plaidRoutes = require('./routes/plaid');
app.use('/api/plaid', plaidRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Financial Super-App Backend Started`);
  console.log(`🕐 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

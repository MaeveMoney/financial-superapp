const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Fix CORS for Vercel + Local Dev
const allowedOrigins = [
  'https://financial-superapp.vercel.app',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow curl or Postman
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(helmet());
app.use(express.json());

// Health check
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

// Load routes
const plaidRoutes = require('./routes/plaid');
const budgetRoutes = require('./routes/budget');
const userRoutes = require('./routes/user');

app.use('/api/plaid', plaidRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/user', userRoutes);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
});

app.all('*', (req, res) => {
  res.status(200).send(`You've reached ${req.method} ${req.url}`);
});

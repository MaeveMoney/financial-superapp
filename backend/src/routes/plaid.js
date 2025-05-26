const express = require('express');
const PlaidService = require('../services/plaid');
const SupabaseService = require('../services/supabase');
const router = express.Router();

const plaid = new PlaidService();
const supabaseService = new SupabaseService();

// GET routes for browser testing
router.get('/test-connection', async (req, res) => {
  try {
    const linkToken = await plaid.createLinkToken('test_user_browser');
    
    res.json({
      success: true,
      message: 'Plaid connection working via GET request!',
      link_token_created: !!linkToken.link_token,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Plaid connection failed',
      details: error.response?.data || error.message
    });
  }
});

// Test database permissions
router.get('/test-db-permissions', async (req, res) => {
  try {
    console.log('Testing database permissions...');
    
    // Test if we can insert a simple record
    const testRecord = {
      user_id: 'test_user_123',
      account_id: 'test_account_123',
      account_type: 'checking',
      account_name: 'Test Account',
      balance: 100.00,
      currency: 'CAD',
      is_active: true
    };

    console.log('Attempting to insert test record...');
    const { data, error } = await supabaseService.supabase
      .from('user_accounts')
      .insert(testRecord)
      .select();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log('Test record inserted successfully');

    // Clean up test record
    await supabaseService.supabase
      .from('user_accounts')
      .delete()
      .eq('user_id', 'test_user_123');

    console.log('Test record cleaned up');

    res.json({
      success: true,
      message: 'Database permissions working!',
      test_record_created: !!data[0]
    });
  } catch (error) {
    console.error('Permission test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Database permission test failed',
      details: error.message,
      code: error.code
    });
  }
});

// Browser-accessible version of create_link_token
router.get('/create_link_token_test', async (req, res) => {
  try {
    const linkToken = await plaid.createLinkToken(`browser_user_${Date.now()}`);
    
    res.json({
      success: true,
      link_token: linkToken.link_token,
      expiration: linkToken.expiration,
      message: 'Link token created successfully via GET'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create link token',
      details: error.response?.data || error.message
    });
  }
});

// Create link token for Plaid Link
router.post('/create_link_token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // If no userId provided, generate a temporary one
    const clientUserId = userId || `user_${Date.now()}`;
    
    const linkToken = await plaid.createLinkToken(clientUserId);
    
    res.json({
      success: true,
      link_token: linkToken.link_token,
      expiration: linkToken.expiration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create link token',
      details: error.response?.data || error.message
    });
  }
});

// Exchange public token for access token
router.post('/exchange_public_token', async (req, res) => {
  try {
    const { public_token, user_id } = req.body;

    if (!public_token) {
      return res.status(400).json({
        success: false,
        error: 'public_token is required'
      });

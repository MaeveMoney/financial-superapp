const express = require('express');
const PlaidService = require('../services/plaid');
const router = express.Router();

const plaid = new PlaidService();

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
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({
        success: false,
        error: 'public_token is required'
      });
    }

    const exchangeResponse = await plaid.exchangePublicToken(public_token);
    
    // Get accounts immediately after exchange
    const accountsResponse = await plaid.getAccounts(exchangeResponse.access_token);
    
    res.json({
      success: true,
      access_token: exchangeResponse.access_token,
      item_id: exchangeResponse.item_id,
      accounts: accountsResponse.accounts,
      institution: accountsResponse.item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to exchange public token',
      details: error.response?.data || error.message
    });
  }
});

// Get user's accounts
router.post('/accounts', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'access_token is required'
      });
    }

    const accountsData = await plaid.getAccounts(access_token);
    
    res.json({
      success: true,
      accounts: accountsData.accounts,
      item: accountsData.item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts',
      details: error.response?.data || error.message
    });
  }
});

// Get account balances
router.post('/balances', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'access_token is required'
      });
    }

    const balanceData = await plaid.getBalances(access_token);
    
    res.json({
      success: true,
      accounts: balanceData.accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balances',
      details: error.response?.data || error.message
    });
  }
});

// Get transactions
router.post('/transactions', async (req, res) => {
  try {
    const { access_token, start_date, end_date } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'access_token is required'
      });
    }

    const startDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    const transactionData = await plaid.getTransactions(access_token, startDate, endDate);
    
    res.json({
      success: true,
      transactions: transactionData.transactions,
      total_transactions: transactionData.total_transactions,
      accounts: transactionData.accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.response?.data || error.message
    });
  }
});

// Get institution details
router.post('/institution', async (req, res) => {
  try {
    const { institution_id } = req.body;

    if (!institution_id) {
      return res.status(400).json({
        success: false,
        error: 'institution_id is required'
      });
    }

    const institutionData = await plaid.getInstitution(institution_id);
    
    res.json({
      success: true,
      institution: institutionData.institution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institution',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;

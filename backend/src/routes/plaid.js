const express = require('express');
const PlaidService = require('../services/plaid');
const SupabaseService = require('../services/supabase');
const { randomUUID } = require('crypto');
const router = express.Router();

const plaid = new PlaidService();
const supabaseService = new SupabaseService();

// Test database permissions
router.get('/test-db-permissions', async (req, res) => {
  try {
    const testRecord = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      account_id: 'test_account_123',
      account_type: 'checking',
      account_name: 'Test Account',
      balance: 100.0,
      currency: 'CAD',
      is_active: true,
    };

    const { data, error } = await supabaseService.supabase
      .from('user_accounts')
      .insert(testRecord)
      .select();

    if (error) throw error;

    await supabaseService.supabase
      .from('user_accounts')
      .delete()
      .eq('user_id', '123e4567-e89b-12d3-a456-426614174000');

    res.json({
      success: true,
      message: 'Database permissions working!',
      test_record_created: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database permission test failed',
      details: error.message,
      code: error.code,
    });
  }
});

// GET routes for browser testing
router.get('/test-connection', async (req, res) => {
  try {
    const linkToken = await plaid.createLinkToken('test_user_browser');
    res.json({
      success: true,
      message: 'Plaid connection working via GET request!',
      link_token_created: !!linkToken.link_token,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Plaid connection failed',
      details: error.response?.data || error.message,
    });
  }
});

// Create link token for Plaid Link
router.post('/create_link_token', async (req, res) => {
  try {
    const { userId } = req.body;
    const clientUserId = userId || `user_${Date.now()}`;
    const linkToken = await plaid.createLinkToken(clientUserId);

    res.json({
      success: true,
      link_token: linkToken.link_token,
      expiration: linkToken.expiration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create link token',
      details: error.response?.data || error.message,
    });
  }
});

// Exchange public token for access token and save data with real user ID
router.post('/exchange_public_token', async (req, res) => {
  try {
    const supabaseToken = req.headers.authorization?.split('Bearer ')[1];
    if (!supabaseToken) {
      return res.status(401).json({ success: false, error: 'Missing Supabase token' });
    }

    const { data: userData, error: userError } = await supabaseService.supabase.auth.getUser(supabaseToken);
    if (userError || !userData?.user?.id) {
      return res.status(401).json({ success: false, error: 'Invalid Supabase token' });
    }

    const userId = userData.user.id;
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ success: false, error: 'public_token is required' });
    }

    console.log('Exchanging token for Supabase user:', userId);

    const exchangeResponse = await plaid.exchangePublicToken(public_token);
    const accountsResponse = await plaid.getAccounts(exchangeResponse.access_token);

    const savedAccounts = [];
    for (const account of accountsResponse.accounts) {
      try {
        const savedAccount = await supabaseService.saveUserAccount(
          userId,
          account,
          exchangeResponse.access_token
        );
        if (savedAccount) savedAccounts.push(savedAccount);
      } catch (error) {
        console.error('Error saving account:', account.name, error.message);
      }
    }

    let totalTransactions = 0;
    for (const account of accountsResponse.accounts) {
      try {
        const transactionData = await plaid.getTransactions(
          exchangeResponse.access_token,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date()
        );

        if (transactionData.transactions && transactionData.transactions.length > 0) {
          const savedAccount = savedAccounts.find(sa => sa.account_id === account.account_id);
          if (savedAccount) {
            const result = await supabaseService.saveTransactions(
              userId,
              savedAccount.id,
              transactionData.transactions
            );
            totalTransactions += result.saved || transactionData.transactions.length;
          }
        }
      } catch (error) {
        console.error('Error importing transactions for account:', account.name, error.message);
      }
    }

    res.json({
      success: true,
      access_token: exchangeResponse.access_token,
      item_id: exchangeResponse.item_id,
      accounts: accountsResponse.accounts,
      saved_accounts: savedAccounts,
      transactions_imported: totalTransactions,
      user_id: userId,
    });

  } catch (error) {
    console.error('Exchange token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to exchange public token',
      details: error.response?.data || error.message,
    });
  }
});

// Get user's transactions
router.get('/user/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const transactions = await supabaseService.getUserTransactions(
      userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      transactions: transactions,
      count: transactions.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.message,
    });
  }
});

// Update transaction category
router.put('/transaction/:transactionId/category', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { category, subcategory } = req.body;

    const updatedTransaction = await supabaseService.updateTransactionCategory(
      transactionId,
      category,
      subcategory
    );

    res.json({
      success: true,
      transaction: updatedTransaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update transaction category',
      details: error.message,
    });
  }
});

// Plaid config debug route
router.get('/debug', async (req, res) => {
  try {
    const config = {
      clientId: process.env.PLAID_CLIENT_ID ? 'Set' : 'MISSING',
      secret: process.env.PLAID_SECRET ? 'Set' : 'MISSING',
      env: process.env.PLAID_ENV,
    };

    const linkTokenResponse = await plaid.createLinkToken('debug_user_123');

    res.json({
      success: true,
      message: 'Plaid credentials are working!',
      config: config,
      linkTokenCreated: !!linkTokenResponse.link_token,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Plaid debug failed',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;

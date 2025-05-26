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
    }

    // Generate a user ID if not provided
    const userId = user_id || `user_${Date.now()}`;

    console.log('Exchanging token for user:', userId);

    // Step 1: Exchange public token for access token
    const exchangeResponse = await plaid.exchangePublicToken(public_token);
    console.log('Token exchange successful');

    // Step 2: Get accounts
    const accountsResponse = await plaid.getAccounts(exchangeResponse.access_token);
    console.log('Accounts retrieved:', accountsResponse.accounts.length);

    // Step 3: Save accounts to database
    const savedAccounts = [];
    for (const account of accountsResponse.accounts) {
      try {
        const savedAccount = await supabaseService.saveUserAccount(
          userId, 
          account, 
          exchangeResponse.access_token
        );
        savedAccounts.push(savedAccount);
        console.log('Saved account:', account.name);
      } catch (error) {
        console.error('Error saving account:', account.name, error.message);
      }
    }

    // Step 4: Import recent transactions (last 30 days)
    let totalTransactions = 0;
    for (const account of accountsResponse.accounts) {
      try {
        const transactionData = await plaid.getTransactions(
          exchangeResponse.access_token,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          new Date() // today
        );

        if (transactionData.transactions && transactionData.transactions.length > 0) {
          // Find our saved account ID
          const savedAccount = savedAccounts.find(sa => sa.account_id === account.account_id);
          if (savedAccount) {
            await supabaseService.saveTransactions(savedAccount.id, transactionData.transactions);
            totalTransactions += transactionData.transactions.length;
            console.log(`Imported ${transactionData.transactions.length} transactions for ${account.name}`);
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
      institution: accountsResponse.item
    });

  } catch (error) {
    console.error('Exchange token error:', error);
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

// Get user's saved accounts
router.get('/user/:userId/accounts', async (req, res) => {
  try {
    const { userId } = req.params;
    const accounts = await supabaseService.getUserAccounts(userId);
    
    res.json({
      success: true,
      accounts: accounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user accounts',
      details: error.message
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
      count: transactions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.message
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
      transaction: updatedTransaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update transaction category',
      details: error.message
    });
  }
});

// Debug route
router.get('/debug', async (req, res) => {
  try {
    const config = {
      clientId: process.env.PLAID_CLIENT_ID ? 'Set' : 'MISSING',
      secret: process.env.PLAID_SECRET ? 'Set' : 'MISSING',
      env: process.env.PLAID_ENV,
      products: process.env.PLAID_PRODUCTS,
      countries: process.env.PLAID_COUNTRY_CODES
    };

    console.log('Plaid configuration:', config);

    const linkTokenResponse = await plaid.createLinkToken('debug_user_123');

    res.json({
      success: true,
      message: 'Plaid credentials are working!',
      config: config,
      linkTokenCreated: !!linkTokenResponse.link_token
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Plaid debug failed',
      config: {
        clientId: process.env.PLAID_CLIENT_ID ? 'Set' : 'MISSING',
        secret: process.env.PLAID_SECRET ? 'Set' : 'MISSING',
        env: process.env.PLAID_ENV
      },
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;

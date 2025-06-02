// backend/src/routes/plaid.js

const express = require('express');
const PlaidService = require('../services/plaid');
const SupabaseService = require('../services/supabase');
const { randomUUID } = require('crypto');
const router = express.Router();

const plaid = new PlaidService();
const supabaseService = new SupabaseService();

//
// 1. Test database permissions (unchanged)
//
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

//
// 2. GET /api/plaid/test-connection (unchanged)
//
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

//
// 3. POST /api/plaid/create_link_token (unchanged)
//
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

//
// 4. POST /api/plaid/exchange_public_token (unchanged except for saving user_id)
//
router.post('/exchange_public_token', async (req, res) => {
  try {
    // Extract Supabase JWT from Authorization header:
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

    // Save each account & its transactions under the real userId
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
          const savedAccount = savedAccounts.find(
            (sa) => sa.account_id === account.account_id
          );
          if (savedAccount) {
            const result = await supabaseService.saveTransactions(
              savedAccount.id,
              transactionData.transactions
            );
            totalTransactions += result.saved || transactionData.transactions.length;
          }
        }
      } catch (error) {
        console.error(
          'Error importing transactions for account:',
          account.name,
          error.message
        );
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

//
// 5. GET /api/plaid/user/:userId/transactions  (UPDATED to honor query params)
//
router.get('/user/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      limit = 50,
      offset = 0,
      start_date,
      end_date,
      search,
      category,
      recurring,
      is_manual,
    } = req.query;

    // 1) Find that user’s “active” account IDs first
    const { data: accounts, error: accountsError } = await supabaseService.supabase
      .from('user_accounts')
      .select('id, account_name, account_type')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) {
      return res.json({ success: true, transactions: [], count: 0 });
    }
    const accountIds = accounts.map((acc) => acc.id);

    // 2) Build our Supabase query with all optional filters
    let query = supabaseService.supabase
      .from('transactions')
      .select('*')
      .in('account_id', accountIds)
      .order('date', { ascending: false });

    // a) Date range
    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }

    // b) Text search on description or merchant_name
    if (search) {
      // Supabase doesn’t have a built‐in “ILIKE or ILIKE” on two columns in a single call,
      // so we do .or()—( this will search description ILIKE '%search%' OR merchant_name ILIKE '%search%' )
      const escaped = search.replace(/'/g, "''");
      query = query.or(
        `description.ilike.%${escaped}%,merchant_name.ilike.%${escaped}%`
      );
    }

    // c) Filter by category exactly
    if (category) {
      query = query.eq('category', category);
    }

    // d) Filter by is_recurring
    if (recurring === 'true') {
      query = query.eq('is_recurring', true);
    } else if (recurring === 'false') {
      query = query.eq('is_recurring', false);
    }

    // e) Filter by is_manual
    if (is_manual === 'true') {
      query = query.eq('is_manual', true);
    } else if (is_manual === 'false') {
      query = query.eq('is_manual', false);
    }

    // f) Pagination: limit & offset
    query = query.limit(parseInt(limit)).offset(parseInt(offset));

    // 3) Run final query
    const { data: transactions, error: txnError } = await query;
    if (txnError) throw txnError;

    // 4) Attach account_name/account_type (could have done this in SQL, 
    //    but for clarity we’ll merge manually)
    const transactionsWithAccounts = (transactions || []).map((txn) => {
      const acct = accounts.find((a) => a.id === txn.account_id);
      return {
        ...txn,
        user_accounts: {
          account_name: acct?.account_name || 'Unknown',
          account_type: acct?.account_type || 'unknown',
        },
      };
    });

    res.json({
      success: true,
      transactions: transactionsWithAccounts,
      count: transactionsWithAccounts.length,
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.message,
    });
  }
});

//
// 6. PUT /api/plaid/transaction/:transactionId/category  (unchanged)
//
router.put('/transaction/:transactionId/category', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { category, subcategory } = req.body;

    const updatedTransaction = await supabaseService.updateTransactionCategory(
      transactionId,
      category,
      subcategory
    );
    res.json({ success: true, transaction: updatedTransaction });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update transaction category',
      details: error.message,
    });
  }
});

//
// 7. POST /api/plaid/user/:userId/transactions/bulk-category (NEW)
//
router.post('/user/:userId/transactions/bulk-category', async (req, res) => {
  try {
    const { userId } = req.params;
    const { transactionIds, category, subcategory } = req.body;
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No transaction IDs provided' });
    }
    // Update all matching transactions belonging to those IDs:
    const { data: updatedRows, error: updateError } = await supabaseService.supabase
      .from('transactions')
      .update({ category, subcategory, updated_at: new Date().toISOString() })
      .in('transaction_id', transactionIds)
      .select();

    if (updateError) throw updateError;
    res.json({
      success: true,
      updatedCount: updatedRows.length,
      updatedRows,
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk update failed',
      details: error.message,
    });
  }
});

//
// 8. PUT /api/plaid/transaction/:transactionId/recurring (NEW)
//
router.put('/transaction/:transactionId/recurring', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { is_recurring } = req.body;
    const { data: updatedRow, error: updateError } = await supabaseService.supabase
      .from('transactions')
      .update({ is_recurring, updated_at: new Date().toISOString() })
      .eq('transaction_id', transactionId)
      .select()
      .single();
    if (updateError) throw updateError;
    res.json({ success: true, transaction: updatedRow });
  } catch (error) {
    console.error('Error toggling recurring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle recurring',
      details: error.message,
    });
  }
});

//
// 9. PUT /api/plaid/transaction/:transactionId/manual (NEW)
//
router.put('/transaction/:transactionId/manual', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { is_manual } = req.body;
    const { data: updatedRow, error: updateError } = await supabaseService.supabase
      .from('transactions')
      .update({ is_manual, updated_at: new Date().toISOString() })
      .eq('transaction_id', transactionId)
      .select()
      .single();
    if (updateError) throw updateError;
    res.json({ success: true, transaction: updatedRow });
  } catch (error) {
    console.error('Error toggling manual:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle manual',
      details: error.message,
    });
  }
});

//
// 10. GET /api/plaid/debug  (unchanged)
//
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
      config,
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

// backend/src/routes/plaid.js

const express = require('express');
const PlaidService = require('../services/plaid');
const SupabaseService = require('../services/supabase');
const router = express.Router();

const plaid = new PlaidService();
const supabaseService = new SupabaseService();

// ---------------------------------------------------
// 1. TEST DB PERMISSIONS
// ---------------------------------------------------
router.get('/test-db-permissions', async (req, res) => {
  try {
    console.log('🔍 [plaid] Testing database permissions…');
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

    console.log('✅ [plaid] Test record inserted:', data);
    await supabaseService.supabase
      .from('user_accounts')
      .delete()
      .eq('user_id', testRecord.user_id);

    console.log('🧹 [plaid] Test record cleaned up');
    return res.json({ success: true, message: 'Database permissions working!' });
  } catch (error) {
    console.error('❌ [plaid] Permission test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database permission test failed',
      details: error.message,
      code: error.code,
    });
  }
});

// ---------------------------------------------------
// 2. PLAID LINK TOKEN TEST (GET)
// ---------------------------------------------------
router.get('/test-connection', async (req, res) => {
  try {
    console.log('🔍 [plaid] Testing Plaid link‐creation…');
    const linkToken = await plaid.createLinkToken('test_user_browser');
    return res.json({
      success: true,
      message: 'Plaid connection working via GET request!',
      link_token_created: !!linkToken.link_token,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [plaid] Connection test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Plaid connection failed',
      details: error.response?.data || error.message,
    });
  }
});

// ---------------------------------------------------
// 3. CREATE LINK TOKEN FOR PLAID LINK (POST)
// ---------------------------------------------------
router.post('/create_link_token', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) console.warn('⚠️ [plaid] No userId provided, generating fallback');
    const clientUserId = userId || `user_${Date.now()}`;
    console.log(`🔍 [plaid] Creating link token for client_user_id="${clientUserId}"`);
    const linkTokenResponse = await plaid.createLinkToken(clientUserId);
    console.log('✅ [plaid] Link token created:', linkTokenResponse.link_token);
    return res.json({
      success: true,
      link_token: linkTokenResponse.link_token,
      expiration: linkTokenResponse.expiration,
    });
  } catch (error) {
    console.error('❌ [plaid] Failed to create link token:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create link token',
      details: error.response?.data || error.message,
    });
  }
});

// ---------------------------------------------------
// 4. EXCHANGE PUBLIC TOKEN & SAVE ACCOUNTS + TRANSACTIONS (POST)
// ---------------------------------------------------
router.post('/exchange_public_token', async (req, res) => {
  try {
    // 1) Validate Supabase JWT
    const supabaseJwt = req.headers.authorization?.split('Bearer ')[1];
    if (!supabaseJwt) {
      console.warn('⚠️ [plaid] Missing Supabase token in headers');
      return res.status(401).json({ success: false, error: 'Missing Supabase token' });
    }

    const { data: { user }, error: userError } = await supabaseService.supabase.auth.getUser(supabaseJwt);
    if (userError || !user?.id) {
      console.error('❌ [plaid] Invalid Supabase token:', userError || 'No user returned');
      return res.status(401).json({ success: false, error: 'Invalid Supabase token' });
    }
    const userId = user.id;
    console.log(`🔍 [plaid] Exchanging public token for userId="${userId}"`);

    const { public_token } = req.body;
    if (!public_token) {
      console.warn('⚠️ [plaid] public_token missing in request body');
      return res.status(400).json({ success: false, error: 'public_token is required' });
    }

    // 2) Exchange for access_token
    const exchangeResponse = await plaid.exchangePublicToken(public_token);
    console.log('✅ [plaid] Received access_token and item_id:', exchangeResponse.access_token, exchangeResponse.item_id);

    // 3) Fetch accounts
    const accountsResponse = await plaid.getAccounts(exchangeResponse.access_token);
    console.log(`🔍 [plaid] Retrieved ${accountsResponse.accounts.length} accounts from Plaid`);

    // 4) Save each account
    const savedAccounts = [];
    for (const account of accountsResponse.accounts) {
      try {
        const saved = await supabaseService.saveUserAccount(
          userId,
          account,
          exchangeResponse.access_token
        );
        if (saved) {
          savedAccounts.push(saved);
          console.log(`✅ [plaid] Saved account "${account.name}" (DB ID=${saved.id})`);
        }
      } catch (saveError) {
        console.error(`❌ [plaid] Error saving account "${account.name}":`, saveError.message);
      }
    }

    // 5) Fetch & save transactions for each saved account
    let totalTransactions = 0;
    for (const savedAccount of savedAccounts) {
      try {
        const transactionData = await plaid.getTransactions(
          exchangeResponse.access_token,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date()
        );
        const txnList = transactionData.transactions || [];
        if (txnList.length > 0) {
          const result = await supabaseService.saveTransactions(
            savedAccount.id,    // <— account’s DB ID
            txnList             // <— array of transaction objects
          );
          totalTransactions += result.saved || txnList.length;
          console.log(`✅ [plaid] Imported ${txnList.length} transactions for "${savedAccount.account_name}"`);
        } else {
          console.log(`ℹ️ [plaid] No new transactions for "${savedAccount.account_name}"`);
        }
      } catch (txnError) {
        console.error(`❌ [plaid] Error importing transactions for "${savedAccount.account_name}":`, txnError.message);
      }
    }

    // 6) Return response
    return res.json({
      success: true,
      access_token: exchangeResponse.access_token,
      item_id: exchangeResponse.item_id,
      saved_accounts: savedAccounts,
      transactions_imported: totalTransactions,
      user_id: userId,
    });
  } catch (error) {
    console.error('❌ [plaid] exchange_public_token error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to exchange public token',
      details: error.response?.data || error.message,
    });
  }
});

// ---------------------------------------------------
// 5. GET USER’S TRANSACTIONS WITH FILTERS, SEARCH, PAGINATION (GET)
// ---------------------------------------------------
router.get('/user/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      limit = 50,
      offset = 0,
      start_date = null,
      end_date = null,
      search = null,
      category = null,
      recurring = null,
      is_manual = null,
    } = req.query;

    console.log(`🔍 [plaid] Fetching transactions for userId="${userId}"`);
    console.log('   Query params:', { limit, offset, start_date, end_date, search, category, recurring, is_manual });

    // Convert recurring/is_manual to booleans if present
    const recurringBool = recurring === 'true' ? true
                      : recurring === 'false' ? false
                      : null;
    const isManualBool = is_manual === 'true' ? true
                       : is_manual === 'false' ? false
                       : null;

    const transactions = await supabaseService.getUserTransactions(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      start_date: start_date || null,
      end_date: end_date || null,
      search: search || null,
      category: category || null,
      recurring: recurringBool,
      is_manual: isManualBool,
    });

    return res.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('❌ [plaid] get transactions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      details: error.message,
    });
  }
});

// ---------------------------------------------------
// 6. UPDATE SINGLE TRANSACTION’S CATEGORY (PUT)
// ---------------------------------------------------
router.put('/transaction/:transactionId/category', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { category, subcategory } = req.body;

    console.log(`🔄 [plaid] Update category for txnId="${transactionId}" → category="${category}", subcategory="${subcategory}"`);
    const updatedTransaction = await supabaseService.updateTransactionCategory(
      transactionId,
      category,
      subcategory
    );
    return res.json({
      success: true,
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error('❌ [plaid] Failed to update transaction category:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update transaction category',
      details: error.message,
    });
  }
});

// ---------------------------------------------------
// 7. BULK UPDATE TRANSACTIONS’ CATEGORY (POST)
// ---------------------------------------------------
router.post('/user/:userId/transactions/bulk-category', async (req, res) => {
  try {
    const { userId } = req.params;
    const { transactionIds = [], category, subcategory = null } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ success: false, error: 'transactionIds must be a non-empty array' });
    }

    console.log(`🔄 [plaid] Bulk update ${transactionIds.length} txns → category="${category}", subcategory="${subcategory}"`);
    const updatedRows = await supabaseService.bulkUpdateTransactionCategory(
      transactionIds,
      category,
      subcategory
    );

    return res.json({
      success: true,
      updatedCount: updatedRows.length,
      updatedRows,
    });
  } catch (error) {
    console.error('❌ [plaid] Bulk update category error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to bulk update transaction categories',
      details: error.message,
    });
  }
});

// ---------------------------------------------------
// 8. UPDATE “IS_RECURRING” FLAG (PUT)
// ---------------------------------------------------
router.put('/transaction/:transactionId/recurring', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { is_recurring } = req.body;
    console.log(`🔄 [plaid] Update is_recurring for txnId="${transactionId}" → ${is_recurring}`);
    const updated = await supabaseService.updateTransactionRecurring(transactionId, is_recurring);
    return res.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('❌ [plaid] Failed to update recurring flag:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update recurring flag',
      details: error.message,
    });
  }
});

// ---------------------------------------------------
// 9. UPDATE “IS_MANUAL” FLAG (PUT)
// ---------------------------------------------------
router.put('/transaction/:transactionId/manual', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { is_manual } = req.body;
    console.log(`🔄 [plaid] Update is_manual for txnId="${transactionId}" → ${is_manual}`);
    const updated = await supabaseService.updateTransactionManual(transactionId, is_manual);
    return res.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('❌ [plaid] Failed to update manual flag:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update manual flag',
      details: error.message,
    });
  }
});

// ---------------------------------------------------
// 10. GET USER’S LINKED ACCOUNTS (GET)
// ---------------------------------------------------
router.get('/user/:userId/accounts', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 [plaid] Fetching linked accounts for userId="${userId}"`);
    const accounts = await supabaseService.getUserAccounts(userId);
    return res.json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error('❌ [plaid] get accounts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts',
      details: error.message,
    });
  }
});

// ---------------------------------------------------
// 11. PLAID CONFIG DEBUG (GET)
// ---------------------------------------------------
router.get('/debug', async (req, res) => {
  try {
    console.log('🔍 [plaid] Running debug endpoint…');
    const config = {
      clientId: process.env.PLAID_CLIENT_ID ? 'Set' : 'MISSING',
      secret: process.env.PLAID_SECRET ? 'Set' : 'MISSING',
      env: process.env.PLAID_ENV,
    };
    const linkTokenResponse = await plaid.createLinkToken('debug_user_123');
    return res.json({
      success: true,
      message: 'Plaid credentials are working!',
      config,
      linkTokenCreated: !!linkTokenResponse.link_token,
    });
  } catch (error) {
    console.error('❌ [plaid] Debug failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Plaid debug failed',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;

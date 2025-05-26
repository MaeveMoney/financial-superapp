const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Save user account information
  async saveUserAccount(userId, accountData, accessToken) {
    try {
      const accountRecord = {
        user_id: userId,
        account_id: accountData.account_id,
        account_type: accountData.type,
        account_name: accountData.name,
        account_number_masked: accountData.mask,
        balance: accountData.balances.current || accountData.balances.available || 0,
        available_balance: accountData.balances.available || 0,
        currency: accountData.balances.iso_currency_code || 'CAD',
        access_token: accessToken, // We'll encrypt this in production
        last_synced_at: new Date().toISOString(),
        is_active: true
      };

      const { data, error } = await this.supabase
        .from('user_accounts')
        .upsert(accountRecord, { 
          onConflict: 'user_id,account_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error saving user account:', error);
      throw error;
    }
  }

  // Save transactions for an account
  async saveTransactions(accountId, transactions) {
    try {
      const transactionRecords = transactions.map(txn => ({
        account_id: accountId,
        transaction_id: txn.transaction_id,
        amount: txn.amount,
        description: txn.name,
        merchant_name: txn.merchant_name,
        date: txn.date,
        posted_date: txn.date,
        category: this.mapPlaidCategory(txn.category),
        subcategory: txn.category ? txn.category[0] : null,
        is_recurring: false,
        is_manual: false
      }));

      const { data, error } = await this.supabase
        .from('transactions')
        .upsert(transactionRecords, { 
          onConflict: 'transaction_id',
          ignoreDuplicates: true 
        })
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving transactions:', error);
      throw error;
    }
  }

  // Get user's accounts
  async getUserAccounts(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user accounts:', error);
      throw error;
    }
  }

  // Get transactions for user accounts
  async getUserTransactions(userId, limit = 100, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select(`
          *,
          user_accounts!inner(user_id, account_name, account_type)
        `)
        .eq('user_accounts.user_id', userId)
        .order('date', { ascending: false })
        .limit(limit)
        .offset(offset);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user transactions:', error);
      throw error;
    }
  }

  // Update transaction category
  async updateTransactionCategory(transactionId, category, subcategory) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .update({ 
          category: category,
          subcategory: subcategory 
        })
        .eq('id', transactionId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error updating transaction category:', error);
      throw error;
    }
  }

  // Map Plaid categories to our simplified categories
  mapPlaidCategory(plaidCategories) {
    if (!plaidCategories || plaidCategories.length === 0) {
      return 'Other';
    }

    const primary = plaidCategories[0];
    const secondary = plaidCategories[1];

    // Map to simplified categories
    const categoryMap = {
      'Food and Drink': 'Food & Dining',
      'Shops': 'Shopping',
      'Recreation': 'Entertainment',
      'Transportation': 'Transportation',
      'Healthcare': 'Healthcare',
      'Service': 'Services',
      'Community': 'Community',
      'Government and Non-Profit': 'Government',
      'Travel': 'Travel',
      'Bank Fees': 'Fees',
      'Interest': 'Income',
      'Deposit': 'Income',
      'Payroll': 'Income',
      'Transfer': 'Transfer'
    };

    return categoryMap[primary] || 'Other';
  }
}

module.exports = SupabaseService;

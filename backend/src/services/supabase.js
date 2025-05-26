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
        access_token: accessToken,
        last_synced_at: new Date().toISOString(),
        is_active: true
      };

      console.log('Saving account record:', accountRecord.account_name);

      // Try to insert first
      const { data: insertData, error: insertError } = await this.supabase
        .from('user_accounts')
        .insert(accountRecord)
        .select();

      if (!insertError) {
        console.log('Account inserted successfully:', insertData[0]?.account_name);
        return insertData[0];
      }

      // If insert failed due to duplicate, try update
      if (insertError.code === '23505') { // Unique constraint violation
        console.log('Account exists, updating...');
        const { data: updateData, error: updateError } = await this.supabase
          .from('user_accounts')
          .update({
            account_name: accountRecord.account_name,
            balance: accountRecord.balance,
            available_balance: accountRecord.available_balance,
            last_synced_at: accountRecord.last_synced_at,
            access_token: accountRecord.access_token
          })
          .eq('user_id', userId)
          .eq('account_id', accountData.account_id)
          .select();

        if (updateError) throw updateError;
        console.log('Account updated successfully:', updateData[0]?.account_name);
        return updateData[0];
      }

      // Other error, throw it
      throw insertError;
      
    } catch (error) {
      console.error('Error saving user account:', error);
      throw error;
    }
  }

  // Save transactions for an account
  async saveTransactions(accountDbId, transactions) {
    try {
      console.log(`Saving ${transactions.length} transactions for account ${accountDbId}`);
      
      let savedCount = 0;
      
      for (const txn of transactions) {
        try {
          const transactionRecord = {
            account_id: accountDbId,
            transaction_id: txn.transaction_id,
            amount: txn.amount,
            description: txn.name,
            merchant_name: txn.merchant_name || null,
            date: txn.date,
            posted_date: txn.date,
            category: this.mapPlaidCategory(txn.category),
            subcategory: txn.category && txn.category[0] ? txn.category[0] : null,
            is_recurring: false,
            is_manual: false
          };

          // Try to insert
          const { error: insertError } = await this.supabase
            .from('transactions')
            .insert(transactionRecord);

          if (!insertError) {
            savedCount++;
          } else if (insertError.code !== '23505') { // Ignore duplicates, throw other errors
            console.error('Error inserting transaction:', insertError);
          }
          
        } catch (txnError) {
          console.error('Error processing transaction:', txnError);
        }
      }
      
      console.log(`Successfully saved ${savedCount} new transactions`);
      return { saved: savedCount };
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
      return data || [];
    } catch (error) {
      console.error('Error getting user accounts:', error);
      throw error;
    }
  }

  // Get transactions for user accounts - FIXED SIMPLE VERSION
  async getUserTransactions(userId, limit = 100, offset = 0) {
    try {
      console.log(`Getting transactions for user ${userId}`);
      
      // Step 1: Get user's account IDs
      const { data: accounts, error: accountsError } = await this.supabase
        .from('user_accounts')
        .select('id, account_name, account_type')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (accountsError) {
        console.error('Error getting user accounts:', accountsError);
        throw accountsError;
      }
      
      if (!accounts || accounts.length === 0) {
        console.log('No accounts found for user');
        return [];
      }

      console.log(`Found ${accounts.length} accounts for user`);
      const accountIds = accounts.map(acc => acc.id);

      // Step 2: Get transactions for these accounts
      const { data: transactions, error: transactionsError } = await this.supabase
        .from('transactions')
        .select('*')
        .in('account_id', accountIds)
        .order('date', { ascending: false })
        .limit(limit);

      if (transactionsError) {
        console.error('Error getting transactions:', transactionsError);
        throw transactionsError;
      }

      // Step 3: Add account info to each transaction
      const transactionsWithAccounts = (transactions || []).map(txn => {
        const account = accounts.find(acc => acc.id === txn.account_id);
        return {
          ...txn,
          user_accounts: {
            account_name: account?.account_name || 'Unknown Account',
            account_type: account?.account_type || 'unknown'
          }
        };
      });
      
      console.log(`Returning ${transactionsWithAccounts.length} transactions for user`);
      return transactionsWithAccounts;
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

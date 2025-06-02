// backend/src/services/supabase.js

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

  // ----------------------------
  // 1. Save user account information
  // ----------------------------
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
        is_active: true,
      };

      // Try to insert
      const { data: insertData, error: insertError } = await this.supabase
        .from('user_accounts')
        .insert(accountRecord)
        .select();

      if (!insertError) {
        return insertData[0];
      }

      // If insert failed due to duplicate (unique constraint), update instead
      if (insertError.code === '23505') {
        const { data: updateData, error: updateError } = await this.supabase
          .from('user_accounts')
          .update({
            account_name: accountRecord.account_name,
            balance: accountRecord.balance,
            available_balance: accountRecord.available_balance,
            last_synced_at: accountRecord.last_synced_at,
            access_token: accountRecord.access_token,
          })
          .eq('user_id', userId)
          .eq('account_id', accountData.account_id)
          .select();

        if (updateError) throw updateError;
        return updateData[0];
      }

      // Otherwise, throw any other insertError
      throw insertError;
    } catch (error) {
      console.error('❌ [SupabaseService] Error saving user account:', error);
      throw error;
    }
  }

  // ----------------------------
  // 2. Save transactions for an account
  // ----------------------------
  async saveTransactions(accountDbId, transactionsArray) {
    try {
      let savedCount = 0;
      console.log(`🔍 [SupabaseService] Saving ${transactionsArray.length} transactions for account ${accountDbId}`);

      for (const txn of transactionsArray) {
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
            is_manual: false,
          };

          // Try inserting; ignore duplicates (code 23505)
          const { error: insertError } = await this.supabase
            .from('transactions')
            .insert(transactionRecord);

          if (!insertError) {
            savedCount++;
          } else if (insertError.code !== '23505') {
            console.error('❌ [SupabaseService] Error inserting transaction:', insertError);
          }
        } catch (txnError) {
          console.error('❌ [SupabaseService] Error processing transaction:', txnError);
        }
      }

      console.log(`✅ [SupabaseService] Successfully saved ${savedCount} new transactions`);
      return { saved: savedCount };
    } catch (error) {
      console.error('❌ [SupabaseService] Error saving transactions:', error);
      throw error;
    }
  }

  // ----------------------------
  // 3. Get user's linked accounts
  // ----------------------------
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
      console.error('❌ [SupabaseService] Error getting user accounts:', error);
      throw error;
    }
  }

  // ----------------------------
  // 4. Get user transactions with filters, search, pagination, etc.
  // 
  // Parameters:
  //   - userId: string
  //   - limit: number
  //   - offset: number
  //   - start_date: string (YYYY-MM-DD) [optional]
  //   - end_date: string (YYYY-MM-DD) [optional]
  //   - search: string [optional] (matches description or merchant_name)
  //   - category: string [optional]
  //   - recurring: boolean [optional]
  //   - is_manual: boolean [optional]
  // ----------------------------
  async getUserTransactions(userId, {
    limit = 50,
    offset = 0,
    start_date = null,
    end_date = null,
    search = null,
    category = null,
    recurring = null,
    is_manual = null,
  } = {}) {
    try {
      console.log(`🔍 [SupabaseService] Getting transactions for user ${userId}`);
      console.log('   Filters:', { limit, offset, start_date, end_date, search, category, recurring, is_manual });

      // Step 1: Get account IDs for this user
      const { data: accounts, error: accountsError } = await this.supabase
        .from('user_accounts')
        .select('id, account_name, account_type')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (accountsError) {
        console.error('❌ [SupabaseService] Error getting user accounts:', accountsError);
        throw accountsError;
      }

      if (!accounts || accounts.length === 0) {
        console.log('ℹ️ [SupabaseService] No accounts found for user');
        return [];
      }

      const accountIds = accounts.map(acc => acc.id);

      // Step 2: Build the base query
      let query = this.supabase
        .from('transactions')
        .select('*, user_accounts(id, account_name, account_type)')
        .in('account_id', accountIds);

      // Step 3: Apply optional filters

      // Date range
      if (start_date) {
        query = query.gte('date', start_date);
      }
      if (end_date) {
        query = query.lte('date', end_date);
      }

      // Search in description OR merchant_name
      if (search) {
        const searchPattern = `%${search}%`;
        query = query.or(`description.ilike.${searchPattern},merchant_name.ilike.${searchPattern}`);
      }

      // Category filter
      if (category) {
        query = query.eq('category', category);
      }

      // Recurring filter
      if (recurring !== null) {
        query = query.eq('is_recurring', recurring);
      }

      // Manual flag filter
      if (is_manual !== null) {
        query = query.eq('is_manual', is_manual);
      }

      // Pagination & ordering
      const { data: transactions, error: transactionsError } = await query
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1); // Supabase’s “range” uses inclusive indices

      if (transactionsError) {
        console.error('❌ [SupabaseService] Error getting transactions:', transactionsError);
        throw transactionsError;
      }

      // Step 4: Return transactions, each including user_accounts info
      console.log(`✅ [SupabaseService] Returning ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      console.error('❌ [SupabaseService] Error in getUserTransactions:', error);
      throw error;
    }
  }

  // ----------------------------
  // 5. Update transaction category & subcategory
  // ----------------------------
  async updateTransactionCategory(transactionId, category, subcategory) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .update({ category, subcategory, updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('❌ [SupabaseService] Error updating transaction category:', error);
      throw error;
    }
  }

  // ----------------------------
  // 6. Bulk update multiple transactions’ categories
  // ----------------------------
  async bulkUpdateTransactionCategory(transactionIds = [], category, subcategory) {
    try {
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        throw new Error('transactionIds must be a non-empty array');
      }

      const { data, error } = await this.supabase
        .from('transactions')
        .update({ category, subcategory, updated_at: new Date().toISOString() })
        .in('transaction_id', transactionIds)
        .select();

      if (error) throw error;
      return data; // array of updated rows
    } catch (error) {
      console.error('❌ [SupabaseService] Error bulk updating transaction category:', error);
      throw error;
    }
  }

  // ----------------------------
  // 7. Update transaction “recurring” flag
  // ----------------------------
  async updateTransactionRecurring(transactionId, isRecurring) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .update({ is_recurring: isRecurring, updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('❌ [SupabaseService] Error updating transaction recurring flag:', error);
      throw error;
    }
  }

  // ----------------------------
  // 8. Update transaction “manual” flag
  // ----------------------------
  async updateTransactionManual(transactionId, isManual) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .update({ is_manual: isManual, updated_at: new Date().toISOString() })
        .eq('transaction_id', transactionId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('❌ [SupabaseService] Error updating transaction manual flag:', error);
      throw error;
    }
  }

  // ----------------------------
  // 9. Map Plaid category array to our simplified category
  // ----------------------------
  mapPlaidCategory(plaidCategoriesArray) {
    if (!Array.isArray(plaidCategoriesArray) || plaidCategoriesArray.length === 0) {
      return 'Other';
    }
    const primary = plaidCategoriesArray[0];
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
      'Transfer': 'Transfer',
    };
    return categoryMap[primary] || 'Other';
  }
}

module.exports = SupabaseService;

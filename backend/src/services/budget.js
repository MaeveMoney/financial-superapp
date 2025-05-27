const { createClient } = require('@supabase/supabase-js');

class BudgetService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Get all categories (predefined + custom) for a user
  async getAllCategories(userId) {
    try {
      // Get predefined categories from transactions
      const { data: transactionCategories, error: txnError } = await this.supabase
        .from('transactions')
        .select(`
          category,
          user_accounts!inner(user_id)
        `)
        .eq('user_accounts.user_id', userId)
        .not('category', 'is', null);

      if (txnError) throw txnError;

      // Get unique predefined categories
      const predefinedCategories = [...new Set(
        (transactionCategories || []).map(t => t.category)
      )].map(category => ({
        name: category,
        type: 'predefined',
        is_income: false,
        color: this.getCategoryColor(category),
        icon: this.getCategoryIcon(category)
      }));

      // Get custom categories
      const { data: customCategories, error: customError } = await this.supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name');

      if (customError) throw customError;

      const formattedCustomCategories = (customCategories || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        type: 'custom',
        description: cat.description,
        is_income: cat.is_income,
        color: cat.color,
        icon: cat.icon,
        parent_category: cat.parent_category
      }));

      return {
        predefined: predefinedCategories,
        custom: formattedCustomCategories,
        all: [...predefinedCategories, ...formattedCustomCategories]
      };
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  // Create custom category
  async createCustomCategory(userId, categoryData) {
    try {
      const { data, error } = await this.supabase
        .from('custom_categories')
        .insert({
          user_id: userId,
          name: categoryData.name,
          description: categoryData.description,
          color: categoryData.color || '#3182ce',
          icon: categoryData.icon || 'tag',
          is_income: categoryData.is_income || false,
          parent_category: categoryData.parent_category
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating custom category:', error);
      throw error;
    }
  }

  // Create budget
  async createBudget(userId, budgetData) {
    try {
      const { data, error } = await this.supabase
        .from('budgets')
        .insert({
          user_id: userId,
          name: budgetData.name,
          category_name: budgetData.category_name,
          budget_type: budgetData.budget_type || 'monthly',
          amount: budgetData.amount,
          period_start: budgetData.period_start,
          period_end: budgetData.period_end,
          auto_renew: budgetData.auto_renew !== false,
          rollover_unused: budgetData.rollover_unused || false,
          alert_threshold: budgetData.alert_threshold || 80.00,
          notes: budgetData.notes
        })
        .select()
        .single();

      if (error) throw error;

      // If it's a goal-based budget, create the goal
      if (budgetData.budget_type === 'goal' && budgetData.goal_data) {
        await this.supabase
          .from('budget_goals')
          .insert({
            budget_id: data.id,
            goal_name: budgetData.goal_data.goal_name,
            target_amount: budgetData.goal_data.target_amount,
            target_date: budgetData.goal_data.target_date
          });
      }

      return data;
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  }

  // Get user's budgets with spending data
  async getUserBudgets(userId) {
    try {
      const { data: budgets, error } = await this.supabase
        .from('budgets')
        .select(`
          *,
          budget_goals(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate spent amounts for each budget
      const budgetsWithSpending = await Promise.all(
        (budgets || []).map(async (budget) => {
          const spentAmount = await this.calculateSpentAmount(userId, budget);
          return {
            ...budget,
            spent_amount: spentAmount,
            remaining_amount: budget.amount - spentAmount,
            percentage_used: (spentAmount / budget.amount) * 100,
            is_over_budget: spentAmount > budget.amount,
            is_near_limit: (spentAmount / budget.amount) >= (budget.alert_threshold / 100)
          };
        })
      );

      return budgetsWithSpending;
    } catch (error) {
      console.error('Error getting user budgets:', error);
      throw error;
    }
  }

  // Calculate spent amount for a budget
  async calculateSpentAmount(userId, budget) {
    try {
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select(`
          amount,
          user_accounts!inner(user_id)
        `)
        .eq('user_accounts.user_id', userId)
        .eq('category', budget.category_name)
        .gte('date', budget.period_start)
        .lte('date', budget.period_end)
        .gt('amount', 0); // Only expenses (positive amounts)

      if (error) throw error;

      const totalSpent = (transactions || []).reduce((sum, txn) => sum + txn.amount, 0);
      return totalSpent;
    } catch (error) {
      console.error('Error calculating spent amount:', error);
      return 0;
    }
  }

  // Get spending insights for budget creation
  async getSpendingInsights(userId, months = 3) {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select(`
          amount,
          category,
          date,
          user_accounts!inner(user_id)
        `)
        .eq('user_accounts.user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .gt('amount', 0); // Only expenses

      if (error) throw error;

      // Group by category and calculate averages
      const categorySpending = {};
      (transactions || []).forEach(txn => {
        const category = txn.category || 'Other';
        if (!categorySpending[category]) {
          categorySpending[category] = { total: 0, count: 0, amounts: [] };
        }
        categorySpending[category].total += txn.amount;
        categorySpending[category].count++;
        categorySpending[category].amounts.push(txn.amount);
      });

      // Calculate suggested budgets
      const suggestions = Object.entries(categorySpending).map(([category, data]) => {
        const monthlyAverage = data.total / months;
        const suggestedBudget = Math.ceil(monthlyAverage * 1.1); // 10% buffer
        
        return {
          category,
          historical_average: monthlyAverage,
          suggested_budget: suggestedBudget,
          transaction_count: data.count,
          highest_month: Math.max(...data.amounts)
        };
      }).sort((a, b) => b.historical_average - a.historical_average);

      return suggestions;
    } catch (error) {
      console.error('Error getting spending insights:', error);
      throw error;
    }
  }

  // Helper methods for category styling
  getCategoryColor(category) {
    const colorMap = {
      'Food & Dining': '#e53e3e',
      'Shopping': '#d69e2e',
      'Transportation': '#3182ce',
      'Entertainment': '#805ad5',
      'Healthcare': '#38a169',
      'Services': '#319795',
      'Income': '#48bb78',
      'Transfer': '#718096',
      'Fees': '#f56565',
      'Other': '#a0aec0'
    };
    return colorMap[category] || '#3182ce';
  }

  getCategoryIcon(category) {
    const iconMap = {
      'Food & Dining': 'utensils',
      'Shopping': 'shopping-bag',
      'Transportation': 'car',
      'Entertainment': 'film',
      'Healthcare': 'heart',
      'Services': 'wrench',
      'Income': 'dollar-sign',
      'Transfer': 'exchange-alt',
      'Fees': 'exclamation-triangle',
      'Other': 'tag'
    };
    return iconMap[category] || 'tag';
  }

  // Update budget
  async updateBudget(budgetId, userId, updateData) {
    try {
      const { data, error } = await this.supabase
        .from('budgets')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', budgetId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating budget:', error);
      throw error;
    }
  }

  // Delete budget
  async deleteBudget(budgetId, userId) {
    try {
      const { error } = await this.supabase
        .from('budgets')
        .update({ is_active: false })
        .eq('id', budgetId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting budget:', error);
      throw error;
    }
  }
}

module.exports = BudgetService;

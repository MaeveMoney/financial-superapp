const express = require('express');
const BudgetService = require('../services/budget');
const router = express.Router();

const budgetService = new BudgetService();

// Get all categories (predefined + custom) for user
router.get('/user/:userId/categories', async (req, res) => {
  try {
    const { userId } = req.params;
    const categories = await budgetService.getAllCategories(userId);
    
    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      details: error.message
    });
  }
});

// Create custom category
router.post('/user/:userId/categories', async (req, res) => {
  try {
    const { userId } = req.params;
    const categoryData = req.body;
    
    const category = await budgetService.createCustomCategory(userId, categoryData);
    
    res.json({
      success: true,
      category: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
      details: error.message
    });
  }
});

// Get spending insights for budget suggestions
router.get('/user/:userId/insights', async (req, res) => {
  try {
    const { userId } = req.params;
    const { months = 3 } = req.query;
    
    const insights = await budgetService.getSpendingInsights(userId, parseInt(months));
    
    res.json({
      success: true,
      insights: insights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get spending insights',
      details: error.message
    });
  }
});

// Create budget
router.post('/user/:userId/budgets', async (req, res) => {
  try {
    const { userId } = req.params;
    const budgetData = req.body;
    
    const budget = await budgetService.createBudget(userId, budgetData);
    
    res.json({
      success: true,
      budget: budget
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create budget',
      details: error.message
    });
  }
});

// Get user's budgets
router.get('/user/:userId/budgets', async (req, res) => {
  try {
    const { userId } = req.params;
    const budgets = await budgetService.getUserBudgets(userId);
    
    res.json({
      success: true,
      budgets: budgets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budgets',
      details: error.message
    });
  }
});

// Update budget
router.put('/budget/:budgetId', async (req, res) => {
  try {
    const { budgetId } = req.params;
    const { userId, ...updateData } = req.body;
    
    const budget = await budgetService.updateBudget(budgetId, userId, updateData);
    
    res.json({
      success: true,
      budget: budget
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update budget',
      details: error.message
    });
  }
});

// Delete budget
router.delete('/budget/:budgetId', async (req, res) => {
  try {
    const { budgetId } = req.params;
    const { userId } = req.body;
    
    const result = await budgetService.deleteBudget(budgetId, userId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete budget',
      details: error.message
    });
  }
});

module.exports = router;

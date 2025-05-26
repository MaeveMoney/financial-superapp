import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Badge,
  Button,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Alert,
  AlertIcon,
  Divider,
  Flex,
  IconButton
} from '@chakra-ui/react';
import { SearchIcon, EditIcon } from '@chakra-ui/icons';
import axios from 'axios';

const TransactionList = ({ userId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingCategory, setEditingCategory] = useState(null);

  const API_BASE = 'https://financial-superapp-production.up.railway.app/api';

  const categories = [
    'Food & Dining', 'Shopping', 'Transportation', 'Entertainment',
    'Healthcare', 'Services', 'Income', 'Transfer', 'Fees', 'Other'
  ];

  useEffect(() => {
    if (userId) {
      fetchTransactions();
    }
  }, [userId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/plaid/user/${userId}/transactions`);
      setTransactions(response.data.transactions);
    } catch (error) {
      setError('Failed to load transactions');
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (transactionId, newCategory) => {
    try {
      await axios.put(`${API_BASE}/plaid/transaction/${transactionId}/category`, {
        category: newCategory,
        subcategory: newCategory
      });
      
      // Update local state
      setTransactions(prev => prev.map(txn => 
        txn.id === transactionId 
          ? { ...txn, category: newCategory, subcategory: newCategory }
          : txn
      ));
      
      setEditingCategory(null);
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAmountColor = (amount) => {
    return amount > 0 ? 'green.500' : 'red.500';
  };

  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch = txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         txn.merchant_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || txn.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" color="brand.500" />
        <Text>Loading your transactions...</Text>
      </VStack>
    );
  }

  if (error) {

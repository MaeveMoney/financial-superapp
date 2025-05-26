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
    return (
      <Alert status="error">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        <HStack spacing={4}>
          <Text fontSize="xl" fontWeight="bold">
            Your Transactions
          </Text>
          <Badge colorScheme="blue" px={2} py={1}>
            {filteredTransactions.length} transactions
          </Badge>
        </HStack>

        {/* Filters */}
        <HStack spacing={4}>
          <InputGroup maxW="300px">
            <InputLeftElement>
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          
          <Select
            maxW="200px"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
        </HStack>

        {/* Transaction List */}
        <VStack spacing={3} align="stretch">
          {filteredTransactions.map((transaction, index) => (
            <Card key={transaction.id} size="sm">
              <CardBody>
                <Flex justify="space-between" align="center">
                  <HStack spacing={3} flex={1}>
                    <VStack align="start" spacing={1} flex={1}>
                      <Text fontWeight="semibold" fontSize="sm">
                        {transaction.description}
                      </Text>
                      {transaction.merchant_name && (
                        <Text fontSize="xs" color="gray.500">
                          {transaction.merchant_name}
                        </Text>
                      )}
                      <HStack spacing={2}>
                        {editingCategory === transaction.id ? (
                          <Select
                            size="xs"
                            value={transaction.category}
                            onChange={(e) => updateCategory(transaction.id, e.target.value)}
                            onBlur={() => setEditingCategory(null)}
                            autoFocus
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </Select>
                        ) : (
                          <Badge 
                            size="sm" 
                            colorScheme="blue"
                            cursor="pointer"
                            onClick={() => setEditingCategory(transaction.id)}
                          >
                            {transaction.category || 'Other'}
                          </Badge>
                        )}
                        <IconButton
                          size="xs"
                          variant="ghost"
                          icon={<EditIcon />}
                          onClick={() => setEditingCategory(transaction.id)}
                        />
                      </HStack>
                    </VStack>
                    
                    <VStack align="end" spacing={1}>
                      <Text
                        fontWeight="bold"
                        color={getAmountColor(transaction.amount)}
                        fontSize="sm"
                      >
                        {transaction.amount > 0 ? '+' : '-'}{formatAmount(transaction.amount)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatDate(transaction.date)}
                      </Text>
                      <Badge size="xs" variant="outline">
                        {transaction.user_accounts?.account_name}
                      </Badge>
                    </VStack>
                  </HStack>
                </Flex>
              </CardBody>
            </Card>
          ))}
          
          {filteredTransactions.length === 0 && (
            <Card>
              <CardBody>
                <Text textAlign="center" color="gray.500" py={8}>
                  {searchTerm || categoryFilter !== 'all' 
                    ? 'No transactions match your filters'
                    : 'No transactions found'
                  }
                </Text>
              </CardBody>
            </Card>
          )}
        </VStack>

        {filteredTransactions.length > 0 && (
          <Button variant="outline" onClick={fetchTransactions}>
            Load More Transactions
          </Button>
        )}
      </VStack>
    </Box>
  );
};

export default TransactionList;

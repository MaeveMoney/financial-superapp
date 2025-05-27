import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Progress,
  Badge,
  Button,
  SimpleGrid,
  Alert,
  AlertIcon,
  Spinner,
  IconButton,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, MoreVerticalIcon } from '@chakra-ui/icons';
import axios from 'axios';
import BudgetCreation from './BudgetCreation';

const BudgetDashboard = ({ userId }) => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingBudget, setEditingBudget] = useState(null);
  const [showCreateBudget, setShowCreateBudget] = useState(false);

  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();

  const API_BASE = 'https://financial-superapp-production.up.railway.app/api';

  useEffect(() => {
    if (userId) {
      fetchBudgets();
    }
  }, [userId]);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/budget/user/${userId}/budgets`);
      setBudgets(response.data.budgets);
    } catch (error) {
      setError('Failed to load budgets');
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditBudget = (budget) => {
    setEditingBudget({
      ...budget,
      amount: budget.amount.toString(),
      alert_threshold: budget.alert_threshold.toString()
    });
    onEditModalOpen();
  };

  const handleUpdateBudget = async () => {
    try {
      await axios.put(`${API_BASE}/budget/budget/${editingBudget.id}`, {
        userId,
        ...editingBudget,
        amount: parseFloat(editingBudget.amount),
        alert_threshold: parseFloat(editingBudget.alert_threshold)
      });

      await fetchBudgets();
      onEditModalClose();
      setEditingBudget(null);
    } catch (error) {
      setError('Failed to update budget');
      console.error('Error updating budget:', error);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/budget/budget/${budgetId}`, {
        data: { userId }
      });
      await fetchBudgets();
    } catch (error) {
      setError('Failed to delete budget');
      console.error('Error deleting budget:', error);
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'yellow';
    return 'green';
  };

  const getStatusBadge = (budget) => {
    if (budget.is_over_budget) {
      return <Badge colorScheme="red">Over Budget</Badge>;
    }
    if (budget.is_near_limit) {
      return <Badge colorScheme="yellow">Near Limit</Badge>;
    }
    return <Badge colorScheme="green">On Track</Badge>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
  };

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" color="brand.500" />
        <Text>Loading your budgets...</Text>
      </VStack>
    );
  }

  if (showCreateBudget) {
    return (
      <VStack spacing={6}>
        <HStack justify="space-between" w="full">
          <Text fontSize="2xl" fontWeight="bold">Create New Budget</Text>
          <Button variant="ghost" onClick={() => setShowCreateBudget(false)}>
            Back to Budgets
          </Button>
        </HStack>
        <BudgetCreation 
          userId={userId} 
          onBudgetCreated={() => {
            setShowCreateBudget(false);
            fetchBudgets();
          }}
        />
      </VStack>
    );
  }

  return (
    <Box maxW="6xl" mx="auto">
      <VStack spacing={8} align="stretch">
        <HStack justify="space-between">
          <VStack align="start" spacing={1}>
            <Text fontSize="2xl" fontWeight="bold">Your Budgets</Text>
            <Text color="gray.600">Track and manage your spending limits</Text>
          </VStack>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="brand"
            onClick={() => setShowCreateBudget(true)}
          >
            Create Budget
          </Button>
        </HStack>

        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {budgets.length === 0 ? (
          <Card>
            <CardBody>
              <VStack spacing={4} py={8}>
                <Text fontSize="lg" color="gray.500">No budgets created yet</Text>
                <Text color="gray.400" textAlign="center">
                  Create your first budget to start tracking your spending limits and reach your financial goals.
                </Text>
                <Button
                  colorScheme="brand"
                  leftIcon={<AddIcon />}
                  onClick={() => setShowCreateBudget(true)}
                >
                  Create Your First Budget
                </Button>
              </VStack>
            </CardBody>
          </Card>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {budgets.map((budget) => (
              <Card key={budget.id} position="relative">
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" fontSize="lg">{budget.name}</Text>
                        <Text fontSize="sm" color="gray.600">{budget.category_name}</Text>
                      </VStack>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<MoreVerticalIcon />}
                          variant="ghost"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem icon={<EditIcon />} onClick={() => handleEditBudget(budget)}>
                            Edit Budget
                          </MenuItem>
                          <MenuItem 
                            icon={<DeleteIcon />} 
                            onClick={() => handleDeleteBudget(budget.id)}
                            color="red.600"
                          >
                            Delete Budget
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </HStack>

                    <VStack spacing={2} align="stretch">
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Spent</Text>
                        <Text fontSize="sm" fontWeight="semibold">
                          {formatCurrency(budget.spent_amount)} of {formatCurrency(budget.amount)}
                        </Text>
                      </HStack>
                      
                      <Progress
                        value={budget.percentage_used}
                        colorScheme={getProgressColor(budget.percentage_used)}
                        size="md"
                        borderRadius="md"
                      />
                      
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.500">
                          {budget.percentage_used.toFixed(1)}% used
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {formatCurrency(budget.remaining_amount)} left
                        </Text>
                      </HStack>
                    </VStack>

                    <HStack justify="space-between" align="center">
                      {getStatusBadge(budget)}
                      <Badge variant="outline" colorScheme="blue">
                        {budget.budget_type}
                      </Badge>
                    </HStack>

                    <VStack spacing={1} align="start">
                      <Text fontSize="xs" color="gray.500">
                        Period: {formatDateRange(budget.period_start, budget.period_end)}
                      </Text>
                      {budget.auto_renew && (
                        <Text fontSize="xs" color="green.500">Auto-renewing</Text>
                      )}
                    </VStack>

                    {budget.notes && (
                      <Text fontSize="sm" color="gray.600" fontStyle="italic">
                        "{budget.notes}"
                      </Text>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Edit Budget Modal */}
        <Modal isOpen={isEditModalOpen} onClose={onEditModalClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit Budget</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              {editingBudget && (
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel>Budget Name</FormLabel>
                    <Input
                      value={editingBudget.name}
                      onChange={(e) => setEditingBudget(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Budget Amount (CAD)</FormLabel>
                    <NumberInput>
                      <NumberInputField
                        value={editingBudget.amount}
                        onChange={(e) => setEditingBudget(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Alert Threshold (%)</FormLabel>
                    <NumberInput min={50} max={100}>
                      <NumberInputField
                        value={editingBudget.alert_threshold}
                        onChange={(e) => setEditingBudget(prev => ({ ...prev, alert_threshold: e.target.value }))}
                      />
                    </NumberInput>
                  </FormControl>

                  <HStack w="full" justify="end" spacing={3}>
                    <Button variant="ghost" onClick={onEditModalClose}>
                      Cancel
                    </Button>
                    <Button colorScheme="brand" onClick={handleUpdateBudget}>
                      Update Budget
                    </Button>
                  </HStack>
                </VStack>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </VStack>
    </Box>
  );
};

export default BudgetDashboard;

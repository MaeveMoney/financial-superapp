import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Select,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  Card,
  CardBody,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Alert,
  AlertIcon,
  Textarea,
  SimpleGrid,
  Spinner,
  IconButton,
  Tooltip,
  Switch,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel
} from '@chakra-ui/react';
import { AddIcon, InfoIcon } from '@chakra-ui/icons';
import axios from 'axios';

const BudgetCreation = ({ userId, onBudgetCreated }) => {
  const [categories, setCategories] = useState({ predefined: [], custom: [], all: [] });
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Budget form state
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    category_name: '',
    budget_type: 'monthly',
    amount: '',
    period_start: new Date().toISOString().split('T')[0],
    period_end: '',
    auto_renew: true,
    rollover_unused: false,
    alert_threshold: 80,
    notes: ''
  });

  // Custom category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: '#3182ce',
    icon: 'tag',
    is_income: false,
    parent_category: ''
  });

  const { isOpen: isCategoryModalOpen, onOpen: onCategoryModalOpen, onClose: onCategoryModalClose } = useDisclosure();
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = 'https://financial-superapp-production.up.railway.app/api';

  const budgetTypes = [
    { value: 'monthly', label: 'Monthly Budget', description: 'Recurring monthly spending limit' },
    { value: 'weekly', label: 'Weekly Budget', description: 'Recurring weekly spending limit' },
    { value: 'annual', label: 'Annual Budget', description: 'Yearly spending budget (taxes, insurance)' },
    { value: 'goal', label: 'Savings Goal', description: 'Save towards a specific target' }
  ];

  const categoryIcons = [
    'tag', 'dollar-sign', 'shopping-bag', 'car', 'utensils', 'film', 
    'heart', 'home', 'phone', 'wifi', 'zap', 'book', 'gift'
  ];

  const categoryColors = [
    '#e53e3e', '#d69e2e', '#3182ce', '#805ad5', '#38a169', 
    '#319795', '#e2e8f0', '#a0aec0', '#f56565', '#ed64a6'
  ];

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  useEffect(() => {
    // Auto-calculate period end based on budget type
    if (budgetForm.period_start && budgetForm.budget_type) {
      const startDate = new Date(budgetForm.period_start);
      let endDate = new Date(startDate);

      switch (budgetForm.budget_type) {
        case 'weekly':
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'monthly':
          endDate.setMonth(startDate.getMonth() + 1);
          endDate.setDate(startDate.getDate() - 1);
          break;
        case 'annual':
          endDate.setFullYear(startDate.getFullYear() + 1);
          endDate.setDate(startDate.getDate() - 1);
          break;
        default:
          endDate.setMonth(startDate.getMonth() + 1);
      }

      setBudgetForm(prev => ({
        ...prev,
        period_end: endDate.toISOString().split('T')[0]
      }));
    }
  }, [budgetForm.period_start, budgetForm.budget_type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories and insights in parallel
      const [categoriesResponse, insightsResponse] = await Promise.all([
        axios.get(`${API_BASE}/budget/user/${userId}/categories`),
        axios.get(`${API_BASE}/budget/user/${userId}/insights`)
      ]);

      setCategories(categoriesResponse.data.categories);
      setInsights(insightsResponse.data.insights);
    } catch (error) {
      setError('Failed to load budget data');
      console.error('Error fetching budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      setSubmitting(true);
      const response = await axios.post(`${API_BASE}/budget/user/${userId}/categories`, categoryForm);
      
      // Refresh categories
      await fetchData();
      
      // Reset form and close modal
      setCategoryForm({
        name: '',
        description: '',
        color: '#3182ce',
        icon: 'tag',
        is_income: false,
        parent_category: ''
      });
      onCategoryModalClose();
    } catch (error) {
      setError('Failed to create category');
      console.error('Error creating category:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBudget = async () => {
    try {
      setSubmitting(true);
      
      if (!budgetForm.name || !budgetForm.category_name || !budgetForm.amount) {
        setError('Please fill in all required fields');
        return;
      }

      const budgetData = {
        ...budgetForm,
        amount: parseFloat(budgetForm.amount),
        alert_threshold: parseFloat(budgetForm.alert_threshold)
      };

      const response = await axios.post(`${API_BASE}/budget/user/${userId}/budgets`, budgetData);
      
      // Reset form
      setBudgetForm({
        name: '',
        category_name: '',
        budget_type: 'monthly',
        amount: '',
        period_start: new Date().toISOString().split('T')[0],
        period_end: '',
        auto_renew: true,
        rollover_unused: false,
        alert_threshold: 80,
        notes: ''
      });

      if (onBudgetCreated) {
        onBudgetCreated(response.data.budget);
      }
    } catch (error) {
      setError('Failed to create budget');
      console.error('Error creating budget:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const applySuggestedBudget = (suggestion) => {
    setBudgetForm(prev => ({
      ...prev,
      name: `${suggestion.category} Budget`,
      category_name: suggestion.category,
      amount: suggestion.suggested_budget.toString()
    }));
  };

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" color="brand.500" />
        <Text>Loading budget data...</Text>
      </VStack>
    );
  }

  return (
    <Box maxW="4xl" mx="auto">
      <VStack spacing={8} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">Create New Budget</Text>

        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <Tabs variant="enclosed" colorScheme="brand">
          <TabList>
            <Tab>Quick Budget</Tab>
            <Tab>Smart Suggestions</Tab>
            <Tab>Advanced Budget</Tab>
          </TabList>

          <TabPanels>
            {/* Quick Budget Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Text fontSize="lg" fontWeight="semibold">Create a Simple Budget</Text>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <FormControl isRequired>
                    <FormLabel>Budget Name</FormLabel>
                    <Input
                      value={budgetForm.name}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Grocery Budget, Gas Money"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Category</FormLabel>
                    <HStack>
                      <Select
                        value={budgetForm.category_name}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, category_name: e.target.value }))}
                        placeholder="Select category"
                      >
                        <optgroup label="Your Categories">
                          {categories.predefined.map((cat) => (
                            <option key={cat.name} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </optgroup>
                        {categories.custom.length > 0 && (
                          <optgroup label="Custom Categories">
                            {categories.custom.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                      <Tooltip label="Create new category">
                        <IconButton
                          icon={<AddIcon />}
                          onClick={onCategoryModalOpen}
                          colorScheme="brand"
                          variant="outline"
                          size="sm"
                        />
                      </Tooltip>
                    </HStack>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Budget Type</FormLabel>
                    <Select
                      value={budgetForm.budget_type}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, budget_type: e.target.value }))}
                    >
                      {budgetTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Budget Amount (CAD)</FormLabel>
                    <NumberInput min={0}>
                      <NumberInputField
                        value={budgetForm.amount}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </NumberInput>
                  </FormControl>
                </SimpleGrid>

                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>Auto-renew</FormLabel>
                    <Switch
                      isChecked={budgetForm.auto_renew}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, auto_renew: e.target.checked }))}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Alert at % spent</FormLabel>
                    <NumberInput min={50} max={100} value={budgetForm.alert_threshold}>
                      <NumberInputField
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, alert_threshold: e.target.value }))}
                      />
                    </NumberInput>
                  </FormControl>
                </HStack>

                <Button
                  colorScheme="brand"
                  size="lg"
                  onClick={handleCreateBudget}
                  isLoading={submitting}
                  loadingText="Creating budget..."
                >
                  Create Budget
                </Button>
              </VStack>
            </TabPanel>

            {/* Smart Suggestions Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <HStack>
                  <Text fontSize="lg" fontWeight="semibold">Budget Suggestions</Text>
                  <Tooltip label="Based on your last 3 months of spending">
                    <InfoIcon color="gray.500" />
                  </Tooltip>
                </HStack>

                {insights.length === 0 ? (
                  <Alert status="info">
                    <AlertIcon />
                    No spending history found. Connect more accounts or wait for transactions to build suggestions.
                  </Alert>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    {insights.slice(0, 8).map((suggestion, index) => (
                      <Card key={index} cursor="pointer" onClick={() => applySuggestedBudget(suggestion)}>
                        <CardBody>
                          <VStack align="start" spacing={2}>
                            <HStack justify="space-between" w="full">
                              <Text fontWeight="semibold">{suggestion.category}</Text>
                              <Badge colorScheme="blue">
                                ${suggestion.suggested_budget.toLocaleString()}
                              </Badge>
                            </HStack>
                            <Text fontSize="sm" color="gray.600">
                              Avg: ${suggestion.historical_average.toFixed(0)}/month
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {suggestion.transaction_count} transactions
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                )}

                {budgetForm.category_name && (
                  <Card bg="blue.50">
                    <CardBody>
                      <VStack spacing={4}>
                        <Text fontWeight="semibold">Selected Budget</Text>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} w="full">
                          <Input
                            value={budgetForm.name}
                            onChange={(e) => setBudgetForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Budget name"
                          />
                          <Text py={2}>{budgetForm.category_name}</Text>
                          <NumberInput>
                            <NumberInputField
                              value={budgetForm.amount}
                              onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                              placeholder="Amount"
                            />
                          </NumberInput>
                        </SimpleGrid>
                        <Button
                          colorScheme="brand"
                          onClick={handleCreateBudget}
                          isLoading={submitting}
                        >
                          Create This Budget
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>
                )}
              </VStack>
            </TabPanel>

            {/* Advanced Budget Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Text fontSize="lg" fontWeight="semibold">Advanced Budget Options</Text>
                
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <FormControl isRequired>
                    <FormLabel>Budget Name</FormLabel>
                    <Input
                      value={budgetForm.name}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Descriptive budget name"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Category</FormLabel>
                    <HStack>
                      <Select
                        value={budgetForm.category_name}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, category_name: e.target.value }))}
                        placeholder="Select category"
                      >
                        <optgroup label="Your Categories">
                          {categories.predefined.map((cat) => (
                            <option key={cat.name} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </optgroup>
                        {categories.custom.length > 0 && (
                          <optgroup label="Custom Categories">
                            {categories.custom.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                      <Tooltip label="Create new category">
                        <IconButton
                          icon={<AddIcon />}
                          onClick={onCategoryModalOpen}
                          colorScheme="brand"
                          variant="outline"
                          size="sm"
                        />
                      </Tooltip>
                    </HStack>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Budget Type</FormLabel>
                    <Select
                      value={budgetForm.budget_type}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, budget_type: e.target.value }))}
                    >
                      {budgetTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {budgetTypes.find(t => t.value === budgetForm.budget_type)?.description}
                    </Text>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Budget Amount (CAD)</FormLabel>
                    <NumberInput min={0}>
                      <NumberInputField
                        value={budgetForm.amount}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </NumberInput>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Start Date</FormLabel>
                    <Input
                      type="date"
                      value={budgetForm.period_start}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, period_start: e.target.value }))}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>End Date</FormLabel>
                    <Input
                      type="date"
                      value={budgetForm.period_end}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, period_end: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                  <FormControl>
                    <HStack>
                      <Switch
                        isChecked={budgetForm.auto_renew}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, auto_renew: e.target.checked }))}
                      />
                      <FormLabel mb={0}>Auto-renew budget</FormLabel>
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      Automatically create next period when this one ends
                    </Text>
                  </FormControl>

                  <FormControl>
                    <HStack>
                      <Switch
                        isChecked={budgetForm.rollover_unused}
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, rollover_unused: e.target.checked }))}
                      />
                      <FormLabel mb={0}>Rollover unused</FormLabel>
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      Add unspent money to next period
                    </Text>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Alert threshold (%)</FormLabel>
                    <NumberInput min={50} max={100} value={budgetForm.alert_threshold}>
                      <NumberInputField
                        onChange={(e) => setBudgetForm(prev => ({ ...prev, alert_threshold: e.target.value }))}
                      />
                    </NumberInput>
                    <Text fontSize="xs" color="gray.500">
                      Get notified when you've spent this percentage
                    </Text>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <Textarea
                    value={budgetForm.notes}
                    onChange={(e) => setBudgetForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes about this budget..."
                    rows={3}
                  />
                </FormControl>

                <Button
                  colorScheme="brand"
                  size="lg"
                  onClick={handleCreateBudget}
                  isLoading={submitting}
                  loadingText="Creating budget..."
                >
                  Create Advanced Budget
                </Button>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Custom Category Modal */}
        <Modal isOpen={isCategoryModalOpen} onClose={onCategoryModalClose} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Create Custom Category</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Category Name</FormLabel>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Pet Expenses, Gym Membership"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Input
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </FormControl>

                <SimpleGrid columns={2} spacing={4} w="full">
                  <FormControl>
                    <FormLabel>Color</FormLabel>
                    <HStack wrap="wrap">
                      {categoryColors.map((color) => (
                        <Box
                          key={color}
                          w={8}
                          h={8}
                          bg={color}
                          borderRadius="md"
                          cursor="pointer"
                          border={categoryForm.color === color ? '3px solid' : '1px solid'}
                          borderColor={categoryForm.color === color ? 'brand.500' : 'gray.200'}
                          onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </HStack>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Icon</FormLabel>
                    <Select
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, icon: e.target.value }))}
                    >
                      {categoryIcons.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon.replace('-', ' ')}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <HStack>
                    <Switch
                      isChecked={categoryForm.is_income}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, is_income: e.target.checked }))}
                    />
                    <FormLabel mb={0}>This is an income category</FormLabel>
                  </HStack>
                </FormControl>

                <HStack w="full" justify="end" spacing={3}>
                  <Button variant="ghost" onClick={onCategoryModalClose}>
                    Cancel
                  </Button>
                  <Button
                    colorScheme="brand"
                    onClick={handleCreateCategory}
                    isLoading={submitting}
                    isDisabled={!categoryForm.name}
                  >
                    Create Category
                  </Button>
                </HStack>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>
      </VStack>
    </Box>
  );
};

export default BudgetCreation;

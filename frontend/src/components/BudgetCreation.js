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
      se

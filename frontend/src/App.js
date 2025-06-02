// frontend/src/App.js

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  Spinner,
  VStack,
  HStack,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Flex,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  useDisclosure,
  useToast,
  InputGroup,
  InputLeftElement,
  Spacer,
} from '@chakra-ui/react';
import { AddIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { createClient } from '@supabase/supabase-js';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';
import dayjs from 'dayjs';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function App() {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. STATE DEFINITIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [linkToken, setLinkToken] = useState(null);

  // Filter / search / pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterRecurring, setFilterRecurring] = useState(''); // '', 'true', 'false'
  const [filterManual, setFilterManual] = useState('');       // '', 'true', 'false'
  const [startDate, setStartDate] = useState('');             // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');                 // YYYY-MM-DD
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Bulk action state
  const [selectedTxnIds, setSelectedTxnIds] = useState([]);
  const [bulkCategoryValue, setBulkCategoryValue] = useState('');

  // Custom category modal state
  const {
    isOpen: isCustomModalOpen,
    onOpen: openCustomModal,
    onClose: closeCustomModal,
  } = useDisclosure();
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryDescription, setCustomCategoryDescription] = useState('');
  const [customCategoryIsIncome, setCustomCategoryIsIncome] = useState(false);

  const toast = useToast();

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. INITIAL EFFECT — AUTH, SAVE USER, THEN FETCH EVERYTHING
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      console.log('🔄 Checking Supabase session...');
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const userId = session.user.id;
        console.log('✅ User is signed in:', session.user.email);
        setUser(session.user);

        // Save user to backend
        try {
          console.log('📡 Saving user to backend via /api/user/save');
          await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}/api/user/save`,
            {},
            {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }
          );
          console.log('✅ User saved to backend');
        } catch (err) {
          console.error('❌ Failed to save user:', err);
        }

        // Fetch accounts, categories, and linkToken; fetch transactions AFTER fetching those
        await Promise.all([
          fetchLinkToken(userId),
          fetchCategories(userId),
          fetchAccounts(userId),
        ]);
        await fetchTransactions(userId);
      } else {
        console.log('ℹ️ No user session found');
      }
      setLoading(false);
    };

    init();

    // Listen for auth‐state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. FETCH PLAID LINK TOKEN
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchLinkToken = async (userId) => {
    try {
      console.log('📡 Fetching link token for userId=', userId);
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/create_link_token`,
        { userId },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      console.log('🔄 Link token received:', response.data.link_token);
      setLinkToken(response.data.link_token);
    } catch (error) {
      console.error('❌ Error creating Plaid link token:', error);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. FETCH CATEGORIES (PREDEFINED + CUSTOM)
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchCategories = async (userId) => {
    try {
      console.log(`📡 Fetching categories for userId=${userId}`);
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/budget/user/${userId}/categories`
      );
      const allCats = data.categories.all || [];
      setCategories(allCats);
      console.log('📂 Categories:', allCats);
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. FETCH ACCOUNTS
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchAccounts = async (userId) => {
    try {
      console.log(`📡 Fetching accounts for userId=${userId}`);
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${userId}/accounts`
      );
      setAccounts(data.accounts);
      console.log('🗄️ Accounts:', data.accounts);
    } catch (error) {
      console.error('❌ Error fetching accounts:', error);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. FETCH TRANSACTIONS WITH FILTERS / PAGINATION
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(
    async (userId) => {
      try {
        console.log(`📡 Fetching transactions for userId=${userId}`);
        // Build query params string
        const params = new URLSearchParams();
        params.set('limit', limit);
        params.set('offset', offset);
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (searchTerm) params.set('search', searchTerm);
        if (filterCategory) params.set('category', filterCategory);
        if (filterRecurring) params.set('recurring', filterRecurring);
        if (filterManual) params.set('is_manual', filterManual);

        const url = `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${userId}/transactions?${params.toString()}`;
        console.log('   URL:', url);

        const { data } = await axios.get(url);
        setTransactions(data.transactions);
        console.log('🧾 Transactions:', data.transactions);
      } catch (error) {
        console.error('❌ Error fetching transactions:', error);
      }
    },
    [limit, offset, startDate, endDate, searchTerm, filterCategory, filterRecurring, filterManual]
  );

  // Whenever filter/pagination changes, re‐fetch transactions
  useEffect(() => {
    if (user) {
      fetchTransactions(user.id);
    }
  }, [fetchTransactions, user]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. PLAID LINK HOOK (UNCHANGED)
  // ─────────────────────────────────────────────────────────────────────────────
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      try {
        console.log('🔄 Exchanging public token for access token');
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/plaid/exchange_public_token`,
          { public_token },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        console.log('✅ Plaid exchange succeeded');
        toast({
          title: 'Account linked!',
          description: 'Your financial data has been imported.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        // Re‐fetch accounts, categories, and transactions
        const userId = session.user.id;
        await Promise.all([
          fetchAccounts(userId),
          fetchCategories(userId),
        ]);
        await fetchTransactions(userId);
      } catch (err) {
        console.error('❌ Token exchange error:', err);
        toast({
          title: 'Something went wrong.',
          description: 'Failed to link your account.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. SIGN IN / SIGN OUT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  const signIn = async () => {
    console.log('🔄 Signing in with Google...');
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signOut = async () => {
    console.log('🔄 Signing out...');
    await supabase.auth.signOut();
    // Clear all local state
    setUser(null);
    setAccounts([]);
    setTransactions([]);
    setCategories([]);
    setLinkToken(null);
    setSearchTerm('');
    setFilterCategory('');
    setFilterRecurring('');
    setFilterManual('');
    setStartDate('');
    setEndDate('');
    setOffset(0);
    setSelectedTxnIds([]);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. HANDLE SINGLE TRANSACTION CATEGORY CHANGE
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCategoryChange = async (transactionId, newCategory) => {
    try {
      console.log(
        `🔄 Updating txn ${transactionId} → category="${newCategory}"`
      );
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/transaction/${transactionId}/category`,
        { category: newCategory, subcategory: null }
      );
      toast({
        title: 'Category updated',
        description: `Transaction categorized as "${newCategory}"`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await fetchTransactions(user.id);
    } catch (error) {
      console.error('❌ Error updating category:', error);
      toast({
        title: 'Failed to update category',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. HANDLE BULK CATEGORY UPDATE
  // ─────────────────────────────────────────────────────────────────────────────
  const handleBulkCategoryUpdate = async () => {
    if (selectedTxnIds.length === 0 || !bulkCategoryValue) {
      toast({
        title: 'Please select transactions and a category',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    try {
      console.log(
        `🔄 Bulk updating ${selectedTxnIds.length} txn(s) → category="${bulkCategoryValue}"`
      );
      const payload = {
        transactionIds: selectedTxnIds,
        category: bulkCategoryValue,
        subcategory: null,
      };
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${user.id}/transactions/bulk-category`,
        payload
      );
      console.log('✅ Bulk update response:', res.data);
      toast({
        title: 'Bulk update successful',
        description: `Updated ${res.data.updatedCount} transactions.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Clear selection & category dropdown
      setSelectedTxnIds([]);
      setBulkCategoryValue('');
      await fetchTransactions(user.id);
    } catch (error) {
      console.error('❌ Bulk update error:', error);
      toast({
        title: 'Bulk update failed',
        description: 'Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. HANDLE RECURRING / MANUAL TOGGLES
  // ─────────────────────────────────────────────────────────────────────────────
  const handleRecurringToggle = async (transactionId, newValue) => {
    try {
      console.log(`🔄 Toggling is_recurring for ${transactionId} → ${newValue}`);
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/transaction/${transactionId}/recurring`,
        { is_recurring: newValue }
      );
      toast({
        title: newValue ? 'Marked as recurring' : 'Unmarked recurring',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
      await fetchTransactions(user.id);
    } catch (error) {
      console.error('❌ Error toggling recurring:', error);
      toast({
        title: 'Failed to toggle recurring',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleManualToggle = async (transactionId, newValue) => {
    try {
      console.log(`🔄 Toggling is_manual for ${transactionId} → ${newValue}`);
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/transaction/${transactionId}/manual`,
        { is_manual: newValue }
      );
      toast({
        title: newValue ? 'Marked as manual' : 'Unmarked manual',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
      await fetchTransactions(user.id);
    } catch (error) {
      console.error('❌ Error toggling manual:', error);
      toast({
        title: 'Failed to toggle manual',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. HANDLE TRANSACTION CHECKBOXES (BULK SELECT)
  // ─────────────────────────────────────────────────────────────────────────────
  const toggleTransactionSelection = (transactionId) => {
    setSelectedTxnIds((prev) => {
      if (prev.includes(transactionId)) {
        return prev.filter((id) => id !== transactionId);
      } else {
        return [...prev, transactionId];
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. HANDLE “ADD CUSTOM CATEGORY” SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCreateCustomCategory = async () => {
    if (!customCategoryName.trim()) {
      toast({
        title: 'Category name is required',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    try {
      console.log(
        `🔄 Creating custom category "${customCategoryName}" for user ${user.id}`
      );
      const payload = {
        name: customCategoryName,
        description: customCategoryDescription,
        color: '#3182ce',        // default color
        icon: 'tag',            // default icon
        is_income: customCategoryIsIncome,
        parent_category: null,  // no parent by default
      };
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/budget/user/${user.id}/categories`,
        payload
      );
      toast({
        title: 'Custom category created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Close modal & reset fields
      closeCustomModal();
      setCustomCategoryName('');
      setCustomCategoryDescription('');
      setCustomCategoryIsIncome(false);
      // Re-fetch categories
      await fetchCategories(user.id);
    } catch (error) {
      console.error('❌ Error creating custom category:', error);
      toast({
        title: 'Failed to create category',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. LOADING SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container centerContent py={20}>
        <Spinner size="xl" />
      </Container>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. SIGN-IN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <Container maxW="4xl" py={20}>
        <VStack spacing={8} textAlign="center">
          <Heading size="2xl">Financial SuperApp</Heading>
          <Text fontSize="lg" color="gray.600">
            Sign in with Google to begin managing your finances
          </Text>
          <Button colorScheme="blue" size="lg" onClick={signIn}>
            Sign in with Google
          </Button>
        </VStack>
      </Container>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. DASHBOARD (SIGNED-IN)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Container maxW="6xl" py={10}>
      <VStack spacing={8} align="stretch">

        {/* 16.1. SIGN OUT BUTTON */}
        <Box textAlign="right">
          <Button colorScheme="red" onClick={signOut}>
            Sign Out
          </Button>
        </Box>

        {/* 16.2. WELCOME HEADER */}
        <Heading size="xl">Welcome, {user.email}</Heading>

        {/* 16.3. PLAID “Connect Bank Account” BUTTON */}
        {linkToken && ready && (
          <Button colorScheme="green" onClick={open}>
            Connect Bank Account
          </Button>
        )}

        {/* 16.4. ACCOUNTS TABLE */}
        <Box>
          <Heading size="lg" mb={4}>
            Linked Accounts
          </Heading>
          {accounts.length === 0 ? (
            <Text>No bank accounts linked yet.</Text>
          ) : (
            <Table variant="striped" size="sm">
              <Thead>
                <Tr>
                  <Th>Account Name</Th>
                  <Th>Type</Th>
                  <Th isNumeric>Balance</Th>
                  <Th>Currency</Th>
                  <Th>Last Synced</Th>
                </Tr>
              </Thead>
              <Tbody>
                {accounts.map((acct) => (
                  <Tr key={acct.id}>
                    <Td>{acct.account_name}</Td>
                    <Td>{acct.account_type}</Td>
                    <Td isNumeric>
                      {parseFloat(acct.balance).toFixed(2)}
                    </Td>
                    <Td>{acct.currency}</Td>
                    <Td>
                      {new Date(acct.last_synced_at).toLocaleString()}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        {/* 16.5. FILTERS & SEARCH */}
        <Box>
          <Heading size="lg" mb={4}>
            Recent Transactions
          </Heading>

          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              {/* Search by description or merchant */}
              <InputGroup>
                <InputLeftElement
                  pointerEvents="none"
                  children={<Text color="gray.500">🔍</Text>}
                />
                <Input
                  placeholder="Search description or merchant"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setOffset(0); // reset pagination
                  }}
                />
              </InputGroup>

              {/* Category filter */}
              <Select
                placeholder="All categories"
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setOffset(0);
                }}
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </Select>

              {/* Recurring filter */}
              <Select
                placeholder="Recurring?"
                value={filterRecurring}
                onChange={(e) => {
                  setFilterRecurring(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>

              {/* Manual filter */}
              <Select
                placeholder="Manual?"
                value={filterManual}
                onChange={(e) => {
                  setFilterManual(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </HStack>

            <HStack spacing={4}>
              {/* Date range */}
              <FormControl maxW="200px">
                <FormLabel>Start Date</FormLabel>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setOffset(0);
                  }}
                  max={dayjs().format('YYYY-MM-DD')}
                />
              </FormControl>
              <FormControl maxW="200px">
                <FormLabel>End Date</FormLabel>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setOffset(0);
                  }}
                  max={dayjs().format('YYYY-MM-DD')}
                />
              </FormControl>

              <Spacer />

              {/* “Add Custom Category” Button */}
              <Button
                leftIcon={<AddIcon />}
                colorScheme="blue"
                onClick={openCustomModal}
              >
                Add Custom Category
              </Button>
            </HStack>
          </VStack>
        </Box>

        {/* 16.6. BULK ACTION BAR (Visible when ≥1 txn selected) */}
        {selectedTxnIds.length > 0 && (
          <Flex
            p={4}
            bg="gray.50"
            borderRadius="md"
            align="center"
            mb={4}
          >
            <Text>
              {selectedTxnIds.length} selected
            </Text>
            <Spacer />
            <Select
              placeholder="Select category..."
              w="200px"
              value={bulkCategoryValue}
              onChange={(e) => setBulkCategoryValue(e.target.value)}
            >
              {categories.map((cat, idx) => (
                <option key={idx} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </Select>
            <Button
              ml={2}
              colorScheme="green"
              onClick={handleBulkCategoryUpdate}
            >
              Apply to Selected
            </Button>
          </Flex>
        )}

        {/* 16.7. TRANSACTIONS TABLE */}
        <Box overflowX="auto">
          {transactions.length === 0 ? (
            <Text>No transactions match your criteria.</Text>
          ) : (
            <Table variant="striped" size="sm">
              <Thead>
                <Tr>
                  <Th>
                    <Checkbox
                      isChecked={
                        selectedTxnIds.length === transactions.length
                      }
                      isIndeterminate={
                        selectedTxnIds.length > 0 &&
                        selectedTxnIds.length < transactions.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTxnIds(
                            transactions.map((t) => t.transaction_id)
                          );
                        } else {
                          setSelectedTxnIds([]);
                        }
                      }}
                    />
                  </Th>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Account</Th>
                  <Th>Amount</Th>
                  <Th>Category</Th>
                  <Th>Recurring</Th>
                  <Th>Manual</Th>
                </Tr>
              </Thead>
              <Tbody>
                {transactions.map((txn) => (
                  <Tr key={txn.transaction_id}>
                    {/* Bulk‐select checkbox */}
                    <Td>
                      <Checkbox
                        isChecked={selectedTxnIds.includes(txn.transaction_id)}
                        onChange={() =>
                          toggleTransactionSelection(txn.transaction_id)
                        }
                      />
                    </Td>
                    <Td>{dayjs(txn.date).format('YYYY-MM-DD')}</Td>
                    <Td>{txn.description}</Td>
                    <Td>{txn.user_accounts.account_name}</Td>
                    <Td isNumeric>{parseFloat(txn.amount).toFixed(2)}</Td>

                    {/* Single‐row category dropdown */}
                    <Td>
                      <Select
                        size="sm"
                        placeholder="Uncategorized"
                        value={txn.category || ''}
                        onChange={(e) =>
                          handleCategoryChange(
                            txn.transaction_id,
                            e.target.value
                          )
                        }
                      >
                        {categories.map((cat, idx) => (
                          <option key={idx} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </Select>
                    </Td>

                    {/* Recurring toggle */}
                    <Td>
                      <Checkbox
                        isChecked={txn.is_recurring}
                        onChange={(e) =>
                          handleRecurringToggle(
                            txn.transaction_id,
                            e.target.checked
                          )
                        }
                      />
                    </Td>

                    {/* Manual toggle */}
                    <Td>
                      <Checkbox
                        isChecked={txn.is_manual}
                        onChange={(e) =>
                          handleManualToggle(
                            txn.transaction_id,
                            e.target.checked
                          )
                        }
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>

        {/* 16.8. PAGINATION CONTROLS */}
        {transactions.length > 0 && (
          <Flex align="center" mt={4}>
            <IconButton
              aria-label="Previous"
              icon={<ChevronLeftIcon />}
              onClick={() => setOffset((prev) => Math.max(prev - limit, 0))}
              isDisabled={offset === 0}
            />
            <Text mx={4}>
              Page {Math.floor(offset / limit) + 1}
            </Text>
            <IconButton
              aria-label="Next"
              icon={<ChevronRightIcon />}
              onClick={() =>
                setOffset((prev) => prev + limit)
              }
              isDisabled={transactions.length < limit}
            />
          </Flex>
        )}
      </VStack>

      {/* ───────────────────────────────────────────────────────────────────────────
        CUSTOM CATEGORY MODAL
      ─────────────────────────────────────────────────────────────────────────── */}
      <Modal isOpen={isCustomModalOpen} onClose={closeCustomModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Custom Category</ModalHeader>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Category Name</FormLabel>
                <Input
                  value={customCategoryName}
                  onChange={(e) =>
                    setCustomCategoryName(e.target.value)
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  value={customCategoryDescription}
                  onChange={(e) =>
                    setCustomCategoryDescription(e.target.value)
                  }
                />
              </FormControl>
              <FormControl>
                <Checkbox
                  isChecked={customCategoryIsIncome}
                  onChange={(e) =>
                    setCustomCategoryIsIncome(e.target.checked)
                  }
                >
                  Is Income?
                </Checkbox>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={closeCustomModal}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleCreateCustomCategory}>
              Create Category
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}

export default App;

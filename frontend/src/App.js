// frontend/src/App.js

import React, { useEffect, useState } from 'react';
import {
  Container,
  VStack,
  Button,
  Heading,
  Text,
  Spinner,
  useToast,
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Select,
  TableCaption,
} from '@chakra-ui/react';
import { createClient } from '@supabase/supabase-js';
import { usePlaidLink } from 'react-plaid-link';
import axios from 'axios';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);       // <— Will hold all categories
  const [linkToken, setLinkToken] = useState(null);

  const toast = useToast();

  // ---------------------------------------------------
  // 1. INITIAL EFFECT: load session, save user, then fetch everything
  // ---------------------------------------------------
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
          console.error('❌ Error saving user:', err);
        }

        // Fetch accounts, transactions, categories, and Plaid link token in parallel
        await Promise.all([
          fetchAccounts(userId),
          fetchTransactions(userId),
          fetchCategories(userId),
          fetchLinkToken(userId),
        ]);
      } else {
        console.log('ℹ️ No user session found');
      }
      setLoading(false);
    };

    init();

    // Listen for auth-state changes (e.g., sign‐in or sign‐out)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ---------------------------------------------------
  // 2. FETCH PLAID LINK TOKEN
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // 3. FETCH LINKED ACCOUNTS
  // ---------------------------------------------------
  const fetchAccounts = async (userId) => {
    try {
      console.log(`📡 Fetching accounts for userId=${userId}`);
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${userId}/accounts`
      );
      console.log('🗄️ Accounts:', data.accounts);
      setAccounts(data.accounts);
    } catch (error) {
      console.error('❌ Error fetching accounts:', error);
    }
  };

  // ---------------------------------------------------
  // 4. FETCH TRANSACTIONS
  // ---------------------------------------------------
  const fetchTransactions = async (userId) => {
    try {
      console.log(`📡 Fetching transactions for userId=${userId}`);
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${userId}/transactions?limit=20`
      );
      console.log('🧾 Transactions:', data.transactions);
      setTransactions(data.transactions);
    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
    }
  };

  // ---------------------------------------------------
  // 5. FETCH ALL CATEGORIES
  // ---------------------------------------------------
  const fetchCategories = async (userId) => {
    try {
      console.log(`📡 Fetching categories for userId=${userId}`);
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/budget/user/${userId}/categories`
      );
      // `data.categories.all` is an array of objects like { name, type, … }
      setCategories(data.categories.all || []);
      console.log('📂 Categories:', data.categories.all);
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
    }
  };

  // ---------------------------------------------------
  // 6. Plaid Link Hook (unchanged)
  // ---------------------------------------------------
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      try {
        console.log('🔄 Exchanging public token for access token');
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;

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

        // Re-fetch accounts, transactions, categories
        const userId = session.data.session.user.id;
        await Promise.all([
          fetchAccounts(userId),
          fetchTransactions(userId),
          fetchCategories(userId),
        ]);
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

  // ---------------------------------------------------
  // 7. SIGN IN / SIGN OUT HANDLERS
  // ---------------------------------------------------
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
  };

  // ---------------------------------------------------
  // 8. HANDLE CATEGORY CHANGE (PUT to /transaction/{id}/category)
  // ---------------------------------------------------
  const handleCategoryChange = async (transactionId, newCategory) => {
    try {
      console.log(
        `🔄 Updating transaction ${transactionId} → category="${newCategory}"`
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
      // Re‐fetch transactions so the table shows the new category
      const userId = user.id;
      await fetchTransactions(userId);
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

  // ---------------------------------------------------
  // 9. RENDER LOADING STATE
  // ---------------------------------------------------
  if (loading) {
    return (
      <Container centerContent py={20}>
        <Spinner size="xl" />
      </Container>
    );
  }

  // ---------------------------------------------------
  // 10. IF NOT SIGNED IN → SHOW SIGN‐IN SCREEN
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // 11. RENDER DASHBOARD (SIGNED‐IN STATE)
  // ---------------------------------------------------
  return (
    <Container maxW="6xl" py={10}>
      <VStack spacing={8} align="stretch">

        {/* Sign Out Button */}
        <Box textAlign="right">
          <Button colorScheme="red" onClick={signOut}>
            Sign Out
          </Button>
        </Box>

        {/* Welcome Header */}
        <Heading size="xl">Welcome, {user.email}</Heading>

        {/* 11a. PLAID “Connect Bank Account” Button */}
        {linkToken && ready && (
          <Button colorScheme="green" onClick={open}>
            Connect Bank Account
          </Button>
        )}

        {/* 11b. ACCOUNTS TABLE */}
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
                    <Td isNumeric>{parseFloat(acct.balance).toFixed(2)}</Td>
                    <Td>{acct.currency}</Td>
                    <Td>
                      {new Date(acct.last_synced_at).toLocaleString()}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
              <TableCaption>Showing all linked accounts</TableCaption>
            </Table>
          )}
        </Box>

        {/* 11c. RECENT TRANSACTIONS TABLE (WITH CATEGORY DROPDOWN) */}
        <Box>
          <Heading size="lg" mb={4}>
            Recent Transactions
          </Heading>
          {transactions.length === 0 ? (
            <Text>No transactions imported yet.</Text>
          ) : (
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Category</Th>
                  <Th isNumeric>Amount</Th>
                  <Th>Account</Th>
                </Tr>
              </Thead>
              <Tbody>
                {transactions.map((txn) => (
                  <Tr key={txn.transaction_id}>
                    <Td>{new Date(txn.date).toLocaleDateString()}</Td>
                    <Td>{txn.description}</Td>
                    <Td>
                      {/* CATEGORY DROPDOWN: always render, even if txn.category is “Other”*/}
                      {categories.length === 0 ? (
                        <Text fontSize="sm" color="gray.500">
                          Loading categories…
                        </Text>
                      ) : (
                        <Select
                          size="sm"
                          value={txn.category || ''}
                          onChange={(e) =>
                            handleCategoryChange(txn.transaction_id, e.target.value)
                          }
                        >
                          {/* “Uncategorized” maps to empty string */}
                          <option value={''}>Uncategorized</option>
                          {/* Render each category name from the backend */}
                          {categories.map((cat, idx) => (
                            <option key={idx} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Td>
                    <Td isNumeric>{parseFloat(txn.amount).toFixed(2)}</Td>
                    <Td>{txn.user_accounts.account_name}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </VStack>
    </Container>
  );
}

export default App;

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

  // New state for accounts + transactions
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [linkToken, setLinkToken] = useState(null);
  const toast = useToast();

  // 1. Load Supabase session, save user, then fetch initial data
  useEffect(() => {
    const init = async () => {
      console.log('🔄 Checking Supabase session...');
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        console.log('✅ User is signed in:', session.user.email);
        setUser(session.user);

        // Save user to backend
        try {
          console.log('📡 Calling /api/user/save');
          await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}/api/user/save`,
            {},
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );
          console.log('✅ User saved to backend');
        } catch (err) {
          console.error('❌ Error saving user:', err);
        }

        // Fetch the user’s accounts and transactions
        await fetchAccounts(session.user.id);
        await fetchTransactions(session.user.id);
        await fetchLinkToken(session.user.id);
      } else {
        console.log('ℹ️ No user session found');
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch Plaid Link token
  const fetchLinkToken = async (userId) => {
    try {
      console.log('📡 Calling /api/plaid/create_link_token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/create_link_token`,
        { userId },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('🔄 Link token received:', response.data.link_token);
      setLinkToken(response.data.link_token);
    } catch (error) {
      console.error('❌ Error creating Plaid link token:', error);
    }
  };

  // 3. Fetch user’s linked accounts
  const fetchAccounts = async (userId) => {
    try {
      console.log(`📡 Fetching accounts for user ${userId}`);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${userId}/accounts`
      );
      console.log('🗄️ Accounts:', response.data.accounts);
      setAccounts(response.data.accounts);
    } catch (error) {
      console.error('❌ Error fetching accounts:', error);
    }
  };

  // 4. Fetch user’s transactions
  const fetchTransactions = async (userId) => {
    try {
      console.log(`📡 Fetching transactions for user ${userId}`);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/user/${userId}/transactions?limit=10`
      );
      console.log('🧾 Transactions:', response.data.transactions);
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
    }
  };

  // 5. Plaid Link Hook
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
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
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

        // Re-fetch accounts and transactions after linking a new bank
        await fetchAccounts(session.data.session.user.id);
        await fetchTransactions(session.data.session.user.id);
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

  // 6. Sign in / Sign out
  const signIn = async () => {
    console.log('🔄 Signing in with Google...');
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signOut = async () => {
    console.log('🔄 Signing out...');
    await supabase.auth.signOut();
    // Clear local state
    setAccounts([]);
    setTransactions([]);
    setLinkToken(null);
    setUser(null);
  };

  // 7. Render a loading spinner while we fetch data
  if (loading) {
    return (
      <Container centerContent py={20}>
        <Spinner size="xl" />
      </Container>
    );
  }

  // 8. If user is not signed in, show the sign-in screen
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

  // 9. User is signed in – render the dashboard with accounts + transactions
  return (
    <Container maxW="6xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="right">
          <Button colorScheme="red" onClick={signOut}>
            Sign Out
          </Button>
        </Box>

        {/* Welcome Header */}
        <Heading size="xl">Welcome, {user.email}</Heading>

        {/* 9a. Connect Bank Account Button (appears once linkToken is ready) */}
        {linkToken && ready && (
          <Button colorScheme="green" onClick={open}>
            Connect Bank Account
          </Button>
        )}

        {/* 9b. Accounts Section */}
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
                    <Td isNumeric>{acct.balance.toFixed(2)}</Td>
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

        {/* 9c. Recent Transactions Section */}
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
                    <Td>{txn.category || 'Other'}</Td>
                    <Td isNumeric>{txn.amount.toFixed(2)}</Td>
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

import React, { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import {
  Box,
  Button,
  VStack,
  Text,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  HStack,
  Badge,
  Spinner,
  Heading
} from '@chakra-ui/react';
import axios from 'axios';

const PlaidLinkComponent = ({ onSuccess }) => {
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);

  // Your Railway backend URL
  const API_BASE = 'https://financial-superapp-production.up.railway.app/api';

  // Initialize Plaid Link
  useEffect(() => {
    createLinkToken();
  }, []);

  const createLinkToken = async () => {
    try {
      const response = await axios.post(`${API_BASE}/plaid/create_link_token`, {
        userId: `user_${Date.now()}`
      });
      setLinkToken(response.data.link_token);
    } catch (error) {
      setError('Failed to initialize bank connection');
      console.error('Link token creation error:', error);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    console.log('=== Plaid Success Callback ===');
    console.log('Public Token:', publicToken);
    console.log('Metadata:', metadata);
    
    setLoading(true);
    setError('');

    try {
      console.log('Attempting token exchange...');
      
      // Exchange public token for access token
      const response = await axios.post(`${API_BASE}/plaid/exchange_public_token`, {
        public_token: publicToken
      });

      console.log('Full backend response:', response.data);

      const { access_token, accounts: userAccounts, user_id, transactions_imported } = response.data;

      // Make sure we have a user_id
      if (!user_id) {
        throw new Error('No user_id received from backend');
      }

      console.log('User ID received:', user_id);
      console.log('Transactions imported:', transactions_imported);

      setAccounts(userAccounts);
      
      if (onSuccess) {
        onSuccess({
          access_token,
          accounts: userAccounts,
          user_id: user_id, // Make sure this gets passed
          institution: metadata.institution,
          transactions_imported: transactions_imported
        });
      }

    } catch (error) {
      console.error('=== Token Exchange Error ===');
      console.error('Error object:', error);
      console.error('Response data:', error.response?.data);
      
      setError(`Failed to connect bank account: ${error.response?.data?.details || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [onSuccess, API_BASE]);

  const onPlaidExit = useCallback((err, metadata) => {
    if (err) {
      setError(`Connection failed: ${err.error_message}`);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  const formatBalance = (account) => {
    const balance = account.balances.current || account.balances.available || 0;
    return balance.toLocaleString('en-CA', {
      style: 'currency',
      currency: account.balances.iso_currency_code || 'CAD'
    });
  };

  const getAccountType = (account) => {
    return account.subtype || account.type || 'account';
  };

  return (
    <Box maxW="md" mx="auto">
      <VStack spacing={6}>
        <Heading size="md" textAlign="center">
          Connect Your Bank Account
        </Heading>

        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {!accounts.length && (
          <VStack spacing={4}>
            <Text textAlign="center" color="gray.600">
              Securely connect your bank account to get started. 
              We use bank-level encryption to protect your data.
            </Text>

            <Button
              colorScheme="brand"
              size="lg"
              onClick={() => open()}
              isDisabled={!ready || loading}
              isLoading={loading}
              loadingText="Connecting..."
            >
              {ready ? 'Connect Bank Account' : 'Loading...'}
            </Button>

            <Text fontSize="sm" color="gray.500" textAlign="center">
              🔒 Your credentials are encrypted and never stored on our servers
            </Text>
          </VStack>
        )}

        {loading && (
          <VStack spacing={3}>
            <Spinner size="lg" color="brand.500" />
            <Text>Setting up your accounts and importing transactions...</Text>
          </VStack>
        )}

        {accounts.length > 0 && (
          <VStack spacing={4} w="full">
            <Alert status="success">
              <AlertIcon />
              Successfully connected {accounts.length} account{accounts.length > 1 ? 's' : ''}!
            </Alert>

            <VStack spacing={3} w="full">
              <Text fontWeight="semibold">Your Connected Accounts:</Text>
              {accounts.map((account) => (
                <Card key={account.account_id} w="full">
                  <CardBody>
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="semibold">{account.name}</Text>
                        <HStack>
                          <Badge colorScheme="blue" size="sm">
                            {getAccountType(account)}
                          </Badge>
                          <Text fontSize="sm" color="gray.500">
                            ****{account.mask}
                          </Text>
                        </HStack>
                      </VStack>
                      <Text fontWeight="bold" color="brand.600">
                        {formatBalance(account)}
                      </Text>
                    </HStack>
                  </CardBody>
                </Card>
              ))}
            </VStack>

            <Button
              variant="outline"
              onClick={() => open()}
              isDisabled={!ready}
              size="sm"
            >
              Connect Another Account
            </Button>
          </VStack>
        )}
      </VStack>
    </Box>
  );
};

export default PlaidLinkComponent;

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

  const API_BASE = 'https://financial-superapp-production.up.railway.app/api';

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
      console.log('Sending request to:', `${API_BASE}/plaid/exchange_public_token`);
      
      const response = await axios.post(`${API_BASE}/plaid/exchange_public_token`, {
        public_token: publicToken
      });

      console.log('=== FULL BACKEND RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      // Check if we have the expected fields
      const backendData = response.data;
      console.log('Backend user_id:', backendData.user_id);
      console.log('Backend transactions_imported:', backendData.transactions_imported);
      console.log('Backend accounts count:', backendData.accounts?.length);

      if (!backendData.user_id) {
        console.error('❌ ERROR: No user_id in backend response!');
        console.error('Available fields:', Object.keys(backendData));
      }

      const finalData = {
        access_token: backendData.access_token,
        accounts: backendData.accounts,
        user_id: backendData.user_id,
        transactions_imported: backendData.transactions_imported,
        institution: metadata.institution
      };

      console.log('=== FINAL DATA BEING SENT TO APP ===');
      console.log('Final data:', JSON.stringify(finalData, null, 2));

      setAccounts(backendData.accounts);
      
      if (onSuccess) {
        onSuccess(finalData);
      } else {
        console.error('❌ No onSuccess callback provided!');
      }

    } catch (error) {
      console.error('=== Token Exchange Error ===');
      console.error('Error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
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

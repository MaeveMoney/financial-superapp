import React, { useState } from 'react';
import { Box, Container, Heading, Text, VStack, Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import PlaidLinkComponent from './components/PlaidLinkComponent';
import TransactionList from './components/TransactionList';

function App() {
  const [connectedData, setConnectedData] = useState(null);
  const [userId, setUserId] = useState(null);

  const handlePlaidSuccess = (data) => {
    console.log('=== APP.JS RECEIVED DATA ===');
    console.log('Full data received:', JSON.stringify(data, null, 2));
    console.log('User ID from data:', data.user_id);
    console.log('Transactions imported:', data.transactions_imported);
    
    setConnectedData(data);
    setUserId(data.user_id);
    
    if (!data.user_id) {
      console.error('❌ APP.JS ERROR: No user_id received!');
      console.error('Available fields:', Object.keys(data));
    }
  };

  return (
    <Container maxW="6xl" py={20}>
      <VStack spacing={8}>
        <Heading size="2xl" color="brand.600" textAlign="center">
          Financial SuperApp
        </Heading>
        <Text fontSize="xl" color="gray.600" textAlign="center">
          Your complete Canadian financial management platform
        </Text>
        
        {!connectedData ? (
          <PlaidLinkComponent onSuccess={handlePlaidSuccess} />
        ) : (
          <Box w="full">
            <Tabs variant="enclosed" colorScheme="brand">
              <TabList>
                <Tab>Accounts</Tab>
                <Tab>Transactions</Tab>
                <Tab>Budget</Tab>
                <Tab>Reports</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <VStack spacing={4}>
                    <Text color="green.700" fontWeight="semibold">
                      🎉 Successfully connected {connectedData.accounts?.length} accounts!
                    </Text>
                    <Text fontSize="sm" color="green.600">
                      Institution: {connectedData.institution?.name}
                    </Text>
                    <Text fontSize="sm" color="blue.600">
                      Imported {connectedData.transactions_imported} transactions
                    </Text>
                    <Text fontSize="sm" color="purple.600">
                      User ID: {userId || 'MISSING!'}
                    </Text>
                  </VStack>
                </TabPanel>
                
                <TabPanel>
                  {userId ? (
                    <TransactionList userId={userId} />
                  ) : (
                    <Text color="red.500">Error: No user ID available to load transactions</Text>
                  )}
                </TabPanel>
                
                <TabPanel>
                  <Text>Budget tools coming soon...</Text>
                </TabPanel>
                
                <TabPanel>
                  <Text>Financial reports coming soon...</Text>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        )}
      </VStack>
    </Container>
  );
}

export default App;

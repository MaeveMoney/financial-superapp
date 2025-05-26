import React, { useState } from 'react';
import { Box, Container, Heading, Text, VStack } from '@chakra-ui/react';
import PlaidLinkComponent from './components/PlaidLinkComponent';

function App() {
  const [connectedData, setConnectedData] = useState(null);

  const handlePlaidSuccess = (data) => {
    console.log('Connected bank data:', data);
    setConnectedData(data);
  };

  return (
    <Container maxW="4xl" py={20}>
      <VStack spacing={8}>
        <Heading size="2xl" color="brand.600" textAlign="center">
          Financial SuperApp
        </Heading>
        <Text fontSize="xl" color="gray.600" textAlign="center">
          Your complete Canadian financial management platform
        </Text>
        
        <PlaidLinkComponent onSuccess={handlePlaidSuccess} />
        
        {connectedData && (
          <Box mt={8} p={4} bg="green.50" rounded="lg" w="full" maxW="md">
            <Text color="green.700" fontWeight="semibold" textAlign="center">
              🎉 Bank connection successful!
            </Text>
            <Text fontSize="sm" color="green.600" textAlign="center" mt={2}>
              Institution: {connectedData.institution?.name}
            </Text>
          </Box>
        )}
      </VStack>
    </Container>
  );
}

export default App;

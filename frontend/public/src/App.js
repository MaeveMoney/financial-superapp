import React from 'react';
import { Box, Container, Heading, Text, Button, VStack } from '@chakra-ui/react';

function App() {
  return (
    <Container maxW="4xl" py={20}>
      <VStack spacing={8} textAlign="center">
        <Heading size="2xl" color="brand.600">
          Financial SuperApp
        </Heading>
        <Text fontSize="xl" color="gray.600">
          Your complete Canadian financial management platform
        </Text>
        <Button colorScheme="brand" size="lg">
          Coming Soon
        </Button>
      </VStack>
    </Container>
  );
}

export default App;

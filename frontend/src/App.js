import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  Text,
  Spinner,
} from '@chakra-ui/react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <Container centerContent py={20}>
        <Spinner size="xl" />
      </Container>
    );
  }

  return (
    <Container maxW="4xl" py={20}>
      <VStack spacing={8} textAlign="center">
        {!user ? (
          <>
            <Heading size="2xl" color="brand.600">
              Financial SuperApp
            </Heading>
            <Text fontSize="lg" color="gray.600">
              Sign in with Google to begin managing your finances
            </Text>
            <Button colorScheme="blue" size="lg" onClick={signInWithGoogle}>
              Sign in with Google
            </Button>
          </>
        ) : (
          <>
            <Heading size="xl">Welcome, {user.email}</Heading>
            <Text>Your dashboard is coming soon!</Text>
            <Button colorScheme="red" onClick={signOut}>
              Sign Out
            </Button>
          </>
        )}
      </VStack>
    </Container>
  );
}

export default App;

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
import axios from 'axios';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        // Save user to backend
        const token = session.access_token;

        try {
          await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}/api/user/save`,
            {},
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          console.log('✅ User saved to backend');
        } catch (err) {
          console.error('❌ Failed to save user', err);
        }
      }

      setLoading(false);
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
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
            <Heading size="2xl">Financial SuperApp</Heading>
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

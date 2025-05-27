import React, { useEffect, useState } from 'react';
import {
  Container,
  VStack,
  Button,
  Heading,
  Text,
  Spinner,
  useToast,
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
  const [linkToken, setLinkToken] = useState(null);
  const toast = useToast();

  // Load session and save user
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        try {
          await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}/api/user/save`,
            {},
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );
        } catch (err) {
          console.error('Error saving user:', err);
        }
      }

      setLoading(false);
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Fetch Plaid Link token
  const fetchLinkToken = async () => {
    if (!user) return;
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/plaid/create_link_token`,
        { userId: user.id }
      );
      setLinkToken(response.data.link_token);
    } catch (error) {
      console.error('Error creating Plaid link token:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLinkToken();
    }
  }, [user]);

  // Plaid Link Hook
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      try {
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

        toast({
          title: 'Account linked!',
          description: 'Your financial data has been imported.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } catch (err) {
        console.error('Token exchange error:', err);
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

  const signIn = async () => {
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
            <Button colorScheme="blue" size="lg" onClick={signIn}>
              Sign in with Google
            </Button>
          </>
        ) : (
          <>
            <Heading size="xl">Welcome, {user.email}</Heading>
            <Text mb={4}>Your dashboard is coming soon!</Text>
            {linkToken && ready && (
              <Button colorScheme="green" onClick={open}>
                Connect Bank Account
              </Button>
            )}
            <Button colorScheme="red" variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </>
        )}
      </VStack>
    </Container>
  );
}

export default App;

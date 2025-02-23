
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import { useEffect } from 'react';

// Navigation
import RootNavigator from './src/navigation/RootNavigator';

// Firebase config
import './src/config/firebase';
import { auth } from './src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Services
import StoreKitService from './src/services/StoreKit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
  },
});

const App = () => {
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        try {
          const storeKit = StoreKitService.getInstance();
          await storeKit.verifySubscriptionStatus();
        } catch (error) {
          console.error('Failed to verify subscription status:', error);
        }
      }
    });

    const authSubscription = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const storeKit = StoreKitService.getInstance();
          await storeKit.verifySubscriptionStatus();
        } catch (error) {
          console.error('Failed to verify subscription status after auth:', error);
        }
      }
    });

    return () => {
      appStateSubscription.remove();
      authSubscription();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};

export default App;


/* import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Navigation
import RootNavigator from './src/navigation/RootNavigator';

// Firebase config
import './src/config/firebase';

const queryClient = new QueryClient();

const App = () => {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};

export default App; */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const firebaseConfig = {
  apiKey: 'AIzaSyDe1uNf8i9CTiu2wie8SlWQUwBtpRtQ7BY',
  authDomain: 'kidslearning-c8106.firebaseapp.com',
  databaseURL: 'https://kidslearning-c8106-default-rtdb.firebaseio.com',
  projectId: 'kidslearning-c8106',
  storageBucket: 'kidslearning-c8106.firebasestorage.app',
  messagingSenderId: '688463689107',
  appId: '1:688463689107:web:5e9af0dd1f4a2cd805e466',
  measurementId: 'G-B8MDMBKQFW'
};

// Initialize Google Sign In
GoogleSignin.configure({
  webClientId: '688463689107-04s9i8frtjvacnt8urggr1o2ng6chi8d.apps.googleusercontent.com', // Your web client ID from Firebase Console
});

// Export Google Sign In method
export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();

    if (!idToken) {
      throw new Error('No ID token present!');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

/* import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDe1uNf8i9CTiu2wie8SlWQUwBtpRtQ7BY',
  authDomain: 'kidslearning-c8106.firebaseapp.com',
  databaseURL: 'https://kidslearning-c8106-default-rtdb.firebaseio.com',
  projectId: 'kidslearning-c8106',
  storageBucket: 'kidslearning-c8106.firebasestorage.app',
  messagingSenderId: '688463689107',
  appId: '1:688463689107:web:5e9af0dd1f4a2cd805e466',
  measurementId: 'G-B8MDMBKQFW'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
 */
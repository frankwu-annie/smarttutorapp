// import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';
// import { getFirestore } from 'firebase/firestore';

// const firebaseConfig = {
//   apiKey: "AIzaSyDe1uNf8i9CTiu2wie8SlWQUwBtpRtQ7BY",
//   authDomain: "kidslearning-c8106.firebaseapp.com",
//   databaseURL: "https://kidslearning-c8106-default-rtdb.firebaseio.com",
//   projectId: "kidslearning-c8106",
//   storageBucket: "kidslearning-c8106.firebasestorage.app",
//   messagingSenderId: "688463689107",
//   appId: "1:688463689107:web:5e9af0dd1f4a2cd805e466",
//   measurementId: "G-B8MDMBKQFW"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const db = getFirestore(app);

// export default app;

// firebase.js
import { initializeApp } from 'firebase/app';
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

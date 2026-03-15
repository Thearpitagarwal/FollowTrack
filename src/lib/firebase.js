import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBYwhmVMCGYaqmWOfhvW6bvPYk5045GQJo",
  authDomain: "followtrack-ce9e3.firebaseapp.com",
  projectId: "followtrack-ce9e3",
  storageBucket: "followtrack-ce9e3.firebasestorage.app",
  messagingSenderId: "1094798640332",
  appId: "1:1094798640332:web:343e882d056e99ccd96e69",
  measurementId: "G-PRWZ27RRDM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;
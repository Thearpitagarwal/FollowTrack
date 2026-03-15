import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// Helper: get or create a minimal user profile
async function getOrCreateUserProfile(firebaseUser) {
  try {
    let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (userDoc.exists()) {
      return { uid: firebaseUser.uid, ...userDoc.data() };
    }

    // No profile yet — try to create a minimal one
    const minimalProfile = {
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Teacher',
      email: firebaseUser.email || '',
      section: 'CSE-3A',
      subject: 'DBMS',
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), minimalProfile);
    } catch (writeErr) {
      console.warn('Could not write user profile to Firestore. Check your Firestore security rules.', writeErr);
    }

    return { uid: firebaseUser.uid, ...minimalProfile };
  } catch (readErr) {
    console.warn('Could not read Firestore. Returning minimal user.', readErr);
    return {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Teacher',
      email: firebaseUser.email || '',
      section: 'CSE-3A',
      subject: 'DBMS'
    };
  }
}

export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return getOrCreateUserProfile(credential.user);
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return getOrCreateUserProfile(result.user);
}

export async function logoutUser() {
  await signOut(auth);
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return callback(null);
    const profile = await getOrCreateUserProfile(firebaseUser);
    callback(profile);
  });
}

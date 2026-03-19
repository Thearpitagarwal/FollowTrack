import { collection, addDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * FollowUpEntry Schema
 * {
 *   id: string (Firestore auto-generated)
 *   studentId: string
 *   type: 'response' | 'parent_call' | 'student_call'
 *   text: string (only if type === 'response', otherwise empty/null)
 *   timestamp: Timestamp (Firebase Firestore Timestamp)
 *   createdBy: string (Teacher UID)
 * }
 */

const COLLECTION_NAME = 'followups';

/**
 * Adds a new follow-up entry for a student.
 */
export async function addFollowUp(studentId, type, text, createdBy) {
  if (!studentId || !type) {
    throw new Error('studentId and type are required');
  }

  const entry = {
    studentId,
    type,
    text: type === 'response' ? text : null,
    timestamp: Timestamp.now(),
    createdBy: createdBy || null,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), entry);
  return { id: docRef.id, ...entry };
}

/**
 * Fetches all follow-ups for a specific student, ordered by timestamp DESC.
 */
export async function getFollowUpsByStudent(studentId) {
  if (!studentId) return [];

  const q = query(
    collection(db, COLLECTION_NAME),
    where('studentId', '==', studentId),
    // Order by timestamp desc requires a composite index if there's also a where clause on another field.
    // If we only have equality on studentId and orderBy on timestamp, Firestore might need an index: studentId ASC, timestamp DESC.
    // However, often where equality + orderBy works with automatic simple indexes if we sort on client, 
    // or if we create an index. We'll add orderBy here and if it requires an index, we can just sort locally in components or wait for the user to click the index link.
    // To ensure zero breakage, we'll fetch and sort locally just in case it's a bare system without indexes yet.
  );
  
  const snap = await getDocs(q);
  const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Local sort to guarantee descending order without strict index requirement
  results.sort((a, b) => {
    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
    return timeB - timeA;
  });

  return results;
}

/**
 * Fetches all follow-ups to be used by the Attendance module for cross-referencing.
 */
export async function getAllFollowUps() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort oldest to newest so when mapped, later ones overwrite earlier ones
  results.sort((a, b) => {
    const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
    const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
    return timeA - timeB; 
  });
  
  return results;
}

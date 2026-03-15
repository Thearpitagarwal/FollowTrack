import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function createFollowUpLog(studentId, logData, user) {
  return await addDoc(collection(db, 'students', studentId, 'followUpLog'), {
    studentId,
    loggedById:   user.uid,
    loggedByName: user.name,
    loggedByRole: user.role,
    type:         logData.type,
    date:         logData.date, // expecting Timestamp
    outcome:      logData.outcome,
    notes:        logData.notes || null,
    aiGenerated:  false,
    createdAt:    serverTimestamp()
  });
}

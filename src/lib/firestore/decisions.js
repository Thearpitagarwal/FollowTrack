import { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

export async function createDecisionEscalation(student, formData, user) {
  const docRef = await addDoc(collection(db, 'decisions'), {
    studentId:       student.id,
    studentName:     student.name,
    studentSection:  student.section,
    title:           `Escalation: ${student.name}`,
    description:     formData.notes,
    proposedAction:  '',
    severity:        formData.severity,
    createdById:     user.uid,
    createdByName:   user.name,
    createdByRole:   user.role,
    status:          'pending',
    escalatedToDean: formData.severity === 'urgent',
    resolvedAt:      null,
    resolvedById:    null,
    resolvedByName:  null,
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp()
  });

  await updateDoc(doc(db, 'students', student.id), {
    decisionIds: arrayUnion(docRef.id)
  });
  
  return docRef.id;
}

export async function approveDecision(decisionId, user) {
  await updateDoc(doc(db, 'decisions', decisionId), {
    status:        'approved',
    resolvedAt:    serverTimestamp(),
    resolvedById:  user.uid,
    resolvedByName: user.name,
    updatedAt:     serverTimestamp()
  });
}

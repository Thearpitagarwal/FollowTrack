import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Get all assignments for a section (all subjects)
export async function getAssignmentsBySection(section) {
  const q = query(
    collection(db, 'assignments'),
    where('section', '==', section),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get assignments filtered by subject
export async function getAssignmentsBySubject(section, subject) {
  const q = query(
    collection(db, 'assignments'),
    where('section', '==', section),
    where('subject',  '==', subject),
    orderBy('dueDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get single assignment
export async function getAssignment(assignmentId) {
  const snap = await getDoc(doc(db, 'assignments', assignmentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAssignmentById(assignmentId) {
  return await getAssignment(assignmentId);
}

// Create a new assignment
// students: array of student objects [{ id, name }]
export async function createAssignment({
  teacherId, section, subject, title, description, dueDate, maxMarks, students
}) {
  // Initialise all students as "missing"
  const submissions = {};
  students.forEach(s => {
    submissions[s.id] = {
      status:      'missing',
      marks:       null,
      submittedAt: null
    };
  });

  const stats = {
    total:     students.length,
    submitted: 0,
    missing:   students.length,
    late:      0
  };

  const ref = await addDoc(collection(db, 'assignments'), {
    teacherId,
    section,
    subject,
    title,
    description: description || null,
    dueDate:     Timestamp.fromDate(new Date(dueDate)),
    maxMarks:    Number(maxMarks),
    submissions,
    stats,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return ref.id;
}

// Update a single student's submission status (and optionally marks)
export async function updateSubmission(assignmentId, studentId, status, marks = null) {
  // First fetch current doc to recompute stats
  const assignment = await getAssignment(assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const submissions = { ...assignment.submissions };
  submissions[studentId] = {
    status,
    marks:       marks !== null ? Number(marks) : null,
    submittedAt: status === 'submitted' ? Timestamp.now() : null
  };

  // Recompute stats
  const values = Object.values(submissions);
  const stats = {
    total:     values.length,
    submitted: values.filter(v => v.status === 'submitted').length,
    missing:   values.filter(v => v.status === 'missing').length,
    late:      values.filter(v => v.status === 'late').length,
  };

  await updateDoc(doc(db, 'assignments', assignmentId), {
    [`submissions.${studentId}`]: submissions[studentId],
    stats,
    updatedAt: serverTimestamp()
  });
}

// Bulk update — e.g. "Mark all submitted"
export async function bulkUpdateSubmissions(assignmentId, studentIds, status) {
  const assignment = await getAssignment(assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const submissions = { ...assignment.submissions };
  const now = Timestamp.now();

  studentIds.forEach(sid => {
    submissions[sid] = {
      status,
      marks:       submissions[sid]?.marks ?? null,
      submittedAt: status === 'submitted' ? now : null
    };
  });

  const values = Object.values(submissions);
  const stats = {
    total:     values.length,
    submitted: values.filter(v => v.status === 'submitted').length,
    missing:   values.filter(v => v.status === 'missing').length,
    late:      values.filter(v => v.status === 'late').length,
  };

  await updateDoc(doc(db, 'assignments', assignmentId), {
    submissions,
    stats,
    updatedAt: serverTimestamp()
  });
}

// Delete an assignment
export async function deleteAssignment(assignmentId) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'assignments', assignmentId));
}

// Get per-student assignment stats (for Student Profile)
export async function getStudentAssignmentStats(studentId, section) {
  const assignments = await getAssignmentsBySection(section);
  
  const stats = { total: 0, submitted: 0, missing: 0, late: 0 };

  assignments.forEach(a => {
    stats.total++;
    const submission = a.submissions?.[studentId];
    if (!submission) {
      stats.missing++;
    } else {
      stats[submission.status]++;
    }
  });

  return stats;
}

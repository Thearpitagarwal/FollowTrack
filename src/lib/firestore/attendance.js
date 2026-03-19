import {
  collection, doc, addDoc, updateDoc, getDocs, getDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { recomputeStudentAttendance } from './students';

// Fetch attendance for a specific date + subject + section
// Returns the session document if it exists, or null
export async function getAttendanceSession(section, subject, date) {
  // date is ISO string: "2025-03-14"
  const q = query(
    collection(db, 'attendance'),
    where('section', '==', section),
    where('subject', '==', subject),
    where('date',    '==', date)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// Get all sessions for a section (for summary views)
export async function getAllSessionsBySection(section) {
  const q = query(
    collection(db, 'attendance'),
    where('section', '==', section),
    orderBy('dateTs', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get sessions filtered by subject
export async function getSessionsBySubject(section, subject) {
  const q = query(
    collection(db, 'attendance'),
    where('section', '==', section),
    where('subject', '==', subject),
    orderBy('dateTs', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get sessions for a date range
export async function getSessionsByDateRange(section, startDate, endDate) {
  // startDate, endDate are ISO strings
  const q = query(
    collection(db, 'attendance'),
    where('section', '==', section),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Save (create or update) an attendance session
// records: { [studentId]: "present" | "absent" | "late" }
export async function saveAttendanceSession({
  teacherId, section, subject, date, records, students
}) {
  // Build summary (late treated as present)
  const values  = Object.values(records);
  const summary = {
    total:   students.length,
    present: values.filter(v => v === 'present' || v === 'late').length,
    absent:  values.filter(v => v === 'absent').length,
  };

  const dateTs = Timestamp.fromDate(new Date(date));

  // Check if session already exists
  const existing = await getAttendanceSession(section, subject, date);

  if (existing) {
    // Update
    await updateDoc(doc(db, 'attendance', existing.id), {
      records,
      summary,
      updatedAt: serverTimestamp()
    });
  } else {
    // Create
    await addDoc(collection(db, 'attendance'), {
      teacherId,
      section,
      subject,
      date,         // ISO string for easy querying
      dateTs,       // Timestamp for ordering
      records,
      summary,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Recompute attendancePct + riskLevel for ALL students in the records
  const studentIds = Object.keys(records);
  await Promise.all(
    studentIds.map(sid => recomputeStudentAttendance(sid, section))
  );

  return { summary };
}

// Get per-student attendance stats for a section (used in summary/profile views)
export async function getStudentAttendanceStats(studentId, section) {
  const sessions = await getAllSessionsBySection(section);
  
  const stats = { total: 0, present: 0, absent: 0, late: 0, pct: 100 };

  sessions.forEach(session => {
    const status = session.records?.[studentId];
    if (status === undefined) return; // student not in this session

    stats.total++;
    stats[status]++;
  });

  stats.pct = stats.total === 0 ? 100 : Math.round(((stats.present + stats.late) / stats.total) * 100);

  return stats;
}

// Get attendance for a specific student across all dates (for profile graph)
export async function getStudentAttendanceTimeline(studentId, section) {
  const sessions = await getAllSessionsBySection(section);
  return sessions
    .filter(s => s.records?.[studentId] !== undefined)
    .map(s => ({
      date:    s.date,
      subject: s.subject,
      status:  s.records[studentId]
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

import {
  collection, doc, getDocs, getDoc, updateDoc,
  query, where, orderBy, serverTimestamp, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { computeRiskLevel } from '../riskEngine';

// Get all students in a section
export async function getStudentsBySection(section) {
  const q = query(
    collection(db, 'students'),
    where('section', '==', section),
    orderBy('attendancePct', 'asc')
  );
  const snap = await getDocs(q);
  const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const seen = new Map();
  raw.forEach(s => { 
    // Prefer rollNumber for dedup if available, else id
    // Clean string by converting to lowercase and stripping whitespace
    const keyStr = (s.rollNumber || '').toString().trim().toLowerCase();
    const key = keyStr ? keyStr : s.id;
    
    // If we haven't seen this key OR the existing one doesn't have a name but the new one does...
    if (!seen.has(key) || (!seen.get(key).name && s.name)) {
      seen.set(key, s);
    } 
  });
  
  const unique = Array.from(seen.values());
  
  // Sort alphabetically by name (A-Z), case-insensitive
  unique.sort((a, b) => {
    const nameA = (a.name || '').trim().toLowerCase();
    const nameB = (b.name || '').trim().toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  return unique;
}

// Get single student
export async function getStudent(studentId) {
  const snap = await getDoc(doc(db, 'students', studentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Update overall attendancePct and riskLevel after marking attendance
// Call this after every attendance save
export async function recomputeStudentAttendance(studentId, section) {
  // Fetch all attendance sessions for this section
  const q = query(
    collection(db, 'attendance'),
    where('section', '==', section)
  );
  const sessions = await getDocs(q);

  let totalSessions = 0;
  let presentCount  = 0;

  sessions.docs.forEach(s => {
    const records = s.data().records;
    if (records && records[studentId] !== undefined) {
      totalSessions++;
      // Treat 'late' as 'present' (Late status removed from UI)
      if (records[studentId] === 'present' || records[studentId] === 'late') {
        presentCount++;
      }
    }
  });

  const attendancePct = totalSessions === 0
    ? 100
    : Math.round((presentCount / totalSessions) * 100);

  const riskLevel = computeRiskLevel(attendancePct);

  await updateDoc(doc(db, 'students', studentId), {
    attendancePct,
    riskLevel,
    updatedAt: serverTimestamp()
  });

  return { attendancePct, riskLevel };
}

// Get student with aggregated attendance and assignment stats (plus recent logs)
export async function getStudentWithStats(studentId, section, subject) {
  const { getAllSessionsBySection } = await import('./attendance');
  const { getAssignmentsBySection } = await import('./assignments');

  const [student, sessions, assignments, logsSnap] = await Promise.all([
    getStudent(studentId),
    getAllSessionsBySection(section),
    getAssignmentsBySection(section),
    getDocs(collection(db, 'students', studentId, 'followUpLog'))
  ]);

  // Attendance stats
  const relevantSessions = sessions.filter(s => s.records?.[studentId] !== undefined);
  const attendanceStats = {
    total:   relevantSessions.length,
    present: relevantSessions.filter(s => s.records[studentId] === 'present').length,
    absent:  relevantSessions.filter(s => s.records[studentId] === 'absent').length,
    late:    relevantSessions.filter(s => s.records[studentId] === 'late').length,
  };

  // Assignment stats
  const assignmentStats = {
    total:     assignments.length,
    submitted: assignments.filter(a => a.submissions?.[studentId]?.status === 'submitted').length,
    missing:   assignments.filter(a => a.submissions?.[studentId]?.status === 'missing').length,
    late:      assignments.filter(a => a.submissions?.[studentId]?.status === 'late').length,
  };

  // Recent follow-up logs
  const allLogs = logsSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      date: data.date,
      outcome: data.outcome,
      notes: data.notes ?? null,
    };
  });
  
  // Sort descending manually to bypass Firestore index limitations
  allLogs.sort((a, b) => {
    const tA = a.date?.toMillis ? a.date.toMillis() : 0;
    const tB = b.date?.toMillis ? b.date.toMillis() : 0;
    return tB - tA; // Newest first
  });
  
  const recentLogs = allLogs.slice(0, 2);

  return { student, attendanceStats, assignmentStats, recentLogs };
}

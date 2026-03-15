import {
  collection, doc, setDoc, addDoc, getDocs, deleteDoc, query, where,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export async function seedFollowTrack(teacherUid) {
  // 1. Create teacher user document
  // (Run AFTER creating the user in Firebase Auth console)
  await setDoc(doc(db, 'users', teacherUid), {
    uid:      teacherUid,
    name:     'Prof. Anil Verma',
    email:    'anil.verma@jecrc.ac.in',
    section:  'CSE-3A',
    subject:  'DBMS',
    createdAt: serverTimestamp()
  });

  // 1.5 Clean ALL existing test data (wipe entire collections)
  console.log('Cleaning old test data...');
  const snap1 = await getDocs(collection(db, 'students'));
  await Promise.all(snap1.docs.map(d => deleteDoc(d.ref)));

  const snap2 = await getDocs(collection(db, 'attendance'));
  await Promise.all(snap2.docs.map(d => deleteDoc(d.ref)));

  const snap3 = await getDocs(collection(db, 'assignments'));
  await Promise.all(snap3.docs.map(d => deleteDoc(d.ref)));
  console.log('Old data cleaned.');

  // 2. Seed 40 distinct students
  const firstNames = ['Aaditya', 'Aarav', 'Aditi', 'Ananya', 'Arjun', 'Aryan', 'Ayush', 'Bhavya', 'Chaitanya', 'Dev', 'Diya', 'Eshaan', 'Gauri', 'Hari', 'Isha', 'Jatin', 'Kavya', 'Krish', 'Lakshay', 'Meera', 'Neha', 'Nikhil', 'Om', 'Pari', 'Pranav', 'Rahul', 'Riya', 'Rohan', 'Roshni', 'Sahil', 'Samar', 'Sanya', 'Shaurya', 'Shiv', 'Shreya', 'Sneha', 'Tanvi', 'Tarun', 'Vedant', 'Vidya', 'Yash', 'Zara'];
  const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Yadav', 'Joshi', 'Agarwal', 'Choudhary', 'Kumar', 'Das', 'Shah', 'Mehta', 'Mishra', 'Pandey', 'Reddy', 'Nair', 'Bose', 'Rao', 'Iyer'];

  const getRisk = (pct) => pct < 50 ? 'critical' : pct < 65 ? 'high' : pct < 75 ? 'medium' : 'low';

  const students = Array.from({ length: 40 }, (_, i) => {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[(i * 3) % lastNames.length];
    const roll = `23CSE${String(i + 1).padStart(3, '0')}`;
    const basePct = 35 + ((i * 13) % 60); // Wide deterministic distribution
    const riskLevel = getRisk(basePct);
    
    return {
      name: `${firstName} ${lastName}`,
      rollNumber: roll,
      attendancePct: basePct,
      riskLevel,
      remedialEnrolled: riskLevel === 'critical'
    };
  });

  const studentRefs = [];
  for (const s of students) {
    const ref = await addDoc(collection(db, 'students'), {
      ...s,
      section:     'CSE-3A',
      phone:       '+91 9800000000',
      parentPhone: '+91 9800000001',
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp()
    });
    studentRefs.push({ id: ref.id, ...s });
  }

  // 3. Seed 3 past attendance sessions
  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);

  const toISO = (d) => d.toISOString().split('T')[0];

  const sessions = [
    { subject: 'DBMS', date: toISO(yesterday)  },
    { subject: 'DBMS', date: toISO(twoDaysAgo) },
  ];

  for (const session of sessions) {
    const records = {};
    studentRefs.forEach((s, i) => {
      records[s.id] = i % 3 === 0 ? 'absent' : i % 3 === 1 ? 'present' : 'present';
    });
    const vals = Object.values(records);
    await addDoc(collection(db, 'attendance'), {
      teacherId: teacherUid,
      section:   'CSE-3A',
      subject:   session.subject,
      date:      session.date,
      dateTs:    Timestamp.fromDate(new Date(session.date)),
      records,
      summary: {
        total:   studentRefs.length,
        present: vals.filter(v => v === 'present').length,
        absent:  vals.filter(v => v === 'absent').length,
        late:    0
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // 4. Seed 2 assignments
  const assignments = [
    {
      subject: 'DBMS',
      title:   'ER Diagram — Hospital Management System',
      dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      maxMarks: 10
    },
    {
      subject: 'DBMS',
      title:   'Process Scheduling Algorithms Lab',
      dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
      maxMarks: 10
    }
  ];

  for (const a of assignments) {
    const submissions = {};
    studentRefs.forEach((s, i) => {
      const status = i % 3 === 0 ? 'missing' : i % 3 === 1 ? 'submitted' : 'late';
      submissions[s.id] = {
        status,
        marks:       status === 'submitted' ? 8 : status === 'late' ? 6 : null,
        submittedAt: status !== 'missing' ? Timestamp.now() : null
      };
    });
    const vals  = Object.values(submissions);
    await addDoc(collection(db, 'assignments'), {
      teacherId:   teacherUid,
      section:     'CSE-3A',
      subject:     a.subject,
      title:       a.title,
      description: null,
      dueDate:     Timestamp.fromDate(a.dueDate),
      maxMarks:    a.maxMarks,
      submissions,
      stats: {
        total:     vals.length,
        submitted: vals.filter(v => v.status === 'submitted').length,
        missing:   vals.filter(v => v.status === 'missing').length,
        late:      vals.filter(v => v.status === 'late').length,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  console.log('✅ FollowTrack v3 seed complete. Students, sessions, and assignments created.');
}

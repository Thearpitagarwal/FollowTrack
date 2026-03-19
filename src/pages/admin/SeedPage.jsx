import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, addDoc, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export function SeedPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState([]);
  const [done, setDone] = useState(false);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    if (!user) return;

    async function runFullSeed() {
      try {
        // STEP 1: Wipe EVERYTHING
        addLog('🗑️ Step 1: Wiping ALL students...');
        const studSnap = await getDocs(collection(db, 'students'));
        addLog(`   Found ${studSnap.size} student documents`);
        for (const d of studSnap.docs) {
          await deleteDoc(d.ref);
        }
        addLog(`   ✓ Deleted ${studSnap.size} students`);

        addLog('🗑️ Step 2: Wiping ALL attendance...');
        const attSnap = await getDocs(collection(db, 'attendance'));
        addLog(`   Found ${attSnap.size} attendance documents`);
        for (const d of attSnap.docs) {
          await deleteDoc(d.ref);
        }
        addLog(`   ✓ Deleted ${attSnap.size} attendance records`);

        addLog('🗑️ Step 3: Wiping ALL assignments...');
        const asgSnap = await getDocs(collection(db, 'assignments'));
        addLog(`   Found ${asgSnap.size} assignment documents`);
        for (const d of asgSnap.docs) {
          await deleteDoc(d.ref);
        }
        addLog(`   ✓ Deleted ${asgSnap.size} assignments`);

        addLog('🗑️ Step 4: Wiping ALL follow-ups...');
        const fupSnap = await getDocs(collection(db, 'followups'));
        addLog(`   Found ${fupSnap.size} follow-up documents`);
        for (const d of fupSnap.docs) {
          await deleteDoc(d.ref);
        }
        addLog(`   ✓ Deleted ${fupSnap.size} follow-ups`);

        // STEP 2: Create teacher user doc
        addLog('👤 Step 5: Writing teacher user document...');
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: 'Prof. Anil Verma',
          email: user.email || 'anil.verma@jecrc.ac.in',
          section: 'CSE-3A',
          subject: 'DBMS',
          createdAt: serverTimestamp()
        });
        addLog('   ✓ Teacher doc written');

        // STEP 3: Create 40 students
        addLog('📝 Step 6: Creating 40 students...');
        const firstNames = ['Aaditya','Aarav','Aditi','Ananya','Arjun','Aryan','Ayush','Bhavya','Chaitanya','Dev','Diya','Eshaan','Gauri','Hari','Isha','Jatin','Kavya','Krish','Lakshay','Meera','Neha','Nikhil','Om','Pari','Pranav','Rahul','Riya','Rohan','Roshni','Sahil','Samar','Sanya','Shaurya','Shiv','Shreya','Sneha','Tanvi','Tarun','Vedant','Vidya'];
        const lastNames = ['Sharma','Verma','Gupta','Singh','Patel','Yadav','Joshi','Agarwal','Choudhary','Kumar','Das','Shah','Mehta','Mishra','Pandey','Reddy','Nair','Bose','Rao','Iyer'];
        
        const getRisk = (pct) => pct < 50 ? 'critical' : pct < 65 ? 'high' : pct < 75 ? 'medium' : 'low';
        
        const studentRefs = [];
        for (let i = 0; i < 40; i++) {
          const firstName = firstNames[i];
          const lastName = lastNames[(i * 3) % 20];
          const roll = `23CSE${String(i + 1).padStart(3, '0')}`;
          const basePct = 35 + ((i * 13) % 60);
          const riskLevel = getRisk(basePct);

          const ref = await addDoc(collection(db, 'students'), {
            name: `${firstName} ${lastName}`,
            rollNumber: roll,
            attendancePct: basePct,
            riskLevel,
            remedialEnrolled: riskLevel === 'critical',
            section: 'CSE-3A',
            phone: `+91 98${String(i).padStart(8, '0')}`,
            parentPhone: `+91 97${String(i).padStart(8, '0')}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          studentRefs.push({ id: ref.id, name: `${firstName} ${lastName}`, rollNumber: roll });
        }
        addLog(`   ✓ Created ${studentRefs.length} students`);

        // STEP 4: Create 2 attendance sessions
        addLog('📋 Step 7: Creating attendance sessions...');
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);
        const toISO = (d) => d.toISOString().split('T')[0];

        for (const sessionDate of [toISO(yesterday), toISO(twoDaysAgo)]) {
          const records = {};
          studentRefs.forEach((s, i) => {
            records[s.id] = i % 3 === 0 ? 'absent' : i % 3 === 1 ? 'present' : 'present';
          });
          const vals = Object.values(records);
          await addDoc(collection(db, 'attendance'), {
            teacherId: user.uid,
            section: 'CSE-3A',
            subject: 'DBMS',
            date: sessionDate,
            dateTs: Timestamp.fromDate(new Date(sessionDate)),
            records,
            summary: {
              total: studentRefs.length,
              present: vals.filter(v => v === 'present').length,
              absent: vals.filter(v => v === 'absent').length,
              late: 0
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        addLog('   ✓ Created 2 attendance sessions');

        // STEP 5: Create 2 assignments
        addLog('📚 Step 8: Creating assignments...');
        const assignments = [
          { title: 'ER Diagram — Hospital Management System', dueDate: new Date(today.getTime() + 3*24*60*60*1000), maxMarks: 10 },
          { title: 'SQL Queries — Library Database', dueDate: new Date(today.getTime() - 2*24*60*60*1000), maxMarks: 10 }
        ];

        for (const a of assignments) {
          const submissions = {};
          studentRefs.forEach((s, i) => {
            const status = i % 3 === 0 ? 'missing' : i % 3 === 1 ? 'submitted' : 'late';
            submissions[s.id] = {
              status,
              marks: status === 'submitted' ? 8 : status === 'late' ? 6 : null,
              submittedAt: status !== 'missing' ? Timestamp.now() : null
            };
          });
          const vals = Object.values(submissions);
          await addDoc(collection(db, 'assignments'), {
            teacherId: user.uid,
            section: 'CSE-3A',
            subject: 'DBMS',
            title: a.title,
            description: null,
            dueDate: Timestamp.fromDate(a.dueDate),
            maxMarks: a.maxMarks,
            submissions,
            stats: {
              total: vals.length,
              submitted: vals.filter(v => v.status === 'submitted').length,
              missing: vals.filter(v => v.status === 'missing').length,
              late: vals.filter(v => v.status === 'late').length,
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        addLog('   ✓ Created 2 assignments');

        // STEP 6: Create dummy follow-ups for students with < 75% attendance
        addLog('📞 Step 9: Creating follow-ups for at-risk students...');
        const atRiskStudents = studentRefs.filter(s => {
          const pct = 35 + ((studentRefs.indexOf(s) * 13) % 60);
          return pct < 75;
        });

        const followUpMethods = ['Call', 'Email', 'WhatsApp'];
        const followUpOutcomes = ['Reached Parent', 'No Response', 'Parent Aware', 'Student Promised Improvement'];
        
        let followUpsCreated = 0;
        for (const s of atRiskStudents) {
          // Give them 1 to 3 followups
          const numFollowUps = 1 + (studentRefs.indexOf(s) % 3);
          for (let j = 0; j < numFollowUps; j++) {
            const fDate = new Date(today);
            fDate.setDate(today.getDate() - (j * 2) - 1);
            
            await addDoc(collection(db, 'followups'), {
              studentId: s.id,
              teacherId: user.uid,
              teacherName: 'Prof. Anil Verma',
              method: followUpMethods[(studentRefs.indexOf(s) + j) % followUpMethods.length],
              outcome: followUpOutcomes[(studentRefs.indexOf(s) + j) % followUpOutcomes.length],
              notes: 'Discussed recent absences and remedial classes.',
              date: fDate.toISOString(),
              timestamp: serverTimestamp()
            });
            followUpsCreated++;
          }
        }
        addLog(`   ✓ Created ${followUpsCreated} follow-ups`);

        addLog('');
        addLog('✅ ALL DONE! Seeded students, attendance, assignments, and follow-ups.');
        setDone(true);
      } catch(err) {
        addLog('❌ ERROR: ' + err.message);
        console.error(err);
      }
    }

    runFullSeed();
  }, [user]);

  return (
    <div style={{ padding: '3rem', fontFamily: 'monospace', maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'system-ui', fontSize: '28px', marginBottom: '2rem' }}>FollowTrack Data Seeder</h1>
      <div style={{ backgroundColor: '#1a1a2e', color: '#16d89a', padding: '1.5rem', borderRadius: '12px', fontSize: '14px', lineHeight: 1.8 }}>
        {logs.length === 0 ? 'Waiting for authentication...' : logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
      {done && (
        <a href="/dashboard" style={{ 
          display: 'inline-block', marginTop: '2rem', padding: '14px 36px', backgroundColor: '#EF4623', 
          color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '16px'
        }}>
          Go to Dashboard →
        </a>
      )}
    </div>
  );
}

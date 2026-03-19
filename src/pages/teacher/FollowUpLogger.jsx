import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { collection, query, where, addDoc, orderBy, onSnapshot, Timestamp, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Phone, FileText, Activity, Search, Filter } from 'lucide-react';
import { computeRiskLevel, RISK_COLORS } from '../../lib/riskEngine';
import { getStudentsBySection } from '../../lib/firestore/students';
import { filterStudentsByName } from '../../lib/utils';
import { addFollowUp } from '../../lib/firestore/followups';
import './teacher.css';

export function FollowUpLogger() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentLoading, setSelectedStudentLoading] = useState(false);
  const [selectedStudentError, setSelectedStudentError] = useState('');
  const [studentHistory, setStudentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  const [formState, setFormState] = useState({
    type: 'call parent',
    date: new Date().toISOString().split('T')[0],
    outcome: '',
    notes: ''
  });

  const historyUnsubRef = useRef(null);
  const fetchedRef = useRef(false);

  const getAttendancePct = (s) => {
    const pct = s?.attendancePct ?? s?.attendancePercentage ?? s?.attendance ?? 0;
    const num = typeof pct === 'number' ? pct : parseFloat(String(pct));
    return Number.isFinite(num) ? num : 0;
  };

  const computeRiskFromStudent = (s) => computeRiskLevel(getAttendancePct(s));

  const formatFollowUpDate = (d) => {
    if (!d) return '—';
    try {
      const dt =
        d instanceof Timestamp ? d.toDate()
        : typeof d?.toDate === 'function' ? d.toDate()
        : typeof d === 'string' ? new Date(d)
        : d instanceof Date ? d
        : null;
      if (!dt || Number.isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(/ /g, ' ');
    } catch {
      return '—';
    }
  };

  useEffect(() => {
    if (!user) return;
    async function fetchData() {
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      try {
        setStudentsError('');
        setStudentsLoading(true);
        const allStudents = await getStudentsBySection(user.section);

        const needingFollowUp = allStudents
          .map(s => ({ ...s, attendancePct: getAttendancePct(s), riskLevel: computeRiskFromStudent(s) }))
          .filter(s => s.attendancePct < 75);

        setStudents(needingFollowUp);
      } catch (err) {
        console.error(err);
        setStudentsError('Failed to load students from the database.');
      } finally {
        setStudentsLoading(false);
      }
    }
    fetchData();
    return () => { fetchedRef.current = false; };
  }, [user]);

  useEffect(() => {
    const sid = searchParams.get('student');
    if (sid && students.length > 0) {
      const s = students.find(st => st.id === sid);
      if (s && (!selectedStudent || s.id !== selectedStudent.id)) {
        handleRowClick(s);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, students]);

  useEffect(() => {
    if (historyUnsubRef.current) {
      historyUnsubRef.current();
      historyUnsubRef.current = null;
    }

    if (!selectedStudent?.id) {
      setStudentHistory([]);
      setHistoryLoading(false);
      setHistoryError('');
      return;
    }

    setHistoryError('');
    setHistoryLoading(true);
    const hq = collection(db, 'students', selectedStudent.id, 'followUpLog');

    const unsub = onSnapshot(
      hq,
      (snap) => {
        const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rawDocs.sort((a, b) => {
          const tA = a.date?.toMillis ? a.date.toMillis() : 0;
          const tB = b.date?.toMillis ? b.date.toMillis() : 0;
          return tB - tA;
        });
        setStudentHistory(rawDocs);
        setHistoryLoading(false);
      },
      (err) => {
        console.error(err);
        setHistoryError('Failed to load follow-up history.');
        setHistoryLoading(false);
      }
    );

    historyUnsubRef.current = unsub;

    return () => {
      unsub();
      historyUnsubRef.current = null;
    };
  }, [selectedStudent]);

  const filteredStudents = useMemo(() => {
    const rf = riskFilter === 'All' ? 'All' : riskFilter.toLowerCase();
    let result = filterStudentsByName(students, debouncedSearch);

    result = result.filter(s => {
      const risk = (s.riskLevel || computeRiskFromStudent(s) || '').toLowerCase();
      return rf === 'All' || risk === rf;
    });

    result.sort((a, b) => {
      const nameA = (a.name || '').trim().toLowerCase();
      const nameB = (b.name || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return result;
  }, [students, debouncedSearch, riskFilter]);

  const stats = useMemo(() => {
    if (!studentHistory) return { total: 0, calls: 0, responses: 0, last: 'Never' };
    const total = studentHistory.length;
    const calls = studentHistory.filter(h => h.type === 'call').length;
    const responses = studentHistory.filter(h => h.notes).length;
    const last = total > 0 ? formatFollowUpDate(studentHistory[0]?.date) : 'Never';
    return { total, calls, responses, last };
  }, [studentHistory]);

  const handleRowClick = async (s) => {
    if (!s?.id) return;
    setSearchParams({ student: s.id });

    setSelectedStudentError('');
    setSelectedStudentLoading(true);
    try {
      const snap = await getDoc(doc(db, 'students', s.id));
      if (!snap.exists()) {
        setSelectedStudent(null);
        setSelectedStudentError('Student record not found.');
        return;
      }
      const full = { id: snap.id, ...snap.data() };
      const hydrated = { ...full, attendancePct: getAttendancePct(full), riskLevel: computeRiskFromStudent(full) };
      setSelectedStudent(hydrated);
      setFormState(prev => ({ ...prev, outcome: '', notes: '' }));
    } catch (err) {
      console.error(err);
      setSelectedStudent(null);
      setSelectedStudentError('Failed to load student details.');
    } finally {
      setSelectedStudentLoading(false);
    }
  };

  const handleLogFollowUp = async (e) => {
    e.preventDefault();
    setSaveError('');
    if (!selectedStudent?.id) {
      setSaveError('No student is selected.');
      return;
    }
    if (!formState.outcome.trim()) {
      setSaveError('Outcome is required.');
      return;
    }
    
    setSaving(true);
    try {
      const logData = {
        loggedById: user.uid,
        loggedByName: user.name,
        type: formState.type,
        date: Timestamp.fromDate(new Date(formState.date)),
        outcome: formState.outcome.trim(),
        notes: formState.notes.trim() || null,
        aiGenerated: false,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'students', selectedStudent.id, 'followUpLog'), logData);

      setToastMessage('Follow-up logged successfully');
      setFormState(prev => ({ ...prev, outcome: '', notes: '' }));
      setTimeout(() => setToastMessage(''), 3000);
      
    } catch (err) {
      console.error(err);
      setSaveError('Failed to save follow-up. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const StudentsTableSkeleton = () => (
    <Card style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ padding: '1.25rem 1.5rem', backgroundColor: 'var(--color-peach)' }}>
        <div style={{ height: 12, width: '40%', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 12, width: '25%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
      </div>
      <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: '55%', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ height: 10, width: '35%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
            </div>
            <div style={{ width: 70, height: 12, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
            <div style={{ width: 80, height: 22, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </Card>
  );

  const DetailSkeleton = () => (
    <Card style={{ border: 'none', boxShadow: '0 8px 40px rgba(0,0,0,0.06)', borderRadius: '24px', overflow: 'hidden' }}>
      <CardContent style={{ padding: '1.5rem' }}>
        <div style={{ height: 18, width: '60%', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 12, width: '45%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 44, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 12 }} />)}
        </div>
      </CardContent>
    </Card>
  );

  const TimelineSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ backgroundColor: '#fff', border: '1px solid var(--color-ink-10)', borderRadius: 12, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ height: 10, width: 90, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6 }} />
            <div style={{ height: 10, width: 80, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
          </div>
          <div style={{ height: 10, width: '65%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 10, width: '85%', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );

  const getActionIcon = (actionType) => {
    if (actionType === 'response') return <FileText size={14} />;
    return <Phone size={14} />;
  };

  return (
    <div className="page-wrapper animate-fade-up">
      <div className="followup-layout">
        
        {/* LEFT PANEL - STUDENTS LIST */}
        <div className="followup-timeline-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
             <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Students Requiring Follow-Up</h1>
             <p style={{ color: 'var(--color-ink)', opacity: 0.6, fontSize: '15px' }}>Attendance below 75%</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
             <div style={{ position: 'relative', flex: '1 1 200px' }}>
               <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink)', opacity: 0.5 }} />
               <Input 
                 placeholder="Search student..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 style={{ paddingLeft: '40px', width: '100%', backgroundColor: '#fff' }}
               />
             </div>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fff', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-20)' }}>
               <Filter size={16} style={{ color: 'var(--color-ink)', opacity: 0.5, marginLeft: '0.5rem' }} />
               <select 
                 value={riskFilter}
                 onChange={(e) => setRiskFilter(e.target.value)}
                 style={{ border: 'none', backgroundColor: 'transparent', padding: '0.5rem', outline: 'none', color: 'var(--color-ink)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
               >
                 <option value="All">All Risks</option>
                 <option value="critical">Critical</option>
                 <option value="high">High</option>
                 <option value="medium">Medium</option>
               </select>
             </div>
          </div>

          {studentsLoading ? (
            <StudentsTableSkeleton />
          ) : studentsError ? (
            <Card style={{ backgroundColor: 'var(--color-peach)', border: 'none' }}>
              <CardContent style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink)', opacity: 0.7 }}>
                {studentsError}
              </CardContent>
            </Card>
          ) : students.length === 0 ? (
            <Card style={{ backgroundColor: 'var(--color-peach)', border: 'none' }}>
              <CardContent style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink)', opacity: 0.7 }}>
                No students currently require follow-up.
              </CardContent>
            </Card>
          ) : (
            <Card style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-ink-10)', fontSize: '14px', color: 'var(--color-ink)', opacity: 0.6, backgroundColor: 'var(--color-peach)' }}>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>Student</th>
                      <th style={{ padding: '1.25rem 1rem', fontWeight: 600 }}>Attendance</th>
                      <th style={{ padding: '1.25rem 1rem', fontWeight: 600 }}>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-ink)', opacity: 0.5 }}>
                          No students match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(student => {
                        const riskCol = RISK_COLORS[student.riskLevel] || RISK_COLORS.low;
                        const isSelected = selectedStudent?.id === student.id;
                        return (
                          <tr 
                            key={student.id} 
                            onClick={() => handleRowClick(student)}
                            style={{ 
                              borderBottom: '1px solid var(--color-ink-10)', 
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'var(--color-ink-5)' : '#fff',
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <td style={{ padding: '1rem 1.5rem', maxWidth: '150px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-ink)', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</div>
                              <div style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Roll: {student.rollNumber}</div>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontWeight: 600, color: getAttendancePct(student) < 60 ? 'var(--color-coral)' : 'var(--color-ink)' }}>
                                {getAttendancePct(student)}%
                              </span>
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <Badge variant="outline" style={{ backgroundColor: riskCol.bg, color: riskCol.text, border: 'none', padding: '0.25rem 0.5rem', fontSize: '12px' }}>
                                {riskCol.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT PANEL - STUDENT CONTEXT */}
        <div className="followup-form-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: 0 }}>
          {selectedStudentLoading ? (
            <DetailSkeleton />
          ) : !selectedStudent ? (
            <Card style={{ backgroundColor: 'var(--color-peach)', border: 'none', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CardContent style={{ textAlign: 'center', opacity: 0.5, padding: '3rem' }}>
                <Activity size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                <p>{selectedStudentError || 'Select a student to view details.'}</p>
              </CardContent>
            </Card>
          ) : (
             <Card style={{ border: 'none', boxShadow: '0 8px 40px rgba(0,0,0,0.06)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 4rem)' }}>
                 
                 {/* 1. STUDENT INFORMATION SECTION */}
                 <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', borderBottom: '1px solid var(--color-ink-10)', backgroundColor: '#fff' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                     <div style={{ minWidth: 0, flex: 1 }}>
                       <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', color: 'var(--color-ink)', lineHeight: 1.2, marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                         {selectedStudent.name}
                       </h2>
                       <p style={{ color: 'var(--color-ink)', opacity: 0.6, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                         Roll: {selectedStudent.rollNumber} &nbsp;•&nbsp; Section: {selectedStudent.section}
                       </p>
                     </div>
                     <Badge variant="outline" style={{ backgroundColor: RISK_COLORS[selectedStudent.riskLevel]?.bg || RISK_COLORS.low.bg, color: RISK_COLORS[selectedStudent.riskLevel]?.text || RISK_COLORS.low.text, border: 'none', fontWeight: 600, padding: '0.25rem 0.75rem', flexShrink: 0 }}>
                       {RISK_COLORS[selectedStudent.riskLevel]?.label || 'Low'} Risk
                     </Badge>
                   </div>

                   <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', overflow: 'hidden' }}>
                     <div style={{ minWidth: 0, overflow: 'hidden' }}>
                       <p style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '0.25rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Attendance</p>
                       <p style={{ fontSize: '20px', fontFamily: 'var(--font-heading)', color: getAttendancePct(selectedStudent) < 60 ? 'var(--color-coral)' : 'var(--color-ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{getAttendancePct(selectedStudent)}%</p>
                     </div>
                     <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--color-ink-10)' }}></div>
                     <div style={{ minWidth: 0, overflow: 'hidden' }}>
                       <p style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '0.25rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Parent Phone</p>
                       <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{selectedStudent.parentPhone || 'Not available'}</p>
                     </div>
                     <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--color-ink-10)' }}></div>
                     <div style={{ minWidth: 0, overflow: 'hidden' }}>
                       <p style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '0.25rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Student Phone</p>
                       <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{selectedStudent.phone || 'Not available'}</p>
                     </div>
                   </div>
                 </div>

                 <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#FAFAFD' }}>
                   
                    {/* 2. FOLLOW-UP STATISTICS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
                       <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-10)', textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
                          <p style={{ fontSize: '11px', color: 'var(--color-ink)', opacity: 0.6, fontWeight: 600, marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Follow-Ups</p>
                          <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.total}</p>
                       </div>
                       <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-10)', textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
                          <p style={{ fontSize: '11px', color: 'var(--color-ink)', opacity: 0.6, fontWeight: 600, marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Calls</p>
                          <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.calls}</p>
                       </div>
                       <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-10)', textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
                          <p style={{ fontSize: '11px', color: 'var(--color-ink)', opacity: 0.6, fontWeight: 600, marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Responses</p>
                          <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.responses}</p>
                       </div>
                       <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-10)', textAlign: 'center', minWidth: 0, overflow: 'hidden' }}>
                          <p style={{ fontSize: '11px', color: 'var(--color-ink)', opacity: 0.6, fontWeight: 600, marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Last Follow-Up</p>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.last}</p>
                       </div>
                    </div>

                   {/* NEW STEP: 3-STEP FORM */}
                   <div style={{ marginBottom: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', padding: '1rem', border: '1px solid var(--color-ink-10)' }}>
                       <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)', opacity: 0.7, marginBottom: '6px' }}>
                         Log New Follow-Up Action
                       </label>

                       <div className="segmented-control" style={{ marginBottom: '16px' }}>
                         {['call parent', 'call student'].map(type => (
                           <button
                             key={type}
                             type="button"
                             className={`segmented-option ${formState.type === type ? 'active' : ''}`}
                             onClick={() => setFormState(p => ({ ...p, type }))}
                           >
                             {type === 'call parent' ? 'Call Parent' : 'Call Student'}
                           </button>
                         ))}
                       </div>

                       <div style={{ marginBottom: '16px' }}>
                         <Input
                           type="date"
                           value={formState.date}
                           onChange={(e) => setFormState(p => ({ ...p, date: e.target.value }))}
                         />
                       </div>

                       <div style={{ marginBottom: '16px' }}>
                         <Input
                           placeholder="Outcome (e.g. No answer, Left voicemail)..."
                           value={formState.outcome}
                           onChange={(e) => setFormState(p => ({ ...p, outcome: e.target.value }))}
                         />
                       </div>

                       <div style={{ marginBottom: '24px' }}>
                         <textarea
                           placeholder="Response or notes? (optional)"
                           value={formState.notes}
                           onChange={(e) => setFormState(p => ({ ...p, notes: e.target.value }))}
                           style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-ink-20)', fontFamily: 'var(--font-body)', fontSize: '14px', outline: 'none', resize: 'vertical', color: 'var(--color-ink)' }}
                           onFocus={(e) => e.target.style.borderColor = 'var(--color-coral)'}
                           onBlur={(e) => e.target.style.borderColor = 'var(--color-ink-20)'}
                         />
                       </div>

                       {saveError && (
                         <div style={{ color: 'var(--color-coral)', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>{saveError}</div>
                       )}

                       <Button 
                         onClick={handleLogFollowUp} 
                         disabled={saving || !formState.outcome.trim() || !selectedStudent}
                         style={{ width: '100%', backgroundColor: 'var(--color-coral)', color: '#fff', fontWeight: 600, borderRadius: '30px', border: 'none' }}
                       >
                         {saving ? 'Saving...' : 'Log Follow-Up'}
                       </Button>

                        {/* Toast */}
                        {toastMessage && (
                          <div className="toast-container" style={{ position: 'fixed', bottom: 20, right: 20, background: '#fff', borderLeft: '4px solid #16A34A', padding: '14px 20px', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.1)', zIndex: 100 }}>
                            <div className="toast success">{toastMessage}</div>
                          </div>
                        )}
                   </div>

                   {/* 5. FOLLOW-UP HISTORY TIMELINE */}
                   <div>
                     <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', marginBottom: '1rem', color: 'var(--color-ink)' }}>Previous Follow-Ups</h3>
                     
                     {historyLoading ? (
                       <TimelineSkeleton />
                     ) : historyError ? (
                       <div style={{ textAlign: 'center', opacity: 0.7, padding: '1rem 0', fontSize: '13px' }}>{historyError}</div>
                     ) : studentHistory.length === 0 ? (
                       <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem 0', fontSize: '13px', backgroundColor: 'var(--color-peach)', borderRadius: 'var(--radius-md)' }}>
                         No prior follow-ups recorded.
                       </div>
                     ) : (
                       <div className="timeline">
                         {studentHistory.map((h, i) => {
                            const isFirst = i === 0;
                            return (
                              <div key={h.id} className="timeline-entry">
                                 <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-coral)' }}>{formatFollowUpDate(h.date)}</span>
                                      <span style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.5 }}>by {h.loggedByName?.split(' ')[0] || 'Teacher'}</span>
                                    </div>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem', textTransform: 'capitalize' }}>
                                      {h.type}
                                    </p>
                                    <div style={{ fontSize: '14px', color: 'var(--color-ink)', fontWeight: 500, marginBottom: '6px' }}>
                                      <span style={{ fontSize: '12px', opacity: 0.6, marginRight: '4px' }}>Outcome:</span> {h.outcome}
                                    </div>
                                    {h.notes && (
                                      <div style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.8, lineHeight: 1.5, backgroundColor: 'var(--color-ink-5)', padding: '0.75rem', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                        {h.notes}
                                      </div>
                                    )}
                                 </div>
                              </div>
                            );
                         })}
                       </div>
                     )}
                   </div>

                 </div>
             </Card>
          )}
        </div>
      </div>

    </div>
  );
}

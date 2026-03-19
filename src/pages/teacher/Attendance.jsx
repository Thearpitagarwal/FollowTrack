import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  getAttendanceSession, 
  getAllSessionsBySection, 
  saveAttendanceSession 
} from '../../lib/firestore/attendance';
import { getStudentsBySection } from '../../lib/firestore/students';
import { getAllFollowUps } from '../../lib/firestore/followups';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { Eye } from 'lucide-react';
import { filterStudentsByName } from '../../lib/utils';
import './teacher.css';

export function Attendance() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('mark');

  const subject = user?.subject || '';
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  
  const [records, setRecords] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [followUpsMap, setFollowUpsMap] = useState({});
  
  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const summary = {
    total: students.length,
    present: Object.values(records).filter(v => v === 'present').length,
    absent: Object.values(records).filter(v => v === 'absent').length,
  };

  // Filtered students (always alphabetically sorted A-Z)
  const filteredStudents = useMemo(() => {
    let result = filterStudentsByName(students, debouncedSearch);
    
    // Sort alphabetically A-Z
    result.sort((a, b) => {
      const nameA = (a.name || '').trim().toLowerCase();
      const nameB = (b.name || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return result;
  }, [students, debouncedSearch]);

  const handleLoadSheet = async () => {
    setIsSheetLoading(true);
    setIsLoaded(false);
    setSaveSuccess(false);
    try {
      const fetchedStudents = await getStudentsBySection(user.section);
      // Force strict deduplication just in case
      const finalMap = new Map();
      fetchedStudents.forEach(s => {
        const key = s.rollNumber ? s.rollNumber.trim().toLowerCase() : s.id;
        finalMap.set(key, s);
      });
      const uniqueStudents = Array.from(finalMap.values());
      setStudents(uniqueStudents);

      try {
        const allFollowUps = await getAllFollowUps();
        const fMap = {};
        allFollowUps.forEach(f => {
          fMap[f.studentId] = f;
        });
        setFollowUpsMap(fMap);
      } catch (err) {
        console.error('Failed to load follow-ups for attendance sheet', err);
      }

      const session = await getAttendanceSession(user.section, subject, date);
      if (session && session.records) {
        // Migrate any 'late' records to 'present' automatically to prevent missing states
        const migratedRecords = {};
        Object.entries(session.records).forEach(([id, status]) => {
          migratedRecords[id] = status === 'late' ? 'present' : status;
        });
        setRecords(migratedRecords);
      } else {
        const initialRecords = {};
        uniqueStudents.forEach(st => initialRecords[st.id] = 'present');
        setRecords(initialRecords);
      }
      setIsLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSheetLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveAttendanceSession({
        teacherId: user.uid,
        section: user.section,
        subject,
        date,
        records,
        students
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Error saving attendance');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusToggle = (studentId, status) => {
    setRecords(prev => {
      if (prev[studentId] === status) return prev;
      return { ...prev, [studentId]: status };
    });
  };

  const handleMarkAll = (status) => {
    const newRecords = {};
    students.forEach(st => newRecords[st.id] = status);
    setRecords(newRecords);
  };

  const getHealthColor = (pct) => {
    if (pct < 50) return '#EF4623';
    if (pct < 65) return '#D97706';
    if (pct < 75) return '#2563EB';
    return '#16A34A';
  };

  return (
    <div className="page-wrapper animate-fade-up">
      <div className="attendance-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Attendance</h1>
        <div style={{ 
          padding: '0.4rem 1rem', backgroundColor: 'var(--color-ink-10)', borderRadius: 'var(--radius-pill)',
          fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)' 
        }}>
          {subject}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList style={{ marginBottom: '2rem' }}>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="mark">
          {/* Date Picker + Load Button */}
          <div className="session-summary-bar">
            <div className="attendance-controls">
              <label style={{ fontSize: '14px', fontWeight: 600 }}>Date:</label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                style={{ width: '180px' }}
              />
              <Button className="load-btn" onClick={handleLoadSheet} disabled={isSheetLoading}>
                {isSheetLoading ? 'Loading...' : 'Load Sheet'}
              </Button>
            </div>
            
            {isLoaded && (
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '14px', fontWeight: 600 }}>
                <span className="summary-item" style={{ color: '#16A34A' }}>● Present: {summary.present}</span>
                <span className="summary-item" style={{ color: '#EF4623' }}>● Absent: {summary.absent}</span>
                <span className="summary-item" style={{ color: 'var(--color-ink)', opacity: 0.5 }}>Total: {summary.total}</span>
              </div>
            )}
          </div>

          {/* Attendance Sheet */}
          {!isLoaded && !isSheetLoading ? (
            <div style={{ backgroundColor: 'var(--color-peach)', padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '20px', color: 'var(--color-coral)' }}>Select a date and click "Load Sheet" to begin</p>
            </div>
          ) : isSheetLoading ? (
             <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-ink)', opacity: 0.5 }}>Loading...</div>
          ) : (
            <>
              {/* Search + Quick Actions */}
              <div className="attendance-controls" style={{ marginBottom: '1rem', justifyContent: 'space-between' }}>
                <div className="bulk-actions">
                  <Input 
                    placeholder="Search by name or roll..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '220px' }}
                  />
                  <Button variant="outline" onClick={() => handleMarkAll('present')} style={{ borderColor: '#16A34A', color: '#16A34A' }}>All Present</Button>
                  <Button variant="outline" onClick={() => handleMarkAll('absent')} style={{ borderColor: '#EF4623', color: '#EF4623' }}>All Absent</Button>
                </div>
              </div>

              {/* Student List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredStudents.map((st, idx) => {
                  const status = records[st.id] || 'present';
                  const healthColor = getHealthColor(st.attendancePct);
                  const latestFollowUp = followUpsMap[st.id];
                  
                  return (
                    <div key={st.id} className={`attendance-student-card ${idx < 5 ? 'animate-fade-up' : ''}`} style={{ animationDelay: idx < 5 ? `${idx * 0.03}s` : undefined }}>
                      <div className="attendance-student-info">
                        {/* Health Dot */}
                        <div style={{ 
                          width: '10px', height: '10px', borderRadius: '50%', 
                          backgroundColor: healthColor, flexShrink: 0,
                          boxShadow: `0 0 6px ${healthColor}40`
                        }} title={`${st.attendancePct}% attendance`} />

                        {/* Name + Roll + Follow-up */}
                        <div>
                          <div className="attendance-student-name">{st.name}</div>
                          <div className="attendance-student-meta">
                            <span style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.5 }}>{st.rollNumber}</span>
                            {latestFollowUp && (
                              <div style={{ fontSize: '11px', color: 'var(--color-ink)', opacity: 0.7, backgroundColor: 'var(--color-ink-5)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                                {latestFollowUp.type === 'response' ? `📝 Note` : `📞 Call`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Attendance Bar */}
                      <div className="attendance-pct-mini">
                        <div className="progress-bar-track" style={{ flex: 1 }}>
                          <div className="progress-bar-fill" style={{ backgroundColor: healthColor, width: `${st.attendancePct}%` }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: healthColor, width: '35px', textAlign: 'right' }}>{st.attendancePct}%</span>
                      </div>

                      {/* Status Toggle Pills - Only Present and Absent */}
                      <div className="pal-buttons">
                        <button
                          className={`pal-btn present ${status === 'present' ? 'active' : ''}`}
                          onClick={() => handleStatusToggle(st.id, 'present')}
                        >P</button>
                        <button
                          className={`pal-btn absent ${status === 'absent' ? 'active' : ''}`}
                          onClick={() => handleStatusToggle(st.id, 'absent')}
                        >A</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="attendance-save-footer">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
                  {saveSuccess && <span style={{ fontSize: '14px', color: '#16A34A', fontWeight: 600 }}>✓ Saved!</span>}
                  <Button onClick={handleSaveAttendance} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryTab({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const fetched = await getAllSessionsBySection(user.section);
        const relevant = fetched.filter(s => s.subject === user.subject);
        setSessions(relevant);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user]);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>Loading history...</div>;

  return (
    <Card className="animate-fade-up">
      <CardContent style={{ padding: 0 }}>
        {sessions.length === 0 ? (
          <div style={{ backgroundColor: 'var(--color-peach)', padding: '3rem', textAlign: 'center' }}>
             <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '20px' }}>No session history yet.</p>
          </div>
        ) : (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{formatDate(s.date)}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                        <strong>{(s.summary?.present || 0) + (s.summary?.late || 0)}</strong>
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4623' }}></span>
                        <strong>{s.summary?.absent || 0}</strong>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="outline" size="sm" onClick={() => alert('View session details: ' + s.date)}>
                        <Eye size={16} style={{ marginRight: '6px' }} /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(isoDateString) {
  if (!isoDateString) return '';
  const [y, m, d] = isoDateString.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

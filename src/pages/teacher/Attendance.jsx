import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  getAttendanceSession, 
  getAllSessionsBySection, 
  saveAttendanceSession 
} from '../../lib/firestore/attendance';
import { getStudentsBySection } from '../../lib/firestore/students';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { Eye } from 'lucide-react';

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
  
  const summary = {
    total: students.length,
    present: Object.values(records).filter(v => v === 'present').length,
    absent: Object.values(records).filter(v => v === 'absent').length,
    late: Object.values(records).filter(v => v === 'late').length,
  };

  const handleLoadSheet = async () => {
    setIsSheetLoading(true);
    setIsLoaded(false);
    setSaveSuccess(false);
    try {
      const fetchedStudents = await getStudentsBySection(user.section);
      setStudents(fetchedStudents);

      const session = await getAttendanceSession(user.section, subject, date);
      if (session && session.records) {
        setRecords(session.records);
      } else {
        const initialRecords = {};
        fetchedStudents.forEach(st => initialRecords[st.id] = 'present');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
          <Card style={{ marginBottom: '1.5rem' }}>
            <CardContent style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '14px', fontWeight: 600 }}>Date:</label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                style={{ width: '180px' }}
              />
              <Button onClick={handleLoadSheet} disabled={isSheetLoading}>
                {isSheetLoading ? 'Loading...' : 'Load Sheet'}
              </Button>
              
              {isLoaded && (
                <>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '14px', fontWeight: 600 }}>
                    <span style={{ color: '#16A34A' }}>● Present: {summary.present}</span>
                    <span style={{ color: '#EF4623' }}>● Absent: {summary.absent}</span>
                    <span style={{ color: '#D97706' }}>● Late: {summary.late}</span>
                    <span style={{ color: 'var(--color-ink)', opacity: 0.5 }}>Total: {summary.total}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attendance Sheet */}
          {!isLoaded && !isSheetLoading ? (
            <div style={{ backgroundColor: 'var(--color-peach)', padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '20px', color: 'var(--color-coral)' }}>Select a date and click "Load Sheet" to begin</p>
            </div>
          ) : isSheetLoading ? (
             <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-ink)', opacity: 0.5 }}>Loading...</div>
          ) : (
            <>
              {/* Quick Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => handleMarkAll('present')} style={{ fontSize: '13px', color: '#16A34A', background: 'none', border: '1px solid #16A34A', borderRadius: 'var(--radius-pill)', padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>
                    All Present
                  </button>
                  <button onClick={() => handleMarkAll('absent')} style={{ fontSize: '13px', color: '#EF4623', background: 'none', border: '1px solid #EF4623', borderRadius: 'var(--radius-pill)', padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>
                    All Absent
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {saveSuccess && <span style={{ fontSize: '14px', color: '#16A34A', fontWeight: 600 }}>✓ Saved!</span>}
                  <Button onClick={handleSaveAttendance} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </div>
              </div>

              {/* Student List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {students.map((st, idx) => {
                  const status = records[st.id] || 'present';
                  const healthColor = getHealthColor(st.attendancePct);
                  
                  return (
                    <div key={st.id} className={idx < 5 ? 'animate-fade-up' : ''} style={{ 
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '12px 16px', backgroundColor: '#fff', 
                      border: '1px solid var(--color-ink-10)', borderRadius: 'var(--radius-md)',
                      animationDelay: idx < 5 ? `${idx * 0.03}s` : undefined
                    }}>
                      {/* Health Dot */}
                      <div style={{ 
                        width: '10px', height: '10px', borderRadius: '50%', 
                        backgroundColor: healthColor, flexShrink: 0,
                        boxShadow: `0 0 6px ${healthColor}40`
                      }} title={`${st.attendancePct}% attendance`} />

                      {/* Name + Roll */}
                      <div style={{ width: '180px', flexShrink: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '15px', lineHeight: 1.2 }}>{st.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.5 }}>{st.rollNumber}</div>
                      </div>

                      {/* Attendance Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '160px', flexShrink: 0 }}>
                        <div style={{ flex: 1, backgroundColor: 'var(--color-ink-10)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', backgroundColor: healthColor, width: `${st.attendancePct}%`, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: healthColor, width: '35px', textAlign: 'right' }}>{st.attendancePct}%</span>
                      </div>

                      {/* Spacer */}
                      <div style={{ flex: 1 }} />

                      {/* Status Toggle Pills */}
                      <div style={{ display: 'inline-flex', backgroundColor: 'var(--color-ink-10)', padding: '3px', borderRadius: 'var(--radius-pill)' }}>
                        <button
                          onClick={() => handleStatusToggle(st.id, 'present')}
                          style={{
                            padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            backgroundColor: status === 'present' ? '#16A34A' : 'transparent',
                            color: status === 'present' ? '#fff' : 'var(--color-ink)',
                            transition: 'all 0.15s',
                          }}
                        >P</button>
                        <button
                          onClick={() => handleStatusToggle(st.id, 'absent')}
                          style={{
                            padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            backgroundColor: status === 'absent' ? '#EF4623' : 'transparent',
                            color: status === 'absent' ? '#fff' : 'var(--color-ink)',
                            transition: 'all 0.15s',
                          }}
                        >A</button>
                        <button
                          onClick={() => handleStatusToggle(st.id, 'late')}
                          style={{
                            padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            backgroundColor: status === 'late' ? '#D97706' : 'transparent',
                            color: status === 'late' ? '#fff' : 'var(--color-ink)',
                            transition: 'all 0.15s',
                          }}
                        >L</button>
                      </div>
                    </div>
                  );
                })}
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-ink-10)' }}>
                  <th style={{ padding: '1rem', color: 'var(--color-ink)', opacity: 0.5, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                  <th style={{ padding: '1rem', color: 'var(--color-ink)', opacity: 0.5, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Present</th>
                  <th style={{ padding: '1rem', color: 'var(--color-ink)', opacity: 0.5, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Absent</th>
                  <th style={{ padding: '1rem', color: 'var(--color-ink)', opacity: 0.5, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Late</th>
                  <th style={{ padding: '1rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-ink-10)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{formatDate(s.date)}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                        <strong>{s.summary?.present || 0}</strong>
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4623' }}></span>
                        <strong>{s.summary?.absent || 0}</strong>
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }}></span>
                        <strong>{s.summary?.late || 0}</strong>
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
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

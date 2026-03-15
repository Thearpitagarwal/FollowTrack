import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ROUTES } from '../../router/routes';
import { Activity } from 'lucide-react';

export function FollowUpLogger() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialStudentId = searchParams.get('student') || '';

  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    studentId: initialStudentId,
    method: 'In-Person',
    status: 'Reached',
    notes: ''
  });

  const methods = ['In-Person', 'Phone Call', 'WhatsApp', 'Email'];
  const statuses = ['Reached', 'Left Message', 'Invalid Number', 'Meeting Scheduled'];

  useEffect(() => {
    if (!user) return;
    async function fetchStudents() {
      try {
        const q = query(collection(db, 'students'), where('section', '==', user.section), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [user]);

  useEffect(() => {
    // Re-check URL when location changes to support "Back/Forward" or link clicks from My Students
    const sid = searchParams.get('student');
    if (sid && sid !== formData.studentId) {
      setFormData(prev => ({ ...prev, studentId: sid }));
    }
  }, [location.search]);

  useEffect(() => {
    if (!formData.studentId) {
      setHistory([]);
      return;
    }
    async function fetchHistory() {
      try {
        const hq = query(collection(db, 'students', formData.studentId, 'followUpLog'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(hq);
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    }
    fetchHistory();
  }, [formData.studentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentId) return alert('Select a student first');
    
    setSaving(true);
    try {
      await addDoc(collection(db, 'students', formData.studentId, 'followUpLog'), {
        teacherId: user.uid,
        teacherName: user.name,
        method: formData.method,
        status: formData.status,
        notes: formData.notes,
        date: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp()
      });
      alert('Follow-Up logged successfully!');
      
      // Navigate back to MyStudents (Dashboard or where they came from)
      navigate('/students');
    } catch (err) {
      console.error(err);
      alert('Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-wrapper animate-fade-up"><div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>Loading students...</div></div>;

  return (
    <div className="page-wrapper animate-fade-up">
      <h1 className="page-title">Follow-Up Logger</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: '2rem', alignItems: 'start' }}>
        <Card>
          <CardContent style={{ padding: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', marginBottom: '1.5rem' }}>New Entry</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>Select Student *</label>
                <select 
                  required 
                  value={formData.studentId} 
                  onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-20)', fontFamily: 'var(--font-body)' }}
                >
                  <option value="" disabled>Select a student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.rollNumber})</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>Contact Method *</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {methods.map(m => (
                    <button 
                      key={m} type="button" 
                      onClick={() => setFormData({ ...formData, method: m })}
                      style={{ 
                        flex: 1, minWidth: '100px', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        border: formData.method === m ? '1px solid var(--color-coral)' : '1px solid var(--color-ink-20)',
                        backgroundColor: formData.method === m ? 'var(--color-peach)' : 'transparent',
                        color: formData.method === m ? 'var(--color-coral)' : 'var(--color-ink)'
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>Status *</label>
                <select 
                  required 
                  value={formData.status} 
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-20)', fontFamily: 'var(--font-body)' }}
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem' }}>Notes *</label>
                <textarea 
                  required
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Summarize the discussion..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-20)', fontFamily: 'var(--font-body)', minHeight: '100px', resize: 'vertical' }}
                />
              </div>

              <Button type="submit" disabled={saving || !formData.studentId} style={{ marginTop: '0.5rem' }}>
                {saving ? 'Saving...' : 'Log Follow-Up'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: 'var(--color-peach)', border: 'none', animationDelay: '0.1s' }} className="animate-fade-up">
          <CardContent style={{ padding: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', marginBottom: '1.5rem' }}>Student Timeline Tracker</h3>
            
            {!formData.studentId ? (
              <div style={{ color: 'var(--color-ink)', opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: '4rem' }}>
                Select a student to view their follow-up history.
              </div>
            ) : history.length === 0 ? (
               <div style={{ color: 'var(--color-ink)', opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: '4rem' }}>
                 No prior follow-ups recorded.
               </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '16px', width: '2px', backgroundColor: 'var(--color-ink-10)' }} />
                  {history.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1 }}>
                       <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#fff', color: 'var(--color-coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-ink-10)' }}>
                         <Activity size={16} />
                       </div>
                       <div style={{ flex: 1, backgroundColor: '#fff', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-10)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                             <span style={{ fontWeight: 600, fontSize: '14px' }}>{h.method} • {h.status}</span>
                             <span style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6 }}>{h.date}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.8, lineHeight: 1.5 }}>{h.notes}</p>
                       </div>
                    </div>
                  ))}
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

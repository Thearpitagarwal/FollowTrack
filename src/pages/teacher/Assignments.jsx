import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  getAssignmentsBySection, 
  createAssignment, 
  deleteAssignment, 
  updateSubmission, 
  bulkUpdateSubmissions 
} from '../../lib/firestore/assignments';
import { getStudentsBySection } from '../../lib/firestore/students';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Trash2, Plus, ArrowLeft } from 'lucide-react';

const STATUS_COLORS = {
  submitted: { active: '#16A34A' },
  missing:   { active: '#EF4623' },
  late:      { active: '#D97706' },
  none:      { active: '#FFFFFF' }
};

export function Assignments() {
  const { user } = useAuthStore();
  
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null); // null means viewing list, else opens slide-in panel

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [fetchedAssig, fetchedStudents] = await Promise.all([
        getAssignmentsBySection(user.section),
        getStudentsBySection(user.section)
      ]);
      setAssignments(fetchedAssig);
      setStudents(fetchedStudents.reduce((acc, s) => ({...acc, [s.id]: s}), {}));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this assignment? This cannot be undone.")) return;
    try {
      await deleteAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
      if (activeAssignment?.id === id) setActiveAssignment(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAssignments = assignments.filter(a => a.subject === user.subject);

  return (
    <div className="page-wrapper animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Assignments</h1>
        <Button onClick={() => setIsModalOpen(true)}><Plus size={18} style={{ marginRight: '6px' }}/> New Assignment</Button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
           {[1,2,3].map(i => <Card key={i}><CardContent style={{ height: '180px', backgroundColor: 'var(--color-peach)', opacity: 0.5 }} /></Card>)}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div style={{ backgroundColor: 'var(--color-peach)', padding: '4rem', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '20px', color: 'var(--color-coral)' }}>No assignments found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredAssignments.map((a, i) => (
            <AssignmentCard 
              key={a.id} 
              assignment={a} 
              isActive={activeAssignment?.id === a.id}
              onView={() => setActiveAssignment(a)} 
              onDelete={() => handleDelete(a.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Slide-in Submission Panel Overlay */}
      {activeAssignment && (
        <>
          {/* Backdrop */}
          <div 
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 40 }} 
            onClick={() => { setActiveAssignment(null); loadData(); }}
          />
          {/* Panel */}
          <div className="animate-fade-up" style={{ 
            position: 'fixed', 
            top: 0, 
            right: 0, 
            bottom: 0, 
            width: '100%', 
            maxWidth: '600px', 
            backgroundColor: 'var(--color-bg)', 
            boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
            zIndex: 50,
            animation: 'slideInRight 0.3s ease-out forwards',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <SubmissionPanel 
              assignment={activeAssignment} 
              students={students} 
              onClose={() => { setActiveAssignment(null); loadData(); }} 
            />
          </div>
        </>
      )}

      {isModalOpen && (
        <CreateAssignmentModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => { setIsModalOpen(false); loadData(); }} 
          user={user} 
        />
      )}
    </div>
  );
}

function AssignmentCard({ assignment, isActive, onView, onDelete, index }) {
  const isOverdue = assignment.dueDate.toDate() < new Date() && assignment.stats.missing > 0;
  
  // Date Proximity color banding
  const now = new Date();
  const due = assignment.dueDate.toDate();
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let dateBadgeBg = 'var(--color-ink-10)';
  let dateBadgeText = 'var(--color-ink)';
  if (diffDays < 0 && assignment.stats.missing > 0) {
    // Overdue
    dateBadgeBg = '#FEE2E2'; // Coral light
    dateBadgeText = '#DC2626'; // Coral dark
  } else if (diffDays <= 3 && diffDays >= 0) {
    // Due Soon
    dateBadgeBg = '#FEF3C7'; // Amber light
    dateBadgeText = '#B45309'; // Amber dark
  } else if (assignment.stats.missing === 0 && assignment.stats.total > 0) {
     // All Submitted
     dateBadgeBg = '#DCFCE7'; // Green light
     dateBadgeText = '#15803D'; // Green dark
  }
  
  return (
    <Card className="animate-fade-up" style={{ 
      animationDelay: `${index * 0.05}s`, 
      display: 'flex', 
      flexDirection: 'column',
      border: isActive ? '2px solid var(--color-ink)' : '1px solid var(--color-ink-10)',
      transform: isActive ? 'scale(1.02)' : 'none',
      transition: 'all 0.2s',
      boxShadow: isActive ? 'var(--shadow-card-hover)' : 'var(--shadow-card)'
    }}>
      <CardContent style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <Badge variant="outline" style={{ backgroundColor: dateBadgeBg, color: dateBadgeText, border: 'none', fontWeight: 600 }}>
            {diffDays < 0 ? 'Overdue' : diffDays === 0 ? 'Due Today' : `Due in ${diffDays} day${diffDays !== 1 ? 's': ''}`}
          </Badge>
          <span style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.6 }}>
            {formatDate(assignment.dueDate.toDate().toISOString())}
          </span>
        </div>
        
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', marginBottom: '0.25rem' }}>{assignment.title}</h3>
        <p style={{ fontSize: '14px', color: 'var(--color-ink)', opacity: 0.7, marginBottom: '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {assignment.description || 'No description'}
        </p>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ width: '100%', backgroundColor: 'var(--color-ink-10)', height: '6px', borderRadius: 'var(--radius-pill)', marginBottom: '0.5rem', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              backgroundColor: 'var(--color-coral)', 
              width: `${(assignment.stats.submitted + assignment.stats.late) / assignment.stats.total * 100 || 0}%` 
            }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '13px', color: 'var(--color-ink)', opacity: 0.7, marginBottom: '1.5rem' }}>
            <span>Sub: {assignment.stats.submitted}</span>
            <span>Miss: {assignment.stats.missing}</span>
            <span>Late: {assignment.stats.late}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="outline" onClick={onView} style={{ flex: 1, marginRight: '1rem' }}>View Submissions</Button>
            <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)', opacity: 0.5 }}>
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateAssignmentModal({ onClose, onSuccess, user }) {
  const [formData, setFormData] = useState({
    title: '', description: '', 
    dueDate: new Date().toISOString().split('T')[0], maxMarks: 10
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const students = await getStudentsBySection(user.section);
      await createAssignment({
        teacherId: user.uid,
        section: user.section,
        subject: user.subject,
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        maxMarks: formData.maxMarks,
        students
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <Card style={{ width: '100%', maxWidth: '500px' }} className="animate-fade-up">
        <form onSubmit={handleSubmit}>
          <CardContent style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', marginBottom: '0.5rem' }}>New Assignment</h2>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '0.25rem' }}>Title *</label>
              <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Lab Report 1" />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '0.25rem' }}>Subject</label>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-ink-10)', borderRadius: 'var(--radius-md)', fontSize: '14px' }}>
                {user.subject}
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-ink-20)', fontFamily: 'var(--font-body)', minHeight: '80px', resize: 'vertical' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '0.25rem' }}>Due Date *</label>
                <Input required type="date" value={formData.dueDate} min={new Date().toISOString().split('T')[0]} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
              </div>
              <div style={{ width: '120px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '0.25rem' }}>Max Marks *</label>
                <Input required type="number" min="1" value={formData.maxMarks} onChange={e => setFormData({...formData, maxMarks: parseInt(e.target.value, 10)})} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

function SubmissionPanel({ assignment, students, onClose }) {
  const [localSubmissions, setLocalSubmissions] = useState(assignment.submissions);
  const [snapshotSubmissions, setSnapshotSubmissions] = useState(assignment.submissions); // For Revert functionality
  const [savingRow, setSavingRow] = useState(null);

  const handleUpdate = async (studentId, status, marks) => {
    setSavingRow(studentId);
    try {
      await updateSubmission(assignment.id, studentId, status, marks);
      setLocalSubmissions(prev => ({
        ...prev,
        [studentId]: { status, marks, submittedAt: status === 'submitted' ? new Date() : null }
      }));
    } catch (err) {
      console.error("Update failed", err);
    }
    setTimeout(() => setSavingRow(null), 1000);
  };

  const handleBulk = async (status) => {
    const studentIds = Object.keys(students);
    try {
      await bulkUpdateSubmissions(assignment.id, studentIds, status);
      const newSubs = { ...localSubmissions };
      studentIds.forEach(id => {
        newSubs[id] = { status, marks: newSubs[id]?.marks || null, submittedAt: status === 'submitted' ? new Date() : null };
      });
      setLocalSubmissions(newSubs);
    } catch (err) {
      console.error(err);
    }
  };

  // Convert map to array for rendering
  const studentRows = Object.values(students);
  // Re-calculate stats based on local state for the summary row
  const stats = {
    total: studentRows.length,
    submitted: Object.values(localSubmissions).filter(v => v.status === 'submitted').length,
    missing: Object.values(localSubmissions).filter(v => v.status === 'missing').length,
    late: Object.values(localSubmissions).filter(v => v.status === 'late').length,
  };
  
  let validMarks = 0; let totalMarks = 0;
  Object.values(localSubmissions).forEach(v => {
    if (v.marks !== null && v.marks !== undefined) {
      validMarks++;
      totalMarks += v.marks;
    }
  });
  const avgMarks = validMarks > 0 ? (totalMarks / validMarks).toFixed(1) : '0';

  const handleRevert = () => {
    setLocalSubmissions(snapshotSubmissions);
    // Since we write instantly, reverting means rewriting the old snapshot instantly
    const studentIds = Object.keys(snapshotSubmissions);
    // Replay writes
    studentIds.forEach(id => {
       const o = snapshotSubmissions[id];
       if(o) updateSubmission(assignment.id, id, o.status, o.marks);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '2rem', borderBottom: '1px solid var(--color-ink-10)', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)', opacity: 0.7, fontWeight: 600, padding: 0, marginBottom: '1.5rem' }}>
          <ArrowLeft size={18} /> Close Panel
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', margin: 0 }}>{assignment.title}</h2>
        </div>
        <p style={{ color: 'var(--color-ink)', opacity: 0.7, margin: 0 }}>Max Marks: {assignment.maxMarks} • Avg: {avgMarks}</p>
      </div>

      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-ink-10)', backgroundColor: 'var(--color-peach)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>
          Sub: {stats.submitted} • Miss: {stats.missing} • Late: {stats.late}
        </span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleRevert} style={{ fontSize: '14px', color: 'var(--color-amber)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>↻ Revert</button>
        </div>
      </div>

      {/* List Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.5rem' }}>
            {studentRows.map(st => {
              const sub = localSubmissions[st.id] || { status: 'missing', marks: null };
              const isSaved = savingRow === st.id;
              
              return (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', padding: '1rem', backgroundColor: '#fff', border: '1px solid var(--color-ink-10)', borderRadius: 'var(--radius-md)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{st.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6 }}>{st.rollNumber}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                     <div style={{ display: 'inline-flex', gap: '0.25rem', backgroundColor: 'var(--color-ink-10)', padding: '4px', borderRadius: 'var(--radius-pill)' }}>
                        <button onClick={() => handleUpdate(st.id, 'submitted', sub.marks)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontWeight: 600, backgroundColor: sub.status === 'submitted' ? STATUS_COLORS.submitted.active : 'transparent', color: sub.status === 'submitted' ? '#fff' : 'var(--color-ink)', transition: 'all 0.2s', fontSize: '13px' }} title="Submitted">S</button>
                        <button onClick={() => handleUpdate(st.id, 'missing', null)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontWeight: 600, backgroundColor: sub.status === 'missing' ? STATUS_COLORS.missing.active : 'transparent', color: sub.status === 'missing' ? '#fff' : 'var(--color-ink)', transition: 'all 0.2s', fontSize: '13px' }} title="Missing">M</button>
                        <button onClick={() => handleUpdate(st.id, 'late', sub.marks)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontWeight: 600, backgroundColor: sub.status === 'late' ? STATUS_COLORS.late.active : 'transparent', color: sub.status === 'late' ? '#fff' : 'var(--color-ink)', transition: 'all 0.2s', fontSize: '13px' }} title="Late">L</button>
                     </div>
                     
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '80px', justifyContent: 'center' }}>
                        {sub.status === 'missing' ? (
                          <span style={{ color: 'var(--color-ink)', opacity: 0.3, fontSize: '20px' }}>—</span>
                        ) : (
                          <Input 
                            type="number" 
                            min="0" max={assignment.maxMarks} 
                            value={sub.marks === null ? '' : sub.marks} 
                            onChange={(e) => handleUpdate(st.id, sub.status, e.target.value === '' ? null : parseInt(e.target.value, 10))}
                            style={{ padding: '0.4rem', height: 'auto', width: '60px', textAlign: 'center', fontWeight: '600' }}
                          />
                        )}
                     </div>

                     <div style={{ width: '20px', textAlign: 'center' }}>
                       <span style={{ opacity: isSaved ? 1 : 0, color: '#16A34A', fontWeight: 700, transition: 'opacity 0.2s', fontSize: '16px' }}>✓</span>
                     </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function formatDate(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('T')[0].split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}

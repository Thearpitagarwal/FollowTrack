import React, { useState, useEffect, useMemo } from 'react';
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
import { filterStudentsByName } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Trash2, Plus, ArrowLeft, Search } from 'lucide-react';
import './teacher.css';

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
  const [activeAssignment, setActiveAssignment] = useState(null);

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
      // Deduplicate assignments by id
      const seenAssig = new Map();
      fetchedAssig.forEach(a => { if (!seenAssig.has(a.id)) seenAssig.set(a.id, a); });

      setAssignments(Array.from(seenAssig.values()));
      // Students already deduplicated and sorted by getStudentsBySection
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
        <div className="assignments-list">
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
            className="submission-panel-overlay"
            onClick={() => { setActiveAssignment(null); loadData(); }}
          />
          {/* Panel */}
          <div className="submission-panel">
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
    dateBadgeBg = '#FEE2E2';
    dateBadgeText = '#DC2626';
  } else if (diffDays <= 3 && diffDays >= 0) {
    dateBadgeBg = '#FEF3C7';
    dateBadgeText = '#B45309';
  } else if (assignment.stats.missing === 0 && assignment.stats.total > 0) {
     dateBadgeBg = '#DCFCE7';
     dateBadgeText = '#15803D';
  }
  
  return (
    <div className={`assignment-card animate-fade-up`} style={{ 
      animationDelay: `${index * 0.05}s`, 
      border: isActive ? '2px solid var(--color-ink)' : undefined,
      transform: isActive ? 'scale(1.02)' : 'none',
      boxShadow: isActive ? 'var(--shadow-card-hover)' : undefined
    }}>
      <div className="assignment-card-header">
        <h3 className="assignment-card-title">{assignment.title}</h3>
        <div className="assignment-card-actions">
          <Badge variant="outline" style={{ backgroundColor: dateBadgeBg, color: dateBadgeText, border: 'none', fontWeight: 600 }}>
            {diffDays < 0 ? 'Overdue' : diffDays === 0 ? 'Due Today' : `Due in ${diffDays} day${diffDays !== 1 ? 's': ''}`}
          </Badge>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)', opacity: 0.5 }}>
            <Trash2 size={20} />
          </button>
        </div>
      </div>
      
      <p style={{ fontSize: '14px', color: 'var(--color-ink)', opacity: 0.7, marginBottom: '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {assignment.description || 'No description'}
      </p>

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

      <div className="assignment-card-footer">
        <span style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.6 }}>
          {formatDate(assignment.dueDate.toDate().toISOString())}
        </span>
        <Button className="view-submissions-btn" variant="outline" onClick={onView}>View Submissions</Button>
      </div>
    </div>
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
    <div className="modal-backdrop">
      <div className="modal-box">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">New Assignment</h2>
            <button type="button" onClick={onClose} className="modal-close-btn">
              <X size={20} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
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

            <div className="modal-footer">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmissionPanel({ assignment, students, onClose }) {
  const [localSubmissions, setLocalSubmissions] = useState(assignment.submissions || {});
  const [snapshotSubmissions, setSnapshotSubmissions] = useState(assignment.submissions || {});
  const [savingRow, setSavingRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filtered students (always sorted alphabetically A-Z)
  const studentRows = useMemo(() => {
    let result = filterStudentsByName(Object.values(students), debouncedSearch);
    result.sort((a,b) => (a.name||'').trim().toLowerCase().localeCompare((b.name||'').trim().toLowerCase()));
    return result;
  }, [students, debouncedSearch]);

  const handleUpdate = React.useCallback(async (studentId, status, marks) => {
    setSavingRow(studentId);
    setLocalSubmissions(prev => ({
      ...prev,
      [studentId]: { status, marks }
    }));
    try {
      await updateSubmission(assignment.id, studentId, status, marks);
    } catch (err) {
      console.error(err);
    }
    setTimeout(() => {
      setSavingRow(prev => prev === studentId ? null : prev);
    }, 1000);
  }, [assignment.id]);

  // Re-calculate stats based on local state for the summary row
  const stats = useMemo(() => {
    return {
      total: Object.values(students).length,
      submitted: Object.values(localSubmissions).filter(v => v.status === 'submitted').length,
      missing: Object.values(localSubmissions).filter(v => v.status === 'missing').length,
      late: Object.values(localSubmissions).filter(v => v.status === 'late').length,
    };
  }, [students, localSubmissions]);
  
  const avgMarks = useMemo(() => {
    let validMarks = 0; let totalMarks = 0;
    Object.values(localSubmissions).forEach(v => {
      if (v.marks !== null && v.marks !== undefined) {
        validMarks++;
        totalMarks += v.marks;
      }
    });
    return validMarks > 0 ? (totalMarks / validMarks).toFixed(1) : '0';
  }, [localSubmissions]);

  const handleRevert = () => {
    setLocalSubmissions(snapshotSubmissions);
    const studentIds = Object.keys(snapshotSubmissions);
    studentIds.forEach(id => {
       const o = snapshotSubmissions[id];
       if(o) updateSubmission(assignment.id, id, o.status, o.marks);
    });
  };

  return (
    <>
      <div className="submission-panel-header">
        <div style={{ flex: 1 }}>
          <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)', opacity: 0.6, fontWeight: 600, padding: 0, marginBottom: '1rem', fontSize: '13px' }}>
            <ArrowLeft size={16} /> Close Panel
          </button>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', margin: '0 0 0.25rem 0', color: 'var(--color-ink)' }}>{assignment.title}</h2>
          <p style={{ color: 'var(--color-ink)', opacity: 0.6, margin: '0 0 1rem 0', fontSize: '13px' }}>
            Max Marks: {assignment.maxMarks} &nbsp;•&nbsp; Avg: {avgMarks} &nbsp;•&nbsp; {stats.total} students
          </p>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink)', opacity: 0.4 }} />
            <Input 
              placeholder="Search by name or roll..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%', fontSize: '14px' }}
            />
          </div>
        </div>
      </div>

      <div className="submission-panel-body">
        {studentRows.length === 0 ? (
          <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', color: 'var(--color-ink)', opacity: 0.5, fontStyle: 'italic', fontFamily: 'var(--font-heading)' }}>No submissions found.</p>
          </div>
        ) : (
          <div>
            {studentRows.map((st) => (
              <StudentRow
                key={st.id}
                st={st}
                sub={localSubmissions[st.id] || { status: 'missing', marks: null }}
                isSaved={savingRow === st.id}
                onUpdate={handleUpdate}
                maxMarks={assignment.maxMarks}
              />
            ))}
          </div>
        )}
      </div>

      <div className="submission-panel-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '13px', fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }}></span>
            Sub: {stats.submitted}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4623', display: 'inline-block' }}></span>
            Miss: {stats.missing}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706', display: 'inline-block' }}></span>
            Late: {stats.late}
          </span>
        </div>
        <button onClick={handleRevert} style={{ fontSize: '13px', color: 'var(--color-amber)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>↻ Revert</button>
      </div>
    </>
  );
}

const StudentRow = React.memo(({ st, sub, isSaved, onUpdate, maxMarks }) => {
  const STATUS_LABELS = {
    submitted: { label: 'Submitted', color: '#16A34A', bg: '#DCFCE7' },
    missing:   { label: 'Missing',   color: '#EF4623', bg: '#FEE2E2' },
    late:      { label: 'Late',      color: '#D97706', bg: '#FEF3C7' },
  };

  return (
    <div className="submission-row">
      <div className="submission-row-info">
        <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em', display: 'block' }}>
          {st.name}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.5, marginTop: '2px', display: 'block', fontFamily: 'monospace' }}>
          {st.rollNumber}
        </span>
      </div>

      <div className="submission-row-controls">
        <div className="submission-status-btns">
          {['submitted', 'missing', 'late'].map(status => {
            const info = STATUS_LABELS[status];
            const isActive = sub.status === status;
            return (
              <button
                key={status}
                className={`submission-status-btn ${status} ${isActive ? 'active' : ''}`}
                onClick={() => onUpdate(st.id, status, status === 'missing' ? null : sub.marks)}
                title={info.label}
              >
                {info.label.charAt(0)}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {sub.status === 'missing' ? (
            <span style={{ color: 'var(--color-ink)', opacity: 0.2, fontSize: '16px', width: '56px', textAlign: 'center' }}>—</span>
          ) : (
            <input 
              type="number" 
              className="marks-input"
              min="0" max={maxMarks} 
              value={sub.marks === null ? '' : sub.marks} 
              onChange={(e) => {
                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                onUpdate(st.id, sub.status, val);
              }}
            />
          )}
          
          <div style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ opacity: isSaved ? 1 : 0, color: '#16A34A', fontWeight: 700, transition: 'opacity 0.3s', fontSize: '14px' }}>✓</span>
          </div>
        </div>
      </div>
    </div>
  );
});
StudentRow.displayName = 'StudentRow';

function formatDate(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('T')[0].split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}

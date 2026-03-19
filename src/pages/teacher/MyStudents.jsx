import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { getStudentAssignmentStats } from '../../lib/firestore/assignments';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { RISK_COLORS } from '../../lib/riskEngine';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { getStudentWithStats, getStudentsBySection } from '../../lib/firestore/students';
import { filterStudentsByName } from '../../lib/utils';
import './teacher.css';

export function MyStudents() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [students, setStudents] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({}); // studentId -> {submitted, total}
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Expanded Card State
  const [expandedId, setExpandedId] = useState(null);
  const [expandedStats, setExpandedStats] = useState({}); // studentId -> stats object
  const [loadingStats, setLoadingStats] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Guard against StrictMode double-fetch
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Parse URL filters on mount
    const searchParams = new URLSearchParams(location.search);
    const filterParam = searchParams.get('filter');
    if (filterParam) {
      setActiveFilters(filterParam.split(','));
    }
    const studentParam = searchParams.get('student');

    async function fetchData() {
      // Prevent duplicate fetch in StrictMode
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      try {
        // Use getStudentsBySection which has robust dedup + alphabetical sort
        const fetchedStudents = await getStudentsBySection(user.section);

        const amap = {};

        // For list view, we just need basic assignment counts for the single subject
        await Promise.all(fetchedStudents.map(async (st) => {
          const stats = await getStudentAssignmentStats(st.id, user.section);
          amap[st.id] = stats;
        }));

        setAssignmentsMap(amap);
        setStudents(fetchedStudents);

        // Auto-expand if URL parameter exists
        if (studentParam) {
          setExpandedId(studentParam);
          setLoadingStats(true);
          try {
            const stats = await getStudentWithStats(studentParam, user.section, user.subject);
            setExpandedStats(prev => ({ ...prev, [studentParam]: stats }));
            
            // Auto-scroll to student row (approximate by ID)
            setTimeout(() => {
              const el = document.getElementById(`student-row-${studentParam}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          } catch (err) {
            console.error(err);
          } finally {
            setLoadingStats(false);
          }
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    return () => { fetchedRef.current = false; };
  }, [user, location.search]);

  const handleRowClick = async (studentId) => {
    if (expandedId === studentId) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(studentId);
    
    // Only fetch if we don't already have it cached
    if (!expandedStats[studentId]) {
      setLoadingStats(true);
      try {
        const stats = await getStudentWithStats(studentId, user.section, user.subject);
        setExpandedStats(prev => ({ ...prev, [studentId]: stats }));
      } catch (err) {
        console.error("Failed to fetch detailed stats", err);
      } finally {
        setLoadingStats(false);
      }
    }
  };

  const toggleFilter = (level) => {
    setActiveFilters(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  // Filtered students (always alphabetically sorted A-Z)
  const filteredStudents = useMemo(() => {
    // 1. First -> filter by search
    let result = filterStudentsByName(students, debouncedSearch);

    // 2. Then -> apply priority filter
    if (activeFilters.length > 0) {
      result = result.filter(s => activeFilters.includes(s.riskLevel));
    }

    // Sort alphabetically A-Z
    result.sort((a, b) => {
      const nameA = (a.name || '').trim().toLowerCase();
      const nameB = (b.name || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return result;
  }, [students, debouncedSearch, activeFilters]);

  const getAttendanceColor = (pct) => {
    if (pct < 50) return 'var(--color-coral)';
    if (pct < 65) return 'var(--color-amber)';
    if (pct < 75) return '#2563EB'; // Blue
    return '#16A34A'; // Green
  };

  return (
    <div className="page-wrapper animate-fade-up">
      <h1 className="page-title">My Students</h1>

      <div className="students-controls">
        <Input 
          placeholder="Search by name or roll number..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="students-search"
        />
        <div className="filter-chips">
          {['critical', 'high', 'medium', 'low'].map(level => {
            const isActive = activeFilters.includes(level);
            return (
              <button
                key={level}
                onClick={() => toggleFilter(level)}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isActive ? RISK_COLORS[level].text : 'var(--color-ink-20)'}`,
                  backgroundColor: isActive ? RISK_COLORS[level].bg : 'transparent',
                  color: isActive ? RISK_COLORS[level].text : 'var(--color-ink)',
                  transition: 'all 0.2s ease'
                }}
              >
                {RISK_COLORS[level].label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
             <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink)', opacity: 0.6 }}>Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ backgroundColor: 'var(--color-peach)', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
             <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '20px' }}>No students match your criteria.</p>
          </div>
        ) : (
          filteredStudents.map(student => {
            const isExpanded = expandedId === student.id;
            const assignStats = assignmentsMap[student.id];
            const attColor = getAttendanceColor(student.attendancePct);
            
            return (
              <div key={student.id} id={`student-row-${student.id}`}>
                {/* List Row */}
                <div 
                  className="student-row"
                  style={{
                    borderRadius: isExpanded ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                    borderBottom: isExpanded ? 'none' : undefined,
                    zIndex: isExpanded ? 2 : 1
                  }}
                  onClick={() => handleRowClick(student.id)}
                >
                  <div className="student-row-inner">
                    <Badge variant="outline" style={{ backgroundColor: RISK_COLORS[student.riskLevel].bg, color: RISK_COLORS[student.riskLevel].text, border: 'none', width: '80px', textAlign: 'center', display: 'block' }}>
                      {RISK_COLORS[student.riskLevel].label}
                    </Badge>
                    
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.rollNumber}</div>
                    </div>
                    
                    <div className="progress-bar-col attendance-bar-col">
                      <div className="progress-bar-label">
                        Attendance: <span style={{ color: attColor, fontWeight: 600 }}>{student.attendancePct}%</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ backgroundColor: attColor, width: `${student.attendancePct}%` }} />
                      </div>
                    </div>

                    <div className="progress-bar-col assignment-bar-col">
                      <div className="progress-bar-label">
                        Assignments: <span style={{ fontWeight: 600 }}>{assignStats?.submitted || 0}/{assignStats?.total || 0}</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ backgroundColor: 'var(--color-ink)', width: `${assignStats?.total === 0 ? 0 : ((assignStats?.submitted || 0) / assignStats.total) * 100}%` }} />
                      </div>
                    </div>

                    <div style={{ color: 'var(--color-ink)', opacity: 0.4, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>

                {/* Expanded Panel */}
                {isExpanded && (
                  <div className="student-expanded-panel">
                    {loadingStats && !expandedStats[student.id] ? (
                       <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink)', opacity: 0.6 }}>
                         Loading details...
                       </div>
                    ) : expandedStats[student.id] && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                           <div>
                             <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', margin: 0 }}>{student.name}</h2>
                             <p style={{ color: 'var(--color-ink)', opacity: 0.7, margin: '4px 0 0 0' }}>{student.rollNumber} • {student.section}</p>
                           </div>
                           <div style={{ textAlign: 'right', fontSize: '14px', color: 'var(--color-ink)', opacity: 0.8 }}>
                             <p style={{ margin: 0 }}>Phone: {student.phone}</p>
                             <p style={{ margin: '4px 0 0 0' }}>Parent: {student.parentPhone}</p>
                           </div>
                        </div>

                        <div className="student-expanded-stats">
                           {/* Attendance Stats */}
                           <div>
                             <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem' }}>Attendance</h3>
                             <p style={{ fontWeight: 700, fontSize: '18px', color: attColor, marginBottom: '8px' }}>{student.attendancePct}% overall</p>
                             <div className="progress-bar-track" style={{ marginBottom: '1rem' }}>
                                <div className="progress-bar-fill" style={{ backgroundColor: attColor, width: `${student.attendancePct}%` }} />
                             </div>
                             <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                               <span>Sessions attended:</span> <strong>{(expandedStats[student.id].attendanceStats.present || 0) + (expandedStats[student.id].attendanceStats.late || 0)}</strong>
                               <span>Sessions absent:</span> <strong>{expandedStats[student.id].attendanceStats.absent || 0}</strong>
                             </div>
                           </div>
                           
                           {/* Assignment Stats */}
                           <div>
                             <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem' }}>Assignments</h3>
                             <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-ink)', marginBottom: '8px' }}>{expandedStats[student.id].assignmentStats.submitted || 0} of {expandedStats[student.id].assignmentStats.total || 0} submitted</p>
                             <div className="progress-bar-track" style={{ marginBottom: '1rem' }}>
                                <div className="progress-bar-fill" style={{ backgroundColor: 'var(--color-ink)', width: `${expandedStats[student.id].assignmentStats.total === 0 ? 0 : ((expandedStats[student.id].assignmentStats.submitted || 0) / expandedStats[student.id].assignmentStats.total) * 100}%` }} />
                             </div>
                             <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                               <span>Missing:</span> <strong>{expandedStats[student.id].assignmentStats.missing || 0}</strong>
                               <span>Late:</span> <strong>{expandedStats[student.id].assignmentStats.late || 0}</strong>
                             </div>
                           </div>
                        </div>

                        {/* Recent Follow Ups */}
                        <div className="student-expanded-logs">
                          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem' }}>Recent Follow-Ups</h3>
                          {expandedStats[student.id].recentLogs.length === 0 ? (
                            <p style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.6, color: 'var(--color-ink)' }}>No follow-ups logged yet</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {expandedStats[student.id].recentLogs.map(log => {
                                const renderIcon = (t) => {
                                  switch (t) {
                                    case 'call': return '📞';
                                    case 'meeting': return '🤝';
                                    case 'message': return '💬';
                                    case 'email': return '✉️';
                                    default: return '📞';
                                  }
                                };
                                return (
                                  <div key={log.id} className="followup-preview-entry">
                                    <div className="followup-preview-main">
                                      <span style={{ fontSize: '14px' }}>{renderIcon(log.type)}</span>
                                      <span className="log-type">{log.type ? log.type.charAt(0).toUpperCase() + log.type.slice(1) : 'Unknown'}</span>
                                      <span className="log-dot">·</span>
                                      <span className="log-date">{log.date?.toDate ? log.date.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : log.date || '—'}</span>
                                      <span className="log-dot">—</span>
                                      <span className="log-outcome">{log.outcome ? (log.outcome.length > 60 ? log.outcome.substring(0, 60) + '…' : log.outcome) : 'No outcome'}</span>
                                    </div>
                                    {log.notes && log.notes.trim() !== '' && (
                                      <div className="followup-preview-notes">
                                        <span className="notes-arrow">↳</span>
                                        <span className="notes-text">{log.notes.length > 80 ? log.notes.substring(0, 80) + '…' : log.notes}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="student-expanded-actions">
                          <Button 
                            className="btn-primary follow-up-btn" 
                            onClick={() => navigate(`/follow-up?student=${student.id}`)}
                          >
                            Log Follow-Up for {student.name.split(' ')[0]}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

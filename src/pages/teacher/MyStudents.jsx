import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getStudentAssignmentStats } from '../../lib/firestore/assignments';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { RISK_COLORS } from '../../lib/riskEngine';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { getStudentWithStats } from '../../lib/firestore/students';

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
      try {
        const q = query(
          collection(db, 'students'),
          where('section', '==', user.section),
          orderBy('attendancePct', 'asc')
        );
        const snap = await getDocs(q);
        const fetchedStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilters.length === 0 || activeFilters.includes(s.riskLevel);
    return matchesSearch && matchesFilter;
  });

  const getAttendanceColor = (pct) => {
    if (pct < 50) return 'var(--color-coral)';
    if (pct < 65) return 'var(--color-amber)';
    if (pct < 75) return '#2563EB'; // Blue
    return '#16A34A'; // Green
  };

  return (
    <div className="page-wrapper animate-fade-up">
      <h1 className="page-title">My Students</h1>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Input 
          placeholder="Search by name or roll number..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '300px' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
              <div key={student.id} id={`student-row-${student.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* List Row */}
                <Card 
                  hover={true} 
                  style={{ 
                    cursor: 'pointer', 
                    borderRadius: isExpanded ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                    borderBottom: isExpanded ? 'none' : undefined,
                    transition: 'all 0.2s',
                    zIndex: isExpanded ? 2 : 1
                  }}
                  onClick={() => handleRowClick(student.id)}
                >
                  <CardContent style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    
                    <Badge variant="outline" style={{ backgroundColor: RISK_COLORS[student.riskLevel].bg, color: RISK_COLORS[student.riskLevel].text, border: 'none', width: '80px', textAlign: 'center', display: 'block' }}>
                      {RISK_COLORS[student.riskLevel].label}
                    </Badge>
                    
                    <div style={{ width: '200px' }}>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{student.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.6 }}>{student.rollNumber}</div>
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', opacity: 0.7, width: '90px' }}>
                        Attendance: <span style={{ color: attColor }}>{student.attendancePct}%</span>
                      </span>
                      <div style={{ flex: 1, backgroundColor: 'var(--color-ink-10)', height: '6px', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: attColor, width: `${student.attendancePct}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', opacity: 0.7, width: '120px' }}>
                        Assignments: {assignStats?.submitted || 0}/{assignStats?.total || 0}
                      </span>
                      <div style={{ flex: 1, backgroundColor: 'var(--color-ink-10)', height: '6px', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: 'var(--color-ink)', width: `${assignStats?.total === 0 ? 0 : ((assignStats?.submitted || 0) / assignStats.total) * 100}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>

                    <div style={{ color: 'var(--color-ink)', opacity: 0.4, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                      <ChevronRight size={20} />
                    </div>
                  </CardContent>
                </Card>

                {/* Expanded Panel */}
                {isExpanded && (
                  <div className="animate-fade-up" style={{ 
                    backgroundColor: 'var(--color-peach)', 
                    border: '1px solid var(--color-ink-10)',
                    borderTop: 'none',
                    borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                    padding: '2rem',
                    boxShadow: 'var(--shadow-card)',
                    zIndex: 1
                  }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', borderTop: '1px solid var(--color-ink-10)', borderBottom: '1px solid var(--color-ink-10)', padding: '1.5rem 0' }}>
                           {/* Attendance Stats */}
                           <div>
                             <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem' }}>Attendance</h3>
                             <p style={{ fontWeight: 700, fontSize: '18px', color: attColor, marginBottom: '8px' }}>{student.attendancePct}% overall</p>
                             <div style={{ width: '100%', backgroundColor: 'var(--color-ink-10)', height: '8px', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: '1rem' }}>
                                <div style={{ height: '100%', backgroundColor: attColor, width: `${student.attendancePct}%` }} />
                             </div>
                             <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                               <span>Sessions attended:</span> <strong>{expandedStats[student.id].attendanceStats.present || 0}</strong>
                               <span>Sessions absent:</span> <strong>{expandedStats[student.id].attendanceStats.absent || 0}</strong>
                               <span>Sessions late:</span> <strong>{expandedStats[student.id].attendanceStats.late || 0}</strong>
                             </div>
                           </div>
                           
                           {/* Assignment Stats */}
                           <div>
                             <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem' }}>Assignments</h3>
                             <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-ink)', marginBottom: '8px' }}>{expandedStats[student.id].assignmentStats.submitted || 0} of {expandedStats[student.id].assignmentStats.total || 0} submitted</p>
                             <div style={{ width: '100%', backgroundColor: 'var(--color-ink-10)', height: '8px', borderRadius: 'var(--radius-pill)', overflow: 'hidden', marginBottom: '1rem' }}>
                                <div style={{ height: '100%', backgroundColor: 'var(--color-ink)', width: `${expandedStats[student.id].assignmentStats.total === 0 ? 0 : ((expandedStats[student.id].assignmentStats.submitted || 0) / expandedStats[student.id].assignmentStats.total) * 100}%` }} />
                             </div>
                             <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                               <span>Missing:</span> <strong>{expandedStats[student.id].assignmentStats.missing || 0}</strong>
                               <span>Late:</span> <strong>{expandedStats[student.id].assignmentStats.late || 0}</strong>
                             </div>
                           </div>
                        </div>

                        {/* Recent Follow Ups */}
                        <div>
                          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem' }}>Recent Follow-Ups</h3>
                          {expandedStats[student.id].recentLogs.length === 0 ? (
                            <p style={{ fontSize: '14px', fontStyle: 'italic', opacity: 0.6 }}>No follow-ups yet.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {expandedStats[student.id].recentLogs.map(log => (
                                <div key={log.id} style={{ fontSize: '14px', display: 'flex', gap: '0.5rem' }}>
                                  <span style={{ color: 'var(--color-coral)' }}>►</span>
                                  <strong>{log.type}</strong>
                                  <span style={{ opacity: 0.5 }}>·</span>
                                  <span>{log.date}</span>
                                  <span style={{ opacity: 0.5 }}>·</span>
                                  <span style={{ fontStyle: 'italic' }}>"{log.notes}"</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button 
                          className="btn-primary" 
                          style={{ width: '100%', marginTop: '1rem' }}
                          onClick={() => navigate(`/follow-up?student=${student.id}`)}
                        >
                          Log Follow-Up for {student.name.split(' ')[0]}
                        </Button>
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

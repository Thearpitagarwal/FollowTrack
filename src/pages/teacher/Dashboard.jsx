import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { format } from 'date-fns';
import { NavLink, Link } from 'react-router-dom';
import { ROUTES } from '../../router/routes';
import { RISK_COLORS } from '../../lib/riskEngine';
import './teacher.css';

export function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalStudents: 0,
    atRisk: 0,
    totalStudents: 0,
    atRisk: 0,
    assignmentsDue: 0
  });
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        // Students in section
        const studentsQuery = query(collection(db, 'students'), where('section', '==', user.section));
        const studentsSnap = await getDocs(studentsQuery);
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalStudents = studentsSnap.size;
        const riskStudents = students.filter(s => ['critical', 'high'].includes(s.riskLevel));
        // Sort critical first, then high
        riskStudents.sort((a, b) => a.riskLevel === 'critical' ? -1 : 1);

        // Assignments due in next 14 days (upcoming panel) and 7 days (stat card)
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        
        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('section', '==', user.section),
          where('subject', '==', user.subject)
        );
        const assignmentsSnap = await getDocs(assignmentsQuery);
        
        let dueThisWeek = 0;
        const upcoming = [];

        assignmentsSnap.forEach(d => {
          const a = { id: d.id, ...d.data() };
          const pDbd = a.dueDate.toDate();
          
          if (pDbd >= now && pDbd <= nextWeek) {
            dueThisWeek++;
          }
          if (pDbd >= now && pDbd <= twoWeeks) {
            upcoming.push(a);
          }
        });

        upcoming.sort((a, b) => a.dueDate.toDate() - b.dueDate.toDate());

        setStats({
          totalStudents,
          atRisk: riskStudents.length,
          assignmentsDue: dueThisWeek
        });
        setAtRiskStudents(riskStudents);
        setUpcomingAssignments(upcoming);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="page-wrapper animate-fade-up">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent style={{height: '100px', backgroundColor: 'var(--color-peach)', opacity: 0.5}} /></Card>)}
        </div>
      </div>
    );
  }

  if (stats.totalStudents === 0) {
    return (
      <div className="page-wrapper animate-fade-up">
        <h1 className="page-title">Dashboard</h1>
        <Card>
          <CardContent style={{ padding: '4rem', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', marginBottom: '1rem' }}>Welcome to FollowTrack v2</h2>
            <p style={{ color: 'var(--color-ink)', opacity: 0.7, marginBottom: '2rem' }}>Your class is currently empty. Click below to seed test data (Students, Attendance, and Assignments).</p>
            <Button 
               onClick={async () => {
                 setLoading(true);
                 try {
                   const { seedFollowTrack } = await import('../../lib/seedFirestore');
                   await seedFollowTrack(user.uid);
                   window.location.reload();
                 } catch(err) {
                   console.error(err);
                   alert("Failed to seed data");
                   setLoading(false);
                 }
               }}
            >
              Seed Test Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-up">
      <h1 className="page-title">Dashboard</h1>
      
      {/* Stat Cards as Navigation Tiles */}
      <div className="stat-cards-grid">
        <Link to={ROUTES.ATTENDANCE} className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <p className="label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Total Students</p>
            <p className="value" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.totalStudents}</p>
          </div>
        </Link>
        
        <Link to={`${ROUTES.MY_STUDENTS}?filter=critical,high`} className="stat-card" style={{ textDecoration: 'none', color: 'inherit', backgroundColor: 'var(--color-peach)' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <p className="label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>At Risk</p>
            <p className="value" style={{ color: 'var(--color-coral)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.atRisk}</p>
          </div>
        </Link>
        
        <Link to={ROUTES.ASSIGNMENTS} className="stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <p className="label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Due This Week</p>
            <p className="value" style={{ color: 'var(--color-amber)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.assignmentsDue}</p>
          </div>
        </Link>
      </div>

      <div className="dashboard-bottom-grid">
        {/* At Risk List */}
        <Card className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle style={{ fontFamily: 'var(--font-heading)', fontSize: '22px' }}>Needs Attention</CardTitle>
            <Link to={ROUTES.MY_STUDENTS} style={{ color: 'var(--color-coral)', fontSize: '14px', fontWeight: 600 }}>View All →</Link>
          </CardHeader>
          <CardContent>
            {atRiskStudents.length === 0 ? (
              <div style={{ backgroundColor: 'var(--color-peach)', padding: '2rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '18px' }}>No students at high risk.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {atRiskStudents.slice(0, 5).map(student => (
                  <Link 
                    to={`/students?student=${student.id}`} 
                    key={student.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--color-ink-10)', borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit', gap: '1rem' }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }}>{student.name}</span>
                        <Badge variant="outline" style={{ backgroundColor: RISK_COLORS[student.riskLevel].bg, color: RISK_COLORS[student.riskLevel].text, border: 'none', flexShrink: 0 }}>
                          {RISK_COLORS[student.riskLevel].label}
                        </Badge>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6, marginTop: '4px' }}>{student.rollNumber}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: student.attendancePct < 50 ? 'var(--color-coral)' : 'var(--color-amber)' }}>{student.attendancePct}%</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Assignments Panel */}
        <Card className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader>
            <CardTitle style={{ fontFamily: 'var(--font-heading)', fontSize: '22px' }}>Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAssignments.length === 0 ? (
              <div style={{ backgroundColor: 'var(--color-peach)', padding: '2rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '18px', marginBottom: '1rem' }}>No upcoming assignments</p>
                <Link to={ROUTES.ASSIGNMENTS} className="btn-primary" style={{ display: 'inline-block' }}>View Assignments →</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {upcomingAssignments.map(assignment => (
                   <Link 
                     to={ROUTES.ASSIGNMENTS} 
                     key={assignment.id}
                     style={{ 
                       display: 'flex', 
                       flexDirection: 'column', 
                       gap: '0.5rem', 
                       padding: '1rem', 
                       border: '1px solid var(--color-ink-10)', 
                       borderRadius: 'var(--radius-md)', 
                       textDecoration: 'none', 
                       color: 'inherit',
                       transition: 'all 0.2s',
                       backgroundColor: '#ffffff'
                     }}
                     onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-coral)'; e.currentTarget.style.backgroundColor = 'var(--color-peach)'; }}
                     onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-ink-10)'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                   >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{assignment.title}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-amber)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Due {format(assignment.dueDate.toDate(), 'MMM d')}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.7 }}>
                      {assignment.stats?.submitted || 0} / {assignment.stats?.total || 0} submitted
                    </div>
                   </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

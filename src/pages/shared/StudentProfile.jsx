import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { getStudentAssignmentStats } from '../../lib/firestore/assignments';
import { RISK_COLORS } from '../../lib/riskEngine';
import { ROUTES } from '../../router/routes';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, BookOpen, Clock, FileText, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [timelineData, setTimelineData] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [followUps, setFollowUps] = useState([]);

  useEffect(() => {
    if (!user || !id) return;
    fetchData();
  }, [user, id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Student Document
      const sSnap = await getDoc(doc(db, 'students', id));
      if (!sSnap.exists()) {
         alert("Student not found");
         navigate(-1);
         return;
      }
      const st = { id: sSnap.id, ...sSnap.data() };
      setStudent(st);

      // 2. Attendance Timeline (All sessions for this section)
      const attQ = query(collection(db, 'attendance'), where('section', '==', st.section), orderBy('date', 'asc'));
      const attSnap = await getDocs(attQ);
      
      let runningPresent = 0;
      let runningTotal = 0;
      const tData = [];
      const sStats = {}; // per subject: { present, total }

      attSnap.forEach(d => {
        const session = d.data();
        if (!user.subjects.includes(session.subject)) return; // Only teacher's subjects
        
        const status = session.records[id];
        if (status) {
          runningTotal++;
          if (status === 'present' || status === 'late') runningPresent++;
          const pct = Math.round((runningPresent / runningTotal) * 100);
          
          tData.push({
            date: session.date.substring(5), // mm-dd
            pct,
            subject: session.subject,
            status
          });

          if (!sStats[session.subject]) sStats[session.subject] = { present: 0, total: 0 };
          sStats[session.subject].total++;
          if (status === 'present' || status === 'late') sStats[session.subject].present++;
        }
      });
      setTimelineData(tData);
      setSubjectStats(sStats);

      // 3. Assignments
      const asgQ = query(collection(db, 'assignments'), where('section', '==', st.section));
      const asgSnap = await getDocs(asgQ);
      const asgs = asgSnap.docs.map(d => {
        const ad = d.data();
        return {
          id: d.id,
          ...ad,
          mySub: ad.submissions[id] || { status: 'missing', marks: null }
        };
      }).filter(a => user.subjects.includes(a.subject));
      
      setAssignments(asgs);

      // 4. Follow Ups
      const fuQ = query(collection(db, 'students', id, 'followUpLog'), orderBy('timestamp', 'desc'));
      const fuSnap = await getDocs(fuQ);
      const fus = fuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFollowUps(fus);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !student) {
    return (
      <div className="page-wrapper animate-fade-up">
        <div style={{ marginBottom: '1.5rem' }}><Button variant="ghost" disabled>←</Button></div>
        <Card><CardContent style={{ height: '200px', opacity: 0.5 }} /></Card>
      </div>
    );
  }

  const riskCol = RISK_COLORS[student.riskLevel] || RISK_COLORS.low;

  return (
    <div className="page-wrapper animate-fade-up">
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink)', opacity: 0.7, fontWeight: 600, padding: 0 }}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      {/* Header Card */}
      <Card style={{ marginBottom: '2rem' }}>
        <CardContent style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', marginBottom: '0.5rem', color: 'var(--color-ink)' }}>{student.name}</h1>
            <p style={{ color: 'var(--color-ink)', opacity: 0.6, marginBottom: '1rem', fontSize: '15px' }}>
              {student.rollNumber} • {student.section} • Parent: {student.parentPhone}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Badge variant="outline" style={{ backgroundColor: riskCol.bg, color: riskCol.text, border: 'none' }}>
                {riskCol.label} Risk
              </Badge>
              {student.remedialEnrolled && (
                <Badge variant="outline" style={{ backgroundColor: 'var(--color-ink-10)', color: 'var(--color-ink)', border: 'none' }}>
                  Remedial Enrolled
                </Badge>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', color: student.attendancePct < 50 ? 'var(--color-coral)' : 'var(--color-amber)', lineHeight: 1 }}>
                {student.attendancePct}%
              </span>
            </div>
            <p style={{ color: 'var(--color-ink)', opacity: 0.6, fontSize: '14px', marginBottom: '1rem' }}>Overall Attendance</p>
            <Button onClick={() => navigate(`${ROUTES.FOLLOW_UP}?student=${id}`)} style={{ backgroundColor: 'var(--color-coral)', color: '#fff', border: 'none' }}>
              Log Follow-Up
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--color-ink-10)', marginBottom: '2rem', overflowX: 'auto' }}>
        {['Overview', 'Assignments', 'Follow-Up Log'].map(tab => (
          <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             style={{
               padding: '0.5rem 0 1rem 0',
               fontFamily: 'var(--font-heading)',
               fontSize: '18px',
               fontWeight: activeTab === tab ? 600 : 400,
               color: activeTab === tab ? 'var(--color-ink)' : 'var(--color-ink)',
               opacity: activeTab === tab ? 1 : 0.5,
               background: 'transparent',
               border: 'none',
               borderBottom: activeTab === tab ? '2px solid var(--color-coral)' : '2px solid transparent',
               cursor: 'pointer',
               whiteSpace: 'nowrap',
               transition: 'all 0.2s'
             }}
          >
             {tab}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '400px' }}>
        {activeTab === 'Overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem', alignItems: 'start' }}>
            <Card className="animate-fade-up">
              <CardHeader><CardTitle>Attendance Trend</CardTitle></CardHeader>
              <CardContent>
                 {timelineData.length === 0 ? (
                   <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>No attendance data</div>
                 ) : (
                   <div style={{ width: '100%', height: '300px' }}>
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-10)" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: 'var(--color-ink)', opacity: 0.5, fontSize: 12}} />
                          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: 'var(--color-ink)', opacity: 0.5, fontSize: 12}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(val, name, props) => [`${val}%`, props.payload.subject]}
                            labelFormatter={(label) => `Date: ${label}`}
                          />
                          <Line type="monotone" dataKey="pct" stroke="var(--color-coral)" strokeWidth={3} dot={{r: 4, fill: 'var(--color-coral)', strokeWidth: 0}} activeDot={{r: 6}} />
                        </LineChart>
                     </ResponsiveContainer>
                   </div>
                 )}
              </CardContent>
            </Card>

            <Card className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader><CardTitle>Subject Breakdown</CardTitle></CardHeader>
              <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {user.subjects.map(sub => {
                  const stat = subjectStats[sub] || { present: 0, total: 0 };
                  const pct = stat.total === 0 ? 0 : Math.round((stat.present / stat.total) * 100);
                  const color = pct < 50 ? 'var(--color-coral)' : pct < 75 ? 'var(--color-amber)' : '#16A34A';
                  return (
                    <div key={sub}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '14px' }}>
                        <span style={{ fontWeight: 600 }}>{sub}</span>
                        <span style={{ color }}>{pct}% ({stat.present}/{stat.total})</span>
                      </div>
                      <div style={{ width: '100%', backgroundColor: 'var(--color-ink-10)', height: '6px', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: color, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'Assignments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {assignments.length === 0 ? (
               <Card><CardContent style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>No assignments available.</CardContent></Card>
            ) : (
               user.subjects.map(sub => {
                 const subAsgs = assignments.filter(a => a.subject === sub);
                 if (subAsgs.length === 0) return null;
                 
                 const subStats = subAsgs.reduce((acc, a) => {
                   acc.total++;
                   if (a.mySub.status === 'submitted') acc.sub++;
                   return acc;
                 }, { total: 0, sub: 0 });

                 return (
                   <Card key={sub} className="animate-fade-up">
                      <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <CardTitle>{sub}</CardTitle>
                         <span style={{ fontSize: '14px', color: 'var(--color-ink)', opacity: 0.7 }}>
                           {subStats.sub} / {subStats.total} Submitted
                         </span>
                      </CardHeader>
                      <CardContent style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <tbody>
                            {subAsgs.map((a, i) => (
                              <tr key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--color-ink-10)' : 'none' }}>
                                <td style={{ padding: '1rem', width: '50%' }}>
                                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--color-ink)', opacity: 0.6 }}>Due: {a.dueDate.toDate().toLocaleDateString()}</div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  {a.mySub.status === 'submitted' && <Badge style={{ backgroundColor: '#DCFCE7', color: '#16A34A', border: 'none' }}>Submitted</Badge>}
                                  {a.mySub.status === 'missing' && <Badge style={{ backgroundColor: '#FEE2E2', color: '#EF4623', border: 'none' }}>Missing</Badge>}
                                  {a.mySub.status === 'late' && <Badge style={{ backgroundColor: '#FEF3C7', color: '#D97706', border: 'none' }}>Late</Badge>}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, fontSize: '14px' }}>
                                  {a.mySub.marks !== null ? `${a.mySub.marks}/${a.maxMarks}` : `-/${a.maxMarks}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                   </Card>
                 );
               })
            )}
          </div>
        )}

        {activeTab === 'Follow-Up Log' && (
          <div style={{ maxWidth: '800px' }}>
            {followUps.length === 0 ? (
               <Card><CardContent style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>No follow-up history.</CardContent></Card>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
                 <div style={{ position: 'absolute', top: 0, bottom: 0, left: '20px', width: '2px', backgroundColor: 'var(--color-ink-10)' }} />
                 {followUps.map((fu, i) => (
                   <div key={fu.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.05}s`, display: 'flex', gap: '1.5rem' }}>
                     <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-peach)', color: 'var(--color-coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}>
                       <Activity size={20} />
                     </div>
                     <Card style={{ flex: 1, background: 'linear-gradient(to bottom, #fff, #fefefe)' }}>
                       <CardContent style={{ padding: '1.5rem' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                           <span style={{ fontWeight: 600 }}>{fu.method}</span>
                           <span style={{ fontSize: '13px', color: 'var(--color-ink)', opacity: 0.6 }}>{fu.date}</span>
                         </div>
                         <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--color-ink)', opacity: 0.8 }}>
                           {fu.notes}
                         </p>
                         <p style={{ fontSize: '12px', marginTop: '1rem', color: 'var(--color-ink)', opacity: 0.4 }}>
                           Logged by: {fu.teacherName}
                         </p>
                       </CardContent>
                     </Card>
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

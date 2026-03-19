export function filterStudentsByName(students, query) {
  const q = query.trim().toLowerCase();
  
  if (!q) return students;
  
  return students.filter(student =>
    (student.name || '').toLowerCase().startsWith(q)
  );
}

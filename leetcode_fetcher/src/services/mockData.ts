import { Staff, Student, Department } from '../types';

export const mockStaff: Staff[] = [
  {
    id: '1',
    username: 'staff1',
    password: 'password123',
    department: 'Computer Science',
    section: 'A',
    name: 'John Doe'
  },
  {
    id: '2',
    username: 'staff2',
    password: 'password123',
    department: 'Information Technology',
    section: 'B',
    name: 'Jane Smith'
  },
  {
    id: '3',
    username: 'staff3',
    password: 'password123',
    department: 'Computer Science',
    section: 'B',
    name: 'Mike Johnson'
  }
];

export const mockStudents: Student[] = [
  {
    id: '1',
    name: 'Alice Johnson',
  leetcodeId: 'Manoj_200',
    department: 'Computer Science',
    section: 'A'
  },
  {
    id: '2',
    name: 'Bob Smith',
  leetcodeId: 'bhuvaneswar_123',
    department: 'Computer Science',
    section: 'A'
  },
  {
    id: '3',
    name: 'Charlie Brown',
    leetcodeId: 'charlie_brown',
    department: 'Computer Science',
    section: 'B'
  },
  {
    id: '4',
    name: 'Diana Prince',
    leetcodeId: 'diana_prince',
    department: 'Information Technology',
    section: 'B'
  },
  {
    id: '5',
    name: 'Eve Wilson',
    leetcodeId: 'eve_wilson',
    department: 'Information Technology',
    section: 'A'
  }
];

export const mockDepartments: Department[] = [
  {
    id: '1',
    name: 'Computer Science',
    sections: [
      { id: '1', name: 'A', departmentId: '1' },
      { id: '2', name: 'B', departmentId: '1' }
    ]
  },
  {
    id: '2',
    name: 'Information Technology',
    sections: [
      { id: '3', name: 'A', departmentId: '2' },
      { id: '4', name: 'B', departmentId: '2' }
    ]
  }
];

export const authenticateStaff = (username: string, password: string): Staff | null => {
  const staff = mockStaff.find(s => s.username === username && s.password === password);
  return staff || null;
};

export const getStudentsByDepartmentAndSection = (department: string, section: string): Student[] => {
  return mockStudents.filter(s => s.department === department && s.section === section);
};

import { supabase, DatabaseStudent, DatabaseStaff } from './supabase';
import { Staff, Student } from '../types';

export class DatabaseService {
  // Authenticate staff by email (using email as username)
  static async authenticateStaff(email: string): Promise<Staff | null> {
    try {
      const { data, error } = await supabase
        .from('staffs')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.error('Authentication error:', error);
        return null;
      }

      return {
        id: data.id.toString(),
        username: data.email || '',
        password: '', // We'll use email-based auth without password verification
        department: data.department || '',
        section: data.section || '',
        name: data.name
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  // Get students assigned to a specific staff member
  static async getStudentsByStaff(staffDepartment: string, staffSection: string): Promise<Student[]> {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('department', staffDepartment)
        .eq('section', staffSection);

      if (error) {
        console.error('Error fetching students:', error);
        return [];
      }

      return data.map((student: DatabaseStudent) => ({
        id: student.reg_no,
        name: student.name,
        leetcodeId: student.leetcode_contest_id || student.current_skillrack_id || '',
        department: student.department,
        section: student.section,
        email: student.email,
        regNo: student.reg_no,
        gender: student.gender,
        hostelDay: student.h_d,
        mobileNumber: student.mobile_number,
        year: student.year,
        codechefId: student.codechef_id,
        codeforcesId: student.codeforces_id
      }));
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }

  // Get all staff members (for admin purposes)
  static async getAllStaff(): Promise<Staff[]> {
    try {
      const { data, error } = await supabase
        .from('staffs')
        .select('*');

      if (error) {
        console.error('Error fetching staff:', error);
        return [];
      }

      return data.map((staff: DatabaseStaff) => ({
        id: staff.id.toString(),
        username: staff.email || '',
        password: '',
        department: staff.department || '',
        section: staff.section || '',
        name: staff.name
      }));
    } catch (error) {
      console.error('Error fetching staff:', error);
      return [];
    }
  }

  // Get student by registration number
  static async getStudentByRegNo(regNo: string): Promise<Student | null> {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('reg_no', regNo)
        .single();

      if (error || !data) {
        console.error('Error fetching student:', error);
        return null;
      }

      return {
        id: data.reg_no,
        name: data.name,
        leetcodeId: data.leetcode_contest_id || data.current_skillrack_id || '',
        department: data.department,
        section: data.section,
        email: data.email,
        regNo: data.reg_no,
        gender: data.gender,
        hostelDay: data.h_d,
        mobileNumber: data.mobile_number,
        year: data.year,
        codechefId: data.codechef_id,
        codeforcesId: data.codeforces_id
      };
    } catch (error) {
      console.error('Error fetching student:', error);
      return null;
    }
  }

  // Update student LeetCode ID
  static async updateStudentLeetCodeId(regNo: string, leetcodeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('students')
        .update({ leetcode_contest_id: leetcodeId })
        .eq('reg_no', regNo);

      if (error) {
        console.error('Error updating student:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating student:', error);
      return false;
    }
  }

  // Get all departments with their sections
  static async getDepartmentsAndSections() {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('department, section')
        .order('department')
        .order('section');

      if (error) {
        console.error('Error fetching departments:', error);
        return [];
      }

      // Group by department
      const departments = data.reduce((acc: any, student: any) => {
        if (!acc[student.department]) {
          acc[student.department] = new Set();
        }
        acc[student.department].add(student.section);
        return acc;
      }, {});

      // Convert to array format
      return Object.keys(departments).map((dept, index) => ({
        id: index.toString(),
        name: dept,
        sections: Array.from(departments[dept]).map((section: any, sIndex: number) => ({
          id: sIndex.toString(),
          name: section,
          departmentId: index.toString()
        }))
      }));
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
    }
  }
}

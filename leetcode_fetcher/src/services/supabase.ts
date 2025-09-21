import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types based on your schema
export interface DatabaseStudent {
  reg_no: string;
  name: string;
  email: string;
  department: string;
  section: string;
  gender?: string;
  h_d?: string;
  mobile_number?: number;
  current_skillrack_id?: string;
  leetcode_contest_id?: string;
  codechef_id?: string;
  codeforces_id?: string;
  year?: number;
  contest_leetcode?: string;
}

export interface DatabaseStaff {
  id: number;
  name: string;
  email?: string;
  designation: 'CDC' | 'HOD' | 'CA';
  department?: string;
  section?: string;
  class_id?: number;
}

export interface DatabaseClass {
  id: number;
  department: string;
  section: string;
  year: number;
}

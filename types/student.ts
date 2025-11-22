// Unified Student interface based on the actual database schema
export interface Student {
  reg_no: string;
  name: string;
  email: string;
  department: string;
  section: string;
  gender?: string | null;
  h_d?: string | null;
  mobile_number?: number | null;
  current_skillrack_id?: string | null;
  leetcode_contest_id?: string | null;
  codechef_id?: string | null;
  codeforces_id?: string | null;
  year?: number | null;
  contest_leetcode?: string | null;
}

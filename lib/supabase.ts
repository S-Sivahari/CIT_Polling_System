import { createClient } from '@supabase/supabase-js'

// Use environment variables for production
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create a custom fetch function that handles the browser environment properly
const customFetch = (...args: any[]) => {
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && window.fetch) {
      return window.fetch(args[0], args[1])
    }
    // Fallback for server-side rendering or Node.js environment
    if (typeof fetch !== 'undefined') {
      return fetch(args[0], args[1])
    }
    // If no fetch is available, throw a descriptive error
    throw new Error('Fetch is not available in this environment')
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

// Create the Supabase client with proper error handling
let supabase: any

try {
  // Only use custom fetch in browser environment
  const clientOptions = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }

  // Add custom fetch only in browser environment
  if (isBrowser) {
    (clientOptions as any).global = {
      fetch: customFetch
    }
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)
} catch (error) {
  console.error('Failed to create Supabase client:', error)
  // Create a fallback client without custom fetch
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  })
}

// Supabase client created successfully (logging disabled for security)

export { supabase }

export type Database = {
  public: {
    Tables: {
      students: {
        Row: {
          reg_no: string
          name: string
          email: string
          password: string | null
          department: string
          section: string
          class_id: number | null
          gender: string | null
          "h/d": string | null
          mobile_number: number | null
          current_skillrack_id: string | null
          leetcode_contest_id: string | null
          codechef_id: string | null
          codeforces_id: string | null
        }
        Insert: {
          reg_no: string
          name: string
          email: string
          password?: string | null
          department: string
          section: string
          class_id?: number | null
          gender?: string | null
          "h/d"?: string | null
          mobile_number?: number | null
          current_skillrack_id?: string | null
          leetcode_contest_id?: string | null
          codechef_id?: string | null
          codeforces_id?: string | null
        }
        Update: {
          reg_no?: string
          name?: string
          email?: string
          password?: string | null
          department?: string
          section?: string
          class_id?: number | null
          gender?: string | null
          "h/d"?: string | null
          mobile_number?: number | null
          current_skillrack_id?: string | null
          leetcode_contest_id?: string | null
          codechef_id?: string | null
          codeforces_id?: string | null
        }
      }
      staffs: {
        Row: {
          id: number
          name: string
          email: string
          password: string | null
          designation: string
          department: string
          section: string | null
        }
        Insert: {
          id?: number
          name: string
          email: string
          password?: string | null
          designation: string
          department: string
          section?: string | null
        }
        Update: {
          id?: number
          name?: string
          email?: string
          password?: string | null
          designation?: string
          department?: string
          section?: string | null
        }
      }
      polls: {
        Row: {
          id: number
          staff_id: number
          class_id: number
          title: string
          options: string[]
          created_at: string
          poll_type: 'text' | 'options'
          deadline_at: string | null
          poll_category: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved'
          link_url: string | null
          contest_type: 'weekly' | 'biweekly' | null
          custom_question: string | null
          auto_delete_days: number
          is_editable: boolean
          last_modified_at: string | null
          auto_delete_at: string | null
          target_gender: 'all' | 'boys' | 'girls' | null
        }
        Insert: {
          id?: number
          staff_id: number
          class_id: number
          title: string
          options?: string[]
          created_at?: string
          poll_type?: 'text' | 'options'
          deadline_at?: string | null
          poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved'
          link_url?: string | null
          contest_type?: 'weekly' | 'biweekly' | null
          custom_question?: string | null
          auto_delete_days?: number
          is_editable?: boolean
          last_modified_at?: string | null
          auto_delete_at?: string | null
          target_gender?: 'all' | 'boys' | 'girls' | null
        }
        Update: {
          id?: number
          staff_id?: number
          class_id?: number
          title?: string
          options?: string[]
          created_at?: string
          poll_type?: 'text' | 'options'
          deadline_at?: string | null
          poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved'
          link_url?: string | null
          contest_type?: 'weekly' | 'biweekly' | null
          custom_question?: string | null
          auto_delete_days?: number
          is_editable?: boolean
          last_modified_at?: string | null
          auto_delete_at?: string | null
          target_gender?: 'all' | 'boys' | 'girls' | null
        }
      }
      poll_responses: {
        Row: {
          id: number
          poll_id: number
          student_reg_no: string
          response: string | null
          option_index: number | null
          responded_at: string | null
          option_id: number | null
        }
        Insert: {
          id?: number
          poll_id: number
          student_reg_no: string
          response?: string | null
          option_index?: number | null
          responded_at?: string | null
          option_id?: number | null
        }
        Update: {
          id?: number
          poll_id?: number
          student_reg_no?: string
          response?: string | null
          option_index?: number | null
          responded_at?: string | null
          option_id?: number | null
        }
      }
      classes: {
        Row: {
          id: number
          department: string
          section: string | null
        }
        Insert: {
          id?: number
          department: string
          section?: string | null
        }
        Update: {
          id?: number
          department?: string
          section?: string | null
        }
      }
    }
  }
}

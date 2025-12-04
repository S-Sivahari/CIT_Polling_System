import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { SupabaseAdapter } from '@auth/supabase-adapter'
import { supabase } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account"
        }
      }
    }),
  ],
  // Adapter configuration (disabled for custom session handling)
  // adapter: SupabaseAdapter({
  //   url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   secret: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // }),
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 SignIn callback triggered:', { user, account, profile })
      
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim()
        console.log('📧 Checking if email exists in database:', email)
        
        if (!email) {
          console.log('❌ No email provided')
          return '/auth-error?type=invalid_domain'
        }
        
        // Check if email exists in students or staffs table
        try {
          const { data: student } = await supabase
            .from('students')
            .select('reg_no')
            .eq('email', email)
            .single()
          
          const { data: staff } = await supabase
            .from('staffs')
            .select('id')
            .eq('email', email)
            .single()
          
          if (!student && !staff) {
            console.log('❌ Email not found in database:', email)
            return '/auth-error?type=not_found'
          }
          
          console.log('✅ Email found in database, proceeding with authentication')
          return true
        } catch (error) {
          console.error('🚨 Error checking email in database:', error)
          // Allow sign in and let session callback handle validation
          return true
        }
      }
      return true
    },
    async session({ session, token }) {
      // Always prioritize token data first (this contains our database data)
      if (token) {
        session.user.id = (token.id as string) || session.user.id
        session.user.name = (token.name as string) || session.user.name
        session.user.role = (token.role as string) || session.user.role
        session.user.reg_no = (token.reg_no as string) || session.user.reg_no
        session.user.department = (token.department as string) || session.user.department
        session.user.section = (token.section as string) || session.user.section
        session.user.class_id = (token.class_id as number) || session.user.class_id
        session.user.isValid = (token.isValid as boolean) ?? session.user.isValid
      }
      
      // Only do database queries if we don't have role information in token
      if (!token.role && session?.user?.email) {
        const email = session.user.email.toLowerCase().trim()
        console.log('🔍 Session callback - Checking email in database:', email)
        
        try {
          // Check if user is a student FIRST (prioritize student over staff)
          const { data: student, error: studentError } = await supabase
            .from('students')
            .select('*')
            .eq('email', email)
            .single()
          
          console.log('👨‍🎓 Student query result:', { student, studentError })
          
          // Only check staff if NOT a student (student takes priority)
          let staff = null
          if (!student) {
            const { data: staffData, error: staffError } = await supabase
              .from('staffs')
              .select('*')
              .eq('email', email)
              .single()
            staff = staffData
            console.log('👨‍🏫 Staff query result:', { staff, staffError })
          }
          
          if (student) {
            // PRIORITY: Student role takes precedence even if email exists in staff table
            console.log('✅ Student found, setting role to student (takes priority over staff)')
            session.user.id = student.reg_no
            session.user.name = student.name
            session.user.role = 'student'
            session.user.reg_no = student.reg_no
            session.user.department = student.department
            session.user.section = student.section
            session.user.class_id = student.class_id
            session.user.isValid = true
          } else if (staff) {
            console.log('✅ Staff found, setting role to:', staff.designation === 'HOD' ? 'hod' : 'faculty')
            session.user.id = staff.id.toString()
            session.user.name = staff.name
            session.user.role = staff.designation === 'HOD' ? 'hod' : 'faculty'
            session.user.department = staff.department
            session.user.section = staff.section
            session.user.isValid = true
          } else {
            console.log('❌ User not found in database')
            // User not found in database - redirect to error page
            // This will be handled by the client-side redirect
            session.user.role = 'not_found'
            session.user.isValid = false
          }
        } catch (error) {
          console.error('🚨 Database query error:', error)
          session.user.role = 'database_error'
          session.user.isValid = false
        }
      }
      
      console.log('📋 Final session user:', session.user)
      return session
    },
    async jwt({ token, user, account }) {
      // On initial sign in, user object will be available
      if (user) {
        console.log('🔑 JWT callback - Initial sign in, updating token with user data')
        token.id = user.id
        token.name = user.name
        token.role = user.role
        token.reg_no = user.reg_no
        token.department = user.department
        token.section = user.section
        token.class_id = user.class_id
        token.isValid = user.isValid
      }
      
      // If we don't have role info in token yet, we need to fetch from database
      if (!token.role && token.email) {
        console.log('🔑 JWT callback - No role in token, fetching from database')
        const email = (token.email as string).toLowerCase().trim()
        
        try {
          // Check if user is a student FIRST (prioritize student over staff)
          const { data: student } = await supabase
            .from('students')
            .select('*')
            .eq('email', email)
            .single()
          
          // Only check staff if NOT a student (student takes priority)
          let staff = null
          if (!student) {
            const { data: staffData } = await supabase
              .from('staffs')
              .select('*')
              .eq('email', email)
              .single()
            staff = staffData
          }
          
          if (student) {
            // PRIORITY: Student role takes precedence
            console.log('🔑 JWT callback - Student found, updating token (takes priority)')
            token.id = student.reg_no
            token.name = student.name  // Set database name
            token.role = 'student'
            token.reg_no = student.reg_no
            token.department = student.department
            token.section = student.section
            token.class_id = student.class_id
            token.isValid = true
          } else if (staff) {
            console.log('🔑 JWT callback - Staff found, updating token')
            token.id = staff.id.toString()
            token.name = staff.name    // Set database name
            token.role = staff.designation === 'HOD' ? 'hod' : 'faculty'
            token.department = staff.department
            token.section = staff.section
            token.isValid = true
          }
        } catch (error) {
          console.error('🚨 JWT callback - Database query error:', error)
        }
      }
      
      console.log('🔑 JWT token updated:', { name: token.name, role: token.role })
      return token
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth-error',
  },
  session: {
    strategy: 'jwt',
  },
}

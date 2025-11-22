import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      reg_no?: string
      department?: string
      section?: string
      class_id?: number
      isValid?: boolean
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string
    reg_no?: string
    department?: string
    section?: string
    class_id?: number
    isValid?: boolean
  }
}

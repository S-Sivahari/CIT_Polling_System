'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { data: session, status } = useSession()

  // Redirect if already authenticated
  useEffect(() => {
    if (session?.user?.isValid === true && session.user.role) {
      if (session.user.role === 'student') {
        router.push('/student/dashboard')
      } else if (session.user.role === 'faculty') {
        router.push('/faculty/dashboard')
      } else if (session.user.role === 'hod') {
        router.push('/hod/dashboard')
      }
    }
  }, [session, router])

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      toast.loading('Signing in with Google...', { id: 'signin' })

      const result = await signIn('google', {
        redirect: false,
        callbackUrl: '/login',
      })

      if (result?.error) {
        toast.dismiss('signin')
        toast.error('Google sign-in failed. Please try again.')
        setIsLoading(false)
      } else if (result?.ok) {
        console.log('✅ Google sign-in successful, waiting for session...')
        // Keep isLoading true until session updates in useEffect
      }
    } catch (error) {
      toast.dismiss('signin')
      toast.error('An error occurred during Google sign-in')
      setIsLoading(false)
    }
  }

  // Handle session updates
  useEffect(() => {
    if (status === 'loading') return

    if (session?.user) {
      if (session.user.isValid === true && session.user.role) {
        toast.dismiss('signin')

        if (session.user.role === 'student') {
          toast.success('Welcome to Student Dashboard!')
          router.push('/student/dashboard')
        } else if (session.user.role === 'faculty') {
          toast.success('Welcome to Faculty Dashboard!')
          router.push('/faculty/dashboard')
        } else if (session.user.role === 'hod') {
          toast.success('Welcome to HOD Dashboard!')
          router.push('/hod/dashboard')
        }
      } else if (session.user.isValid === false) {
        toast.dismiss('signin')
        setIsLoading(false)

        if (session.user.role === 'invalid_domain') {
          toast.error('Please use your college email account (@citchennai.net)')
          setTimeout(async () => {
            await signOut({ redirect: false })
          }, 5000)
        } else if (session.user.role === 'not_found') {
          router.push('/auth-error?type=not_found')
        } else if (session.user.role === 'database_error') {
          router.push('/auth-error?type=database_error')
        } else {
          router.push('/auth-error?type=unknown')
        }
      }
    } else if (status === 'unauthenticated' && isLoading) {
      toast.dismiss('signin')
      setIsLoading(false)
    }
  }, [session, status, router, isLoading])

  // Show loading state during authentication
  if (status === 'loading' || (isLoading && !session)) {
    return (
      <div className="dashboard-bg flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)]"></div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-lg"
        >
          <div className="card text-center">
            <div className="w-20 h-20 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent-500/30 animate-pulse">
              <Users className="w-10 h-10 text-accent-400" />
            </div>
            <h3 className="text-2xl font-medium text-white mb-3">
              Signing In...
            </h3>
            <p className="text-lg text-slate-300">
              Authenticating your account
            </p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-400"></div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="dashboard-bg flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)]"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        <div className="card">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 text-center">
              Chennai Institute of Technology
            </h1>
            <h2 className="text-2xl font-semibold text-accent-400 mb-6">
              Poll Management System
            </h2>
            <div className="w-20 h-20 bg-accent-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent-500/30">
              <Users className="w-10 h-10 text-accent-400" />
            </div>
            <h3 className="text-2xl font-medium text-white mb-3">
              Login
            </h3>
            <p className="text-lg text-slate-300">
              Sign in with your college Google account
            </p>
          </div>

          {/* Google Sign In Button */}
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            <div className="text-center text-sm text-slate-400">
              <p>Use your college email (@citchennai.net)</p>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  )
}

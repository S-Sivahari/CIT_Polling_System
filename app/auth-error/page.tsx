'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, Mail, Users } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

function AuthErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorType, setErrorType] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // Get error type from URL params
    const error = searchParams.get('error')
    const type = searchParams.get('type')
    
    if (type === 'invalid_domain') {
      setErrorType('Invalid Email Domain')
      setErrorMessage('Please use your college email account (@citchennai.net)')
    } else if (type === 'not_found') {
      setErrorType('Email Not Found')
      setErrorMessage('Your email is not found in our records. Please contact your class advisor or administrator.')
    } else if (type === 'database_error') {
      setErrorType('System Error')
      setErrorMessage('An error occurred while processing your request. Please try again later.')
    } else if (type === 'unknown') {
      setErrorType('Authentication Error')
      setErrorMessage('There was a problem with your login attempt. Please try again.')
    } else {
      setErrorType('Authentication Error')
      setErrorMessage('There was a problem with your login attempt. Please try again.')
    }

    // Sign out the user to clear any invalid session
    signOut({ redirect: false })
  }, [searchParams])

  const handleReturnToLogin = () => {
    router.push('/login')
  }

  return (
    <div className="dashboard-bg flex items-center justify-center p-4 min-h-screen">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)]"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        <div className="card">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">
              {errorType}
            </h1>
            <p className="text-lg text-slate-300 mb-6">
              {errorMessage}
            </p>
          </div>

          {/* Error Details */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8">
            <div className="flex items-start space-x-3">
              <Mail className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-red-400 font-semibold mb-2">What to do next:</h3>
                <ul className="text-slate-300 text-sm space-y-1">
                  <li>• Make sure you&apos;re using your college email (@citchennai.net)</li>
                  <li>• Contact your class advisor if you&apos;re a student</li>
                  <li>• Contact the administrator if you&apos;re faculty/staff</li>
                  <li>• Try logging in again with the correct email</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleReturnToLogin}
              className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-xl transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Return to Login</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              Chennai Institute of Technology
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Poll Management System
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="dashboard-bg flex items-center justify-center p-4 min-h-screen">
        <div className="card">
          <div className="text-center">
            <div className="w-20 h-20 bg-slate-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-500/30">
              <AlertCircle className="w-10 h-10 text-slate-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Loading...</h1>
            <p className="text-lg text-slate-300">Please wait while we process your request.</p>
          </div>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}

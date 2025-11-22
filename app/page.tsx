'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LeetCodeFetcher from '@/components/LeetCodeFetcher'

export default function HomePage() {
  const router = useRouter()
  const [showFetcher, setShowFetcher] = useState(false)

  useEffect(() => {
    // Redirect to login page immediately
    router.push('/login')
  }, [router])

  return (
    <div className="bg-slate-900 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-white mt-4">Redirecting to login...</p>
      </div>
      

      
    </div>
  )
}

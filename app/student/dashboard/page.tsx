'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, LogOut, CheckCircle, Clock, BarChart3, Trophy, ExternalLink, User, Building, Calendar, Edit, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, formatCreatedAt, formatTime, getCurrentTime, getCurrentTimeIST, getCurrentTimeForDisplay, isPollExpired, getTimeRemaining, formatRespondedAt, formatTimeSimple, formatDateNoYear, formatDateTimeNoYear } from '@/lib/utils'
import { useSession, signOut } from 'next-auth/react'

interface Poll {
  id: number
  title: string
  created_at: string
  staff_name: string
  class_name: string
  poll_type: 'text' | 'options'
  options?: string[]
  deadline_at?: string | null
  poll_category: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved'
  link_url?: string | null
  auto_delete_days?: number
  auto_delete_at?: string | null
  last_modified_at?: string | null
  target_gender?: 'all' | 'boys' | 'girls' | null
}

interface PollOption {
  id: number
  poll_id: number
  option_text: string
  option_order: number
}

interface PollResponse {
  id: number
  poll_id: number
  student_reg_no: string
  response: string | null
  option_index: number | null
  responded_at: string | null
  option_id: number | null
}

export default function StudentDashboard() {
  const [studentData, setStudentData] = useState<any>(null)
  const [polls, setPolls] = useState<Poll[]>([])
  const [responses, setResponses] = useState<PollResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'general' | 'hackathon' | 'gform'>('general')
  const [editingResponse, setEditingResponse] = useState<PollResponse | null>(null)
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    // Check authentication status
    if (status === 'loading') {
      return // Still loading
    }

    if (status === 'unauthenticated') {
      router.push('/student/login')
      return
    }

    if (session?.user?.role !== 'student') {
      router.push('/')
      return
    }

    // Get student data from session or fetch from database
    const getStudentData = async () => {
      try {
        const { data: student, error } = await supabase
          .from('students')
          .select('*')
          .eq('email', session?.user?.email)
          .single()

        if (error || !student) {
          toast.error('Student not found')
          router.push('/student/login')
          return
        }

        setStudentData(student)
        setLastRefreshed(new Date())
        fetchPolls(student)
        fetchResponses(student.reg_no)
      } catch (error) {
        console.error('Error fetching student data:', error)
        toast.error('Failed to load student data')
        router.push('/student/login')
      }
    }

    getStudentData()

    // Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        if (studentData && !isRefreshing) {
          handleRefresh()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Set up real-time subscriptions
    const setupRealtimeSubscriptions = () => {
      if (!studentData) return () => {}
      
      // Subscribe to poll_responses changes
      const pollResponsesSubscription = supabase
        .channel('student_poll_responses_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_responses'
          },
          () => {
            // Refresh responses when they change
            fetchResponses(studentData.reg_no)
          }
        )
        .subscribe()

      // Subscribe to polls changes
      const pollsSubscription = supabase
        .channel('student_polls_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'polls'
          },
          () => {
            // Refresh polls when they change
            fetchPolls(studentData)
          }
        )
        .subscribe()

      // Return cleanup function
      return () => {
        pollResponsesSubscription.unsubscribe()
        pollsSubscription.unsubscribe()
      }
    }

    const cleanup = setupRealtimeSubscriptions()

    // Cleanup on unmount
    return () => {
      cleanup()
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [router, session, status])

  const handleLogout = () => {
    signOut({ callbackUrl: '/' })
    toast.success('Logged out successfully')
  }

  const fetchPolls = async (student: any) => {
    try {
      // Get polls for the student's department and section
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('department', student.department)
        .eq('section', student.section)
        .single()

      if (classError) throw classError

      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select(`
          *,
          staffs(name),
          classes(department, section)
        `)
        .eq('class_id', classData.id)

      if (pollsError) throw pollsError

      // Filter polls based on gender targeting, expiration, and scheduling
      const formattedPolls = pollsData
        .filter((poll: any) => {
          // Hide scheduled polls that haven't reached their publish time yet
          const now = new Date()
          const pollCreatedAt = new Date(poll.created_at)
          
          // Debug logging for scheduled polls
          console.log('Poll filtering debug:', {
            title: poll.title,
            pollCreatedAtRaw: poll.created_at,
            pollCreatedAt: pollCreatedAt.toISOString(),
            currentTime: now.toISOString(),
            pollCreatedAtTime: pollCreatedAt.getTime(),
            currentTimeTime: now.getTime(),
            timeDifference: pollCreatedAt.getTime() - now.getTime(),
            isScheduledForFuture: pollCreatedAt.getTime() > now.getTime(),
            willBeHidden: pollCreatedAt.getTime() > now.getTime()
          })
          
          // Use getTime() for more reliable comparison
          if (pollCreatedAt.getTime() > now.getTime()) {
            console.log(`🚫 Hiding scheduled poll "${poll.title}" - scheduled for ${pollCreatedAt.toISOString()} but current time is ${now.toISOString()}`)
            return false // Poll is scheduled for the future
          } else {
            console.log(`✅ Showing poll "${poll.title}" - scheduled time has passed`)
          }

          // Students: hide when past deadline
          if (poll.deadline_at) {
            const deadline = new Date(poll.deadline_at)
            if (deadline <= now) return false
          }
          // Also hide after auto-delete
          if (poll.auto_delete_at) {
            const deleteAt = new Date(poll.auto_delete_at)
            if (deleteAt <= now) return false
          }
          
          // Filter based on gender targeting
          if (poll.target_gender && poll.target_gender !== 'all') {
            // Convert student gender to match poll targeting format
            const studentGender = student.gender
            
            if (poll.target_gender === 'boys' && (studentGender === 'M' || studentGender === 'Male')) {
              return true
            } else if (poll.target_gender === 'girls' && (studentGender === 'F' || studentGender === 'Female')) {
              return true
            } else {
              return false // Student gender doesn't match poll targeting
            }
          }
          
          // If poll targets 'all' or no gender targeting, include it
          return true
        })
        .map((poll: any) => ({
          id: poll.id,
          title: poll.title,
          created_at: poll.created_at,
          staff_name: poll.staffs?.name || 'Unknown',
          class_name: `${poll.classes?.department} ${poll.classes?.section}`,
          last_modified_at: poll.last_modified_at,
          poll_type: poll.poll_type || 'text',
          options: poll.options,
          deadline_at: poll.deadline_at,
          poll_category: poll.poll_category || 'General Poll', // Default to General Poll if not set
          link_url: poll.link_url || null,
          auto_delete_days: poll.auto_delete_days,
          auto_delete_at: poll.auto_delete_at,
          target_gender: poll.target_gender || 'all'
        }))



      setPolls(formattedPolls)
    } catch (error) {
      console.error('Error fetching polls:', error)
      toast.error('Failed to fetch polls')
    }
  }

  const fetchResponses = async (regNo: string) => {
    try {
      const { data, error } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('student_reg_no', regNo)

      if (error) throw error
      setResponses(data || [])
    } catch (error) {
      console.error('Error fetching responses:', error)
    } finally {
      setIsLoading(false)
    }
  }


  const handleRefresh = async () => {
    if (!studentData) return
    
    setIsRefreshing(true)
    try {
      // Refresh all data
      await Promise.all([
        fetchPolls(studentData),
        fetchResponses(studentData.reg_no)
      ])
      
      setLastRefreshed(new Date())
      toast.success('Data refreshed successfully!')
    } catch (error) {
      console.error('Error refreshing data:', error)
      toast.error('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const hasRespondedToPoll = (pollId: number) => {
    return responses.some(response => response.poll_id === pollId)
  }

  const getResponseForPoll = (pollId: number) => {
    return responses.find(response => response.poll_id === pollId)
  }

  const getPollsByCategory = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll') => {
    const filteredPolls = polls.filter(poll => {
      // If poll_category is null/undefined, treat it as 'General Poll'
      const pollCategory = poll.poll_category || 'General Poll'
      
      if (category === 'General Poll') {
        // General Poll tab should show: General Poll, Attendance, and Problems Solved
        return pollCategory === 'General Poll' || pollCategory === 'Attendance' || pollCategory === 'Problems Solved'
      } else {
        // Other tabs show only their specific category
        return pollCategory === category
      }
    })
    
    return filteredPolls
  }

  const getUnrespondedPollsCount = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll') => {
    const categoryPolls = getPollsByCategory(category)
    return categoryPolls.filter(poll => !hasRespondedToPoll(poll.id)).length
  }

  if (isLoading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Student Dashboard</h2>
            <p className="text-slate-300">Loading your polls...</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex justify-center space-x-2"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-3 h-3 bg-primary-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              className="w-3 h-3 bg-accent-500 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="w-3 h-3 bg-secondary-500 rounded-full"
            />
          </motion.div>
        </div>
      </div>
    )
  }

  if (!studentData) {
    return null
  }

  return (
    <div className="dashboard-bg">
      {/* Header */}
      <header className="header">
        <div className="max-w-7xl mx-auto mobile-container">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-500/20 rounded-full flex items-center justify-center border border-primary-500/30">
                <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6 text-primary-400" />
              </div>
              <div>
                <h1 className="mobile-text-lg sm:mobile-text-xl font-semibold text-white">
                  Student Dashboard
                </h1>
                <p className="mobile-text-xs sm:mobile-text-sm text-slate-300">
                  {studentData.name} • {studentData.department} {studentData.section}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-slate-400 text-xs sm:text-sm">
                {lastRefreshed && (
                  <span title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}>
                    Last: {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700 text-sm sm:text-base"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto mobile-container mobile-p">
        {/* Student Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mobile-mb"
        >
          <div className="card">
            <div className="mobile-grid">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-500/20 rounded-full flex items-center justify-center border border-primary-500/30">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">Name</p>
                  <p className="mobile-text-sm sm:font-medium text-white">{studentData.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-500/20 rounded-full flex items-center justify-center border border-accent-500/30">
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-accent-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">Department</p>
                  <p className="mobile-text-sm sm:font-medium text-white">{studentData.department} {studentData.section}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary-500/20 rounded-full flex items-center justify-center border border-secondary-500/30">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-400">Registration</p>
                  <p className="mobile-text-sm sm:font-medium text-white">{studentData.reg_no}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-1 mobile-mb bg-slate-800 p-1 rounded-xl shadow-lg">
          {[
            { id: 'general', label: 'General Poll', icon: BarChart3, category: 'General Poll' as const },
            { id: 'hackathon', label: 'Hackathon', icon: Trophy, category: 'Hackathon' as const },
            { id: 'gform', label: 'G-Form Poll', icon: ExternalLink, category: 'G-Form Poll' as const }
          ].map((tab) => {
            const unrespondedCount = getUnrespondedPollsCount(tab.category)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base relative ${
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <tab.icon className="w-4 h-4 sm:w-5 sm:w-5" />
                <span>{tab.label}</span>
                {unrespondedCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{unrespondedCount}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>



        {/* Tab Content */}
        <div className="mobile-space-y">
          {/* General Poll Tab */}
          {activeTab === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mobile-space-y"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                <h2 className="mobile-text-xl sm:mobile-text-2xl font-bold text-white">General Poll</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2 text-xs sm:text-sm"
                    title="Refresh general polls data"
                  >
                    <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <span className="text-xs sm:text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
                    {getPollsByCategory('General Poll').length} poll{getPollsByCategory('General Poll').length !== 1 ? 's' : ''} available
                  </span>
                </div>
              </div>

              {getPollsByCategory('General Poll').length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mobile-mb border border-slate-600">
                    <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  </div>
                  <h3 className="mobile-text-base sm:mobile-text-lg font-medium text-white mobile-mb">No general polls available</h3>
                  <p className="mobile-text-sm sm:mobile-text-base text-slate-400">Check back later for new polls from your faculty.</p>
                  {polls.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-300 text-sm">Found {polls.length} polls but none categorized as 'General Poll'</p>
                      <p className="text-blue-200 text-xs mt-1">Polls might be in other categories or have no category set.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {getPollsByCategory('General Poll').map((poll) => {
                    const hasResponded = hasRespondedToPoll(poll.id)
                    const existingResponse = getResponseForPoll(poll.id)
                    
                    return (
                      <div key={poll.id} className="card">
                        <div className="flex flex-col sm:flex-row justify-between items-start space-y-3 sm:space-y-0">
                          <div className="flex-1">
                            <h3 className="mobile-text-base sm:mobile-text-lg font-semibold text-white mobile-mb">
                              {poll.title}
                              {poll.last_modified_at && poll.last_modified_at !== poll.created_at && (
                                <span className="ml-2 text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full border border-orange-500/40">edited</span>
                              )}
                            </h3>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-slate-400">
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{poll.staff_name}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{poll.class_name}</span>
                              </span>
                              {/* Target audience is enforced in filtering; no badge shown to students */}
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{formatDateTimeNoYear(poll.created_at)}</span>
                              </span>
                              {poll.deadline_at && (
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="text-orange-400">
                                    Due: {formatDateTimeNoYear(poll.deadline_at)}
                                  </span>
                                </span>
                              )}

                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {hasResponded ? (
                              <div className="flex items-center space-x-2 text-green-400 bg-green-500/20 px-2 sm:px-3 py-1 rounded-full border border-green-500/30">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs sm:text-sm font-medium">Responded</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-orange-400 bg-orange-500/20 px-2 sm:px-3 py-1 rounded-full border border-orange-500/30">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs sm:text-sm font-medium">Pending</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {hasResponded && existingResponse ? (
                          <div className="mt-4 pt-4 border-t border-slate-600">
                            <div className="flex flex-col sm:flex-row justify-between items-start space-y-3 sm:space-y-0">
                              <div className="flex-1">
                                <p className="mobile-text-sm sm:mobile-text-base text-slate-300 mobile-mb">
                                  <strong>Your Response:</strong> {existingResponse.response ? String(existingResponse.response).split(' - ')[0] : 'Unknown'}
                                </p>
                                <div className="text-xs sm:text-sm text-slate-400">
                                  Responded at: {existingResponse.responded_at ? formatRespondedAt(existingResponse.responded_at) : 'Unknown'}
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setEditingResponse(existingResponse)}
                                  className="btn-secondary flex items-center space-x-2 text-xs sm:text-sm"
                                >
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span>Edit Response</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 pt-4 border-t border-slate-600">
                            <PollResponseForm 
                              poll={poll} 
                              session={session}
                              onResponseSubmitted={() => {
                                fetchResponses(studentData.reg_no)
                                toast.success('Response submitted successfully!')
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Hackathon Tab */}
          {activeTab === 'hackathon' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mobile-space-y"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                <h2 className="mobile-text-xl sm:mobile-text-2xl font-bold text-white">Hackathon</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2 text-xs sm:text-sm"
                    title="Refresh hackathon polls data"
                  >
                    <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <span className="text-xs sm:text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
                    {getPollsByCategory('Hackathon').length} poll{getPollsByCategory('Hackathon').length !== 1 ? 's' : ''} available
                  </span>
                </div>
              </div>

              {getPollsByCategory('Hackathon').length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mobile-mb border border-slate-600">
                    <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  </div>
                  <h3 className="mobile-text-base sm:mobile-text-lg font-medium text-white mobile-mb">No hackathon polls available</h3>
                  <p className="mobile-text-sm sm:mobile-text-base text-slate-400">Check back later for hackathon-related polls.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {getPollsByCategory('Hackathon').map((poll) => {
                    const hasResponded = hasRespondedToPoll(poll.id)
                    
                    return (
                      <div key={poll.id} className="card">
                        <div className="flex flex-col sm:flex-row justify-between items-start space-y-3 sm:space-y-0">
                          <div className="flex-1">
                            <h3 className="mobile-text-base sm:mobile-text-lg font-semibold text-white mobile-mb">
                              {poll.title}
                              {poll.last_modified_at && poll.last_modified_at !== poll.created_at && (
                                <span className="ml-2 text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full border border-orange-500/40">
                                  edited
                                </span>
                              )}
                            </h3>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-slate-400">
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{poll.staff_name}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{poll.class_name}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{formatDateTimeNoYear(poll.created_at)}</span>
                              </span>
                              {poll.deadline_at && (
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="text-orange-400">
                                    Due: {formatDateTimeNoYear(poll.deadline_at)}
                                  </span>
                                </span>
                              )}

                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {hasResponded ? (
                              <div className="flex items-center space-x-2 text-green-400 bg-green-500/20 px-2 sm:px-3 py-1 rounded-full border border-green-500/30">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs sm:text-sm font-medium">Responded</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-orange-400 bg-orange-500/20 px-2 sm:px-3 py-1 rounded-full border border-orange-500/30">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs sm:text-sm font-medium">Pending</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Display link if available */}
                        {poll.link_url && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <div className="flex items-center space-x-2">
                              <ExternalLink className="w-4 h-4 text-blue-400" />
                              <a 
                                href={poll.link_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline text-sm"
                              >
                                View Hackathon Details
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {!hasResponded && (
                          <div className="mt-4 pt-4 border-t border-slate-600">
                            <PollResponseForm 
                              poll={poll} 
                              session={session}
                              onResponseSubmitted={() => {
                                fetchResponses(studentData.reg_no)
                                toast.success('Response submitted successfully!')
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Show edit option if already responded */}
                        {hasResponded && (
                          <div className="mt-4 pt-4 border-t border-slate-600">
                            <div className="flex flex-col sm:flex-row justify-between items-start space-y-3 sm:space-y-0">
                              <div className="flex-1">
                                <p className="mobile-text-sm sm:mobile-text-base text-slate-300 mobile-mb">
                                  <strong>Your Response:</strong> {getResponseForPoll(poll.id)?.response ? String(getResponseForPoll(poll.id)!.response).split(' - ')[0] : 'Unknown'}
                                </p>
                                <div className="text-xs sm:text-sm text-slate-400">
                                  Responded at: {getResponseForPoll(poll.id)?.responded_at ? formatRespondedAt(getResponseForPoll(poll.id)!.responded_at!) : 'Unknown'}
                                </div>
                              </div>
                              <button
                                onClick={() => setEditingResponse(getResponseForPoll(poll.id)!)}
                                className="btn-secondary flex items-center space-x-2 text-xs sm:text-sm"
                              >
                                <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>Edit Response</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* G-Form Poll Tab */}
          {activeTab === 'gform' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mobile-space-y"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                <h2 className="mobile-text-xl sm:mobile-text-2xl font-bold text-white">G-Form Poll</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2 text-xs sm:text-sm"
                    title="Refresh G-Form polls data"
                  >
                    <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <span className="text-xs sm:text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-600">
                    {getPollsByCategory('G-Form Poll').length} poll{getPollsByCategory('G-Form Poll').length !== 1 ? 's' : ''} available
                  </span>
                </div>
              </div>

              {getPollsByCategory('G-Form Poll').length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mobile-mb border border-slate-600">
                    <ExternalLink className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  </div>
                  <h3 className="mobile-text-base sm:mobile-text-lg font-medium text-white mobile-mb">No G-Form polls available</h3>
                  <p className="mobile-text-sm sm:mobile-text-base text-slate-400">Check back later for G-Form related polls.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {getPollsByCategory('G-Form Poll').map((poll) => {
                    const hasResponded = hasRespondedToPoll(poll.id)
                    
                    return (
                      <div key={poll.id} className="card">
                        <div className="flex flex-col sm:flex-row justify-between items-start space-y-3 sm:space-y-0">
                          <div className="flex-1">
                            <h3 className="mobile-text-base sm:mobile-text-lg font-semibold text-white mobile-mb">
                              {poll.title}
                              {poll.last_modified_at && poll.last_modified_at !== poll.created_at && (
                                <span className="ml-2 text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full border border-orange-500/40">
                                  edited
                                </span>
                              )}
                            </h3>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-slate-400">
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{poll.staff_name}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{poll.class_name}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{formatDateTimeNoYear(poll.created_at)}</span>
                              </span>
                              {poll.deadline_at && (
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="text-orange-400">
                                    Due: {formatDateTimeNoYear(poll.deadline_at)}
                                  </span>
                                </span>
                              )}

                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {hasResponded ? (
                              <div className="flex items-center space-x-2 text-green-400 bg-green-500/20 px-2 sm:px-3 py-1 rounded-full border border-green-500/30">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs sm:text-sm font-medium">Responded</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-orange-400 bg-orange-500/20 px-2 sm:px-3 py-1 rounded-full border border-orange-500/30">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs sm:text-sm font-medium">Pending</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Display link if available */}
                        {poll.link_url && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <div className="flex items-center space-x-2">
                              <ExternalLink className="w-4 h-4 text-blue-400" />
                              <a 
                                href={poll.link_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline text-sm"
                              >
                                View G-Form
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {!hasResponded && (
                          <div className="mt-4 pt-4 border-t border-slate-600">
                            <PollResponseForm 
                              poll={poll} 
                              session={session}
                              onResponseSubmitted={() => {
                                fetchResponses(studentData.reg_no)
                                toast.success('Response submitted successfully!')
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Show edit option if already responded */}
                        {hasResponded && (
                          <div className="mt-4 pt-4 border-t border-slate-600">
                            <div className="flex flex-col sm:flex-row justify-between items-start space-y-3 sm:space-y-0">
                              <div className="flex-1">
                                <p className="mobile-text-sm sm:mobile-text-base text-slate-300 mobile-mb">
                                  <strong>Your Response:</strong> {getResponseForPoll(poll.id)?.response ? String(getResponseForPoll(poll.id)!.response).split(' - ')[0] : 'Unknown'}
                                </p>
                                <div className="text-xs sm:text-sm text-slate-400">
                                  Responded at: {getResponseForPoll(poll.id)?.responded_at ? formatRespondedAt(getResponseForPoll(poll.id)!.responded_at!) : 'Unknown'}
                                </div>
                              </div>
                              <button
                                onClick={() => setEditingResponse(getResponseForPoll(poll.id)!)}
                                className="btn-secondary flex items-center space-x-2 text-xs sm:text-sm"
                              >
                                <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>Edit Response</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Edit Response Modal */}
      {editingResponse && (
        <EditResponseModal
          response={editingResponse}
          poll={polls.find(p => p.id === editingResponse.poll_id)!}
          session={session}
          onClose={() => setEditingResponse(null)}
          onResponseUpdated={() => {
            fetchResponses(studentData.reg_no)
            setEditingResponse(null)
          }}
        />
      )}

      
    </div>
  )
}

 

// Poll Response Form Component
function PollResponseForm({ poll, onResponseSubmitted, session }: { 
  poll: Poll, 
  onResponseSubmitted: () => void,
  session: any 
}) {
  const [response, setResponse] = useState('')
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Always require option selection for all poll types
    if (selectedOptionIndex === null) {
      toast.error('Please select an option')
      return
    }
    
    // For General Polls, text response is optional
    // For other poll types, no text response needed

    setIsSubmitting(true)
    try {
      // Test Supabase connection first
      console.log('Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('polls')
        .select('id')
        .limit(1)
      
      if (testError) {
        console.error('Supabase connection test failed:', testError)
        toast.error('Database connection failed. Please try again.')
        return
      }
      
      console.log('Supabase connection test successful')
      
      if (!session?.user || session.user.role !== 'student') {
        toast.error('Authentication required. Please log in again.')
        return
      }

      // Get student data from session
      const studentData = {
        reg_no: session.user.reg_no,
        email: session.user.email,
        name: session.user.name,
        department: session.user.department,
        section: session.user.section,
        class_id: session.user.class_id
      }

      // Session is managed by NextAuth, no need to check expiry manually
      
      // Check if student has already responded to this poll
      const { data: existingResponse, error: checkError } = await supabase
        .from('poll_responses')
        .select('id')
        .eq('poll_id', poll.id)
        .eq('student_reg_no', studentData.reg_no)
                                      
      if (checkError) {
        console.error('Error checking existing response:', checkError)
        throw checkError
      }

      if (existingResponse && existingResponse.length > 0) {
        toast.error('You have already responded to this poll')
        return
      }

      const selectedOption = poll.options?.[selectedOptionIndex!]
      
      // For Attendance templates (LeetCode/CodeChef) with Absent option, require text response
      if ((poll.title.includes('LeetCode Attendance') || poll.title.includes('CodeChef Attendance')) && selectedOption === 'Absent') {
        if (!response.trim()) {
          toast.error('Please provide a reason for absenteeism')
          return
        }
      }

      // Validate option_index constraint (0-50) - matches database schema
      if (selectedOptionIndex !== null && (selectedOptionIndex < 0 || selectedOptionIndex > 50)) {
        toast.error('Invalid option selection')
        return
      }
      
      // Create response text
      let responseText = ''
      if (selectedOption && response.trim()) {
        responseText = `${selectedOption} - ${response.trim()}`
      } else if (selectedOption) {
        responseText = selectedOption
      } else if (response.trim()) {
        responseText = response.trim()
      } else {
        responseText = 'No response provided'
      }

      const responseData: any = {
        poll_id: poll.id,
        student_reg_no: studentData.reg_no,
        response: responseText,
        option_index: selectedOptionIndex,
        responded_at: new Date().toISOString()
      }

      console.log('Submitting response data:', responseData)
      
      const { data, error } = await supabase
        .from('poll_responses')
        .insert(responseData)
        .select()

      if (error) {
        console.error('Supabase insert error:', error)
        throw error
      }
      
      console.log('Response submitted successfully:', data)

      setResponse('')
      setSelectedOptionIndex(null)
      onResponseSubmitted()
    } catch (error) {
      console.error('Error submitting response:', error)
      toast.error('Failed to submit response')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mobile-space-y">
      {/* Always show radio buttons for all poll types */}
      {poll.options && poll.options.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-200 mobile-mb">
            Select an option:
          </label>
          <div className="space-y-2">
            {poll.options.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={`poll-${poll.id}`}
                  value={index}
                  checked={selectedOptionIndex === index}
                  onChange={(e) => setSelectedOptionIndex(Number(e.target.value))}
                  className="w-4 h-4 text-primary-600 bg-slate-700 border-slate-600 focus:ring-primary-500 focus:ring-2"
                />
                <span className="text-slate-200">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      
      {/* Show text response field for Attendance templates when Absent is selected */}
      {(poll.title.includes('LeetCode Attendance') || poll.title.includes('CodeChef Attendance')) && selectedOptionIndex !== null && poll.options?.[selectedOptionIndex] === 'Absent' && (
        <div>
          <label htmlFor="response" className="block text-sm font-medium text-slate-200 mobile-mb">
            Reason for Absenteeism (Required)
          </label>
          
          <textarea
            id="response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Please provide a reason for being absent..."
            className="input-field resize-none"
            rows={3}
            required
          />
        </div>
      )}
      
      {/* Show text response field for General Polls */}
      {poll.poll_category === 'General Poll' && !poll.title.includes('LeetCode Attendance') && (
        <div>
          <label htmlFor="response" className="block text-sm font-medium text-slate-200 mobile-mb">
            Additional Text Response (Optional)
          </label>
          
          <textarea
            id="response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Add any additional comments or explanations..."
            className="input-field resize-none"
            rows={3}
          />
        </div>
      )}
      
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary disabled:opacity-50 flex items-center justify-center space-x-2"
      >
        {isSubmitting ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
            />
            <span>Submitting...</span>
          </>
        ) : (
          'Submit Response'
        )}
      </button>
    </form>
  )
}

// Edit Response Modal Component
function EditResponseModal({ 
  response, 
  poll, 
  onClose, 
  onResponseUpdated,
  session
}: { 
  response: PollResponse
  poll: Poll
  onClose: () => void
  onResponseUpdated: () => void
  session: any
}) {
  const [editedResponse, setEditedResponse] = useState('')
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(
    response.option_index !== null && response.option_index !== undefined ? response.option_index : null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate response ID exists
    if (!response.id) {
      toast.error('Invalid response ID')
      return
    }
    
    // Always require option selection for all poll types
    if (selectedOptionIndex === null) {
      toast.error('Please select an option')
      return
    }
    
    // For General Polls, text response is optional
    // For other poll types, no text response needed

    setIsSubmitting(true)
    try {
      if (!session?.user || session.user.role !== 'student') {
        toast.error('Authentication required. Please log in again.')
        return
      }

      // Get student data from session
      const studentData = {
        reg_no: session.user.reg_no,
        email: session.user.email,
        name: session.user.name,
        department: session.user.department,
        section: session.user.section,
        class_id: session.user.class_id
      }
      
      console.log('Student authenticated:', studentData.email)
      
      // Verify the response still exists and belongs to the current user
      console.log('Checking response ownership...')
      console.log('Response student_reg_no:', response.student_reg_no)
      console.log('Current student reg_no:', studentData.reg_no)
      
            const { data: existingResponse, error: fetchError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('id', response.id)
        .eq('student_reg_no', studentData.reg_no)

      if (fetchError) {
        console.error('Fetch error:', fetchError)
        toast.error(`Error fetching response: ${fetchError.message}`)
        return
      }

      if (!existingResponse || existingResponse.length === 0) {
        toast.error('Response not found or access denied')
        return
      }

      const responseData = existingResponse[0]
      
      // Double-check that the response belongs to the current user
      if (responseData.student_reg_no !== studentData.reg_no) {
        console.error('Response ownership mismatch:', {
          responseOwner: responseData.student_reg_no,
          currentUser: studentData.reg_no
        })
        toast.error('Access denied: This response does not belong to you')
        return
      }
      
      console.log('Response ownership verified:', responseData)
      
      // Validate option_index constraint (0-50) - matches database schema
      if (selectedOptionIndex !== null && (selectedOptionIndex < 0 || selectedOptionIndex > 50)) {
        toast.error('Invalid option selection')
        return
      }

      // Get the selected option text
      const selectedOption = poll.options?.[selectedOptionIndex!]
      
      // For Attendance templates (LeetCode/CodeChef) with Absent option, require text response
      if ((poll.title.includes('LeetCode Attendance') || poll.title.includes('CodeChef Attendance')) && selectedOption === 'Absent') {
        if (!editedResponse.trim()) {
          toast.error('Please provide a reason for absenteeism')
          return
        }
      }
      
      // Create response text
      let responseText = ''
      if (selectedOption && editedResponse.trim()) {
        responseText = `${selectedOption} - ${editedResponse.trim()}`
      } else if (selectedOption) {
        responseText = selectedOption
      } else if (editedResponse.trim()) {
        responseText = editedResponse.trim()
      } else {
        responseText = 'No response provided'
      }

      const updateData: any = {
        response: responseText,
        option_index: selectedOptionIndex,
        responded_at: new Date().toISOString()
      }
      
      console.log('Final update data:', updateData)

      console.log('Updating response with data:', updateData)
      console.log('Response ID:', response.id)
      console.log('Response object:', response)
      
      const { data, error } = await supabase
        .from('poll_responses')
        .update(updateData)
        .eq('id', response.id)
        .select()

      if (error) throw error

      console.log('Update successful, returned data:', data)
      
      onResponseUpdated()
      onClose()
      toast.success(`Response updated successfully at ${new Date().toTimeString().split(' ')[0]}!`)
    } catch (error) {
      console.error('Error updating response:', error)
      if (error && typeof error === 'object' && 'message' in error) {
        console.error('Error details:', error.message)
        console.error('Full error object:', error)
        
        // Check for specific error types
        const errorMessage = String(error.message)
        if (errorMessage.includes('permission')) {
          toast.error('Permission denied. You may not have access to edit this response.')
        } else if (errorMessage.includes('constraint')) {
          toast.error('Data validation error. Please check your input.')
        } else if (errorMessage.includes('not found')) {
          toast.error('Response not found. It may have been deleted.')
        } else {
          toast.error(`Failed to update response: ${errorMessage}`)
        }
      } else {
        console.error('Unknown error:', error)
        toast.error('Failed to update response')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center mobile-p z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl shadow-xl mobile-p w-full max-w-lg border border-slate-700"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mobile-mb space-y-2 sm:space-y-0">
          <h2 className="mobile-text-lg sm:mobile-text-xl font-semibold text-white">Edit Response</h2>
          <div className="text-xs text-slate-400 text-right">
            <div>Last updated: {response.responded_at ? formatRespondedAt(response.responded_at) : 'Unknown'}</div>
            <div className="text-blue-400">Current time: {getCurrentTimeForDisplay()}</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mobile-space-y">
          {/* Always show radio buttons for all poll types */}
          {poll.options && poll.options.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mobile-mb">
                Select an option:
              </label>
              <div className="space-y-2">
                {poll.options.map((option, index) => (
                  <label key={index} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name={`edit-poll-${poll.id}`}
                      value={index}
                      checked={selectedOptionIndex === index}
                      onChange={(e) => setSelectedOptionIndex(Number(e.target.value))}
                      className="w-4 h-4 text-primary-600 bg-slate-700 border-slate-600 focus:ring-primary-500 focus:ring-2"
                    />
                    <span className="text-slate-200">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {/* Show text response field for Attendance templates when Absent is selected */}
          {(poll.title.includes('LeetCode Attendance') || poll.title.includes('CodeChef Attendance')) && selectedOptionIndex !== null && poll.options?.[selectedOptionIndex] === 'Absent' && (
            <div>
              <label htmlFor="editedResponse" className="block text-sm font-medium text-slate-200 mobile-mb">
                Reason for Absenteeism (Required)
              </label>
              
              <textarea
                id="editedResponse"
                value={editedResponse}
                onChange={(e) => setEditedResponse(e.target.value)}
                placeholder="Please provide a reason for being absent..."
                className="input-field resize-none"
                rows={3}
                required
              />
            </div>
          )}
          
          {/* Show text response field for General Polls */}
          {poll.poll_category === 'General Poll' && !poll.title.includes('LeetCode Attendance') && (
            <div>
              <label htmlFor="editedResponse" className="block text-sm font-medium text-slate-200 mobile-mb">
                Additional Text Response (Optional)
              </label>
              
              <textarea
                id="editedResponse"
                value={editedResponse}
                onChange={(e) => setEditedResponse(e.target.value)}
                placeholder="Add any additional comments or explanations..."
                className="input-field resize-none"
                rows={3}
              />
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>Updating...</span>
                </>
              ) : (
                'Update Response'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

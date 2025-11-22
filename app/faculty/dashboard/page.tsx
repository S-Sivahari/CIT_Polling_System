'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, LogOut, Plus, BarChart3, UserCheck, Download, Eye, Edit, Trash2, RefreshCw, Code } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import toast from 'react-hot-toast'
import { formatDate, formatCreatedAt, exportToExcel, exportToExcelWithMultipleSheets, getCurrentTime, isPollExpired, formatDeadline, formatRespondedAt, formatDeadlineDate, getAutoDeleteCountdown, isNearAutoDelete, getAutoDeleteWarning, formatLastModified, formatTimeSimple, formatDateNoYear, formatDateTimeNoYear, getAutoDeleteHours, sanitizeFilename } from '@/lib/utils'
import LeetCodeFetchDialog from '@/components/LeetCodeFetchDialog'
import { Student } from '@/types/student'

interface Poll {
  id: number
  title: string
  created_at: string
  class_id: number
  staff_id: number
  staff_name?: string
  poll_type?: 'text' | 'options'
  options?: string[]
  deadline_at?: string | null
  poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved'
  link_url?: string | null
  contest_type?: string | null
  custom_question?: string | null
  auto_delete_days?: number
  is_editable?: boolean
  last_modified_at?: string | null
  auto_delete_at?: string | null
  target_gender?: string | null
  scheduled_at_time?: string | null
}

interface PollResponse {
  id: number
  poll_id: number
  student_reg_no: string
  response: string | null
  option_index: number | null
  responded_at: string | null
  option_id: number | null
  student_name: string
}

export default function FacultyDashboard() {
  const { data: session, status } = useSession()
  const [facultyData, setFacultyData] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [responses, setResponses] = useState<PollResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...')
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'polls' | 'responses'>('overview')
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [deletingPolls, setDeletingPolls] = useState<Set<number>>(new Set())
  const [showLeetCodeDialog, setShowLeetCodeDialog] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [showEditPoll, setShowEditPoll] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Set up a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('Dashboard loading timeout, redirecting to login')
        router.push('/faculty/login')
      }
    }, 10000) // 10 second timeout

    if (status === 'loading') {
      setLoadingProgress('Loading session...')
      return
    }

    // Add a small delay to ensure session is fully processed
    const sessionDelay = setTimeout(() => {
      if (isLoading) {
        console.log('Session still loading after delay, retrying...')
        setLoadingProgress('Retrying session...')
      }
    }, 1000)
    
    if (!session) {
      console.log('No session found, redirecting to login')
      clearTimeout(timeoutId)
      router.push('/faculty/login')
      return
    }

    if (session.user.role !== 'faculty') {
      console.log('Invalid role for faculty dashboard:', session.user.role)
      clearTimeout(timeoutId)
      router.push('/faculty/login')
      return
    }

    // Check if session user has required data
    if (!session.user.isValid) {
      console.log('Invalid session, redirecting to login')
      clearTimeout(timeoutId)
      router.push('/faculty/login')
      return
    }

    console.log('Faculty session validated, initializing dashboard')
    setLoadingProgress('Loading dashboard...')
    clearTimeout(timeoutId)
    
    // Get faculty data from session
    const data = {
      id: (() => {
        // Safely convert session.user.id to integer
        const sessionId = session.user.id
        console.log('Session user ID:', sessionId, typeof sessionId)
        
        // If it's already a small number, use it directly
        const numId = Number(sessionId)
        if (numId <= 2147483647) { // PostgreSQL integer max value
          return numId
        }
        
        // If it's too large, it's likely a Google OAuth ID, we need to find the actual staff ID
        console.warn('Session ID too large for database, need to fetch from database')
        return null // We'll handle this in fetchPolls
      })(),
      name: session.user.name,
      email: session.user.email,
      designation: 'CA',
      department: session.user.department || 'Unknown',
      section: session.user.section || null
    }
    setFacultyData(data)
    setLastRefreshed(new Date()) // Set initial refresh time
    fetchStudents(data)
    fetchPolls(data)

    // Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        if (facultyData && !isRefreshing) {
          handleRefresh()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(sessionDelay)
      document.removeEventListener('keydown', handleKeyDown)
    }

    // Set up real-time subscriptions
    const setupRealtimeSubscriptions = () => {
      // Subscribe to poll_responses changes
      const pollResponsesSubscription = supabase
        .channel('faculty_poll_responses_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_responses'
          },
          () => {
            // Refresh data when responses change
            if (selectedPoll) {
              fetchResponses(selectedPoll.id)
            }
          }
        )
        .subscribe()

      // Subscribe to polls changes
      const pollsSubscription = supabase
        .channel('faculty_polls_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'polls'
          },
          () => {
            // Refresh data when polls change
            fetchPolls(data)
          }
        )
        .subscribe()

      // Subscribe to students changes
      const studentsSubscription = supabase
        .channel('faculty_students_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'students'
          },
          () => {
            // Refresh data when students change
            fetchStudents(data)
          }
        )
        .subscribe()

      // Return cleanup function
      return () => {
        pollResponsesSubscription.unsubscribe()
        pollsSubscription.unsubscribe()
        studentsSubscription.unsubscribe()
      }
    }

    const cleanup = setupRealtimeSubscriptions()

    // Set up auto-delete interval for expired polls (check every 2 minutes)
    const autoDeleteInterval = setInterval(autoDeleteExpiredPolls, 2 * 60 * 1000)

    // Cleanup on unmount
    return () => {
      cleanup()
      clearInterval(autoDeleteInterval)
    }
  }, [router, selectedPoll])

  const fetchStudents = async (faculty: any) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('department', faculty.department)
        .eq('section', faculty.section)

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      if (error instanceof Error && error.message.includes('fetch')) {
        toast.error('Network error: Please check your internet connection')
      } else {
        toast.error('Failed to fetch students')
      }
    }
  }

  const fetchPolls = async (faculty: any) => {
    try {
      // If faculty ID is null, fetch it from database first
      if (faculty.id === null) {
        console.log('Fetching correct staff ID from database using email:', faculty.email)
        const { data: staffData, error: staffError } = await supabase
          .from('staffs')
          .select('id')
          .eq('email', faculty.email)
          .single()
        
        if (staffError) throw staffError
        if (staffData) {
          faculty.id = staffData.id
          setFacultyData((prev: any) => ({ ...prev, id: staffData.id }))
          console.log('Updated faculty ID to:', staffData.id)
        }
      }
      
      // First, cleanup expired polls
      try {
        await fetch('/api/cleanup-polls', { method: 'POST' })
      } catch (cleanupError) {
        console.log('Cleanup polls failed (non-critical):', cleanupError)
      }
      
      // Get class ID for faculty's department and section
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('department', faculty.department)
        .eq('section', faculty.section)
        .single()

      if (classError) throw classError

      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select(`*, staffs(name, id)`) // join creator
        .eq('class_id', classData.id)
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError
      // Faculty can see multi-section polls that include their class; also their own polls
      // Filter out scheduled polls that haven't reached their scheduled time yet
      const now = new Date()
      const visiblePolls = (pollsData || []).filter((p: any) => {
        // If poll has scheduled_at_time, only show if that time has passed
        if (p.scheduled_at_time) {
          const scheduledTime = new Date(p.scheduled_at_time)
          if (scheduledTime > now) {
            // Don't show scheduled polls that haven't reached their time yet
            return false
          }
        }
        // If poll created by HOD, allow only if class matches (already ensured by class_id)
        return true
      })

      const mappedPolls = visiblePolls.map((p: any) => ({
        ...p,
        staff_id: p.staff_id,
        staff_name: p.staffs?.name || 'Unknown'
      }))
      
      
      setPolls(mappedPolls)
    } catch (error) {
      console.error('Error fetching polls:', error)
      if (error instanceof Error && error.message.includes('fetch')) {
        toast.error('Network error: Please check your internet connection')
      } else {
        toast.error('Failed to fetch polls')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchResponses = async (pollId: number) => {
    try {
      // First get the poll details to know which class and gender it targets
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('class_id, target_gender')
        .eq('id', pollId)
        .maybeSingle()
      
      if (pollError) throw pollError
      if (!pollData) {
        console.warn('fetchResponses: poll not found for id', pollId)
        toast.error('Poll not found')
        return
      }

      // Get the class details
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('department, section')
        .eq('id', pollData.class_id)
        .maybeSingle()

      if (classError) throw classError
      if (!classData) {
        console.warn('fetchResponses: class not found for class_id', pollData.class_id)
        toast.error('Class not found for this poll')
        return
      }

      // Build query for students based on gender targeting
      let studentsQuery = supabase
        .from('students')
        .select('reg_no, name, email, department, section, gender')
        .eq('department', classData.department)
        .eq('section', classData.section)

      // Apply gender filter if specified
      if (pollData.target_gender && pollData.target_gender !== 'all') {
        const genderValues = pollData.target_gender === 'boys' ? ['M', 'Male', 'm', 'male'] : ['F', 'Female', 'f', 'female']
        studentsQuery = studentsQuery.in('gender', genderValues)
      }

      const { data: classStudents, error: studentsError } = await studentsQuery

      if (studentsError) throw studentsError

      // Get responses for this poll
      const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId)

      if (responsesError) throw responsesError

      // Match responses with student names
      const formattedResponses = responsesData.map((response: any) => {
        const student = classStudents.find((s: any) => s.reg_no === response.student_reg_no)
        return {
          ...response,
          student_name: student?.name || 'Unknown'
        }
      })

      setResponses(formattedResponses)
      
      // Update students state to only show students from this class
      setStudents(classStudents || [])
    } catch (error) {
      console.error('Error fetching responses:', error)
      if (error instanceof Error && error.message.includes('fetch')) {
        toast.error('Network error: Please check your internet connection')
      } else {
        toast.error('Failed to fetch responses')
      }
    }
  }

  const handleLogout = () => {
    signOut({ callbackUrl: '/' })
    toast.success('Logged out successfully')
  }

  const exportStudentData = () => {
    const data = students.map(student => ({
      'Registration Number': student.reg_no,
      'Name': student.name,
      'Mobile Number': student.mobile_number || 'N/A',
      'H/D': student.h_d || 'N/A',
      'Gender': student.gender || 'N/A',
      'Email': student.email,
      'Department': student.department,
      'Section': student.section,
      'Year': student.year || 'N/A'
    }))
    
    exportToExcel(data, `students_${facultyData.department}`)
    toast.success('Student data exported successfully!')
  }

  const exportPollResponses = (poll: Poll) => {
    if (responses.length === 0) {
      toast.error('No responses to export')
      return
    }

    // Get students who haven't responded
    const respondedRegNos = responses.map(r => r.student_reg_no)
    const nonResponders = students.filter(student => !respondedRegNos.includes(student.reg_no))
    
    // Export responded students - need to get full student data
    const respondedData = responses.map(response => {
      // Find the student data from the students array
      const student = students.find(s => s.reg_no === response.student_reg_no)
      return {
        'Registration Number': response.student_reg_no,
        'Student Name': response.student_name,
        'Mobile Number': student?.mobile_number || 'N/A',
        'H/D': student?.h_d || 'N/A',
        'Gender': student?.gender || 'N/A',
        'Email': student?.email || 'N/A',
        'Department': student?.department || 'N/A',
        'Section': student?.section || 'N/A',
        'Year': student?.year || 'N/A',
        'Response': response.response || 'N/A',
        'Responded At': response.responded_at ? formatRespondedAt(response.responded_at) : 'N/A',
        'Status': 'Responded'
      }
    })

    // Export non-responded students
    const nonRespondersData = nonResponders.map(student => ({
      'Registration Number': student.reg_no,
      'Name': student.name,
      'Mobile Number': student.mobile_number || 'N/A',
      'H/D': student.h_d || 'N/A',
      'Gender': student.gender || 'N/A',
      'Email': student.email,
      'Department': student.department,
      'Section': student.section,
      'Year': student.year || 'N/A',
      'Status': 'Not Responded'
    }))

    // Use the utility function for multiple sheets
    exportToExcelWithMultipleSheets([
      { name: 'Responded', data: respondedData },
      { name: 'Not Responded', data: nonRespondersData }
    ], poll.title)
    
    toast.success('Poll data exported successfully with separate sheets for responded and non-responded students!')
  }

  const handleRefresh = async () => {
    if (!facultyData) return
    
    setIsRefreshing(true)
    try {
      // Auto-delete expired polls first
      await autoDeleteExpiredPolls()
      
      // Refresh all data
      await Promise.all([
        fetchStudents(facultyData),
        fetchPolls(facultyData),
        selectedPoll && fetchResponses(selectedPoll.id)
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

  const handleDeletePoll = async (pollId: number) => {
    if (!window.confirm('Are you sure you want to delete this poll?')) {
      return
    }

    setDeletingPolls(prev => new Set(prev).add(pollId))
    try {
      // Faculty delete: remove only their own class/section entry
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)
        .eq('staff_id', facultyData.id)

      if (error) throw error

      setPolls(polls.filter(poll => poll.id !== pollId))
      toast.success('Poll deleted successfully!')
    } catch (error) {
      console.error('Error deleting poll:', error)
      toast.error('Failed to delete poll')
    } finally {
      setDeletingPolls(prev => {
        const newSet = new Set(prev)
        newSet.delete(pollId)
        return newSet
      })
    }
  }

  // Auto-delete expired polls
  const autoDeleteExpiredPolls = async () => {
    try {
      const now = new Date()
      // Only auto-delete when auto_delete_at has passed, not at deadline
      const expiredPolls = polls.filter(poll => {
        if (!poll.auto_delete_at) return false
        const deleteAt = new Date(poll.auto_delete_at)
        return deleteAt < now
      })

      if (expiredPolls.length > 0) {
        const expiredPollIds = expiredPolls.map(poll => poll.id)
        
        // Also delete related poll responses
        const { error: responsesError } = await supabase
          .from('poll_responses')
          .delete()
          .in('poll_id', expiredPollIds)

        if (responsesError) {
          console.error('Error deleting poll responses:', responsesError)
        }

        // Delete the polls
        const { error } = await supabase
          .from('polls')
          .delete()
          .in('id', expiredPollIds)

        if (error) {
          console.error('Error auto-deleting expired polls:', error)
          toast.error('Failed to auto-delete expired polls')
        } else {
          // Update local state
          setPolls(polls.filter(poll => !expiredPollIds.includes(poll.id)))
          console.log(`Auto-deleted ${expiredPolls.length} expired polls`)
          toast.success(`Auto-deleted ${expiredPolls.length} expired poll(s)`)
        }
      }
    } catch (error) {
      console.error('Error in auto-delete function:', error)
      toast.error('Error in auto-delete function')
    }
  }


  const getTodayDDMM = () => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}`
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
              <Users className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Faculty Dashboard</h2>
            <p className="text-slate-300">Loading your workspace...</p>
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

  if (!facultyData) {
    return null
  }

  return (
    <div className="dashboard-bg">
      {/* Enhanced Header */}
      <header className="bg-gradient-to-r from-slate-800/95 via-slate-700/95 to-slate-800/95 backdrop-blur-lg border-b border-slate-600/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                <UserCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  Faculty Dashboard
                </h1>
                <p className="text-slate-300 mt-1 flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span>Welcome back, <span className="font-semibold text-blue-300">{facultyData.name}</span></span>
                </p>
                {facultyData.department && facultyData.section && (
                  <p className="text-slate-400 text-sm mt-1">
                    Handling: <span className="font-medium text-cyan-300">{facultyData.department} - Section {facultyData.section}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2 text-slate-400 text-xs sm:text-sm bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg">
                {lastRefreshed && (
                  <span title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}>
                    <span className="hidden sm:inline">Last: </span>{lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg hover:shadow-red-500/25 transform hover:scale-105 text-sm sm:text-base"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Enhanced Tab Navigation - Mobile Responsive */}
        <div className="grid grid-cols-2 sm:flex sm:space-x-2 mb-4 sm:mb-8 bg-gradient-to-r from-slate-800/80 to-slate-700/80 p-1 sm:p-2 rounded-xl sm:rounded-2xl shadow-2xl border border-slate-600/30 gap-1 sm:gap-0">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3, color: 'from-blue-500 to-cyan-500' },
            { id: 'students', label: 'Students', icon: UserCheck, color: 'from-emerald-500 to-teal-500' },
            { id: 'polls', label: 'Polls', icon: BarChart3, color: 'from-purple-500 to-pink-500' },
            { id: 'responses', label: 'Responses', icon: Eye, color: 'from-orange-500 to-red-500' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-3 py-2 sm:py-4 px-2 sm:px-6 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 text-xs sm:text-base ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-${tab.color.split('-')[1]}-500/25`
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-lg sm:rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* First Row - 2 Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <motion.div 
                  className="card text-center group relative overflow-hidden flex items-center justify-center" 
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                      <UserCheck className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-2">{students.length}</h3>
                    <p className="text-slate-300 text-lg font-medium">Total Students</p>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="card text-center group relative overflow-hidden flex items-center justify-center" 
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300">
                      <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">{polls.length}</h3>
                    <p className="text-slate-300 text-lg font-medium">Active Polls</p>
                  </div>
                </motion.div>
              </div>

              {/* Second Row - Quick Actions */}
              <div className="card relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-700/50"></div>
                <div className="relative z-10">
                    <div className="mb-6">
                      <h2 className="text-lg font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent text-center">Quick Actions</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <motion.button
                      onClick={() => setShowCreatePoll(true)}
                        className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-green-500/20"
                        whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        <Plus className="w-4 h-4" />
                        <span className="font-medium text-base">Create New Poll</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                        className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-blue-500/20"
                      title="Refresh all data"
                        whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {isRefreshing ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                          <RefreshCw className="w-4 h-4" />
                      )}
                        <span className="font-medium text-base">{isRefreshing ? 'Refreshing...' : 'Refresh All Data'}</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={exportStudentData}
                      className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-purple-500/20"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Download className="w-4 h-4" />
                      <span className="font-medium text-base">Export Student List</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <UserCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">My Students</h2>
                    <p className="text-slate-400 mt-1">Manage your class students</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
                    title="Refresh students data"
                  >
                    {isRefreshing ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                    <span className="font-medium">Refresh</span>
                  </button>
                  <button
                    onClick={exportStudentData}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                  >
                    <Download className="w-5 h-5" />
                    <span className="font-medium">Export</span>
                  </button>
                  <button
                    onClick={() => setShowLeetCodeDialog(true)}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-orange-500/25 transform hover:scale-105"
                  >
                    <Code className="w-5 h-5" />
                    <span className="font-medium">Fetch All LeetCode Data</span>
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="overflow-x-auto">
                  <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                    <table className="min-w-full">
                      <thead className="bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-fuchsia-600/90">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Registration No
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                            LeetCode ID
                          </th>

                        </tr>
                      </thead>
                      <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                        {students.map((student, index) => (
                          <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-violet-500/10 hover:to-fuchsia-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-violet-300 font-medium">
                              {student.reg_no}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold">
                              {student.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                              {student.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-300 font-medium">
                              {student.department}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-300 font-medium">
                              {student.leetcode_contest_id || 'N/A'}
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Polls Tab */}
          {activeTab === 'polls' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">My Polls</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="btn-accent flex items-center space-x-2"
                    title="Refresh polls data"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create Poll</span>
                  </button>
                </div>
              </div>

              {polls.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No polls created yet</h3>
                  <p className="text-slate-300">Create your first poll to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {polls.map((poll) => (
                    <div key={poll.id} className="card p-4 hover:bg-slate-700/50 transition-colors cursor-pointer relative" 
                         onClick={() => {
                           setSelectedPoll(poll)
                           fetchResponses(poll.id)
                           setActiveTab('responses')
                         }}>
                        {/* Action Icons - Top Right 2x2 Grid */}
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 grid grid-cols-2 gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPoll(poll)
                            fetchResponses(poll.id)
                            setActiveTab('responses')
                          }}
                          className="p-1.5 sm:p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                          title="View Responses"
                        >
                          <Eye className="w-4 h-4 text-slate-300 hover:text-white" />
                        </button>
                        {(poll.staff_id === facultyData.id || Number(poll.staff_id) === Number(facultyData.id)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('Edit button clicked for poll:', poll.id, 'by staff:', poll.staff_id, 'faculty:', facultyData.id)
                              setEditingPoll(poll)
                              setShowEditPoll(true)
                            }}
                            className="p-1.5 sm:p-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-lg transition-colors"
                            title="Edit Poll"
                          >
                            <Edit className="w-4 h-4 text-blue-400 hover:text-blue-300" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            exportPollResponses(poll)
                          }}
                          className="p-1.5 sm:p-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-lg transition-colors"
                          title="Export Data"
                        >
                          <Download className="w-4 h-4 text-green-400 hover:text-green-300" />
                        </button>
                        {(poll.staff_id === facultyData.id || Number(poll.staff_id) === Number(facultyData.id)) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('Delete button clicked for poll:', poll.id, 'by staff:', poll.staff_id, 'faculty:', facultyData.id)
                              handleDeletePoll(poll.id)
                            }}
                            disabled={deletingPolls.has(poll.id)}
                            className="p-1.5 sm:p-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Poll"
                          >
                            {deletingPolls.has(poll.id) ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full"
                              />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                            )}
                          </button>
                        )}

                      </div>

                        <div className="space-y-3 sm:space-y-4 pr-16 sm:pr-24">
                        {/* Poll Title */}
                        <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">
                          {poll.title}
                        </h3>

                        {/* Poll Info */}
                        <div className="text-sm text-slate-300 space-y-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-400 font-semibold text-base">Created by:</span>
                            <span className="text-slate-200 font-medium">{poll.staff_name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-400 font-semibold text-base">Created:</span>
                            <span className="text-slate-200 font-medium">{formatCreatedAt(poll.created_at)}</span>
                          </div>
                          
                          {/* Category + Target row */}
                          <div className="grid grid-cols-2 gap-2">
                            {poll.poll_category && (
                              <div className="flex items-center space-x-2 w-full">
                                <span className={`inline-block w-3 h-3 rounded-full ${
                                  poll.poll_category === 'Attendance' ? 'bg-emerald-500' :
                                  (poll.poll_category as any) === 'CodeChef Attendance' ? 'bg-amber-500' :
                                  poll.poll_category === 'Problems Solved' ? 'bg-purple-500' :
                                  poll.poll_category === 'General Poll' ? 'bg-blue-500' :
                                  poll.poll_category === 'Hackathon' ? 'bg-green-500' :
                                  poll.poll_category === 'G-Form Poll' ? 'bg-orange-500' :
                                  'bg-slate-500'
                                }`}></span>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 truncate w-full ${
                                  poll.poll_category === 'Attendance' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                  (poll.poll_category as any) === 'CodeChef Attendance' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                  poll.poll_category === 'Problems Solved' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                                  poll.poll_category === 'General Poll' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                                  poll.poll_category === 'Hackathon' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
                                  poll.poll_category === 'G-Form Poll' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                                  'bg-slate-500/20 text-slate-300 border-slate-500/40'
                                }`}>
                                  {poll.poll_category}
                                </span>
                              </div>
                            )}
                            {typeof poll.target_gender !== 'undefined' && poll.target_gender !== null && (
                              (() => {
                                const label = poll.target_gender === 'all' ? 'All Students' : (poll.target_gender === 'boys' ? 'Boys Only' : 'Girls Only')
                                const dot = poll.target_gender === 'all' ? 'bg-slate-400' : (poll.target_gender === 'boys' ? 'bg-blue-400' : 'bg-pink-400')
                                const pill = poll.target_gender === 'all'
                                  ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                                  : (poll.target_gender === 'boys'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : 'bg-pink-500/20 text-pink-300 border-pink-500/40')
                                return (
                                  <div className="flex items-center space-x-2 w-full">
                                    <span className={`w-2 h-2 rounded-full inline-block ${dot}`} />
                                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border truncate w-full ${pill}`}>Target: {label}</span>
                                  </div>
                                )
                              })()
                            )}
                          </div>

                          {/* Deadline Information (still visible for staff after expiry) */}
                          {poll.deadline_at && (
                            <div className="flex items-center space-x-2">
                              <span className="text-orange-400 text-sm">⏰</span>
                              <span className="text-orange-400 text-sm font-medium">Deadline:</span>
                              <span className="text-orange-300 text-sm font-semibold">{formatDeadline(poll.deadline_at)}</span>
                            </div>
                          )}
                          
                          {/* Scheduled Information */}
                          {poll.scheduled_at_time && (
                            <div className="flex items-center space-x-2">
                              <span className="text-purple-400 text-sm">📅</span>
                              <span className="text-purple-400 text-sm font-medium">Scheduled:</span>
                              <span className="text-purple-300 text-sm font-semibold">{formatDeadline(poll.scheduled_at_time)}</span>
                            </div>
                          )}
                          {/* Target pill handled in Category + Target row above */}
                          
                          {/* Auto-Delete Countdown */}
                          {poll.auto_delete_at && (
                            <div className="text-center">
                              <div className="text-sm font-bold text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1">
                                {getAutoDeleteHours(poll.auto_delete_at, poll.auto_delete_days)}
                              </div>
                            </div>
                          )}
                          
                          {poll.link_url && (
                            <div className="text-xs text-blue-400 truncate">
                              Link: {poll.link_url}
                            </div>
                          )}
                        </div>

                        {/* Options */}
                        {poll.poll_type === 'options' && poll.options && poll.options.length > 0 && (
                          <div>
                            <div className="text-sm text-slate-400 mb-2 font-medium">Options:</div>
                            <div className="grid grid-cols-2 gap-1">
                              {poll.options.slice(0, 4).map((option, idx) => (
                                <div key={idx} className="text-xs px-2 py-1 bg-slate-600 rounded text-center text-slate-200 truncate">
                                  {option}
                                </div>
                              ))}
                              {poll.options.length > 4 && (
                                <div className="text-xs px-2 py-1 bg-slate-500 rounded text-center text-slate-200">
                                  +{poll.options.length - 4}
                                 </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bottom-right tags: Expired + Edited + Scheduled */}
                        <div className="flex justify-end mt-2 space-x-2">
                          {(() => { 
                            try { 
                              const now = new Date()
                              // Check if poll is scheduled for future publication
                              if (poll.scheduled_at_time) {
                                const scheduledTime = new Date(poll.scheduled_at_time)
                                return scheduledTime > now
                              }
                              return false
                            } catch { 
                              return false 
                            } 
                          })() && (
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/40 flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Scheduled</span>
                            </span>
                          )}
                          {(() => { try { const now = new Date(); return poll.deadline_at ? (new Date(poll.deadline_at as any) < now) : false } catch { return false } })() && (
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full border border-red-500/40">Expired</span>
                          )}
                          {poll.last_modified_at && poll.last_modified_at !== poll.created_at && (
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full border border-orange-500/40">edited</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Responses Tab */}
          {activeTab === 'responses' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Poll Responses</h2>
                  {selectedPoll && (
                    <div className="mt-1">
                      <p className="text-slate-300">
                        Poll: {selectedPoll.title}
                      </p>
                    </div>
                  )}
                </div>
                {selectedPoll && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="btn-accent flex items-center space-x-2"
                      title="Refresh responses data"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={() => exportPollResponses(selectedPoll)}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Download className="w-5 h-5" />
                      <span>Export Data</span>
                    </button>
                    <div className="flex items-center space-x-2">
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm">
                        Responded: {responses.length}
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm">
                        Not Responded: {students.length - responses.length}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!selectedPoll ? (
                <div className="text-center py-12">
                  <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a poll to view responses</h3>
                  <p className="text-gray-600">Go to the Polls tab and click "View Responses" on a poll.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="card">
                    {/* Compact Header with Counts */}
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Response Summary</h3>
                      <div className="flex items-center space-x-6 text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                          <span className="text-slate-300">Responded: <span className="text-green-400 font-semibold">{responses.length}</span></span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                          <span className="text-slate-300">Not Responded: <span className="text-red-400 font-semibold">{students.length - responses.length}</span></span>
                        </div>
                        <div className="text-slate-300">
                          Total: <span className="text-white font-semibold">{students.length}</span>
                        </div>
                        <div className="text-slate-300">
                          Rate: <span className="text-blue-400 font-semibold">{students.length > 0 ? Math.round((responses.length / students.length) * 100) : 0}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Compact Option Counts in Single Row */}
                    {selectedPoll.options && selectedPoll.options.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center space-x-4">
                          {(() => {
                            const optionCounts = selectedPoll.options?.map((option, index) => {
                              const normalized = option.toLowerCase()
                              const count = responses.filter(r => {
                                const text = (r.response || '').toLowerCase()
                                // exact match or prefix match like "Absent - reason"
                                return text === normalized || text.startsWith(`${normalized} -`)
                              }).length
                              return { option, index, count }
                            }) || []
                            
                            return optionCounts.map(({ option, index, count }) => (
                              <div key={index} className="flex items-center space-x-2 px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                    {index + 1}
                                  </div>
                                <span className="text-slate-200 text-sm">{option}</span>
                                <span className="text-blue-400 font-semibold text-sm">{count}</span>
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Side by Side Tables Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
                      {/* Left Side: Responded Students */}
                      <div className="min-w-0">
                        <h4 className="text-md font-medium text-white mb-3 flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                          Responded ({responses.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-indigo-600/90">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Student
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Response
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                    Time
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                {responses.map((response, index) => (
                                  <tr key={response.id} className={`hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                    <td className="px-4 py-3 text-sm text-white font-medium">
                                      {response.student_name}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-200">
                                      {response.response || 'No response'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-emerald-300">
                                      {formatRespondedAt(response.responded_at)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Non-Responders */}
                      <div className="min-w-0">
                        <h4 className="text-md font-medium text-white mb-3 flex items-center">
                          <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                          Not Responded ({students.length - responses.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-rose-600/90 via-pink-600/90 to-red-600/90">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/4">
                                    Student
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/4">
                                    Registration No
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider w-2/4">
                                    Email
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                {students
                                  .filter(student => !responses.some(r => r.student_reg_no === student.reg_no))
                                  .map((student, index) => (
                                    <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-rose-500/10 hover:to-pink-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                      <td className="px-4 py-3 text-sm text-white font-medium">
                                        {student.name}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-blue-300 font-mono">
                                        {student.reg_no}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-300 break-all">
                                        {student.email}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Create Poll Modal */}
      {showCreatePoll && (
        <CreatePollModal
          facultyData={facultyData}
          onClose={() => setShowCreatePoll(false)}
          onPollCreated={() => {
            setShowCreatePoll(false)
            handleRefresh() // Use the refresh function instead of just fetchPolls
            toast.success('Poll created successfully!')
          }}
        />
      )}

      {/* Edit Poll Modal */}
      {showEditPoll && editingPoll && (
        editingPoll.staff_id !== facultyData.id ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center mobile-p z-50">
            <div className="bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-lg border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Editing Restricted</h2>
              <p className="text-slate-300 mb-6">This poll was created by HOD and cannot be edited by faculty.</p>
              <div className="flex justify-end">
                <button onClick={() => { setShowEditPoll(false); setEditingPoll(null) }} className="btn-secondary">Close</button>
              </div>
            </div>
          </div>
        ) : (
          <EditPollModal
            poll={editingPoll}
            facultyData={facultyData}
            onClose={() => {
              setShowEditPoll(false)
              setEditingPoll(null)
            }}
            onPollUpdated={() => {
              setShowEditPoll(false)
              setEditingPoll(null)
              handleRefresh()
              toast.success('Poll updated successfully!')
            }}
          />
        )
      )}

      {/* LeetCode Fetch Dialog */}
      {showLeetCodeDialog && (
        <LeetCodeFetchDialog
          open={showLeetCodeDialog}
          onClose={() => setShowLeetCodeDialog(false)}
          students={students}
          department={facultyData.department}
          section={facultyData.section}
        />
      )}
    </div>
  )
}

// Create Poll Modal Component
function CreatePollModal({ 
  facultyData, 
  onClose, 
  onPollCreated 
}: { 
  facultyData: any
  onClose: () => void
  onPollCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [pollCategory, setPollCategory] = useState<'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'CodeChef Attendance' | 'Problems Solved'>('General Poll')
  const [contestType, setContestType] = useState<'weekly' | 'biweekly' | null>(null)
  const [targetGender, setTargetGender] = useState<'all' | 'boys' | 'girls'>('all')
  const [options, setOptions] = useState(['Present', 'Absent'])
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [gFormLink, setGFormLink] = useState('')
  const [absentReason, setAbsentReason] = useState('State reason for absenteeism')
  const [section, setSection] = useState('O')
  const [availableSections, setAvailableSections] = useState<string[]>([])
  const [isLoadingSections, setIsLoadingSections] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showTemplateSelection, setShowTemplateSelection] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})


  // Reset options when poll category changes in details step
  useEffect(() => {
    if (currentStep === 2) {
      if (pollCategory === 'General Poll') {
        setOptions(['Yes', 'No'])
      } else if (pollCategory === 'Attendance') {
        setOptions(['Present', 'Absent'])
      } else if (pollCategory === 'CodeChef Attendance') {
        setOptions(['Present', 'Absent'])
      } else if (pollCategory === 'Problems Solved') {
        setOptions(['0', '1', '2', '3', '4', 'Absent'])
      } else if (pollCategory === 'Hackathon') {
        setOptions(['Participated', 'Not Participated'])
      } else if (pollCategory === 'G-Form Poll') {
        setOptions(['Submitted', 'Not Submitted'])
      }
    }
  }, [pollCategory, currentStep])

  // Load sections dynamically for faculty's department
  useEffect(() => {
    const fetchSections = async () => {
      if (!facultyData?.department) return
      setIsLoadingSections(true)
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('section')
          .eq('department', facultyData.department)
          .order('section', { ascending: true })

        if (error) throw error
        // Restrict to faculty's own section only
        const sections: string[] = Array.from(new Set<string>((data || []).map((c: any) => String(c.section)).filter(Boolean)))
        const own = sections.includes(facultyData.section) ? [facultyData.section] : (sections.length ? [sections[0]] : [])
        setAvailableSections(own)
        if (own.length) setSection(own[0])
      } catch (err) {
        console.error('Error fetching sections for faculty:', err)
        setAvailableSections([])
      } finally {
        setIsLoadingSections(false)
      }
    }
    fetchSections()
  }, [facultyData?.department, facultyData?.section])

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // Reset options when category changes
  const handleCategoryChange = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved') => {
    setPollCategory(category)
    setCurrentStep(2)
    setFormErrors({})
    // Reset title and options when changing category
    if (category === 'General Poll') {
      setOptions(['Yes', 'No']) // Reset to default options for General Poll
    } else if (category === 'Attendance') {
      setOptions(['Present', 'Absent']) // Default options for Attendance
    } else if (category === 'Problems Solved') {
      setOptions(['0', '1', '2', '3', '4', 'Absent']) // Default options for Problems Solved
    } else if (category === 'Hackathon') {
      setOptions(['Participated', 'Not Participated']) // Default options for Hackathon
    } else if (category === 'G-Form Poll') {
      setOptions(['Submitted', 'Not Submitted']) // Default options for G-Form Poll
    } else {
      setOptions(['Yes', 'No']) // Reset to default options for other categories
    }
  }

  const validateForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!title.trim()) {
      errors.title = 'Poll title is required'
    }
    
    const validOptions = options.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      errors.options = 'At least 2 options are required'
    }
    
    if (pollCategory === 'G-Form Poll' && !gFormLink.trim()) {
      errors.gFormLink = 'G-Form link is required'
    }
    
    if (pollCategory === 'Hackathon' && !gFormLink.trim()) {
      errors.gFormLink = 'Hackathon link is required'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting')
      return
    }

    setIsSubmitting(true)
    setIsCreating(true)
    try {
      // Ensure we have a valid faculty ID
      let validFacultyId = facultyData.id
      if (!validFacultyId || validFacultyId > 2147483647) {
        console.log('Invalid faculty ID, fetching from database:', validFacultyId)
        const { data: staffData, error: staffError } = await supabase
          .from('staffs')
          .select('id')
          .eq('email', facultyData.email)
          .single()
        
        if (staffError) throw new Error(`Failed to fetch staff ID: ${staffError.message}`)
        if (!staffData) throw new Error('Staff not found in database')
        
        validFacultyId = staffData.id
        console.log('Updated faculty ID to:', validFacultyId)
      }
      
      console.log('Creating poll with faculty data:', { 
        id: validFacultyId, 
        name: facultyData.name, 
        email: facultyData.email,
        department: facultyData.department,
        section: facultyData.section
      })
      console.log('Form data:', {
        title,
        pollCategory,
        contestType,
        targetGender,
        options,
        section
      })
      // Get class ID for faculty's department and chosen section
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('department', facultyData.department)
        .eq('section', section)
        .single()

      if (classError) throw classError

      // Calculate auto-delete time based on poll category
      const now = new Date()
      let autoDeleteDays = 2
      
      if ((pollCategory === 'Attendance') || (pollCategory === 'CodeChef Attendance') || (pollCategory === 'Problems Solved')) {
        autoDeleteDays = 1
      }
      
      // Calculate auto-delete timestamp
      const autoDeleteTime = new Date(now.getTime() + autoDeleteDays * 24 * 60 * 60 * 1000).toISOString()

      // Create deadline timestamp - if only date provided, set to 11:59pm of that date
      let deadlineAt = null
      if (deadlineDate && deadlineTime) {
        deadlineAt = new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
      } else if (deadlineDate) {
        deadlineAt = new Date(`${deadlineDate}T23:59:59`).toISOString()
      }
      // Keep deadline empty unless explicitly chosen

      // Create scheduled timestamp - if only date provided, set to start of day
      let scheduledAt = null
      if (scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      } else if (scheduledDate) {
        scheduledAt = new Date(`${scheduledDate}T00:00:00`).toISOString()
      }
      // Keep scheduled empty unless explicitly chosen

      const pollData = {
        title: (() => {
          const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
          if (pollCategory === 'Attendance' && contestType) {
            return `LeetCode Attendance ${contestType.charAt(0).toUpperCase() + contestType.slice(1)} ${dateStr}`
          } else if (pollCategory === 'CodeChef Attendance') {
            return `CodeChef Attendance ${dateStr}`
          } else if (pollCategory === 'Problems Solved') {
            return `Problems Solved ${dateStr}`
          } else if (pollCategory === 'Hackathon' || pollCategory === 'G-Form Poll' || pollCategory === 'General Poll') {
            return title.trim() // Use user-entered title for these categories
          } else {
            return title.trim()
          }
        })(),
        staff_id: validFacultyId,
        class_id: classData.id,
        poll_type: 'options',
        // Map CodeChef Attendance to Attendance to satisfy DB check constraint
        poll_category: (pollCategory === 'CodeChef Attendance') ? 'Attendance' : pollCategory,
        options: options.filter(opt => opt.trim() !== ''),
        deadline_at: deadlineAt,
        // For Hackathon/G-Form, take the link from gFormLink field
        link_url: (pollCategory === 'Hackathon' || pollCategory === 'G-Form Poll') ? (gFormLink.trim() || null) : (linkUrl.trim() || null),
        contest_type: contestType,
        auto_delete_days: autoDeleteDays,
        auto_delete_at: autoDeleteTime,
        target_gender: targetGender,
        is_editable: true,
        scheduled_at_time: scheduledAt
      }

      console.log('Final poll data being sent to database:', pollData)
      console.log('Class data found:', classData)

      const { data: insertResult, error } = await supabase
        .from('polls')
        .insert(pollData)
        .select()

      console.log('Database insert result:', { insertResult, error })

      if (error) throw error

      toast.success('Poll created successfully and is now visible to students!', {
        icon: '✅'
      })

      setTitle('')
      setOptions(['Present', 'Absent'])
      setPollCategory('General Poll')
      setContestType(null)
      setTargetGender('all')
      setDeadlineDate('')
      setDeadlineTime('')
      setScheduledDate('')
      setScheduledTime('')
      setLinkUrl('')
      setCurrentStep(1)
      setFormErrors({})
      onPollCreated()
    } catch (error) {
      console.error('Error creating poll:', error)
      toast.error('Failed to create poll')
    } finally {
      setIsSubmitting(false)
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-slate-700/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create New Poll</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Loading Overlay */}
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded-3xl flex items-center justify-center z-10"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white text-lg font-medium">Creating Poll...</p>
              <p className="text-slate-300 text-sm mt-2">
                Please wait while we set up your poll
              </p>
            </div>
          </motion.div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Template Selection */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    title: 'LeetCode Attendance',
                    category: 'Attendance',
                    icon: '📊',
                    color: 'from-emerald-500 to-emerald-600',
                    description: 'Track student attendance for LeetCode contests',
                    action: () => {
                      const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      setTitle(`LeetCode Attendance Weekly ${now}`)
                      setPollCategory('Attendance')
                      setContestType('weekly')
                      setOptions(['Present', 'Absent'])
                      setCurrentStep(2)
                    }
                  },
                  {
                    title: 'CodeChef Attendance',
                    category: 'CodeChef Attendance',
                    icon: '🏆',
                    color: 'from-amber-500 to-amber-600',
                    description: 'Track student attendance for CodeChef contests',
                    action: () => {
                      const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      setTitle(`CodeChef Attendance ${now}`)
                      setPollCategory('CodeChef Attendance')
                      setContestType(null)
                      setOptions(['Present', 'Absent'])
                      setCurrentStep(2)
                    }
                  },
                  {
                    title: 'Problems Solved',
                    category: 'Problems Solved',
                    icon: '🎯',
                    color: 'from-purple-500 to-purple-600',
                    description: 'Track number of problems solved by students',
                    action: () => {
                      const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      setTitle(`Problems Solved ${now}`)
                      setPollCategory('Problems Solved')
                      setOptions(['0', '1', '2', '3', '4', 'Absent'])
                      setCurrentStep(2)
                    }
                  },
                  {
                    title: 'General Poll',
                    category: 'General Poll',
                    icon: '📝',
                    color: 'from-blue-500 to-blue-600',
                    description: 'Create custom polls with your own questions',
                    action: () => {
                      setTitle('')
                      handleCategoryChange('General Poll')
                    }
                  },
                  {
                    title: 'Hackathon',
                    category: 'Hackathon',
                    icon: '🏆',
                    color: 'from-green-500 to-green-600',
                    description: 'Track hackathon participation and submissions',
                    action: () => {
                      setTitle('')
                      handleCategoryChange('Hackathon')
                      setLinkUrl('')
                    }
                  },
                  {
                    title: 'G-Form Poll',
                    category: 'G-Form Poll',
                    icon: '📋',
                    color: 'from-orange-500 to-orange-600',
                    description: 'Link to Google Forms for detailed surveys',
                    action: () => {
                      setTitle('')
                      handleCategoryChange('G-Form Poll')
                      setLinkUrl('')
                    }
                  }
                ].map((template) => (
                  <motion.button
                    key={template.title}
                    type="button"
                    onClick={template.action}
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-6 rounded-2xl bg-gradient-to-br ${template.color} text-white text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg group`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">{template.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{template.title}</h4>
                        <p className="text-white/80 text-sm">{template.description}</p>
                </div>
              </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
            </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Poll Details */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Poll Template Selection (Interactive) */}
              <div className="flex space-x-2 mb-4">
                {[
                  { title: 'LeetCode Attendance', color: 'bg-emerald-500', value: 'Attendance' },
                  { title: 'CodeChef Attendance', color: 'bg-amber-600', value: 'CodeChef Attendance' },
                  { title: 'Problems Solved', color: 'bg-purple-500', value: 'Problems Solved' },
                  { title: 'General Poll', color: 'bg-blue-500', value: 'General Poll' },
                  { title: 'Hackathon', color: 'bg-green-500', value: 'Hackathon' },
                  { title: 'G-Form Poll', color: 'bg-orange-500', value: 'G-Form Poll' }
                ].map((template) => (
                <button
                    key={template.title}
                  type="button"
                    onClick={() => {
                      setPollCategory(template.value as any)
                      // Update title based on template
                      const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      if (template.value === 'Attendance' && contestType) {
                        setTitle(`LeetCode Attendance ${contestType.charAt(0).toUpperCase() + contestType.slice(1)} ${now}`)
                      } else if (template.value === 'CodeChef Attendance') {
                        setTitle(`CodeChef Attendance ${now}`)
                      } else if (template.value === 'Problems Solved') {
                        setTitle(`Problems Solved ${now}`)
                      } else if (template.value === 'Hackathon' || template.value === 'G-Form Poll' || template.value === 'General Poll') {
                        setTitle('') // Empty for these categories
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      pollCategory === template.value
                        ? `${template.color} text-white shadow-lg` 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {template.title}
                </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Contest Type */}
                  {pollCategory === 'Attendance' && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Contest Type</label>
                      <div className="flex space-x-3">
                        {[
                          { value: 'weekly', label: 'Weekly' },
                          { value: 'biweekly', label: 'Biweekly' }
                    ].map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setContestType(type.value as 'weekly' | 'biweekly')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          contestType === type.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
              </div>
            </div>
          )}

                  {/* Target Gender */}
                  <div>
                                          <label className="block text-sm font-medium text-white mb-2">Target Gender</label>
                    <div className="flex space-x-3">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'boys', label: 'Boys' },
                        { value: 'girls', label: 'Girls' }
                      ].map((gender) => (
                        <button
                          key={gender.value}
                          type="button"
                          onClick={() => setTargetGender(gender.value as 'all' | 'boys' | 'girls')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            targetGender === gender.value
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {gender.label}
                        </button>
                    ))}
            </div>
          </div>

                  {/* Poll Question */}
                  <div>
                                          <label htmlFor="title" className="block text-sm font-medium text-white mb-2">
                Poll Question
              </label>
              <input
                id="title"
                type="text"
                      value={(() => {
                        const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        if (pollCategory === 'Attendance' && contestType) {
                          return `LeetCode Attendance ${contestType.charAt(0).toUpperCase() + contestType.slice(1)} ${now}`
                        } else if (pollCategory === 'CodeChef Attendance') {
                          return `CodeChef Attendance ${now}`
                        } else if (pollCategory === 'Problems Solved') {
                          return `Problems Solved ${now}`
                        } else if (pollCategory === 'Hackathon' || pollCategory === 'G-Form Poll' || pollCategory === 'General Poll') {
                          return title // Keep empty for these categories
                        } else {
                          return title
                        }
                      })()}
                onChange={(e) => setTitle(e.target.value)}
                      placeholder={(() => {
                        if (pollCategory === 'General Poll') {
                          return "Enter your custom poll question..."
                        } else if (pollCategory === 'G-Form Poll') {
                          return "Enter poll question for Google Form..."
                        } else if (pollCategory === 'Hackathon') {
                          return "Enter hackathon participation question..."
                        } else {
                          return "e.g., Are you present for today's contest?"
                        }
                      })()}
                                              className={`w-full px-3 py-2 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400 transition-colors ${
                    formErrors.title ? 'border-red-500' : 'border-slate-600'
                  }`}
                required
                disabled={isSubmitting}
              />
                {formErrors.title && (
                  <p className="mt-2 text-sm text-red-400">{formErrors.title}</p>
                )}
            </div>

                  {/* Link Field for G-Form Poll and Hackathon */}
                  {(pollCategory === 'G-Form Poll' || pollCategory === 'Hackathon') && (
                    <div>
                      <label htmlFor="gFormLink" className="block text-sm font-medium text-white mb-2">
                        {pollCategory === 'G-Form Poll' ? 'G-Form Link' : 'Hackathon Link'}
              </label>
                      <input
                        id="gFormLink"
                        type="url"
                        value={gFormLink}
                        onChange={(e) => setGFormLink(e.target.value)}
                        placeholder={pollCategory === 'G-Form Poll' ? 'https://forms.google.com/...' : 'https://hackathon-event.com'}
                        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400 transition-colors ${
                          formErrors.gFormLink ? 'border-red-500' : 'border-slate-600'
                        }`}
                        disabled={isSubmitting}
                      />
                      {formErrors.gFormLink && (
                        <p className="mt-2 text-sm text-red-400">{formErrors.gFormLink}</p>
                        )}
                      </div>
                  )}


                  {/* Poll Options for all templates */}
              <div>
                    <label className="block text-sm font-medium text-white mb-2">Poll Options</label>
                    <div className="space-y-2">
                  {options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg">
                            {index + 1}
                          </div>
                      <input
                        type="text"
                        value={option}
                            onChange={(e) => {
                              const newOptions = [...options]
                              newOptions[index] = e.target.value
                              setOptions(newOptions)
                            }}
                        placeholder={`Option ${index + 1}`}
                            className={`flex-1 px-3 py-2 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400 transition-colors ${
                              formErrors.options ? 'border-red-500' : 'border-slate-600'
                            }`}
                        required
                        disabled={isSubmitting}
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                              onClick={() => {
                                const newOptions = options.filter((_, i) => i !== index)
                                setOptions(newOptions)
                              }}
                          disabled={isSubmitting}
                              className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 5 && (
                  <button
                    type="button"
                        onClick={() => setOptions([...options, ''])}
                    disabled={isSubmitting}
                        className="mt-3 w-full py-2 px-3 border-2 border-dashed border-blue-400 text-blue-300 hover:border-blue-300 hover:text-white hover:bg-blue-500/10 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium text-sm"
                  >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Option</span>
                  </button>
                )}
                    {formErrors.options && (
                      <p className="mt-3 text-sm text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{formErrors.options}</p>
                    )}
              </div>


                  {/* Note for Attendance templates */}
                  {(pollCategory === 'Attendance' || pollCategory === 'CodeChef Attendance') && (
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
                      <p className="text-yellow-200 text-sm">
                        <strong>Note:</strong> When students select "Absent", they will be prompted to provide a reason for absenteeism.
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Section (dynamic dropdown) */}
                  <div>
                    <label htmlFor="section" className="block text-sm font-medium text-white mb-2">Section</label>
                    <select
                      id="section"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white transition-colors ${
                        formErrors.section ? 'border-red-500' : 'border-slate-600'
                      }`}
                      disabled={isSubmitting || isLoadingSections}
                    >
                      {isLoadingSections ? (
                        <option>Loading...</option>
                      ) : (
                        availableSections.map((sec) => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))
                      )}
                    </select>
                    {formErrors.section && (
                      <p className="mt-2 text-sm text-red-400">{formErrors.section}</p>
                    )}
                  </div>

                  {/* Deadline Date */}
                  <div>
                    <label htmlFor="deadlineDate" className="block text-sm font-medium text-white mb-2">
                      Deadline Date (Optional)
                    </label>
                <input
                      id="deadlineDate"
                  type="date"
                  value={deadlineDate}
                      onChange={(e) => {
                        setDeadlineDate(e.target.value)
                        // Auto-set time to 11:59pm if date is provided but no time is set
                        if (e.target.value && !deadlineTime) {
                          setDeadlineTime('23:59')
                        }
                      }}
                      className={`w-full px-4 py-3 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white transition-colors [color-scheme:dark] ${
                        formErrors.deadlineDate ? 'border-red-500' : 'border-slate-600'
                      }`}
                  disabled={isSubmitting}
                />
                    {formErrors.deadlineDate && (
                      <p className="mt-2 text-sm text-red-400">{formErrors.deadlineDate}</p>
                    )}
              </div>

                  {/* Deadline Time (Optional) */}
              <div>
                    <label htmlFor="deadlineTime" className="block text-sm font-medium text-white mb-2">
                      Deadline Time (Optional)
                    </label>
                <div className="relative">
                  <input
                      id="deadlineTime"
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white transition-colors [color-scheme:dark] pr-10"
                  disabled={isSubmitting}
                />
                  {deadlineTime && (
                    <button
                      type="button"
                      onClick={() => setDeadlineTime('')}
                      disabled={isSubmitting}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

                  {/* Scheduled Date */}
                  <div>
                    <label htmlFor="scheduledDate" className="block text-sm font-medium text-white mb-2">
                      Schedule Publication (Optional)
                    </label>
                <input
                      id="scheduledDate"
                  type="date"
                  value={scheduledDate}
                      onChange={(e) => {
                        setScheduledDate(e.target.value)
                        // Auto-set time to start of day if date is provided but no time is set
                        if (e.target.value && !scheduledTime) {
                          setScheduledTime('00:00')
                        }
                      }}
                      className={`w-full px-4 py-3 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white transition-colors [color-scheme:dark] ${
                        formErrors.scheduledDate ? 'border-red-500' : 'border-slate-600'
                      }`}
                  disabled={isSubmitting}
                />
                    {formErrors.scheduledDate && (
                      <p className="mt-2 text-sm text-red-400">{formErrors.scheduledDate}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">Poll will only be visible to students from this date</p>
              </div>

                  {/* Scheduled Time (Optional) */}
              <div>
                    <label htmlFor="scheduledTime" className="block text-sm font-medium text-white mb-2">
                      Schedule Time (Optional)
                    </label>
                <div className="relative">
                  <input
                      id="scheduledTime"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white transition-colors [color-scheme:dark] pr-10"
                  disabled={isSubmitting}
                />
                  {scheduledTime && (
                    <button
                      type="button"
                      onClick={() => setScheduledTime('')}
                      disabled={isSubmitting}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                      ✕
                    </button>
                  )}
                </div>
                    <p className="mt-1 text-xs text-slate-400">Exact time poll becomes visible</p>
              </div>


                  {/* Text Response Field for Absent Students - Only for Attendance templates */}
                  {(pollCategory === 'Attendance' || pollCategory === 'CodeChef Attendance') && (
                    <div>
                      <label htmlFor="absentReason" className="block text-sm font-medium text-white mb-2">
                        Text Response Field for Absent Students
                      </label>
                      <textarea
                        id="absentReason"
                        value={absentReason}
                        onChange={(e) => setAbsentReason(e.target.value)}
                        placeholder="State reason for absenteeism"
                        rows={3}
                        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400 transition-colors resize-none ${
                          formErrors.absentReason ? 'border-red-500' : 'border-slate-600'
                        }`}
                        disabled={isSubmitting}
                      />
                      <p className="mt-2 text-sm text-slate-400">Required for absent students</p>
                      {formErrors.absentReason && (
                        <p className="mt-2 text-sm text-red-400">{formErrors.absentReason}</p>
                      )}
            </div>
                  )}
                </div>
          </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors font-medium"
                >
                  ← Back to Templates
                </button>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors font-medium"
                  >
                    Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Review & Create →
                </button>
              </div>
              </div>

            </motion.div>
          )}

          {/* Step 3: Review & Create */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
            <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Review & Create</h3>
                  <p className="text-slate-400">Review your poll details before creating</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>
              </div>

              {/* Compact Review Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column */}
              <div className="space-y-4">
                  {/* Poll Info */}
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <h4 className="text-md font-medium text-white mb-3">Poll Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Title:</span>
                        <span className="text-white text-right max-w-[200px] truncate">{title}</span>
                    </div>
                      <div className="flex justify-between items-center">
                      <span className="text-slate-400">Category:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          pollCategory === 'Attendance' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                          pollCategory === 'CodeChef Attendance' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          pollCategory === 'Problems Solved' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                          pollCategory === 'General Poll' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                          pollCategory === 'Hackathon' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
                          pollCategory === 'G-Form Poll' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                          'bg-slate-500/20 text-slate-300 border-slate-500/40'
                        }`}>
                          {pollCategory}
                        </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target:</span>
                      <span className="text-white">{targetGender === 'all' ? 'All Students' : targetGender === 'boys' ? 'Boys Only' : 'Girls Only'}</span>
                    </div>
                    {contestType && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Contest Type:</span>
                        <span className="text-white">{contestType.charAt(0).toUpperCase() + contestType.slice(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                  {/* Poll Options */}
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <h4 className="text-md font-medium text-white mb-3">Options</h4>
                    <div className="flex flex-wrap gap-2">
                      {options.filter(opt => opt.trim() !== '').map((option, index) => (
                        <div key={index} className="flex items-center space-x-2 bg-slate-600/50 rounded-lg px-3 py-1">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white">
                            {index + 1}
                          </div>
                          <span className="text-slate-200 text-sm">{option}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Link for G-Form Poll and Hackathon */}
                  {(pollCategory === 'G-Form Poll' || pollCategory === 'Hackathon') && (
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <h4 className="text-md font-medium text-white mb-3">
                        {pollCategory === 'G-Form Poll' ? 'G-Form Link' : 'Hackathon Link'}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                        <span className="text-slate-200 text-sm truncate">{gFormLink || 'No link provided'}</span>
                </div>
                </div>
                  )}

                  {/* Deadline */}
                {deadlineDate && (
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <h4 className="text-md font-medium text-white mb-3">Deadline</h4>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                        <span className="text-slate-200 text-sm">
                        {new Date(deadlineDate).toLocaleDateString()}
                        {deadlineTime && ` at ${deadlineTime}`}
                      </span>
              </div>
            </div>
          )}

                  {/* Scheduled Publication */}
                {scheduledDate && (
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <h4 className="text-md font-medium text-white mb-3">Scheduled Publication</h4>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                        <span className="text-slate-200 text-sm">
                        Poll visible from {new Date(scheduledDate).toLocaleDateString()}
                        {scheduledTime && ` at ${scheduledTime}`}
                      </span>
              </div>
                      <p className="text-xs text-slate-400 mt-1">Students will see this poll only after this time</p>
            </div>
          )}

                  {/* Auto-Delete Information */}
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <h4 className="text-md font-medium text-white mb-3">Auto-Delete</h4>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="text-slate-200 text-sm">
                        {(() => {
                          const autoDeleteDays = (pollCategory === 'Attendance' || pollCategory === 'CodeChef Attendance' || pollCategory === 'Problems Solved') ? 1 : 2
                          const baseDate = deadlineDate ? new Date(deadlineDate) : new Date()
                          const autoDeleteDate = new Date(baseDate.getTime() + autoDeleteDays * 24 * 60 * 60 * 1000)
                          return `After ${autoDeleteDays} day${autoDeleteDays > 1 ? 's' : ''} (${autoDeleteDate.toLocaleDateString()})`
                        })()}
                      </span>
                    </div>
                  </div>


                </div>
              </div>

              {/* Final Action Buttons */}
              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-xl hover:from-slate-500 hover:to-slate-600 transition-all duration-200 font-semibold shadow-lg transform hover:scale-105"
                >
                  ← Back to Edit
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg transform hover:scale-105 flex items-center justify-center space-x-3"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 border-3 border-white border-t-transparent rounded-full"
                      />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create Poll</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}


        </form>
      </motion.div>
    </div>
  )
}

// Edit Poll Modal Component
function EditPollModal({ 
  poll, 
  facultyData, 
  onClose, 
  onPollUpdated 
}: { 
  poll: Poll
  facultyData: any
  onClose: () => void
  onPollUpdated: () => void
}) {
  const [title, setTitle] = useState(poll.title)
  const [pollCategory, setPollCategory] = useState<'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'CodeChef Attendance' | 'Problems Solved'>(poll.poll_category as any || 'General Poll')
  const [contestType, setContestType] = useState<'weekly' | 'biweekly' | null>(poll.contest_type as any || null)
  const [targetGender, setTargetGender] = useState<'all' | 'boys' | 'girls'>(poll.target_gender as any || 'all')
  const [options, setOptions] = useState(poll.options || ['Yes', 'No'])
  const [deadlineDate, setDeadlineDate] = useState(
    poll.deadline_at ? new Date(poll.deadline_at).toISOString().split('T')[0] : ''
  )
  const [deadlineTime, setDeadlineTime] = useState(
    poll.deadline_at ? new Date(poll.deadline_at).toTimeString().split(' ')[0].slice(0, 5) : ''
  )
  const [linkUrl, setLinkUrl] = useState(poll.link_url || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(
    (poll.auto_delete_days as number) === 1000 ? 1000 : ((poll.auto_delete_days as number) ?? ((poll.poll_category === 'Attendance' || (poll.poll_category as any) === 'CodeChef Attendance' || poll.poll_category === 'Problems Solved') ? 1 : 2))
  )

  // Initialize options based on poll category when modal opens
  useEffect(() => {
    const category = poll.poll_category as any || 'General Poll'
    if (category === 'General Poll') {
      setOptions(poll.options || ['Yes', 'No'])
    } else if (category === 'Attendance') {
      setOptions(poll.options || ['Present', 'Absent'])
    } else if (category === 'CodeChef Attendance') {
      setOptions(poll.options || ['Present', 'Absent'])
    } else if (category === 'Problems Solved') {
      setOptions(poll.options || ['0', '1', '2', '3', '4', 'Absent'])
    } else if (category === 'Hackathon') {
      setOptions(poll.options || ['Participated', 'Not Participated'])
    } else if (category === 'G-Form Poll') {
      setOptions(poll.options || ['Submitted', 'Not Submitted'])
    } else {
      setOptions(poll.options || ['Yes', 'No'])
    }
  }, [poll.poll_category, poll.options])

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // Reset options when category changes
  const handleCategoryChange = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'CodeChef Attendance' | 'Problems Solved') => {
    setPollCategory(category)
    // Reset options when changing category
    if (category === 'General Poll') {
      setOptions(['Yes', 'No']) // Reset to default options for General Poll
    } else if (category === 'Attendance') {
      setOptions(['Present', 'Absent']) // Default options for Attendance
    } else if (category === 'CodeChef Attendance') {
      setOptions(['Present', 'Absent']) // Default options for CodeChef Attendance
    } else if (category === 'Problems Solved') {
      setOptions(['0', '1', '2', '3', '4', 'Absent']) // Default options for Problems Solved
    } else if (category === 'Hackathon') {
      setOptions(['Participated', 'Not Participated']) // Default options for Hackathon
    } else if (category === 'G-Form Poll') {
      setOptions(['Submitted', 'Not Submitted']) // Default options for G-Form Poll
    } else {
      setOptions(['Yes', 'No']) // Reset to default options for other categories
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('Please enter a poll title')
      return
    }
    
    const validOptions = options.filter(opt => opt.trim() !== '')
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options')
      return
    }
    
    if (pollCategory === 'G-Form Poll' && !linkUrl.trim()) {
      toast.error('Please provide the G-Form link')
      return
    }
    
    if (pollCategory === 'Hackathon' && !linkUrl.trim()) {
      toast.error('Please provide the hackathon link')
      return
    }

    setIsSubmitting(true)
    setIsUpdating(true)
    try {
      // Calculate auto-delete time based on user input
      const now = new Date()
      const autoDeleteTime = autoDeleteDays === 1000 ? new Date(now.getTime() + 1000 * 24 * 60 * 60 * 1000).toISOString() : new Date(now.getTime() + autoDeleteDays * 24 * 60 * 60 * 1000).toISOString()

      // Create deadline timestamp - if only date provided, set to 11:59pm of that date
      let deadlineAt = null
      if (deadlineDate && deadlineTime) {
        deadlineAt = new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
      } else if (deadlineDate) {
        deadlineAt = new Date(`${deadlineDate}T23:59:59`).toISOString()
      }
      // Keep deadline empty unless explicitly chosen

      const updateData = {
        title: title.trim(),
        poll_category: pollCategory,
        options: validOptions,
        deadline_at: deadlineAt,
        link_url: linkUrl.trim() || null,
        contest_type: contestType,
        target_gender: targetGender,
        auto_delete_days: autoDeleteDays,
        auto_delete_at: autoDeleteDays === 1000 ? new Date(now.getTime() + 1000 * 24 * 60 * 60 * 1000).toISOString() : new Date(now.getTime() + autoDeleteDays * 24 * 60 * 60 * 1000).toISOString(),
        last_modified_at: now.toISOString()
      }
      
      console.log('Updating poll with data:', updateData)

      const { error } = await supabase
        .from('polls')
        .update(updateData)
        .eq('id', poll.id)

      if (error) throw error

      onPollUpdated()
    } catch (error) {
      console.error('Error updating poll:', error)
      toast.error('Failed to update poll')
    } finally {
      setIsSubmitting(false)
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-slate-700 relative"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-20"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold text-white mb-6">Edit Poll</h2>
        
        {/* Loading Overlay */}
        {isUpdating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/80 rounded-2xl flex items-center justify-center z-10"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-white text-lg font-medium">Updating Poll...</p>
              <p className="text-slate-300 text-sm mt-2">Please wait while we update your poll</p>
            </div>
          </motion.div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Poll Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-200 mb-3">
              Poll Question
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Are you present for today's contest?"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Poll Category and Contest Type */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Poll Category
              </label>
              <select
                value={pollCategory}
                onChange={(e) => handleCategoryChange(e.target.value as any)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
              >
                <option value="General Poll">General Poll</option>
                <option value="Hackathon">Hackathon</option>
                <option value="G-Form Poll">G-Form Poll</option>
                <option value="Attendance">LeetCode Attendance</option>
                <option value="CodeChef Attendance">CodeChef Attendance</option>
                <option value="Problems Solved">Problems Solved</option>
              </select>
            </div>

            {/* Contest Type for LeetCode */}
            {title.includes('LeetCode Attendance') && (
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-3">
                  Contest Type
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="contestType"
                      value="weekly"
                      checked={contestType === 'weekly'}
                      onChange={(e) => setContestType(e.target.value as 'weekly' | 'biweekly')}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-200">Weekly</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="contestType"
                      value="biweekly"
                      checked={contestType === 'biweekly'}
                      onChange={(e) => setContestType(e.target.value as 'weekly' | 'biweekly')}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-200">Biweekly</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Gender Targeting */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Target Audience
            </label>
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetGender"
                  value="all"
                  checked={targetGender === 'all'}
                  onChange={(e) => setTargetGender(e.target.value as 'all' | 'boys' | 'girls')}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-slate-200">All Students</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetGender"
                  value="boys"
                  checked={targetGender === 'boys'}
                  onChange={(e) => setTargetGender(e.target.value as 'all' | 'boys' | 'girls')}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-slate-200">Boys Only</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetGender"
                  value="girls"
                  checked={targetGender === 'girls'}
                  onChange={(e) => setTargetGender(e.target.value as 'all' | 'boys' | 'girls')}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-slate-200">Girls Only</span>
              </label>
            </div>
          </div>

          {/* Options and Link */}
          <div className="grid grid-cols-3 gap-6">
            {/* Poll Options - Show for all categories */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Poll Options
              </label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg flex-shrink-0">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                      required
                      disabled={isSubmitting}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={isSubmitting}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10 relative"
                        title="Remove option"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 5 && (
                <button
                  type="button"
                  onClick={addOption}
                  disabled={isSubmitting}
                  className="mt-2 w-full py-2 px-3 border-2 border-dashed border-slate-600 text-slate-300 hover:border-slate-500 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Option
                </button>
              )}
            </div>

            {/* Link Field - Show for Hackathon and G-Form Poll */}
            {(pollCategory === 'Hackathon' || pollCategory === 'G-Form Poll') && (
              <div>
                <label htmlFor="linkUrl" className="block text-sm font-medium text-slate-200 mb-2">
                  {pollCategory === 'Hackathon' ? 'Hackathon Link' : 'G-Form Link'}
                </label>
                <input
                  id="linkUrl"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={pollCategory === 'Hackathon' ? 'https://hackathon-event.com' : 'https://forms.google.com/...'}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400"
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Deadline Fields */}
            <div className="col-span-1 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Deadline Date
                </label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Deadline Time (Optional)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white pr-10"
                    disabled={isSubmitting}
                  />
                  {deadlineTime && (
                    <button
                      type="button"
                      onClick={() => setDeadlineTime('')}
                      disabled={isSubmitting}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Auto-Delete Settings */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-amber-300 mb-3">Auto-Delete</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-amber-200 mb-1">Auto-Delete In</label>
                <select
                  value={autoDeleteDays === 1000 ? '1000' : String(autoDeleteDays)}
                  onChange={(e) => setAutoDeleteDays(e.target.value === '1000' ? 1000 : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-700 border border-amber-500/30 rounded-lg text-white"
                >
                  <option value="1000">No auto-delete (permanent)</option>
                  {[...Array(14)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1} day{i + 1 > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-200 mb-1">Current Auto-Delete</label>
                <div className="px-3 py-2 bg-slate-700 border border-amber-500/30 rounded-lg text-amber-200 text-sm">
                  {poll.auto_delete_days === 1000 || !poll.auto_delete_at ? 'Never (permanent)' : new Date(poll.auto_delete_at).toLocaleString()}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-amber-200">This poll will auto-delete at the configured time above.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-slate-600 text-slate-200 rounded-lg hover:bg-slate-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>Updating...</span>
                </>
              ) : (
                'Update Poll'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

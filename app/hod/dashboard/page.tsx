  'use client'

  import { useState, useEffect, useCallback, useMemo } from 'react'
  import { motion } from 'framer-motion'
  import { UserCheck, LogOut, BarChart3, Users, Download, Eye, TrendingUp, Building, Plus, Trash2, RefreshCw, Edit } from 'lucide-react'
  import { supabase } from '@/lib/supabase'
  import { useRouter } from 'next/navigation'
  import { useSession, signOut } from 'next-auth/react'
  import toast from 'react-hot-toast'
  import { formatDate, formatCreatedAt, exportToExcel, exportToExcelWithMultipleSheets, getCurrentTime, isPollExpired, formatDeadline, formatRespondedAt, getAutoDeleteHours, sanitizeFilename } from '@/lib/utils'

  import { Student } from '@/types/student'

  interface Poll {
    id: number
    title: string
    created_at: string
    staff_name: string
    staff_id?: number
    class_name: string
    deadline?: string | null
    poll_type?: 'text' | 'options'
    options?: string[]
    poll_category?: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved'
    classStudents?: Student[]
    // New fields for grouped polls
    sections?: string[]
    totalSections?: number
    isGrouped?: boolean
    // Additional fields
    link_url?: string | null
    auto_delete_at?: string | null
    auto_delete_days?: number
    target_gender?: string | null
  }

  interface PollResponse {
    id: number
    poll_id: number
    student_reg_no: string
    response: string
    responded_at: string
    student_name: string
    option_index?: number | null
  }

  interface SectionStats {
    section: string
    totalStudents: number
    respondedStudents: number
    responseRate: number
  }

  export default function HODDashboard() {
    const { data: session, status } = useSession()
    const [hodData, setHodData] = useState<any>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [polls, setPolls] = useState<Poll[]>([])
    const [responses, setResponses] = useState<PollResponse[]>([])
    const [sectionStats, setSectionStats] = useState<SectionStats[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRealtimeUpdating, setIsRealtimeUpdating] = useState(false)
    const [loadingProgress, setLoadingProgress] = useState<string>('Initializing...')
    const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'polls' | 'analytics'>('overview')
    const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null)
    const [selectedSection, setSelectedSection] = useState<string>('A')
    const [selectedPollSection, setSelectedPollSection] = useState<string>('A')


    // Memoize filtered students to prevent unnecessary re-renders
    const filteredStudents = useMemo(() => {
      return students.filter(student => student.section === selectedSection)
    }, [students, selectedSection])

    // Memoize section options to prevent unnecessary re-renders
    const sectionOptions = useMemo(() => {
      return Array.from(new Set(students.map(s => s.section))).sort()
    }, [students])

    // Set default section when students are loaded
    useEffect(() => {
      if (students.length > 0 && sectionOptions.length > 0 && !sectionOptions.includes(selectedSection)) {
        setSelectedSection(sectionOptions[0])
      }
    }, [students, sectionOptions, selectedSection])
    const [showCreatePoll, setShowCreatePoll] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
    const [deletingPolls, setDeletingPolls] = useState<Set<number>>(new Set())
    const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
    const [showEditPoll, setShowEditPoll] = useState(false)
    const router = useRouter()


    // Function to group polls by title and staff to avoid duplicates
    const groupPollsByTitleAndStaff = (polls: Poll[]): Poll[] => {
      const groupedMap = new Map<string, Poll>()
      
      polls.forEach(poll => {
        // First try exact match (title + staff + timestamp) for new polls
        const exactKey = `${poll.title}-${poll.staff_id}-${poll.created_at}`
        
        if (groupedMap.has(exactKey)) {
          const existingPoll = groupedMap.get(exactKey)!
          // Add section to the existing poll
          if (!existingPoll.sections) {
            existingPoll.sections = [existingPoll.class_name.split(' ').pop() || '']
          }
          const section = poll.class_name.split(' ').pop() || ''
          if (!existingPoll.sections.includes(section)) {
            existingPoll.sections.push(section)
          }
          existingPoll.totalSections = existingPoll.sections.length
          existingPoll.isGrouped = existingPoll.totalSections > 1
        } else {
          // Check if there's already a poll with same title and staff (for existing polls)
          const titleStaffKey = `${poll.title}-${poll.staff_id}`
          let foundExisting = false
          
          groupedMap.forEach((existingPoll, key) => {
            if (key.startsWith(titleStaffKey) && !foundExisting) {
              // Add section to the existing poll
              if (!existingPoll.sections) {
                existingPoll.sections = [existingPoll.class_name.split(' ').pop() || '']
              }
              const section = poll.class_name.split(' ').pop() || ''
              if (!existingPoll.sections.includes(section)) {
                existingPoll.sections.push(section)
              }
              existingPoll.totalSections = existingPoll.sections.length
              existingPoll.isGrouped = existingPoll.totalSections > 1
              foundExisting = true
            }
          })
          
          if (!foundExisting) {
            // Create new grouped poll
            const section = poll.class_name.split(' ').pop() || ''
            const groupedPoll: Poll = {
              ...poll,
              sections: [section],
              totalSections: 1,
              isGrouped: false
            }
            groupedMap.set(exactKey, groupedPoll)
          }
        }
      })
      
      return Array.from(groupedMap.values()).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }

  useEffect(() => {
    // Set up a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('Dashboard loading timeout, redirecting to login')
        router.push('/hod/login')
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
      router.push('/hod/login')
      return
    }

    if (session.user.role !== 'hod') {
      console.log('Invalid role for HOD dashboard:', session.user.role)
      clearTimeout(timeoutId)
      router.push('/hod/login')
      return
    }

    // Check if session user has required data
    if (!session.user.isValid) {
      console.log('Invalid session, redirecting to login')
      clearTimeout(timeoutId)
      router.push('/hod/login')
      return
    }

    console.log('HOD session validated, initializing dashboard')
    setLoadingProgress('Loading dashboard...')
    clearTimeout(timeoutId)

    // Get HOD data from session
    const data = {
      id: parseInt(session.user.id), // Convert string ID to number for database comparison
      name: session.user.name,
      email: session.user.email,
      designation: 'HOD',
      department: session.user.department || 'Unknown',
      section: session.user.section || null
    }
    setHodData(data)
    setLastRefreshed(new Date()) // Set initial refresh time
    fetchDepartmentData(data)

      // Add keyboard shortcut for refresh (Ctrl+R or Cmd+R)
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
          e.preventDefault()
          if (data && !isRefreshing) {
            handleRefresh()
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)

      // Set up real-time subscriptions with debouncing
      const setupRealtimeSubscriptions = () => {
        let refreshTimeout: NodeJS.Timeout | null = null
        
        const debouncedRefresh = () => {
          if (refreshTimeout) clearTimeout(refreshTimeout)
          refreshTimeout = setTimeout(() => {
            setIsRealtimeUpdating(true)
            fetchDepartmentData(data)
            setTimeout(() => setIsRealtimeUpdating(false), 1000) // Reduced from 2000ms to 1000ms
          }, 2000) // Increased from 1 second to 2 seconds to reduce flickering
        }

        // Subscribe to poll_responses changes
        const pollResponsesSubscription = supabase
          .channel('poll_responses_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'poll_responses'
            },
            (payload: { new: { poll_id: number } | null }) => {
              console.log('Poll response change detected:', payload)
              // If we have a selected poll, check if the change is relevant
              if (selectedPoll && payload.new && payload.new.poll_id === selectedPoll.id) {
                console.log('Change is for the currently selected poll, refreshing...')
                fetchPollResponses(selectedPoll.id, selectedPollSection)
              } else {
                debouncedRefresh()
              }
            }
          )
          .subscribe()
        
        console.log('Poll responses subscription set up')

        // Subscribe to polls changes
        const pollsSubscription = supabase
          .channel('polls_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'polls'
            },
            debouncedRefresh
          )
          .subscribe()

        // Subscribe to students changes
        const studentsSubscription = supabase
          .channel('students_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'students'
            },
            debouncedRefresh
          )
          .subscribe()

        // Return cleanup function
        return () => {
          if (refreshTimeout) clearTimeout(refreshTimeout)
          pollResponsesSubscription.unsubscribe()
          pollsSubscription.unsubscribe()
          studentsSubscription.unsubscribe()
        }
      }

      const cleanup = setupRealtimeSubscriptions()

      // Cleanup on unmount
      return () => {
        clearTimeout(timeoutId)
        clearTimeout(sessionDelay)
        cleanup()
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [router, isRefreshing])


    // useEffect(() => {
    //   if (selectedPoll) {
    //     console.log('selectedPoll changed to:', selectedPoll.id, selectedPoll.title, selectedPoll.class_name)
    //   }
    // }, [selectedPoll])

      const fetchDepartmentData = useCallback(async (hod: any) => {
      try {
        // First, cleanup expired polls
        try {
          await fetch('/api/cleanup-polls', { method: 'POST' })
        } catch (cleanupError) {
          console.log('Cleanup polls failed (non-critical):', cleanupError)
        }
        
        setLoadingProgress('Loading students...')
        
        // Fetch all students in the department with pagination to ensure we get all students
        let allStudents: Student[] = []
        let from = 0
        const pageSize = 1000
        let retryCount = 0
        const maxRetries = 3
        let lastProgressUpdate = 0
        
        while (true) {
          try {
            // Only update progress every 500ms to prevent flickering
            const now = Date.now()
            if (now - lastProgressUpdate > 500) {
              setLoadingProgress(`Loading students... (${allStudents.length} loaded so far)`)
              lastProgressUpdate = now
            }
            
            const { data: studentsData, error: studentsError } = await supabase
              .from('students')
              .select('*')
              .eq('department', hod.department)
              .order('section', { ascending: true })
              .order('name', { ascending: true })
              .range(from, from + pageSize - 1)
            
            if (studentsError) {
              console.error('Error fetching students page:', studentsError)
              if (retryCount < maxRetries) {
                retryCount++
                // Only update progress on first retry to prevent flickering
                if (retryCount === 1) {
                  setLoadingProgress(`Retrying... (attempt ${retryCount}/${maxRetries})`)
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)) // Exponential backoff
                continue
              } else {
                throw studentsError
              }
            }
            
            if (!studentsData || studentsData.length === 0) break
            
            allStudents = [...allStudents, ...studentsData]
            from += pageSize
            
            // If we got less than pageSize, we've reached the end
            if (studentsData.length < pageSize) break
            
            // Reset retry count on successful fetch
            retryCount = 0
            
          } catch (error) {
            console.error('Error in student fetch loop:', error)
            if (retryCount < maxRetries) {
              retryCount++
              // Only update progress on first retry to prevent flickering
              if (retryCount === 1) {
                setLoadingProgress(`Retrying... (attempt ${retryCount}/${maxRetries})`)
              }
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
              continue
            } else {
              throw error
            }
          }
        }
        
        setStudents(allStudents)
        setLoadingProgress(`Loaded ${allStudents.length} students. Loading polls...`)
        

        
        // Fetch all polls in the department
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select('id')
          .eq('department', hod.department)

        if (classesError) throw classesError

        const classIds = classesData.map((c: any) => c.id)
        
        const { data: pollsData, error: pollsError } = await supabase
          .from('polls')
          .select(`
            *,
            staffs(name, id),
            classes(department, section)
          `)
          .in('class_id', classIds)
          .order('created_at', { ascending: false })

        if (pollsError) throw pollsError
        // HOD should see all department polls (not just their own)
        const allDepartmentPolls = pollsData || []

        const formattedPolls = allDepartmentPolls.map((poll: any) => ({
          id: poll.id,
          title: poll.title,
          created_at: poll.created_at,
          staff_name: poll.staffs?.name || 'Unknown',
          staff_id: poll.staffs?.id || null,
          class_name: `${poll.classes?.department} ${poll.classes?.section}`,
          deadline: poll.deadline_at,
          options: poll.options || [],
          poll_type: poll.poll_type || 'options',
          poll_category: poll.poll_category || 'General Poll',
          auto_delete_at: poll.auto_delete_at,
          target_gender: poll.target_gender || 'all'
        }))

        // Group polls by title and staff to avoid duplicates
        const groupedPolls = groupPollsByTitleAndStaff(formattedPolls)
        setPolls(groupedPolls)
        setLoadingProgress('Calculating statistics...')

        // Calculate section statistics
        await calculateSectionStats(allStudents, formattedPolls)
      } catch (error) {
        console.error('Error fetching department data with pagination:', error)
        
        // Fallback: try to fetch all students at once with a higher limit
        try {
          setLoadingProgress('Pagination failed. Trying alternative method...')
          
          
          const { data: fallbackStudents, error: fallbackError } = await supabase
            .from('students')
            .select('*')
            .eq('department', hod.department)
            .order('section', { ascending: true })
            .order('name', { ascending: true })
            .limit(5000) // Try with a higher limit
          
          if (fallbackError) throw fallbackError
          
          if (fallbackStudents && fallbackStudents.length > 0) {
            setStudents(fallbackStudents)
            setLoadingProgress(`Fallback loaded ${fallbackStudents.length} students. Loading polls...`)
            
            // Continue with polls loading using the existing logic
            const { data: classesData, error: classesError } = await supabase
              .from('classes')
              .select('id')
              .eq('department', hod.department)

            if (classesError) throw classesError

            const classIds = classesData.map((c: any) => c.id)
            
            const { data: pollsData, error: pollsError } = await supabase
              .from('polls')
              .select(`
                *,
                staffs(name, id),
                classes(department, section)
              `)
              .in('class_id', classIds)
              .order('created_at', { ascending: false })

            if (pollsError) throw pollsError
            // HOD should see all department polls (not just their own)
            const allDepartmentPolls = pollsData || []

            const formattedPolls = allDepartmentPolls.map((poll: any) => ({
              id: poll.id,
              title: poll.title,
              created_at: poll.created_at,
              staff_name: poll.staffs?.name || 'Unknown',
              staff_id: poll.staffs?.id || null,
              class_name: `${poll.classes?.department} ${poll.classes?.section}`,
              deadline: poll.deadline_at,
              options: poll.options || [],
              poll_type: poll.poll_type || 'options',
              poll_category: poll.poll_category || 'General Poll',
              auto_delete_at: poll.auto_delete_at,
              target_gender: poll.target_gender || 'all'
            }))

            // Group polls by title and staff to avoid duplicates
            const groupedPolls = groupPollsByTitleAndStaff(formattedPolls)
            setPolls(groupedPolls)
            setLoadingProgress('Calculating statistics...')

            // Calculate section statistics
            await calculateSectionStats(fallbackStudents, formattedPolls)
          } else {
            throw new Error('No students found with fallback method')
          }
        } catch (fallbackError) {
          console.error('Fallback method also failed:', fallbackError)
          toast.error('Failed to fetch department data. Please try refreshing.')
          setStudents([])
        }
      } finally {
        setIsLoading(false)
      }
    }, [])

    const handleRefresh = async () => {
      if (!hodData) return
      
      setIsRefreshing(true)
      try {
        // Refresh all department data
        await fetchDepartmentData(hodData)
        
        setLastRefreshed(new Date())
        toast.success('Data refreshed successfully!')
      } catch (error) {
        console.error('Error refreshing data:', error)
        toast.error('Failed to refresh data')
      } finally {
        setIsRefreshing(false)
      }
    }

    const calculateSectionStats = async (students: Student[], polls: Poll[]) => {
      const sections = Array.from(new Set(students.map(s => s.section)))
      const stats: SectionStats[] = []

      // Get all responses for all polls in one query instead of multiple queries
      if (polls.length > 0) {
        const pollIds = polls.map(p => p.id)
        const { data: allResponses } = await supabase
          .from('poll_responses')
          .select('poll_id, student_reg_no')
          .in('poll_id', pollIds)
          .limit(10000) // Increase limit to handle more responses

        // Calculate response rates for each section
        for (const section of sections) {
          const sectionStudents = students.filter(s => s.section === section)
          const totalStudents = sectionStudents.length
          const sectionStudentRegNos = sectionStudents.map(s => s.reg_no)
          
          // Count responses for this section from the cached data
          let totalResponses = 0
          if (allResponses) {
            totalResponses = allResponses.filter((r: any) =>
              sectionStudentRegNos.includes(r.student_reg_no)
            ).length
          }
          
          // Calculate response rate as percentage of students who responded to any poll
          const responseRate = totalStudents > 0 ? Math.round((totalResponses / totalStudents) * 100) : 0
          const respondedStudents = totalResponses

          stats.push({
            section,
            totalStudents,
            respondedStudents,
            responseRate
          })
        }
      } else {
        // If no polls, just show basic stats
        for (const section of sections) {
          const sectionStudents = students.filter(s => s.section === section)
          stats.push({
            section,
            totalStudents: sectionStudents.length,
            respondedStudents: 0,
            responseRate: 0
          })
        }
      }

      setSectionStats(stats)
    }

    // Calculate section response rates for the current poll (memoized to prevent flickering)
    const calculateCurrentPollSectionStats = useMemo(() => {
      if (!selectedPoll || !responses.length) return []

      // Get the class details from the selected poll
      const pollClass = selectedPoll.class_name
      const pollDepartment = pollClass?.split(' ')[0] // Extract department from "Department Section"
      const pollSection = pollClass?.split(' ')[1]   // Extract section from "Department Section"
      
      // Only show sections that are relevant to this poll
      let relevantSections: string[] = []
      
      if (pollSection) {
        // If this is a specific section poll, only show that section
        relevantSections = [pollSection]
      } else if (pollDepartment) {
        // If this is a department-wide poll, show all sections in that department
        relevantSections = Array.from(new Set(
          students
            .filter(s => s.department === pollDepartment)
            .map(s => s.section)
        ))
      } else {
        // Fallback: show all sections
        relevantSections = Array.from(new Set(students.map(s => s.section)))
      }
      
      const currentPollStats: SectionStats[] = []

      for (const section of relevantSections) {
        const sectionStudents = students.filter(s => s.section === section)
        const totalStudents = sectionStudents.length
        const sectionStudentRegNos = sectionStudents.map(s => s.reg_no)
        
        // Count responses for this section in the current poll
        const sectionResponses = responses.filter(r => 
          sectionStudentRegNos.includes(r.student_reg_no)
        ).length
        
        // Calculate response rate for this specific poll
        const responseRate = totalStudents > 0 ? Math.round((sectionResponses / totalStudents) * 100) : 0

        currentPollStats.push({
          section,
          totalStudents,
          respondedStudents: sectionResponses,
          responseRate
        })
      }

      return currentPollStats
    }, [selectedPoll, responses, students])

    const fetchPollResponses = useCallback(async (pollId: number, targetSection?: string) => {
      try {
        // Get the current poll from the polls array to check if it's grouped
        const currentPoll = polls.find(p => p.id === pollId)
        if (!currentPoll) {
          console.error('Poll not found in polls array')
          return
        }

        // First get the complete poll details including options
        const { data: pollData, error: pollError } = await supabase
          .from('polls')
          .select('class_id, title, options, poll_type, poll_category, target_gender')
          .eq('id', pollId)
          .single()

        if (pollError) throw pollError

        // Get the class details
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('department, section')
          .eq('id', pollData.class_id)
          .single()

        if (classError) throw classError

        // For grouped polls, we need to handle section selection differently
        let classStudents: any[] = []
        
        if (currentPoll.isGrouped && currentPoll.sections) {
          // For grouped polls, get students from specific section
          if (targetSection) {
            // Get students from specific section
            const { data: studentsData, error: studentsError } = await supabase
              .from('students')
              .select('reg_no, name, email, department, section, gender, mobile_number, h_d')
              .eq('department', classData.department)
              .eq('section', targetSection)
            
            if (studentsError) throw studentsError
            classStudents = studentsData || []
          } else {
            // Get students from all sections in the grouped poll
            const { data: studentsData, error: studentsError } = await supabase
              .from('students')
              .select('reg_no, name, email, department, section, gender, mobile_number, h_d')
              .eq('department', classData.department)
              .in('section', currentPoll.sections)
            
            if (studentsError) throw studentsError
            classStudents = studentsData || []
          }
        } else {
          // For single polls, get students from the specific class
          const { data: studentsData, error: studentsError } = await supabase
            .from('students')
            .select('reg_no, name, email, department, section, gender, mobile_number, h_d')
            .eq('department', classData.department)
            .eq('section', classData.section)
          
          if (studentsError) throw studentsError
          classStudents = studentsData || []
        }

        // Apply gender targeting consistently to the student pool used for counts and non-responders
        if (pollData.target_gender && pollData.target_gender !== 'all') {
          const genderValues = pollData.target_gender === 'boys' ? ['M', 'Male', 'm', 'male'] : ['F', 'Female', 'f', 'female']
          classStudents = classStudents.filter(s => s.gender && genderValues.includes(String(s.gender)))
        }

        // For grouped polls, we need to get responses from all related polls
        let pollIds = [pollId]
        
        if (currentPoll.isGrouped && currentPoll.sections) {
          // Get all poll IDs for this grouped poll (match title + staff_id; timestamps may differ per row)
          const { data: relatedPolls, error: relatedPollsError } = await supabase
            .from('polls')
            .select('id')
            .eq('title', currentPoll.title)
            .eq('staff_id', currentPoll.staff_id)
          
          if (!relatedPollsError && relatedPolls) {
            pollIds = relatedPolls.map((p: any) => p.id)
          }
        }

        // Get responses for all relevant polls (also request count for diagnostics)
        const { data: responsesData, error: responsesError, count: responsesCount } = await supabase
          .from('poll_responses')
          .select('*', { count: 'exact' })
          .in('poll_id', pollIds)
          .limit(10000)

        if (responsesError) throw responsesError
        
        console.log('Poll responses fetched:', responsesData?.length || 0, 'responses for poll IDs:', pollIds, 'count header:', responsesCount)

        // Match responses with student names and filter by section if needed
        console.log('Class students:', classStudents.length, 'students found')
        
        // Apply gender filter to responses if needed (match by reg_no -> student.gender)
        let genderFilteredResponses = responsesData
        if (pollData.target_gender && pollData.target_gender !== 'all') {
          const genderValues = pollData.target_gender === 'boys' ? ['M', 'Male', 'm', 'male'] : ['F', 'Female', 'f', 'female']
          genderFilteredResponses = responsesData.filter((response: any) => {
            const student = classStudents.find(s => s.reg_no === response.student_reg_no)
            return student && student.gender && genderValues.includes(String(student.gender))
          })
        }

        const formattedResponses = genderFilteredResponses
          .map((response: any) => {
            const student = classStudents.find(s => s.reg_no === response.student_reg_no)
            return {
              ...response,
              student_name: student?.name || 'Unknown',
              student_department: student?.department || 'Unknown',
              student_section: student?.section || 'Unknown'
            }
          })
          .filter((response: any) => {
            // If targetSection is specified, only include responses from that section
            if (targetSection) {
              return response.student_section === targetSection
            }
            return true
          })
          .sort((a: any, b: any) => (a.student_reg_no || '').localeCompare(b.student_reg_no || ''))
          
        console.log('Formatted responses:', formattedResponses.length, 'responses after filtering')

        console.log('Setting responses state with', formattedResponses.length, 'responses')
        setResponses(formattedResponses)
        
        // Update the selectedPoll with complete poll data including options
        const updatedPoll = { 
          ...currentPoll, 
          classStudents: classStudents || [],
          options: pollData.options || [],
          poll_type: pollData.poll_type,
          poll_category: pollData.poll_category
        }
        console.log('Updated poll data:', updatedPoll)

        setSelectedPoll(updatedPoll)
        console.log('Responses after formatting:', formattedResponses.length)
      } catch (error) {
        console.error('Error fetching responses:', error)
        toast.error('Failed to fetch responses')
      }
    }, [polls])

    const handleLogout = () => {
      signOut({ callbackUrl: '/' })
      toast.success('Logged out successfully')
    }

          

    const exportDepartmentData = () => {
      const studentsToExport = filteredStudents
      
      // Get section-wise summary
      const sectionSummary = Array.from(new Set(studentsToExport.map(s => s.section))).map(section => {
        const sectionStudents = studentsToExport.filter(s => s.section === section)
        return {
          'Section': section,
          'Student Count': sectionStudents.length,
          'Department': hodData.department,
          'HOD': hodData.name
        }
      })
      
      const studentData = studentsToExport.map(student => ({
        'Registration Number': student.reg_no,
        'Student Name': student.name,
        'Mobile Number': student.mobile_number || 'N/A',
        'Hostel/Day Scholar': student.h_d || 'N/A',
        'Responded Time': 'N/A',
        'Response': 'N/A',
        'Gender': student.gender || 'N/A',
        'Department': student.department,
        'Section': student.section
      }))
      
      const filename = `${sanitizeFilename(`Students_${hodData.department}_Section_${selectedSection}`)}`
      
      // Export with multiple sheets
      exportToExcelWithMultipleSheets([
        { name: 'Section Summary', data: sectionSummary },
        { name: 'Student Details', data: studentData }
      ], filename)
      
      toast.success(`Student data exported successfully with section summary! (Section ${selectedSection})`)
    }

    const handleExportResults = async (poll: any) => {
      
      if (responses.length === 0) {
        toast.error('No responses to export')
        return
      }

      // Get students who haven't responded
      const respondedRegNos = responses.map(r => r.student_reg_no)
      const nonResponders = (selectedPoll?.classStudents || []).filter(student => !respondedRegNos.includes(student.reg_no))
      
      // Calculate option counts for summary
      let optionSummaryData: any[] = []
      if (poll.options && poll.options.length > 0) {
        optionSummaryData = poll.options.map((option: string, index: number) => {
          const count = responses.filter(r => {
            // Try to match by option_index first, then fall back to response text matching (case-insensitive)
            if (r.option_index === index) return true
            const text = (r.response || '').toLowerCase()
            const normalized = option.toLowerCase()
            return text === normalized || text.startsWith(`${normalized} -`)
          }).length
          return {
            'Option': option,
            'Count': count,
            'Percentage': responses.length > 0 ? Math.round((count / responses.length) * 100) : 0
          }
        })
      }

      // Export responded students with detailed response info
      const respondedData = responses.map(response => {
        // Find the student data to get additional fields
        const student = (selectedPoll?.classStudents || []).find(s => s.reg_no === response.student_reg_no)
        return {
          'Registration Number': response.student_reg_no,
          'Student Name': response.student_name,
          'Mobile Number': student?.mobile_number || 'N/A',
          'Hostel/Day Scholar': student?.h_d || 'N/A',
          'Responded Time': formatRespondedAt(response.responded_at),
          'Response': response.response,
          'Gender': student?.gender || 'N/A',
          'Department': student?.department || 'N/A',
          'Section': student?.section || 'N/A'
        }
      })

      // Export non-responded students
      const nonRespondedData = nonResponders.map(student => ({
        'Registration Number': student.reg_no,
        'Student Name': student.name,
        'Mobile Number': student.mobile_number || 'N/A',
        'Hostel/Day Scholar': student.h_d || 'N/A',
        'Responded Time': 'N/A',
        'Response': 'Not Responded',
        'Gender': student.gender || 'N/A',
        'Department': student.department,
        'Section': student.section
      }))
      


      // Get section and faculty information
      const sectionInfo = {
        'Poll Title': poll.title,
        'Class': poll.class_name,
        'Department': (selectedPoll?.classStudents?.[0]?.department) || 'Unknown',
        'Section': poll.class_name?.split(' ')[1] || 'Unknown',
        'Total Students': (selectedPoll?.classStudents?.length || 0),
        'Responded': responses.length,
        'Not Responded': nonResponders.length,
        'Response Rate': (selectedPoll?.classStudents?.length || 0) > 0 ? 
          Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0
      }

      // Create section info sheet
      const sectionInfoData = Object.entries(sectionInfo).map(([key, value]) => ({
        'Field': key,
        'Value': value
      }))


      
      // Use the utility function for multiple sheets
      exportToExcelWithMultipleSheets([
        { name: 'Responded', data: respondedData },
        { name: 'Not Responded', data: nonRespondedData }
      ], `${sanitizeFilename(poll.title)}`)
      
      toast.success('Poll data exported successfully with detailed analysis and segregated option counts!')
    }

    // Enhanced export function for poll responses with faculty details
    const exportPollResponsesWithFaculty = async (poll: Poll) => {
      if (responses.length === 0) {
        toast.error('No responses to export')
        return
      }

      try {
        // Get faculty information for the poll
        const { data: facultyData, error: facultyError } = await supabase
          .from('staffs')
          .select('name, email')
          .eq('id', poll.staff_id)
          .single()

        if (facultyError) {
          console.error('Error fetching faculty data:', facultyError)
        }

        // Get students who haven't responded
        const respondedRegNos = responses.map(r => r.student_reg_no)
        const nonResponders = (selectedPoll?.classStudents || []).filter(student => !respondedRegNos.includes(student.reg_no))
        
        // Calculate option counts for summary
        let optionSummaryData: any[] = []
        if (poll.options && poll.options.length > 0) {
          optionSummaryData = poll.options.map((option: string, index: number) => {
            const count = responses.filter(r => {
              if (r.option_index === index) return true
              const text = (r.response || '').toLowerCase()
              const normalized = option.toLowerCase()
              return text === normalized || text.startsWith(`${normalized} -`)
            }).length
            return {
              'Option': option,
              'Count': count,
              'Percentage': responses.length > 0 ? Math.round((count / responses.length) * 100) : 0
            }
          })
        }

        // Export responded students with detailed response info
        const respondedData = responses.map(response => {
          // Find the student data to get additional fields
          const student = (selectedPoll?.classStudents || []).find(s => s.reg_no === response.student_reg_no)
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
            'Response': response.response,
            'Responded At': formatRespondedAt(response.responded_at)
          }
        })

        // Export non-responded students
        const nonRespondersData = nonResponders.map(student => ({
          'Registration Number': student.reg_no,
          'Student Name': student.name,
          'Mobile Number': student.mobile_number || 'N/A',
          'H/D': student.h_d || 'N/A',
          'Gender': student.gender || 'N/A',
          'Email': student.email || 'N/A',
          'Department': student.department,
          'Section': student.section,
          'Year': student.year || 'N/A',
          'Response': 'Not Responded',
          'Responded At': 'N/A'
        }))

        // Get comprehensive section info with faculty details
        const comprehensiveInfo = {
          'Poll Title': poll.title,
          'Class': poll.class_name,
          'Department': (selectedPoll?.classStudents?.[0]?.department) || 'Unknown',
          'Section': poll.class_name?.split(' ')[1] || 'Unknown',
          'Faculty Name': facultyData?.name || 'Unknown',
          'Faculty Email': facultyData?.email || 'Unknown',
          'Total Students': (selectedPoll?.classStudents?.length || 0),
          'Responded': responses.length,
          'Not Responded': nonResponders.length,
          'Response Rate': (selectedPoll?.classStudents?.length || 0) > 0 ? 
            Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0,
          'Export Date': new Date().toLocaleDateString('en-GB'),
          'Export Time': new Date().toLocaleTimeString('en-GB')
        }

        // Create comprehensive info sheet
        const comprehensiveInfoData = Object.entries(comprehensiveInfo).map(([key, value]) => ({
          'Field': key,
          'Value': value
        }))

        // Export with multiple sheets including faculty information
        exportToExcelWithMultipleSheets([
          { name: 'Responded', data: respondedData },
          { name: 'Not Responded', data: nonRespondersData }
        ], poll.title)
        
        toast.success('Poll data exported successfully with faculty details and segregated option counts!')
      } catch (error) {
        console.error('Error exporting poll data:', error)
        toast.error('Failed to export poll data')
      }
    }

    const handleDeletePoll = async (pollId: number) => {
      if (!window.confirm('Are you sure you want to delete this poll?')) {
        return
      }

      setDeletingPolls(prev => new Set(prev).add(pollId))

      try {
        // HOD delete: remove the poll and all grouped duplicates (same title, staff)
        // First, fetch the poll to get title and staff
        const { data: pollData, error: fetchError } = await supabase
          .from('polls')
          .select('id, title, staff_id')
          .eq('id', pollId)
          .single()

        if (fetchError) throw fetchError

        // Delete all polls that are part of the same grouped set
        const { error } = await supabase
          .from('polls')
          .delete()
          .eq('title', pollData.title)
          .eq('staff_id', pollData.staff_id)

        if (error) throw error

        setPolls(polls.filter(poll => !(poll.title === pollData.title && poll.staff_id === pollData.staff_id)))
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
              <div className="w-20 h-20 bg-gradient-to-r from-secondary-500 to-accent-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
                <UserCheck className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-6"
            >
              <h2 className="text-2xl font-bold text-white mb-2">HOD Dashboard</h2>
              <p className="text-slate-300">{loadingProgress}</p>
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
                className="w-3 h-3 bg-secondary-500 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="w-3 h-3 bg-accent-500 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                className="w-3 h-3 bg-primary-500 rounded-full"
              />
            </motion.div>
          </div>
        </div>
      )
    }

    // Define colors outside the return statement
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']
    
    if (!hodData) {
      return null;
    }

    return (
      <div className="dashboard-bg">
        {/* Enhanced Header */}
        <header className="bg-gradient-to-r from-slate-800/95 via-slate-700/95 to-slate-800/95 backdrop-blur-lg border-b border-slate-600/50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                  <UserCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    HOD Dashboard
                  </h1>
                  <p className="text-slate-300 mt-1 flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span>Welcome back, <span className="font-semibold text-purple-300">{hodData.name}</span></span>
                    <span className="text-slate-500">•</span>
                    <span className="px-3 py-1 bg-slate-600/50 rounded-full text-sm font-medium">
                      {hodData.department} Department
                    </span>
                    {isRealtimeUpdating && (
                      <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                        Live Updates
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-slate-400 text-sm bg-slate-800/50 px-3 py-2 rounded-lg">
                  {lastRefreshed && (
                    <span title={`Last refreshed: ${lastRefreshed.toLocaleTimeString()}`}>
                      Last: {lastRefreshed.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-red-500/25 transform hover:scale-105"
                >
                  <LogOut className="w-5 h-5" />
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
              { id: 'overview', label: 'Overview', icon: BarChart3, color: 'from-purple-500 to-pink-500' },
              { id: 'students', label: 'Students', icon: Users, color: 'from-emerald-500 to-teal-500' },
              { id: 'polls', label: 'Polls', icon: BarChart3, color: 'from-blue-500 to-cyan-500' },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp, color: 'from-orange-500 to-red-500' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-3 py-2 sm:py-4 px-2 sm:px-6 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 relative text-xs sm:text-base ${
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
                    className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-xl"
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
                {/* Enhanced Department Overview Cards */}
                <div className="grid md:grid-cols-3 gap-8">
                  <motion.div 
                    className="card text-center group relative overflow-hidden" 
                    whileHover={{ scale: 1.05, rotateY: 5 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300 transform group-hover:scale-110">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                      <h3 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-3">{students.length}</h3>
                      <p className="text-slate-300 text-lg font-medium">Total Students</p>
                  </div>
                  </motion.div>
                  
                  <motion.div 
                    className="card text-center group relative overflow-hidden" 
                    whileHover={{ scale: 1.05, rotateY: 5 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-emerald-500/25 transition-all duration-300 transform group-hover:scale-110">
                        <Building className="w-8 h-8 text-white" />
                    </div>
                      <h3 className="text-4xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent mb-3">
                      {Array.from(new Set(students.map(s => s.section))).length}
                    </h3>
                      <p className="text-slate-300 text-lg font-medium">Total Sections</p>
                  </div>
                  </motion.div>
                  
                  <motion.div 
                    className="card text-center group relative overflow-hidden" 
                    whileHover={{ scale: 1.05, rotateY: 5 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300 transform group-hover:scale-110">
                        <BarChart3 className="w-8 h-8 text-white" />
                    </div>
                      <h3 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-3">{polls.length}</h3>
                      <p className="text-slate-300 text-lg font-medium">Active Polls</p>
                  </div>
                  </motion.div>
                </div>

                {/* Quick Actions moved here */}
                <div className="card relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-700/50"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-orange-200 bg-clip-text text-transparent">Quick Actions</h2>
                        </div>
                      </div>
                    
                  </div>
                    <div className="grid md:grid-cols-3 gap-6">
                      <motion.button
                      onClick={() => setShowCreatePoll(true)}
                        className="flex items-center justify-center space-x-3 py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl transition-all duration-300 shadow-lg hover:shadow-green-500/25 transform hover:scale-105"
                        whileHover={{ y: -5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Plus className="w-6 h-6" />
                        <span className="font-semibold text-lg">Create Poll</span>
                      </motion.button>
                      
                      <motion.button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                        className="flex items-center justify-center space-x-3 py-6 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all duration-300 shadow-lg hover:shadow-blue-500/25 transform hover:scale-105"
                      title="Refresh all data"
                        whileHover={{ y: -5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        {isRefreshing ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                          />
                        ) : (
                          <RefreshCw className="w-6 h-6" />
                        )}
                        <span className="font-semibold text-lg">{isRefreshing ? 'Refreshing...' : 'Refresh All Data'}</span>
                      </motion.button>
                      
                      <motion.button
                      onClick={exportDepartmentData}
                        className="flex items-center justify-center space-x-3 py-6 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-2xl transition-all duration-300 shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                        whileHover={{ y: -5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Download className="w-6 h-6" />
                        <span className="font-semibold text-lg">Export Department Data</span>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Section Breakdown component removed as requested */}
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
                  <div>
                    <h2 className="text-2xl font-bold text-white">Department Students</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Showing {students.length} students across {Array.from(new Set(students.map(s => s.section))).length} sections in {hodData.department} Department
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="btn-accent flex items-center space-x-2"
                      title="Refresh students data"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    <button
                      onClick={exportDepartmentData}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <Download className="w-5 h-5" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Two-column layout: Section boxes on left, students table on right */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left side: Section Summary with Clickable Boxes */}
                  <div className="lg:col-span-1">
                    {/* Section Filter - Positioned above Section Breakdown */}
                    <div className="card mb-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Filter by Section</h3>
                        <select
                          value={selectedSection}
                          onChange={(e) => setSelectedSection(e.target.value)}
                          className="input-field max-w-xs"
                        >
                          {sectionOptions.map(section => (
                            <option key={section} value={section}>Section {section}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Section Breakdown */}
                    <div className="card">
                      <h3 className="text-lg font-semibold text-white mb-4">Section Breakdown</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {sectionOptions.map(section => {
                          const sectionStudents = students.filter(s => s.section === section)
                          
                          // Define attractive colors for each section A to Q
                          const getSectionColors = (sectionLetter: string) => {
                            const colorMap: { [key: string]: { bg: string; border: string; text: string; hoverBg: string } } = {
                              'A': { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/30' },
                              'B': { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', hoverBg: 'hover:bg-emerald-500/30' },
                              'C': { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', hoverBg: 'hover:bg-purple-500/30' },
                              'D': { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/30' },
                              'E': { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', hoverBg: 'hover:bg-pink-500/30' },
                              'F': { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', hoverBg: 'hover:bg-indigo-500/30' },
                              'G': { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', hoverBg: 'hover:bg-teal-500/30' },
                              'H': { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', hoverBg: 'hover:bg-rose-500/30' },
                              'I': { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/30' },
                              'J': { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', hoverBg: 'hover:bg-amber-500/30' },
                              'K': { bg: 'bg-lime-500/20', border: 'border-lime-500/30', text: 'text-lime-400', hoverBg: 'hover:bg-lime-500/30' },
                              'L': { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', hoverBg: 'hover:bg-violet-500/30' },
                              'M': { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400', hoverBg: 'hover:bg-sky-500/30' },
                              'N': { bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', hoverBg: 'hover:bg-fuchsia-500/30' },
                              'O': { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/30' },
                              'P': { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', hoverBg: 'hover:bg-red-500/30' },
                              'Q': { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', hoverBg: 'hover:bg-green-500/30' }
                            }
                            return colorMap[sectionLetter] || { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', hoverBg: 'hover:bg-slate-500/30' }
                          }
                          
                          const colors = getSectionColors(section)
                          const isSelected = selectedSection === section
                          
                          return (
                            <button
                              key={section}
                              onClick={() => setSelectedSection(section === selectedSection ? 'all' : section)}
                              className={`text-center p-3 rounded-lg border transition-all duration-200 cursor-pointer ${colors.bg} ${colors.border} ${colors.hoverBg} ${
                                isSelected ? 'ring-2 ring-white ring-opacity-50 scale-105' : ''
                              }`}
                            >
                              <div className={`text-2xl font-bold ${colors.text}`}>
                                {sectionStudents.length}
                              </div>
                              <div className="text-sm text-slate-300">Section {section}</div>
                              <div className="text-xs text-slate-400 mt-1">
                                {sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      {/* Section Summary */}
                      <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                        <p className="text-xs text-slate-400">
                          Total students: {students.length} | 
                          Sections: {Array.from(new Set(students.map(s => s.section))).sort().join(', ')} | 
                          Section Q: {students.filter(s => s.section === 'Q').length} students
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Students Table */}
                  <div className="lg:col-span-1">
                    <div className="card relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-700/50"></div>
                      <div className="relative z-10">
                        <div className="flex items-center space-x-3 mb-6">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">Students List</h3>
                            <p className="text-slate-400 text-sm">
                            Showing {filteredStudents.length} students in Section {selectedSection}
                            </p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                          <table className="w-full table-fixed">
                            <thead className="bg-gradient-to-r from-indigo-600/90 via-blue-600/90 to-cyan-600/90">
                              <tr>
                                <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-32">
                                  Registration No
                                </th>
                                <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-48">
                                  Name
                                </th>
                                <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                  Email
                                </th>
                                <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                                  LeetCode ID
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                              {filteredStudents.map((student, index) => (
                                  <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-cyan-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                    <td className="px-4 py-4 text-sm font-mono text-indigo-300 font-medium truncate">
                                      {student.reg_no}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-white font-semibold truncate">
                                      {student.name}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-300 truncate" title={student.email}>
                                      <span className="hover:text-white transition-colors cursor-help">
                                      {student.email}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm font-mono text-cyan-300 font-medium truncate">
                                      {student.leetcode_contest_id || 'N/A'}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {polls.map((poll) => (
                      <div key={poll.id} className="card p-4 hover:bg-slate-700/50 transition-colors cursor-pointer relative" 
                          onClick={() => {
                            setSelectedPoll(poll)
                            if (poll.isGrouped && poll.sections && poll.sections.length > 0) {
                              setSelectedPollSection(poll.sections[0])
                              fetchPollResponses(poll.id, poll.sections[0])
                            } else {
                              // For single-section polls, don't pass a targetSection to avoid over-filtering
                              const sectionFromClass = poll.class_name?.split(' ')[1] || 'A'
                              setSelectedPollSection(sectionFromClass)
                              fetchPollResponses(poll.id)
                            }
                            setActiveTab('analytics')
                          }}>
                        {/* Action Icons - Top Right 2x2 Grid */}
                        <div className="absolute top-3 right-3 grid grid-cols-2 gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedPoll(poll)
                              if (poll.isGrouped && poll.sections && poll.sections.length > 0) {
                                setSelectedPollSection(poll.sections[0])
                                fetchPollResponses(poll.id, poll.sections[0])
                              } else {
                                const sectionFromClass = poll.class_name?.split(' ')[1] || 'A'
                                setSelectedPollSection(sectionFromClass)
                                fetchPollResponses(poll.id)
                              }
                              setActiveTab('analytics')
                            }}
                            className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                            title="View Responses"
                          >
                            <Eye className="w-4 h-4 text-slate-300 hover:text-white" />
                          </button>
                          {poll.staff_id === hodData.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingPoll(poll)
                                setShowEditPoll(true)
                              }}
                              className="p-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-lg transition-colors"
                              title="Edit Poll"
                            >
                              <Edit className="w-4 h-4 text-green-400 hover:text-green-300" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              exportPollResponsesWithFaculty(poll)
                            }}
                            className="p-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-lg transition-colors"
                            title="Export Data"
                          >
                            <Download className="w-4 h-4 text-green-400 hover:text-green-300" />
                          </button>
                          {poll.staff_id === hodData.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeletePoll(poll.id)
                              }}
                              disabled={deletingPolls.has(poll.id)}
                              className="p-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                          {/* Removed one-section delete control */}
                        </div>

                        <div className="space-y-4 pr-24">
                          {/* Poll Title */}
                          <h3 className="text-xl font-bold text-white leading-tight">
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
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-400 font-semibold text-base">Scope:</span>
                              {poll.isGrouped ? (
                                <span className="text-slate-200 font-medium">Multi-section ({poll.totalSections || 0} sections)</span>
                              ) : (
                                <span className="text-slate-200 font-medium">Single section</span>
                              )}
                            </div>
                            <div className="flex items-start space-x-2">
                              <span className="text-slate-400 font-semibold text-base">Sections:</span>
                              {poll.isGrouped ? (
                                <span className="text-slate-200 font-medium">
                                  {Array.isArray(poll.sections) && poll.sections.length > 0 ? poll.sections.join(', ') : '—'}
                                </span>
                              ) : (
                                <span className="text-slate-200 font-medium">{poll.class_name?.split(' ')[1] || '—'}</span>
                              )}
                            </div>
                            
                            {/* Category + Target row (two equal chips) */}
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
                              {typeof (poll as any).target_gender !== 'undefined' && (poll as any).target_gender !== null && (
                                (() => {
                                  const tg = (poll as any).target_gender
                                  const label = tg === 'all' ? 'All Students' : (tg === 'boys' ? 'Boys Only' : 'Girls Only')
                                  const dot = tg === 'all' ? 'bg-slate-400' : (tg === 'boys' ? 'bg-blue-400' : 'bg-pink-400')
                                  const pill = tg === 'all'
                                    ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                                    : (tg === 'boys' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-pink-500/20 text-pink-300 border-pink-500/40')
                                  return (
                                    <div className="flex items-center space-x-2 w-full">
                                      <span className={`w-2 h-2 rounded-full inline-block ${dot}`} />
                                      <span className={`px-3 py-1 rounded-full text-sm font-semibold border truncate w-full ${pill}`}>Target: {label}</span>
                                    </div>
                                  )
                                })()
                              )}
                            </div>
                            
                            
                            {/* Deadline Information */}
                            {poll.deadline && (
                              <div className="flex items-center space-x-2">
                                <span className="text-orange-400 text-sm">⏰</span>
                                <span className="text-orange-400 text-sm font-medium">Deadline:</span>
                                <span className="text-orange-300 text-sm font-semibold">{formatDeadline(poll.deadline)}</span>
                                {(() => {
                                  try {
                                    const now = new Date()
                                    const deadline = new Date(poll.deadline as any)
                                    return deadline < now
                                  } catch {
                                    return false
                                  }
                                })() && (
                                  <span className="ml-2 text-red-400 font-semibold text-sm">Expired</span>
                                )}
                              </div>
                            )}
                            {/* Target pill moved to the Category + Target row above */}
                            
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
                    {selectedPoll && (
                      <div className="mt-1">
                        <p className="text-slate-300">
                          Poll: {selectedPoll.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          Class: {selectedPoll?.isGrouped 
                            ? `${selectedPoll?.class_name?.split(' ')[0]} ${selectedPollSection}`
                            : selectedPoll.class_name
                          } | ID: {selectedPoll.id}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedPoll && (
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleExportResults(selectedPoll)}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export Basic</span>
                      </button>
                      <button
                        onClick={() => exportPollResponsesWithFaculty(selectedPoll)}
                        className="btn-accent flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export with Faculty</span>
                      </button>
                    </div>
                  )}
                </div>

                {!selectedPoll ? (
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Select a poll to view analytics</h3>
                    <p className="text-slate-300">Go to the Polls tab and click "View Analytics" on a poll.</p>
                  </div>
                ) : !selectedPoll.classStudents ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-500 mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-white mb-2">Loading poll data...</h3>
                    <p className="text-slate-300">Please wait while we fetch the poll details and student information.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Section Selector for Grouped Polls */}
                    {selectedPoll?.isGrouped && selectedPoll?.sections && (
                      <div className="card">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-white">Select Section to View</h3>
                          <div className="text-sm text-slate-400">
                            This poll spans {selectedPoll.totalSections} sections
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">

                          {selectedPoll.sections.map((section) => (
                            <button
                              key={section}
                              onClick={() => {
                                setSelectedPollSection(section)
                                // Fetch responses for specific section
                                fetchPollResponses(selectedPoll.id, section)
                              }}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                selectedPollSection === section
                                  ? 'bg-green-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              Section {section}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Compact response info + Refresh */}
                    <div className="card flex items-center justify-between">
                      <div className="text-sm text-slate-300">
                        <span className="text-green-400 font-semibold">Responded:</span> {responses.length} |
                        <span className="text-red-400 font-semibold"> Not Responded:</span> {Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)} |
                        <span className="text-blue-400 font-semibold"> Total:</span> {selectedPoll?.classStudents?.length || 0} |
                        <span className="text-purple-400 font-semibold"> Rate:</span> {(() => { const total = selectedPoll?.classStudents?.length || 0; return total > 0 ? Math.round((responses.length / total) * 100) : 0 })()}%
                        {selectedPoll?.isGrouped && (
                          <span className="text-xs text-slate-400 ml-2">(Section {selectedPollSection})</span>
                        )}
                      </div>
                      <button
                        onClick={() => selectedPoll && fetchPollResponses(selectedPoll.id, selectedPoll.isGrouped ? selectedPollSection : undefined)}
                        className="btn-accent flex items-center space-x-2 text-xs"
                        title="Refresh analytics"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {/* Individual Responses */}
                    <div className="card">
                      <h3 className="text-lg font-semibold text-white mb-4">Response Summary</h3>
                      {/* Chips like design counts */}
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="flex items-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-600 text-white text-xs mr-2">{responses.length}</span>
                          <span className="text-slate-300">Responded</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-600 text-white text-xs mr-2">{Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)}</span>
                          <span className="text-slate-300">Not Responded</span>
                        </div>
                      </div>
                      
                      {/* Option Counts Summary */}
                      {selectedPoll?.options && selectedPoll.options.length > 0 && (
                        <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
                          <h4 className="text-md font-medium text-white mb-3">
                            Option Counts 
                            {(() => {
                              const question = selectedPoll.title.toLowerCase()
                              const options = (selectedPoll.options as string[]).map(opt => opt.toLowerCase())
                              
                              const numericalKeywords = [
                                'how many', 'number of', 'problems solved', 'questions answered',
                                'score', 'points', 'marks', 'grade', 'level', 'difficulty',
                                'problems', 'questions', 'tasks', 'assignments', 'exercises'
                              ]
                              
                              const hasNumericalOptions = options.some(opt => 
                                /\d+/.test(opt) || 
                                ['none', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].some(word => opt.includes(word))
                              )
                              
                              const isAchievementQuestion = numericalKeywords.some(keyword => 
                                question.includes(keyword)
                              )
                              
                              if (isAchievementQuestion && hasNumericalOptions) {
                                return ' (Best Performance First)'
                              } else {
                                return ' (Lowest Count First)'
                              }
                            })()}
                          </h4>
                          

                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(() => {
                              // Calculate counts for each option - use both option_index and response text matching
                              const optionCounts = (selectedPoll?.options ?? []).map((option: string, index: number) => {
                                // Try to match by option_index first, then fall back to response text matching
                                let count = responses.filter(r => r.option_index === index).length
                                
                                // If no matches found by option_index, try matching by response text
                                if (count === 0) {
                                  count = responses.filter(r => {
                                    const text = (r.response || '').toLowerCase()
                                    const normalized = option.toLowerCase()
                                    return text === normalized || text.startsWith(`${normalized} -`)
                                  }).length
                                }
                                
                                return { option, index, count }
                              })
                              
                              // Smart sorting based on poll question context
                              const shouldSortDescending = () => {
                                const question = selectedPoll.title.toLowerCase()
                                const options = (selectedPoll?.options ?? []).map((opt: string) => opt.toLowerCase())
                                
                                // Check if this is a numerical/achievement question
                                const numericalKeywords = [
                                  'how many', 'number of', 'problems solved', 'questions answered',
                                  'score', 'points', 'marks', 'grade', 'level', 'difficulty',
                                  'problems', 'questions', 'tasks', 'assignments', 'exercises'
                                ]
                                
                                // Check if options contain numbers or represent quantities
                                const hasNumericalOptions = options.some(opt => 
                                  /\d+/.test(opt) || 
                                  ['none', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].some(word => opt.includes(word))
                                )
                                
                                // Check if question asks about achievement/performance
                                const isAchievementQuestion = numericalKeywords.some(keyword => 
                                  question.includes(keyword)
                                )
                                
                                return isAchievementQuestion && hasNumericalOptions
                              }
                              
                              // Sort based on context
                              if (shouldSortDescending()) {
                                // For achievement questions: sort by count in descending order (highest first)
                                optionCounts.sort((a, b) => b.count - a.count)
                              } else {
                                // For preference/opinion questions: sort by count in ascending order (lowest first)
                                optionCounts.sort((a, b) => a.count - b.count)
                              }
                              
                              return optionCounts.map(({ option, index, count }) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg border border-slate-500">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-secondary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                      {index + 1}
                                    </div>
                                    <span className="text-slate-200 font-medium">{option}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-secondary-400">{count}</div>
                                    <div className="text-xs text-slate-400">responses</div>
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                      )}
                      
                      <h3 className="text-lg font-semibold text-white mb-4">Individual Responses</h3>
                      
                      {/* Additional Info Row */}
                      <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <span className="text-slate-300">Targeted Class: </span>
                            <span className="text-white font-medium">
                              {selectedPoll?.isGrouped 
                                ? `${selectedPoll?.class_name?.split(' ')[0]} ${selectedPollSection}`
                                : selectedPoll?.class_name
                              }
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-300">Total Students: </span>
                            <span className="text-white font-medium">{selectedPoll?.classStudents?.length || 0}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-slate-300">Response Rate: </span>
                            <span className="text-white font-medium">
                              {(selectedPoll?.classStudents?.length || 0) > 0 ? Math.round((responses.length / (selectedPoll?.classStudents?.length || 1)) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tabs for Responses and Non-Responders */}
                      <div className="mb-4">
                        <div className="flex space-x-1 bg-slate-700 p-1 rounded-lg">
                          <button
                            onClick={() => setActiveTab('analytics')}
                            className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors bg-secondary-500/20 text-secondary-400 border border-secondary-500/30"
                          >
                            Responses ({responses.length})
                          </button>
                          <button
                            onClick={() => setActiveTab('analytics')}
                            className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-slate-600"
                          >
                            Non-Responders ({Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)})
                          </button>
                        </div>
                      </div>

                      {/* Side by Side Tables Layout */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
                        {/* Left Side: Responded Students */}
                        <div className="min-w-0">
                          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                            <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3"></div>
                            Students Who Responded ({responses.length})
                          </h4>
                          <div className="overflow-x-auto">
                            <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                              <table className="w-full">
                                <thead className="bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90">
                                  <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                      Student
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                      Response
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/3">
                                      Time
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                  {responses && responses.length > 0 ? (
                                    responses.map((response, index) => (
                                      <tr key={response.id} className={`hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-teal-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                        <td className="px-6 py-4 text-sm text-white font-medium">
                                          {response.student_name}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-200">
                                          {response.response}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-emerald-300">
                                          {formatRespondedAt(response.responded_at)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={3} className="px-6 py-4 text-center text-sm text-slate-400">
                                        No responses found for this poll. Check console for debugging information.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Non-Responders */}
                        <div className="min-w-0">
                          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                            <div className="w-3 h-3 bg-amber-400 rounded-full mr-3"></div>
                            Students Who Haven't Responded ({Math.max(0, (selectedPoll?.classStudents?.length || 0) - responses.length)})
                          </h4>
                          

                          
                          {selectedPoll?.classStudents && selectedPoll.classStudents.length > 0 ? (
                            <div className="overflow-x-auto">
                              <div className="rounded-xl overflow-hidden border border-slate-600/50 shadow-lg">
                                <table className="w-full">
                                  <thead className="bg-gradient-to-r from-amber-600/90 via-orange-600/90 to-red-600/90">
                                    <tr>
                                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-1/4">
                                        Student
                                      </th>
                                      <th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider w-1/4">
                                        Registration No
                                      </th>
                                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider w-2/4">
                                        Email
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-gradient-to-b from-slate-900/95 to-slate-800/95">
                                    {(selectedPoll?.classStudents || [])
                                      .filter(student => !responses.some(r => r.student_reg_no === student.reg_no))
                                      .map((student, index) => (
                                        <tr key={student.reg_no} className={`hover:bg-gradient-to-r hover:from-amber-500/10 hover:to-orange-500/10 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-700/30'}`}>
                                          <td className="px-6 py-4 text-sm text-white font-medium">
                                            {student.name}
                                          </td>
                                          <td className="text-sm text-cyan-300 font-mono">
                                            {student.reg_no}
                                          </td>
                                          <td className="px-6 py-4 text-sm text-slate-300 break-all">
                                            {student.email}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 bg-slate-700/50 rounded-lg border border-slate-600">
                              <p className="text-slate-400">No class students data available</p>
                            </div>
                          )}
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
            hodData={hodData}
            onClose={() => setShowCreatePoll(false)}
            onPollCreated={() => {
              setShowCreatePoll(false)
              fetchDepartmentData(hodData)
              toast.success('Poll created successfully!')
            }}
          />
        )}

        {/* Edit Poll Modal */}
        {showEditPoll && editingPoll && (
          <EditPollModal
            poll={editingPoll}
            hodData={hodData}
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
        )}
      </div>
    )
  }

  // Create Poll Modal Component for HOD
  function CreatePollModal({ 
    hodData, 
    onClose, 
    onPollCreated 
  }: { 
    hodData: any
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
    const [linkUrl, setLinkUrl] = useState('')
    const [gFormLink, setGFormLink] = useState('')
    const [absentReason, setAbsentReason] = useState('State reason for absenteeism')
    const [selectedSections, setSelectedSections] = useState<string[]>([])
    const [availableSections, setAvailableSections] = useState<string[]>([])
    const [isLoadingSections, setIsLoadingSections] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [showTemplateSelection, setShowTemplateSelection] = useState(true)
    const [currentStep, setCurrentStep] = useState(1)
    const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
    const [isScheduled, setIsScheduled] = useState(false)
    const [scheduledDate, setScheduledDate] = useState('')
    const [scheduledTime, setScheduledTime] = useState('')

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

    useEffect(() => {
      const fetchSections = async () => {
        if (!hodData?.department) return
        setIsLoadingSections(true)
        try {
          const { data, error } = await supabase
            .from('classes')
            .select('section')
            .eq('department', hodData.department)
            .order('section', { ascending: true })

          if (error) throw error
          const sectionsRaw: string[] = (data || [])
            .map((c: any) => String(c.section))
            .filter((s: string) => !!s && s.trim().length > 0)
          const uniqueSections: string[] = Array.from(new Set<string>(sectionsRaw))
          setAvailableSections(uniqueSections)
          setSelectedSections((prev) => prev.filter((s) => uniqueSections.includes(s)))
        } catch (err) {
          console.error('Error fetching sections:', err)
          setAvailableSections([])
        } finally {
          setIsLoadingSections(false)
        }
      }
      fetchSections()
    }, [hodData?.department])

    const addOption = () => {
      if (options.length < 5) {
        setOptions([...options, ''])
      }
    }

    const removeOption = (index: number) => {
      if (options.length > 1) {
        setOptions(options.filter((_, i) => i !== index))
      }
    }

    const updateOption = (index: number, value: string) => {
      const newOptions = [...options]
      newOptions[index] = value
      setOptions(newOptions)
    }

    // Reset options when category changes
    const handleCategoryChange = (category: 'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'Problems Solved' | 'CodeChef Attendance') => {
      setPollCategory(category)
      setCurrentStep(2)
      setFormErrors({})
      // Reset title and options when changing category
      const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      if (category === 'Attendance') {
        setContestType((prev) => prev || 'weekly')
        setOptions(['Present', 'Absent'])
        setTitle(`LeetCode Attendance Weekly ${now}`)
      } else if (category === 'CodeChef Attendance') {
        setOptions(['Present', 'Absent'])
        setTitle(`CodeChef Attendance ${now}`)
      } else if (category === 'Problems Solved') {
        setOptions(['0', '1', '2', '3', '4', 'Absent'])
        setTitle(`Problems Solved ${now}`)
      } else if (category === 'Hackathon') {
        setOptions(['Participated', 'Not Participated'])
        setTitle('')
      } else if (category === 'G-Form Poll') {
        setOptions(['Submitted', 'Not Submitted'])
        setTitle('')
      } else {
        setOptions(['Yes', 'No'])
        setTitle('')
      }
    }

    const validateForm = () => {
      const errors: {[key: string]: string} = {}
      if (!title.trim()) {
        errors.title = 'Poll title is required'
      }
      if (selectedSections.length === 0) {
        errors.sections = 'Please select at least one section'
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
        console.log('Creating poll with HOD data:', { id: hodData.id, name: hodData.name, email: hodData.email })
        // Get class IDs for all selected sections
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select('id, section')
          .eq('department', hodData.department)
          .in('section', selectedSections)

        if (classesError) throw classesError

        // Calculate auto-delete time based on poll category
        const now = new Date()
        let autoDeleteDays = 2
        if (pollCategory === 'Attendance' || pollCategory === 'CodeChef Attendance' || pollCategory === 'Problems Solved') {
          autoDeleteDays = 1
        }
        
        // Calculate auto-delete timestamp
        const autoDeleteTime = new Date(now.getTime() + autoDeleteDays * 24 * 60 * 60 * 1000).toISOString()

        // Create deadline timestamp - if only date provided, set to 11:59pm of that date
        let deadlineAt: string | null = null
        if (deadlineDate && deadlineTime) {
          deadlineAt = new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
        } else if (deadlineDate) {
          deadlineAt = new Date(`${deadlineDate}T23:59:59`).toISOString()
        }
        // Keep deadline empty unless explicitly chosen

        const pollCommon = {
          title: (() => {
            const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            if (pollCategory === 'Attendance' && contestType) {
              return `LeetCode Attendance ${contestType.charAt(0).toUpperCase() + contestType.slice(1)} ${now}`
            } else if (pollCategory === 'CodeChef Attendance') {
              return `CodeChef Attendance ${now}`
            } else if (pollCategory === 'Problems Solved') {
              return `Problems Solved ${now}`
            } else {
              return title.trim()
            }
          })(),
            staff_id: hodData.id, // Debug: Using HOD ID
            poll_type: 'options',
            // Map CodeChef to Attendance for DB constraint compatibility
            poll_category: (pollCategory === 'CodeChef Attendance') ? 'Attendance' : pollCategory,
            options: options.filter(opt => opt.trim() !== ''),
            deadline_at: deadlineAt,
            // For Hackathon/G-Form, use gFormLink field
            link_url: (pollCategory === 'Hackathon' || pollCategory === 'G-Form Poll') ? (gFormLink.trim() || null) : (linkUrl.trim() || null),
          contest_type: contestType,
            auto_delete_days: autoDeleteDays,
            auto_delete_at: autoDeleteTime,
            target_gender: targetGender
          }
        // Create one poll per class
        for (const klass of classesData as any[]) {
          const pollData = { ...pollCommon, class_id: klass.id }
          const { error } = await supabase.from('polls').insert(pollData)
          if (error) throw error
        }

        setTitle('')
        setOptions(['Present', 'Absent'])
        setPollCategory('General Poll')
        setContestType(null)
        setTargetGender('all')
        setDeadlineDate('')
        setDeadlineTime('')
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
                <p className="text-slate-300 text-sm mt-2">Please wait while we set up your poll</p>
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
                      onClick={() => handleCategoryChange(template.value as any)}
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
                            return title
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
                          <div key={index} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg flex-shrink-0">
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
                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {/* Sections (multi-select) */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Sections (choose one or more)
              </label>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                          {isLoadingSections ? 'Loading sections…' : `Selected: ${selectedSections.length}`}
                        </div>
                <button
                  type="button"
                  onClick={() => {
                            const all = availableSections
                            setSelectedSections(selectedSections.length === all.length ? [] : all)
                          }}
                          className="px-3 py-1 rounded-md text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600"
                          disabled={isSubmitting}
                        >
                          {availableSections.length > 0 && selectedSections.length === availableSections.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
                      <div className="grid grid-cols-6 gap-2">
                        {(availableSections || []).map((sec) => {
                          const isSelected = selectedSections.includes(sec)
                  return (
                    <button
                              key={sec}
                      type="button"
                              onClick={() => setSelectedSections((prev) => prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec])}
                              className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'}`}
                              disabled={isSubmitting}
                            >
                              {sec}
                    </button>
                  )
                })}
              </div>
                      
                  {formErrors.sections && (
                        <p className="mt-2 text-sm text-red-400">{formErrors.sections}</p>
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

  // Edit Poll Modal Component for HOD
  function EditPollModal({ 
    poll, 
    hodData, 
    onClose, 
    onPollUpdated 
  }: { 
    poll: Poll
    hodData: any
    onClose: () => void
    onPollUpdated: () => void
  }) {
    const [title, setTitle] = useState(poll.title)
    const [pollCategory, setPollCategory] = useState<'General Poll' | 'Hackathon' | 'G-Form Poll' | 'Attendance' | 'CodeChef Attendance' | 'Problems Solved'>(poll.poll_category as any || 'General Poll')
    const [contestType, setContestType] = useState<'weekly' | 'biweekly' | null>(null)
    const [targetGender, setTargetGender] = useState<'all' | 'boys' | 'girls'>(poll.target_gender as any || 'all')
    const [options, setOptions] = useState(poll.options || ['Yes', 'No'])
    const [deadlineDate, setDeadlineDate] = useState(
      poll.deadline ? new Date(poll.deadline).toISOString().split('T')[0] : ''
    )
    const [deadlineTime, setDeadlineTime] = useState(
      poll.deadline ? new Date(poll.deadline).toTimeString().split(' ')[0].slice(0, 5) : ''
    )
    const [linkUrl, setLinkUrl] = useState(poll.link_url || '')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [autoDeleteDays, setAutoDeleteDays] = useState<number>(
      (poll as any).auto_delete_days === 1000 ? 1000 : ((poll as any).auto_delete_days ?? ((poll.poll_category === 'Attendance' || (poll.poll_category as any) === 'CodeChef Attendance' || poll.poll_category === 'Problems Solved') ? 1 : 2))
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
      if (options.length > 1) {
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
          target_gender: targetGender,
          auto_delete_days: autoDeleteDays,
          auto_delete_at: autoDeleteDays === 1000 ? new Date(now.getTime() + 1000 * 24 * 60 * 60 * 1000).toISOString() : autoDeleteTime,
          last_modified_at: now.toISOString()
        }
        
        console.log('Updating poll with data:', updateData)

        // Update entire grouped set: match by title + staff_id (timestamps may differ)
        const { error } = await supabase
          .from('polls')
          .update(updateData)
          .eq('title', poll.title)
          .eq('staff_id', poll.staff_id as any)

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
          className="bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-slate-700"
        >
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
          
          <form onSubmit={handleSubmit} className="space-y-8">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Poll Options - Show for all categories */}
              <div className="lg:col-span-2">
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
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          disabled={isSubmitting}
                          className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

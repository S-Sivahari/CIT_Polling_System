import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function getCurrentTime() {
  // Return current time in local timezone instead of UTC
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function getCurrentTimeIST() {
  // Get current time in Indian Standard Time (IST)
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset)
  
  const year = istTime.getUTCFullYear()
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(istTime.getUTCDate()).padStart(2, '0')
  const hours = String(istTime.getUTCHours()).padStart(2, '0')
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function getCurrentTimeForDisplay() {
  // Get current time formatted for display
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata' // Indian Standard Time
  })
}

export function isPollExpired(deadline: string | null) {
  if (!deadline) return false
  
  // Since deadline is now time without timezone (HH:MM:SS), 
  // we need to compare it with current time
  const now = new Date()
  const currentTime = now.toTimeString().split(' ')[0] // HH:MM:SS
  
  return currentTime > deadline
}

export function getTimeRemaining(deadline: string) {
  if (!deadline) return 'No deadline'
  
  // Since deadline is now time without timezone (HH:MM:SS),
  // we need to calculate remaining time based on current time
  const now = new Date()
  const currentTime = now.toTimeString().split(' ')[0] // HH:MM:SS
  
  // Parse times to compare
  const [currentHour, currentMin] = currentTime.split(':').map(Number)
  const [deadlineHour, deadlineMin] = deadline.split(':').map(Number)
  
  let diffHours = deadlineHour - currentHour
  let diffMinutes = deadlineMin - currentMin
  
  // Handle day rollover (if deadline is tomorrow)
  if (diffHours < 0) {
    diffHours += 24
  }
  if (diffMinutes < 0) {
    diffMinutes += 60
    diffHours -= 1
  }
  
  if (diffHours <= 0 && diffMinutes <= 0) return 'Expired'
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m remaining`
  } else {
    return `${diffMinutes}m remaining`
  }
}

// New function to handle created_at as time without timezone
export function formatCreatedAt(createdAt: string | null) {
  if (!createdAt) return 'Unknown'
  
  try {
    // If it's just time (HH:MM:SS), add today's date
    if (createdAt.includes('T') || createdAt.includes(' ')) {
      // It's a full timestamp, format normally
      return new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      // It's just time, add today's date
      const today = new Date()
      const timeOnly = new Date(`${today.toISOString().split('T')[0]}T${createdAt}`)
      return timeOnly.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  } catch (error) {
    return 'Invalid date'
  }
}

// New function to handle deadline as time without timezone
export function formatDeadline(deadline: string | null) {
  if (!deadline) return 'No deadline'
  
  try {
    // If it's a full ISO timestamp with date part, format directly
    if (typeof deadline === 'string' && (deadline.includes('T') || deadline.includes('Z') || /\d{4}-\d{2}-\d{2}/.test(deadline))) {
      const d = new Date(deadline)
      if (isNaN(d.getTime())) return String(deadline)
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      })
    }
    // Else if it's just time (HH:MM or HH:MM:SS), add today's date and format nicely
    if (deadline.includes(':')) {
      const today = new Date()
      const [hours, minutes] = deadline.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      
      // Format as "Jan 15, 2:30 PM" (current date + stored time)
      return `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${displayHour}:${minutes} ${ampm}`
    } else {
      return deadline
    }
  } catch (error) {
    return 'Invalid time'
  }
}

// Function to handle responded_at as timestamp with timezone
export function formatRespondedAt(respondedAt: string | null) {
  if (!respondedAt) return 'Unknown'
  
  try {
    // Parse the timestamp - handle different timestamp formats
    let date: Date
    
    // If it's already in ISO format with timezone, parse directly
    if (typeof respondedAt === 'string' && (respondedAt.includes('+') || respondedAt.includes('Z'))) {
      date = new Date(respondedAt)
    } else {
      // For other formats, parse as UTC and convert
      date = new Date(respondedAt)
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', respondedAt)
      // Return the original value if formatting fails
      return String(respondedAt)
    }
    
    // Format using Intl.DateTimeFormat for better browser support - NO YEAR
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    const result = formatter.format(date)
    return result
  } catch (error) {
    console.error('Error formatting responded_at:', error, 'Input:', respondedAt)
    // Return the original value if formatting fails
    return String(respondedAt)
  }
}

// Function to format time in 7:38pm format for easier reading
export function formatTimeSimple(timestamp: string | null) {
  if (!timestamp) return 'Unknown'
  
  try {
    const date = new Date(timestamp)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid time'
    }
    
    // Format as "7:38pm" using IST timezone
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata', // IST timezone
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch (error) {
    console.error('Error formatting time:', error, 'Input:', timestamp)
    return 'Invalid time'
  }
}

// Function to format date without year
export function formatDateNoYear(timestamp: string | null) {
  if (!timestamp) return 'Unknown'
  
  try {
    const date = new Date(timestamp)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    // Format date without year
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', timestamp)
    return 'Invalid date'
  }
}

// Function to format date and time without year
export function formatDateTimeNoYear(timestamp: string | null) {
  if (!timestamp) return 'Unknown'
  
  try {
    const date = new Date(timestamp)
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    // Format date and time without year
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch (error) {
    console.error('Error formatting date time:', error, 'Input:', timestamp)
    return 'Invalid date'
  }
}

// Function to get auto-delete countdown in hours
export function getAutoDeleteHours(autoDeleteAt: string | null, autoDeleteDays: number = 0) {
  // If autoDeleteDays is 1000, it's a permanent poll
  if (autoDeleteDays === 1000) return 'Auto-delete: Never'
  
  if (!autoDeleteAt) return 'Auto-delete not set'
  
  try {
    const deleteTime = new Date(autoDeleteAt)
    const now = new Date()
    const timeRemaining = deleteTime.getTime() - now.getTime()
    
    if (timeRemaining <= 0) {
      return 'Poll will be deleted soon'
    }
    
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  } catch (error) {
    return 'Invalid auto-delete time'
  }
}

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  const XLSX = require('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  
  // Format filename with title + date
  const formattedFilename = formatExportFilename(filename)
  XLSX.writeFile(wb, `${formattedFilename}.xlsx`)
}

export function exportToExcelWithMultipleSheets(sheets: { name: string, data: any[] }[], filename: string) {
  const XLSX = require('xlsx')
  const wb = XLSX.utils.book_new()
  
  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  })
  
  // Format filename with title + date
  const formattedFilename = formatExportFilename(filename)
  XLSX.writeFile(wb, `${formattedFilename}.xlsx`)
}

// Helper function to sanitize filename by removing invalid characters
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
    .trim()
}

// Helper function to format export filename with title + date
export function formatExportFilename(title: string): string {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  const dateStr = `${day}_${month}_${year}`
  
  return `${sanitizeFilename(title)}_${dateStr}`
}

export function getRoleFromDesignation(designation: string) {
  switch (designation) {
    case 'HOD':
      return 'hod'
    case 'CA':
      return 'faculty'
    case 'CDC':
      return 'cdc'
    default:
      return 'faculty'
  }
}

export function getAccessLevel(role: string) {
  switch (role) {
    case 'student':
      return 1
    case 'faculty':
      return 2
    case 'hod':
      return 3
    case 'cdc':
      return 4
    default:
      return 0
  }
}

// New function to format deadline date for display
export function formatDeadlineDate(deadlineDate: string | null, deadlineTime: string | null) {
  if (!deadlineDate) return 'No deadline set'
  
  try {
    const date = new Date(deadlineDate)
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    if (deadlineTime) {
      const [hours, minutes] = deadlineTime.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      return `${formattedDate} at ${displayHour}:${minutes} ${ampm}`
    }
    
    return formattedDate
  } catch (error) {
    return 'Invalid deadline'
  }
}

// New function to get auto-delete countdown for faculty dashboard
export function getAutoDeleteCountdown(autoDeleteAt: string | null, autoDeleteDays: number = 0) {
  // If autoDeleteDays is 1000, it's a permanent poll
  if (autoDeleteDays === 1000) return 'Auto-delete: Never'
  
  if (!autoDeleteAt) return 'Auto-delete not set'
  
  try {
    const deleteTime = new Date(autoDeleteAt)
    const now = new Date()
    const timeRemaining = deleteTime.getTime() - now.getTime()
    
    if (timeRemaining <= 0) {
      return 'Poll will be deleted soon'
    }
    
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h ${minutes}m until auto-delete`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m until auto-delete`
    } else {
      return `${minutes}m until auto-delete`
    }
  } catch (error) {
    return 'Invalid auto-delete time'
  }
}

// New function to check if poll is near auto-delete (within 1 hour)
export function isNearAutoDelete(autoDeleteAt: string | null) {
  if (!autoDeleteAt) return false
  
  try {
    const deleteTime = new Date(autoDeleteAt)
    const now = new Date()
    const timeRemaining = deleteTime.getTime() - now.getTime()
    
    // Return true if less than 1 hour remaining
    return timeRemaining <= 60 * 60 * 1000 && timeRemaining > 0
  } catch (error) {
    return false
  }
}

// New function to get auto-delete warning message
export function getAutoDeleteWarning(autoDeleteDays: number, pollCategory: string) {
  if (pollCategory === 'Attendance' || pollCategory === 'Problems Solved') {
    return `⚠️ This poll will be automatically deleted in 24 hours (${autoDeleteDays} day)`
  } else {
    return `⚠️ This poll will be automatically deleted in 48 hours (${autoDeleteDays} days)`
  }
}

// New function to format last modified time
export function formatLastModified(lastModified: string | null) {
  if (!lastModified) return 'Never modified'
  
  try {
    const modified = new Date(lastModified)
    const now = new Date()
    const diffMs = now.getTime() - modified.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    
    return modified.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch (error) {
    return 'Invalid date'
  }
}

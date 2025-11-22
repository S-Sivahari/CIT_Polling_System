import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const now = new Date().toISOString()
    
    // Check for polls that have passed their auto_delete_at timestamp
    const { data: autoDeletePolls, error: autoDeleteError } = await supabase
      .from('polls')
      .select('id, title, auto_delete_at')
      .lt('auto_delete_at', now)
    
    console.log('Polls being considered for auto-delete:', autoDeletePolls)
    
    if (autoDeleteError) {
      console.error('Error checking auto-delete polls:', autoDeleteError)
    }
    
    // Check for polls that have passed their deadline_at timestamp (for info only)
    const { data: deadlinePolls, error: deadlineError } = await supabase
      .from('polls')
      .select('id, title, deadline_at')
      .lt('deadline_at', now)
    
    if (deadlineError) {
      console.error('Error checking deadline polls:', deadlineError)
    }
    
    const expiredCount = autoDeletePolls?.length || 0 // Only count auto-delete for cleanup
    
    return NextResponse.json({
      success: true,
      expiredPolls: expiredCount,
      autoDeletePolls: autoDeletePolls || [],
      deadlinePolls: deadlinePolls || [] // Info only, not for deletion
    })
    
  } catch (error) {
    console.error('Error in cleanup-polls GET API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check expired polls' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const now = new Date().toISOString()
    
    // Only delete polls that have passed their auto_delete_at timestamp
    // Deadline polls should remain visible to faculty/HOD but hidden from students
    const { data: autoDeletePolls, error: autoDeleteError } = await supabase
      .from('polls')
      .delete()
      .lt('auto_delete_at', now)
      .select('id, title')
    
    console.log('Polls being deleted:', autoDeletePolls)
    
    if (autoDeleteError) {
      console.error('Error deleting auto-delete polls:', autoDeleteError)
    }
    
    const deletedCount = autoDeletePolls?.length || 0
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} auto-delete polls`,
      autoDeletedPolls: autoDeletePolls?.length || 0,
      deadlineDeletedPolls: 0 // No longer deleting deadline polls
    })
    
  } catch (error) {
    console.error('Error in cleanup-polls API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cleanup polls' },
      { status: 500 }
    )
  }
}

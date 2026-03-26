"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "@/app/(app)/actions/notifications"
import { useFocusTrap, useEscapeKey } from "@/hooks/useAccessibility"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "repair_completed" || type === "repair_ready") {
    return (
      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    )
  }
  if (type === "job_completed") {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </div>
    )
  }
  if (type === "sale_created") {
    return (
      <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
    )
  }
  if (type === "account_suspended" || type === "grace_period_24h") {
    return (
      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    )
  }
  // default
  return (
    <div className="w-8 h-8 rounded-full bg-stone-900/10 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    </div>
  )
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const focusTrapRef = useFocusTrap(open)
  
  // Close on Escape key
  useEscapeKey(() => setOpen(false), open)

  const fetchData = useCallback(async () => {
    const [notifRes, count] = await Promise.all([
      getNotifications(),
      getUnreadCount(),
    ])
    if (notifRes.data) setNotifications(notifRes.data as Notification[])
    setUnreadCount(count)
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  async function handleMarkAllRead() {
    setLoading(true)
    await markAllAsRead()
    await fetchData()
    setLoading(false)
  }

  async function handleMarkRead(id: string) {
    await markAsRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const displayed = notifications.slice(0, 20)

  // Keyboard navigation for notification list
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || displayed.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % displayed.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + displayed.length) % displayed.length)
        break
      case 'Home':
        e.preventDefault()
        setSelectedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setSelectedIndex(displayed.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        const selected = displayed[selectedIndex]
        if (selected?.link) {
          if (!selected.is_read) handleMarkRead(selected.id)
          setOpen(false)
        }
        break
    }
  }, [open, displayed, selectedIndex])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-lg hover:bg-stone-50 border border-stone-200 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="notification-menu"
      >
        <svg className="w-4 h-4 text-stone-900/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div 
          ref={focusTrapRef}
          id="notification-menu"
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-11 w-80 bg-white rounded-xl border border-stone-200 shadow-xl z-50 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
            <h3 className="font-semibold text-sm text-stone-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-amber-700 hover:text-amber-700/80 transition-colors disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div 
            className="overflow-y-auto max-h-[400px]"
            role="listbox"
            aria-label="Notification list"
          >
            {displayed.length === 0 ? (
              <div className="py-10 text-center text-sm text-stone-400" role="status">
                No notifications yet
              </div>
            ) : (
              displayed.map((n, index) => {
                const isSelected = index === selectedIndex
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 border-b border-stone-100 last:border-0 transition-colors ${
                      !n.is_read ? "bg-amber-700/5" : "hover:bg-stone-50/50"
                    } ${isSelected ? "ring-2 ring-inset ring-amber-500" : ""}`}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    <NotificationIcon type={n.type} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug truncate ${!n.is_read ? "font-semibold text-stone-900" : "text-stone-900/80"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-stone-500 truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-amber-700 flex-shrink-0 mt-1.5" aria-label="Unread" />
                    )}
                  </div>
                )

                if (n.link) {
                  return (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={() => { setOpen(false); if (!n.is_read) handleMarkRead(n.id) }}
                      className="block cursor-pointer"
                      role="option"
                      aria-selected={isSelected}
                      aria-label={`${n.title}${!n.is_read ? ', unread' : ''}, ${relativeTime(n.created_at)}`}
                    >
                      {content}
                    </Link>
                  )
                }
                return (
                  <div 
                    key={n.id} 
                    className="cursor-default"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`${n.title}${!n.is_read ? ', unread' : ''}, ${relativeTime(n.created_at)}`}
                  >
                    {content}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-stone-200 bg-stone-50/50">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-amber-700 hover:text-amber-700/80 transition-colors font-medium"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

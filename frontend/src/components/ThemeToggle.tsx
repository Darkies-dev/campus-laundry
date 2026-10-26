'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('campus_laundry_theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark')
      document.documentElement.classList.add('dark')
    } else {
      setTheme('light')
      document.documentElement.classList.remove('dark')
    }
  }, [])

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark')
      localStorage.setItem('campus_laundry_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('campus_laundry_theme', 'light')
    }
  }

  if (!mounted) {
    return (
      <div className="w-[82px] h-[32px] rounded-full bg-slate-100 dark:bg-[#151b17] border border-slate-200 dark:border-[#26332a] animate-pulse" />
    )
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      id="theme-toggle-btn"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`
        relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
        transition-all duration-200 ease-in-out cursor-pointer select-none border
        ${isDark
          ? 'bg-[#151b17] hover:bg-[#1c241f] active:bg-[#121714] text-[#e2e8e3] border-[#26332a] hover:border-[#374a3d]'
          : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
        }
      `}
    >
      <span className="flex items-center justify-center">
        {isDark ? (
          // Crescent Moon symbol for Dark Mode
          <svg
            className="w-3.5 h-3.5 text-[#a3c9a8] fill-[#a3c9a8]"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon for Light Mode
          <svg
            className="w-3.5 h-3.5 text-amber-500 fill-amber-400 stroke-amber-500"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.25" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M4.93 4.93l1.41 1.41" />
            <path d="M17.66 17.66l1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M6.34 17.66l-1.41 1.41" />
            <path d="M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </span>

      <span className="tracking-wide text-xs">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}

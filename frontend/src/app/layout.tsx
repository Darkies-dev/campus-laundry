import type { Metadata } from 'next'
import './globals.css'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'CampusLaundry — Hostel Laundry Management',
  description: 'College hostel laundry quota tracking, drop-off scheduling, and cycle management system.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('campus_laundry_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-slate-50 dark:bg-[#090c0a] text-slate-800 dark:text-[#f0f2f0] min-h-screen flex flex-col transition-colors duration-200">

        {/* Header */}
        <header className="bg-white/95 dark:bg-[#090c0a]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#1d2420] sticky top-0 z-40 transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-primary-800 dark:bg-[#1a261e] dark:border dark:border-[#2f4233] flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
                <span className="text-white dark:text-[#a3c9a8] text-sm font-bold tracking-tight">CL</span>
              </div>
              <span className="text-lg font-extrabold text-slate-800 dark:text-[#f0f2f0] tracking-tight">CampusLaundry</span>
            </a>

            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-400 dark:text-[#8a958d] font-mono hidden md:block">
                Fri, Oct 23, 2026
              </div>
              {/* Dark Mode Toggle */}
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-[#1d2420] bg-white dark:bg-[#090c0a] py-4 text-center text-xs text-slate-400 dark:text-[#6d7870] transition-colors duration-200">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1">
            <span>&copy; 2026 CampusLaundry System</span>
            <span>Policy: 30 Cycles/Year &middot; Standard Turnaround: 72 hrs</span>
          </div>
        </footer>

      </body>
    </html>
  )
}

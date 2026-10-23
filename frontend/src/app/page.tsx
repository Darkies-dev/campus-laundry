'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RoleSelectionPage() {
  const router = useRouter()
  const [studentInput, setStudentInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleStudentProceed = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentInput.trim()) {
      setErrorMsg('Please enter your Registration Number')
      return
    }
    router.push(`/student?reg=${encodeURIComponent(studentInput.trim().toUpperCase())}`)
  }

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center py-6">
      <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          CampusLaundry
        </h1>
        <p className="text-sm text-slate-400">
          College Hostel Laundry Management &bull; Quota Tracking &bull; Drop-offs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* STUDENT PORTAL CARD */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border-white/10 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Student Portal</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-slate-300">
                  Hostelers
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Check remaining cycles (30 quota limit), calculate laundry loads, track orders, and schedule drop-offs.
              </p>
            </div>

            {/* Quick Registration Input */}
            <form onSubmit={handleStudentProceed} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1">
                  Registration Number
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={studentInput}
                    onChange={(e) => {
                      setStudentInput(e.target.value.toUpperCase())
                      setErrorMsg('')
                    }}
                    placeholder="e.g. 2502050680"
                    className="flex-1 glass-input px-3 py-2.5 rounded-xl font-mono text-sm uppercase text-white font-bold tracking-wide focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-sage text-obsidian-950 font-bold text-xs uppercase tracking-wider hover:bg-sage-light transition-all"
                  >
                    Enter &rarr;
                  </button>
                </div>
                {errorMsg && <p className="text-[11px] text-terracotta mt-1">{errorMsg}</p>}
              </div>

              <div className="pt-2 text-[11px] text-slate-500">
                Enter your university-issued registration number to access your 30-cycle quota and order history.
              </div>
            </form>
          </div>

          <div className="pt-6 border-t border-white/5 mt-6 flex items-center justify-between text-xs text-slate-400">
            <span>Standard: 1 cycle up to 6.0kg</span>
            <span>Max 8.0kg (2 cycles)</span>
          </div>
        </div>

        {/* ADMIN PORTAL CARD */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border-white/10 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Hostel Admin &amp; Vendor Console</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-slate-300">
                  Staff Only
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                Campus overview: Active loads, student records, quota burn rate, drop point operations, and order lifecycle management.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="p-3 rounded-xl bg-obsidian-900 border border-white/5 text-xs text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hostel Blocks:</span>
                  <span className="font-semibold text-white">B1–B12, G1–G8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Privileges:</span>
                  <span className="font-semibold text-white">Status Stepper &amp; Database CRUD</span>
                </div>
              </div>

              <Link
                href="/admin"
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-obsidian-900 border border-white/10 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition-all"
              >
                <span>Launch Admin Dashboard</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 mt-6 flex items-center justify-between text-xs text-slate-400">
            <span>Live Cycle Stream</span>
            <span>Batch Control</span>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [regNumber, setRegNumber] = useState('')
  const [error, setError] = useState('')

  function handleStudentLogin(e: React.FormEvent) {
    e.preventDefault()
    const val = regNumber.trim().toUpperCase()
    if (!val) {
      setError('Please enter your registration number')
      return
    }
    if (val.length !== 10 || !/^\d{10}$/.test(val)) {
      setError('Registration number must be exactly 10 digits')
      return
    }
    router.push(`/student?reg=${encodeURIComponent(val)}`)
  }

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center py-6 sm:py-10">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          CampusLaundry
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8a958d] mt-2 font-medium">
          College Hostel Laundry Management &bull; Quota Tracking &bull; Drop-offs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

        {/* Student Portal Card */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">Student Portal</h2>
              <span className="badge badge-green">Hostelers</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8a958d] mb-6 leading-relaxed">
              Check remaining cycles (30 quota limit), calculate laundry loads, track orders, and schedule drop-offs.
            </p>

            <form onSubmit={handleStudentLogin} className="space-y-2 mb-4">
              <label className="text-[11px] font-bold text-slate-500 dark:text-[#8a958d] uppercase tracking-wider block">
                REGISTRATION NUMBER
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={regNumber}
                  onChange={(e) => {
                    setRegNumber(e.target.value.toUpperCase().replace(/\D/g, '').slice(0, 10))
                    setError('')
                  }}
                  placeholder="E.G. 2502050680"
                  className="input-field font-mono uppercase tracking-wider text-sm flex-1"
                  maxLength={10}
                />
                <button type="submit" className="btn btn-primary px-4 whitespace-nowrap text-xs font-bold tracking-wider uppercase">
                  ENTER &rarr;
                </button>
              </div>
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              <p className="text-[11px] text-slate-400 dark:text-[#6d7870] mt-2 leading-normal">
                Enter your university-issued registration number to access your 30-cycle quota and order history.
              </p>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1d2420] flex justify-between text-[11px] text-slate-400 dark:text-[#6d7870]">
            <span>Standard: 1 cycle up to 6.0kg</span>
            <span>Max 8.0kg (2 cycles)</span>
          </div>
        </div>

        {/* Hostel Admin & Vendor Console Card */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-base font-bold text-slate-800 dark:text-white">Hostel Admin &amp; Vendor Console</h2>
              <span className="badge badge-gray">Staff Only</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8a958d] mb-6 leading-relaxed">
              Campus overview: Active loads, student records, quota burn rate, drop point operations, and order lifecycle management.
            </p>

            <div className="bg-slate-50 dark:bg-[#0e1310] border border-slate-100 dark:border-[#1d2420] rounded-lg p-3 text-xs text-slate-600 dark:text-[#c5cec7] space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400 dark:text-[#6d7870]">Hostel Blocks:</span>
                <span className="font-semibold text-slate-700 dark:text-[#e0e6e2]">B1&ndash;B12, G1&ndash;G8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 dark:text-[#6d7870]">Privileges:</span>
                <span className="font-semibold text-slate-700 dark:text-[#e0e6e2]">Status Stepper &amp; Database CRUD</span>
              </div>
            </div>

            <Link
              href="/admin/login"
              className="btn btn-outline w-full uppercase tracking-wider font-bold text-xs py-2.5"
            >
              LAUNCH ADMIN DASHBOARD &rarr;
            </Link>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1d2420] flex justify-between text-[11px] text-slate-400 dark:text-[#6d7870]">
            <span>Live Cycle Stream</span>
            <span>Batch Control</span>
          </div>
        </div>

      </div>
    </div>
  )
}

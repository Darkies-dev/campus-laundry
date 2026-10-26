'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  fetchStudentQuota,
  fetchKiosks,
  fetchLaundryItems,
  submitDropOff,
  Student,
  Kiosk,
  LaundryItem,
  Transaction,
} from '@/lib/api'

function StudentDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialReg = searchParams.get('reg') || ''

  const [studentId, setStudentId] = useState<string>(initialReg)
  const [student, setStudent] = useState<Student | null>(null)
  const [studentOrders, setStudentOrders] = useState<Transaction[]>([])
  const [activeWashOrder, setActiveWashOrder] = useState<any | null>(null)
  const [canSubmitNew, setCanSubmitNew] = useState<boolean>(true)
  const [studentLoading, setStudentLoading] = useState<boolean>(false)
  const [studentError, setStudentError] = useState<string | null>(null)

  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [selectedKiosk, setSelectedKiosk] = useState<string>('')
  const [catalogItems, setCatalogItems] = useState<LaundryItem[]>([])

  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})
  const [remarks, setRemarks] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitResult, setSubmitResult] = useState<any>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'dropoff' | 'history' | 'kiosks'>('dropoff')

  useEffect(() => { loadGlobalData() }, [])
  useEffect(() => {
    if (studentId.trim()) loadStudentData(studentId)
  }, [studentId])

  async function loadGlobalData() {
    try {
      const [kioskList, itemRes] = await Promise.all([fetchKiosks(), fetchLaundryItems()])
      setKiosks(kioskList)
      if (kioskList.length > 0) {
        const active = kioskList.find((k) => k.Operational_Status === 'Active') || kioskList[0]
        setSelectedKiosk(active.Drop_Point_ID)
      }
      setCatalogItems(itemRes.items)
      setItemQuantities({})
    } catch (err: any) {
      console.error('Failed to load data:', err)
    }
  }

  async function loadStudentData(id: string) {
    setStudentLoading(true)
    setStudentError(null)
    try {
      const data = await fetchStudentQuota(id)
      setStudent(data.student)
      const orders = data.recent_orders || []
      setStudentOrders(orders)
      const active = data.active_order || orders.find((o: any) => {
        const s = (o.Status || '').toLowerCase()
        return s && s !== 'completed' && s !== 'cancelled'
      }) || null
      setActiveWashOrder(active)
      setCanSubmitNew(active === null)
    } catch (err: any) {
      setStudent(null)
      setStudentOrders([])
      setActiveWashOrder(null)
      setCanSubmitNew(true)
      setStudentError(err.message || 'Student not found.')
    } finally {
      setStudentLoading(false)
    }
  }

  const totalWeightKg = Object.entries(itemQuantities).reduce((sum, [itemId, qty]) => {
    const item = catalogItems.find((i) => i.Item_ID === itemId)
    return sum + (item ? item.Standard_Weight * qty : 0)
  }, 0)

  const isOverweight = totalWeightKg > 8.0
  const cyclesNeeded = totalWeightKg > 6.2 ? 2 : 1
  const totalItemsCount = Object.values(itemQuantities).reduce((a, b) => a + b, 0)

  function updateQuantity(itemId: string, delta: number) {
    setItemQuantities((prev) => {
      const current = prev[itemId] || 0
      const next = Math.max(0, current + delta)
      const updated = { ...prev, [itemId]: next }
      if (next === 0) delete updated[itemId]
      return updated
    })
  }

  async function handleDropOffSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitResult(null)

    if (totalItemsCount === 0) { setSubmitError('Add at least 1 item to your bag.'); return }
    if (isOverweight) { setSubmitError('Bag exceeds 8.0 kg limit.'); return }
    if (!student || student.cycle_remaining < cyclesNeeded) {
      setSubmitError(`Need ${cyclesNeeded} cycle(s) but only have ${student?.cycle_remaining ?? 0}.`)
      return
    }
    if (!selectedKiosk) { setSubmitError('Select a drop point.'); return }

    setSubmitting(true)
    try {
      const result = await submitDropOff({
        std_id: studentId,
        drop_point_id: selectedKiosk,
        items: Object.entries(itemQuantities).map(([item_id, quantity]) => ({ item_id, quantity })),
        remarks,
      })
      setSubmitResult(result)
      setItemQuantities({})
      setRemarks('')
      await loadStudentData(studentId)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit.')
    } finally {
      setSubmitting(false)
    }
  }

  const weightPercent = Math.min(100, (totalWeightKg / 8.0) * 100)

  return (
    <div className="space-y-6">

      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">Student Dashboard</h1>
          {student && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-500 dark:text-[#8a958d]">
                Welcome back, <span className="font-semibold text-slate-700 dark:text-[#e0e6e2]">{student.std_name}</span>
              </p>
              <span className="text-[11px] font-mono bg-slate-100 dark:bg-[#161c18] border border-slate-200 dark:border-[#26332a] rounded px-2 py-0.5 text-slate-600 dark:text-[#a3c9a8] font-bold">
                {studentId}
              </span>
            </div>
          )}
        </div>

        {/* Logout Option in place of old registration number position */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="btn btn-outline text-xs px-3 py-1.5 rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:bg-[#201515] dark:border-[#482020] dark:text-[#f87171] dark:hover:bg-[#2c1a1a] dark:active:bg-[#191010] flex items-center gap-1.5 transition-colors"
          title="Sign out of student portal"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      {studentError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {studentError}
        </div>
      )}

      {/* Overview Cards (Enlarged & Aligned to match reference) */}
      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Profile Card */}
          <div className="card p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 dark:text-[#8a958d] uppercase tracking-wider">
                  Student Profile
                </span>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-md bg-slate-100 dark:bg-[#161c18] border border-slate-200 dark:border-[#26332a] text-slate-700 dark:text-[#a3c9a8]">
                  {student.std_id}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight my-2">
                {student.std_name}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center my-3">
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-[#6d7870] uppercase tracking-wider mb-1">Hostel</div>
                <div className="text-2xl sm:text-3xl font-black text-primary-800 dark:text-[#a3c9a8] font-mono leading-none">{student.hostel}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-[#6d7870] uppercase tracking-wider mb-1">Room</div>
                <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white font-mono leading-none">{student.room}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-[#6d7870] uppercase tracking-wider mb-1">Year</div>
                <div className="text-lg sm:text-xl font-bold text-amber-500 dark:text-[#fde047] leading-none">{student.academic_year}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#1d2420] flex justify-between items-center text-xs text-slate-400 dark:text-[#8a958d]">
              <span>Contact Number</span>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-[#e0e6e2]">{student.contact}</span>
            </div>
          </div>

          {/* Quota / Washes Remaining Card */}
          <div className="card p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
            <div className="text-xs font-bold text-slate-400 dark:text-[#8a958d] uppercase tracking-wider mb-2">
              Washes Remaining
            </div>

            <div className="flex items-center gap-6 my-auto">
              {/* Enlarged Circular Gauge */}
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" strokeWidth="10" stroke="currentColor" className="text-slate-100 dark:text-[#19221b]" fill="transparent" />
                  <circle
                    cx="60" cy="60" r="48" strokeWidth="10" fill="transparent"
                    stroke={student.cycle_remaining <= 5 ? '#ef4444' : student.cycle_remaining <= 15 ? '#f59e0b' : '#a3c9a8'}
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - Math.max(0, student.cycle_remaining) / (student.quota || 30))}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white leading-none">
                    {student.cycle_remaining}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 dark:text-[#a3c9a8] uppercase tracking-wider mt-1">
                    REMAINING
                  </span>
                </div>
              </div>

              {/* Burn & Quota Stats */}
              <div className="space-y-3 flex-1">
                <div className="flex justify-between items-baseline text-xs sm:text-sm font-extrabold text-slate-700 dark:text-white">
                  <span className="uppercase tracking-wider">8-MONTH BURN</span>
                  <span className="text-amber-500 dark:text-[#fde047] font-black">{student.burn_percentage}%</span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-[#161c18] overflow-hidden">
                  <div
                    className="h-full bg-primary-800 dark:bg-[#a3c9a8] transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, student.burn_percentage)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                  <div className="bg-slate-50 dark:bg-[#151b17] rounded-lg p-2 border border-slate-100 dark:border-[#1d2420]">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-[#6d7870] uppercase">Used</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono mt-0.5">{student.cycle_used}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#151b17] rounded-lg p-2 border border-slate-100 dark:border-[#1d2420]">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-[#6d7870] uppercase">Quota</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white font-mono mt-0.5">{student.quota}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 dark:text-[#6d7870] pt-2 text-right">
              Recommended: ~3.75 washes / month
            </div>
          </div>

          {/* Current Wash Card */}
          <div className="card p-6 sm:p-7 flex flex-col justify-between min-h-[240px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 dark:text-[#8a958d] uppercase tracking-wider">
                  Current Laundry Cycle
                </span>
                {activeWashOrder ? (
                  <span className="badge badge-yellow uppercase font-bold text-[10px] tracking-wider px-2.5 py-1">
                    {activeWashOrder.Status}
                  </span>
                ) : (
                  <span className="badge badge-gray uppercase font-bold text-[10px] tracking-wider px-2.5 py-1">
                    Idle
                  </span>
                )}
              </div>

              {activeWashOrder ? (
                <div className="space-y-2.5 my-3">
                  <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight leading-snug">
                    {activeWashOrder.Status === 'Ready for Pickup' ? 'Ready for Pick Up' :
                     activeWashOrder.Status === 'In Wash' ? 'Washing...' :
                     activeWashOrder.Status === 'Submitted' ? 'Order Submitted' : activeWashOrder.Status}
                  </div>
                  <div className="text-sm sm:text-base text-slate-600 dark:text-[#c5cec7] font-medium">
                    Order <span className="font-mono font-bold text-amber-500 dark:text-[#fde047]">#{activeWashOrder.Transaction_ID}</span> &middot; <span className="font-bold">{activeWashOrder.Total_Weight} kg</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 my-auto">
                  <div className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-[#8a958d]">No Active Wash</div>
                  <p className="text-xs text-slate-400 dark:text-[#6d7870] mt-1.5">All previous loads are completed.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#1d2420] flex justify-between items-center text-xs text-slate-400 dark:text-[#8a958d]">
              <span>Pickup Kiosk</span>
              <span className="font-bold text-slate-800 dark:text-[#a3c9a8] text-sm">
                {activeWashOrder ? (activeWashOrder.drop_point_location || activeWashOrder.Drop_Point_ID) : 'Any Drop Point'}
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Loading state */}
      {studentLoading && !student && (
        <div className="card p-8 text-center text-sm text-slate-400">Loading student data...</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'dropoff', label: 'New Wash' },
          { key: 'history', label: `History (${studentOrders.length})` },
          { key: 'kiosks', label: `Drop Points (${kiosks.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Drop-Off Builder */}
      {activeTab === 'dropoff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Step 1: Drop Point */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-800 text-white flex items-center justify-center text-[11px] font-bold">1</span>
                Select Drop Point
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {kiosks.map((kiosk) => {
                  const isSelected = selectedKiosk === kiosk.Drop_Point_ID
                  const inactive = kiosk.Operational_Status !== 'Active'
                  return (
                    <button
                      key={kiosk.Drop_Point_ID}
                      type="button"
                      disabled={inactive}
                      onClick={() => setSelectedKiosk(kiosk.Drop_Point_ID)}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        isSelected
                          ? 'border-primary-800 bg-blue-50 dark:bg-[#17221a] dark:border-[#a3c9a8] ring-1 ring-primary-800/20 dark:ring-[#a3c9a8]/30'
                          : 'border-slate-200 dark:border-[#1d2420] bg-white dark:bg-[#0e1310] hover:border-slate-300 dark:hover:border-[#2a362d]'
                      } ${inactive ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-semibold text-slate-800 dark:text-[#f0f2f0]">{kiosk.Location}</div>
                      <div className="text-slate-400 dark:text-[#8a958d] mt-0.5">{kiosk.Vendor_Name}</div>
                      {inactive && <span className="text-red-500 text-[10px] font-medium">Maintenance</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: Item Selector */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-800 text-white flex items-center justify-center text-[11px] font-bold">2</span>
                Add Items to Bag
                <span className="ml-auto text-xs text-slate-400">{totalItemsCount} items selected</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {catalogItems.map((item) => {
                  const qty = itemQuantities[item.Item_ID] || 0
                  return (
                    <div
                      key={item.Item_ID}
                      className={`rounded-lg border p-3 transition-all ${
                        qty > 0 
                          ? 'border-primary-800/30 bg-blue-50/50 dark:bg-[#152018] dark:border-[#2d4232]' 
                          : 'border-slate-200 dark:border-[#1d2420] bg-white dark:bg-[#0e1310]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-sm font-medium text-slate-800 dark:text-[#f0f2f0]">{item.Item_Name}</div>
                          <div className="text-[11px] text-slate-400 dark:text-[#8a958d]">{item.Category}</div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-[#8a958d] bg-slate-100 dark:bg-[#161c18] border border-slate-200 dark:border-[#26332a] px-1.5 py-0.5 rounded">
                          {item.Standard_Weight}kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1d2420]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.Item_ID, -1)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded border border-slate-200 dark:border-[#26332a] bg-white dark:bg-[#161c18] text-slate-600 dark:text-[#c5cec7] flex items-center justify-center font-bold text-sm hover:bg-slate-50 dark:hover:bg-[#1f2721] active:bg-slate-100 dark:active:bg-[#131915] disabled:opacity-30"
                        >−</button>
                        <span className="font-mono text-sm font-bold text-slate-800 dark:text-[#f0f2f0] w-6 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.Item_ID, 1)}
                          className="w-7 h-7 rounded border border-slate-200 dark:border-[#26332a] bg-white dark:bg-[#161c18] text-slate-600 dark:text-[#c5cec7] flex items-center justify-center font-bold text-sm hover:bg-slate-100 dark:hover:bg-[#a3c9a8] dark:hover:text-[#0d170f] dark:hover:border-[#a3c9a8] active:bg-slate-200 dark:active:bg-[#95be9b]"
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sidebar: Weight Meter + Submit */}
          <div className="space-y-5">
            <div className="card p-5 sticky top-20 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">Weight Summary</h3>

              {/* Weight bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Total Weight</span>
                  <span className={`font-mono font-bold ${isOverweight ? 'text-red-600' : totalWeightKg > 6.2 ? 'text-amber-600' : 'text-slate-800'}`}>
                    {totalWeightKg.toFixed(2)} / 8.00 kg
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOverweight ? 'bg-red-500' : totalWeightKg > 6.2 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${weightPercent}%` }}
                  />
                </div>
                {isOverweight && (
                  <p className="text-xs text-red-500 mt-1">Exceeds 8.0 kg limit! Remove some items.</p>
                )}
                {!isOverweight && totalWeightKg > 6.2 && (
                  <p className="text-xs text-amber-600 mt-1">Above 6.2 kg — will deduct 2 cycles.</p>
                )}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cycles to deduct</span>
                  <span className={`font-semibold ${cyclesNeeded === 2 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {cyclesNeeded} {cyclesNeeded === 2 ? '(> 6.2 kg)' : '(≤ 6.2 kg)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">After drop-off</span>
                  <span className="font-semibold text-slate-700">
                    {student ? Math.max(0, student.cycle_remaining - cyclesNeeded) : '—'} / {student?.quota ?? 30}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Turnaround</span>
                  <span className="font-semibold text-slate-700">
                    {[5, 6].includes(new Date().getDay()) ? '3-5 days' : '2-3 days'}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{submitError}</div>
              )}

              {submitResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  <div className="font-semibold">Drop-off registered!</div>
                  <div>Order #{submitResult.transaction?.transaction_id}</div>
                </div>
              )}

              <button
                type="button"
                onClick={handleDropOffSubmit}
                disabled={submitting || isOverweight || totalItemsCount === 0 || !student || student.cycle_remaining < cyclesNeeded}
                className="btn btn-primary w-full py-2.5"
              >
                {submitting ? 'Submitting...' : `Confirm Drop-Off (${cyclesNeeded} cycle${cyclesNeeded > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: History */}
      {activeTab === 'history' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Recent Wash History</h3>
            <span className="text-xs text-slate-400">{studentOrders.length} records</span>
          </div>
          {studentOrders.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">No wash records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Drop Point</th>
                    <th>Weight</th>
                    <th>Drop-Off</th>
                    <th>Expected</th>
                    <th>Completed</th>
                    <th>Cycles</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentOrders.map((order: any, idx: number) => {
                    const st = order.Status
                    return (
                      <tr key={order.Transaction_ID || idx}>
                        <td className="font-mono font-semibold">#{order.Transaction_ID}</td>
                        <td>{order.drop_point_location || order.Drop_Point_ID}</td>
                        <td className="font-mono">{order.Total_Weight} kg</td>
                        <td>{order.Drop_Off_Date ? new Date(order.Drop_Off_Date).toLocaleDateString() : '—'}</td>
                        <td>{order.Expected_Completion_Date ? new Date(order.Expected_Completion_Date).toLocaleDateString() : '—'}</td>
                        <td>
                          {order.Actual_Completion_Date
                            ? <span className="text-green-600 font-medium">{new Date(order.Actual_Completion_Date).toLocaleDateString()}</span>
                            : <span className="text-slate-400 italic">Pending</span>}
                        </td>
                        <td className="font-mono">{order.Cycles_Deducted ?? 1}</td>
                        <td>
                          <span className={`badge ${
                            st === 'Completed' ? 'badge-green' :
                            st === 'Cancelled' ? 'badge-red' : 'badge-yellow'
                          }`}>{st}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Drop Points */}
      {activeTab === 'kiosks' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Hostel Drop Points</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {kiosks.map((k) => (
              <div key={k.Drop_Point_ID} className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-slate-800">{k.Location}</h4>
                  <span className={`badge ${k.Operational_Status === 'Active' ? 'badge-green' : 'badge-red'}`}>
                    {k.Operational_Status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                  <div>Vendor: <strong className="text-slate-700">{k.Vendor_Name}</strong></div>
                  <div>Contact: <span className="font-mono">{k.Contact_No}</span></div>
                  <div className="text-slate-400 font-mono text-[11px]">ID: {k.Drop_Point_ID}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">Loading...</div>}>
      <StudentDashboardContent />
    </Suspense>
  )
}

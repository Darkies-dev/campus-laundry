'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const initialReg = searchParams.get('reg') || '2502050680'

  // Active Student State (College Registration Number)
  const [studentId, setStudentId] = useState<string>(initialReg)
  const [student, setStudent] = useState<Student | null>(null)
  const [studentOrders, setStudentOrders] = useState<Transaction[]>([])
  const [activeWashOrder, setActiveWashOrder] = useState<any | null>(null)
  const [canSubmitNew, setCanSubmitNew] = useState<boolean>(true)
  const [studentLoading, setStudentLoading] = useState<boolean>(false)
  const [studentError, setStudentError] = useState<string | null>(null)

  // Kiosks & Items
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [selectedKiosk, setSelectedKiosk] = useState<string>('')
  const [catalogItems, setCatalogItems] = useState<LaundryItem[]>([])

  // Drop-off Builder (6kg Load calculation)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({})
  const [remarks, setRemarks] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitResult, setSubmitResult] = useState<any>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'dropoff' | 'history' | 'kiosks'>('dropoff')

  useEffect(() => {
    loadGlobalData()
  }, [])

  useEffect(() => {
    if (studentId.trim()) {
      loadStudentData(studentId)
    }
  }, [studentId])

  async function loadGlobalData() {
    try {
      const [kioskList, itemRes] = await Promise.all([
        fetchKiosks(),
        fetchLaundryItems(),
      ])
      setKiosks(kioskList)
      if (kioskList.length > 0) {
        const active = kioskList.find((k) => k.Operational_Status === 'Active') || kioskList[0]
        setSelectedKiosk(active.Drop_Point_ID)
      }
      setCatalogItems(itemRes.items)
      // Initialize with empty bag (all 0s by default)
      setItemQuantities({})
    } catch (err: any) {
      console.error('Failed to load global data:', err)
    }
  }

  async function loadStudentData(id: string) {
    setStudentLoading(true)
    setStudentError(null)
    try {
      const data: any = await fetchStudentQuota(id)
      setStudent(data.student)
      const orders = data.recent_orders || []
      setStudentOrders(orders)
      const statusOf = (o: any) => (o.Status || o.status || '').toLowerCase()
      const active =
        data.active_order ||
        orders.find((o: any) => {
          const s = statusOf(o)
          return s && s !== 'completed' && s !== 'cancelled'
        }) ||
        null
      setActiveWashOrder(active)
      setCanSubmitNew(active === null)
    } catch (err: any) {
      setStudent(null)
      setStudentOrders([])
      setActiveWashOrder(null)
      setCanSubmitNew(true)
      setStudentError(err.message || 'Student not found in college records.')
    } finally {
      setStudentLoading(false)
    }
  }

  // Weight Calculation: Sum of (quantity * standard weight)
  const totalWeightKg = Object.entries(itemQuantities).reduce((sum, [itemId, qty]) => {
    const item = catalogItems.find((i) => i.Item_ID === itemId)
    return sum + (item ? item.Standard_Weight * qty : 0)
  }, 0)

  // Max cap is 8.0 kg; cycle count is 2 only if it crosses 6.20 kg, otherwise 1
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

    if (totalItemsCount === 0) {
      setSubmitError('Please add at least 1 item to your laundry bag.')
      return
    }
    if (isOverweight) {
      setSubmitError('Bag exceeds the maximum allowed limit of 8.0 kg for a single wash.')
      return
    }
    if (!student || student.cycle_remaining < cyclesNeeded) {
      setSubmitError(
        `You need ${cyclesNeeded} cycle(s) for this load (${totalWeightKg.toFixed(2)} kg), but you only have ${
          student?.cycle_remaining ?? 0
        } cycle(s) left.`
      )
      return
    }
    if (!selectedKiosk) {
      setSubmitError('Please select a collection drop point.')
      return
    }

    setSubmitting(true)
    const itemsPayload = Object.entries(itemQuantities).map(([item_id, quantity]) => ({
      item_id,
      quantity,
    }))

    try {
      const result = await submitDropOff({
        std_id: studentId,
        drop_point_id: selectedKiosk,
        items: itemsPayload,
        remarks,
      })
      setSubmitResult(result)
      await loadStudentData(studentId)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit drop-off.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Header Label */}
      <div className="pb-2 border-b border-white/5">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-sage">
          Student Dashboard
        </h1>
      </div>

      {/* 3 BALANCED OVERVIEW CARDS: PROFILE, QUOTA DONUT, CURRENT CYCLE STATUS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 1: Student Profile Information */}
        <div className="glass-panel p-5 rounded-3xl border-white/10 shadow-glass flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sage">Student Profile</span>
            <span className="text-sm font-mono font-bold text-white bg-obsidian-900 border border-white/10 rounded-lg px-3 py-1 tracking-wide">
              {studentId}
            </span>
          </div>

          {studentLoading && (
            <div className="text-xs text-slate-400 animate-pulse">Loading profile...</div>
          )}

          {studentError && (
            <div className="text-xs text-terracotta bg-terracotta/10 px-2.5 py-1 rounded-lg border border-terracotta/20">
              {studentError}
            </div>
          )}

          {student && (
            <div className="my-auto space-y-3 py-1">
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {student.std_name}
              </div>

              {/* Center-aligned 3-column layout filling width with large typography */}
              <div className="grid grid-cols-3 divide-x divide-white/10 text-center pt-2">
                <div className="px-2">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Hostel</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-sage font-mono mt-0.5">{student.hostel}</div>
                </div>
                <div className="px-2">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Room</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-0.5">{student.room}</div>
                </div>
                <div className="px-2">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Year</div>
                  <div className="text-lg sm:text-xl font-bold text-gold font-mono mt-1">{student.academic_year}</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400 pt-2.5 border-t border-white/5 flex items-center justify-between">
            <span>Contact Number</span>
            <span className="font-mono text-slate-200 font-bold text-xs sm:text-sm">{student?.contact || '--'}</span>
          </div>
        </div>

        {/* Card 2: Remaining Cycle Donut Chart (50/50 Balanced Split) */}
        {student ? (
          (() => {
            const total = student.quota || 30
            const remaining = Math.max(0, student.cycle_remaining ?? 0)
            const radius = 48
            const circumference = 2 * Math.PI * radius
            const remainingRatio = total > 0 ? remaining / total : 0
            const strokeDashoffset = circumference * (1 - remainingRatio)

            return (
              <div className="glass-panel p-5 rounded-3xl border-white/10 shadow-glass flex items-center gap-4">
                {/* Left Side: Exactly 50% of the card for the circular chart */}
                <div className="w-1/2 flex items-center justify-center">
                  <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 116 116">
                      {/* Background circle */}
                      <circle
                        cx="58"
                        cy="58"
                        r={radius}
                        className="text-white/10"
                        strokeWidth="11"
                        stroke="currentColor"
                        fill="transparent"
                      />
                      {/* Progress ring */}
                      <circle
                        cx="58"
                        cy="58"
                        r={radius}
                        className="text-sage transition-all duration-700 ease-out"
                        strokeWidth="11"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                      />
                    </svg>
                    {/* Inside Center: Remaining Cycles */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl sm:text-4xl font-black font-mono text-sage leading-none">
                        {remaining}
                      </span>
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-extrabold mt-1">
                        Remaining
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Exactly 50% balanced space for metrics */}
                <div className="w-1/2 space-y-3.5 pl-2">
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gold">
                        8-Month Burn
                      </span>
                      <span className="text-xl sm:text-2xl font-black font-mono text-gold">
                        {student.burn_percentage}%
                      </span>
                    </div>
                    {/* Progress bar: Pure solid white, absolutely no glow / no shadow / no gradient */}
                    <div className="w-full h-3 rounded-full bg-obsidian-950 overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${Math.min(100, student.burn_percentage)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Used</div>
                      <div className="text-xl sm:text-2xl font-mono font-black text-white mt-0.5">
                        {student.cycle_used}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Quota</div>
                      <div className="text-xl sm:text-2xl font-mono font-black text-slate-200 mt-0.5">
                        {student.quota}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        ) : (
          <div className="glass-panel p-5 rounded-3xl border-white/10 shadow-glass flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Remaining Quota</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 text-slate-400 uppercase border border-white/10 font-mono animate-pulse">
                LOADING...
              </span>
            </div>
            <div className="my-auto py-8 text-center">
              <div className="text-xs text-slate-400 animate-pulse">Loading quota metrics...</div>
            </div>
          </div>
        )}

        {/* Card 3: Current Laundry Cycle Status */}
        {(() => {
          const activeOrderMatch = studentOrders.find(
            (o) => o.Transaction_ID === activeWashOrder?.Transaction_ID
          )
          const dropPointId =
            activeWashOrder?.Drop_Point_ID ||
            activeOrderMatch?.Drop_Point_ID ||
            'DP01'
          const matchedKiosk = kiosks.find((k) => k.Drop_Point_ID === dropPointId)
          const activeDropLocation =
            activeWashOrder?.drop_point_location ||
            activeOrderMatch?.drop_point_location ||
            matchedKiosk?.Location ||
            dropPointId

          return (
            <div className="glass-panel p-5 rounded-3xl border-white/10 shadow-glass flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Laundry Cycle</span>
                {studentLoading ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 text-slate-400 uppercase border border-white/10 font-mono animate-pulse">
                    LOADING...
                  </span>
                ) : activeWashOrder ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gold/20 text-gold uppercase border border-gold/30">
                    {activeWashOrder.Status}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/5 text-slate-400 uppercase border border-white/10 font-mono">
                    IDLE
                  </span>
                )}
              </div>

              <div className="my-auto py-3 text-center flex flex-col items-center justify-center">
                {studentLoading ? (
                  <div className="text-xs text-slate-400 animate-pulse py-4">
                    Loading cycle status...
                  </div>
                ) : activeWashOrder ? (
                  <div className="space-y-2 w-full">
                    <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {activeWashOrder.Status === 'Ready for Pickup'
                        ? 'Ready for Pick Up'
                        : activeWashOrder.Status === 'In Wash'
                        ? 'Washing in Progress'
                        : activeWashOrder.Status === 'Submitted'
                        ? 'Order Submitted'
                        : activeWashOrder.Status}
                    </div>
                    <div className="text-sm sm:text-base text-slate-300 font-medium">
                      Order <span className="font-mono text-gold font-bold text-base sm:text-lg">#{activeWashOrder.Transaction_ID}</span> &bull; <span className="font-mono text-white font-bold">{activeWashOrder.Total_Weight} kg</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 pt-1">
                      Drop Point: <strong className="text-sage font-bold font-mono text-sm sm:text-base">{activeDropLocation}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 w-full">
                    <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      No Active Cycle
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                      All previous laundry loads completed and picked up.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </section>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('dropoff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'dropoff'
              ? 'bg-sage text-obsidian-950 shadow-glass font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>New Wash Request</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-sage text-obsidian-950 shadow-glass font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>Last 10 Washes</span>
          <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono">
            {studentOrders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('kiosks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'kiosks'
              ? 'bg-sage text-obsidian-950 shadow-glass font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Drop Points ({kiosks.length})
        </button>
      </div>

      {/* TAB 1: DROP-OFF WORKFLOW & 6KG LOAD CALCULATOR */}
      {activeTab === 'dropoff' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Item Selector & Bag Builder */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Drop Point Selection */}
            <div className="glass-panel p-5 rounded-2xl border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs">1</span>
                  Select Drop Point
                </h3>
                <span className="text-xs text-slate-400">Available across hostels</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {kiosks.map((kiosk) => {
                  const isSelected = selectedKiosk === kiosk.Drop_Point_ID
                  const isMaintenance = kiosk.Operational_Status !== 'Active'
                  return (
                    <button
                      key={kiosk.Drop_Point_ID}
                      type="button"
                      disabled={isMaintenance}
                      onClick={() => setSelectedKiosk(kiosk.Drop_Point_ID)}
                      className={`p-3 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'bg-sage/10 border-sage shadow-glass'
                          : 'bg-obsidian-900/60 border-white/5 hover:border-white/20'
                      } ${isMaintenance ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-base text-white">{kiosk.Location}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            kiosk.Operational_Status === 'Active' ? 'badge-sage' : 'badge-terracotta'
                          }`}
                        >
                          {kiosk.Operational_Status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">Vendor: {kiosk.Vendor_Name}</div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">ID: #{kiosk.Drop_Point_ID}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: 6kg Load Calculator & Garment Counts */}
            <div className="glass-panel p-5 rounded-2xl border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs">2</span>
                  Build Your Laundry Bag (6.0 kg Cap)
                </h3>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Selected Items: <strong className="text-white">{totalItemsCount}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {catalogItems.map((item) => {
                  const qty = itemQuantities[item.Item_ID] || 0
                  return (
                    <div
                      key={item.Item_ID}
                      className={`p-3 rounded-xl border transition-all ${
                        qty > 0
                          ? 'bg-obsidian-900/80 border-sage/50 shadow-glass'
                          : 'bg-obsidian-900/40 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-sm text-white">{item.Item_Name}</div>
                          <div className="text-[11px] text-slate-400">{item.Category}</div>
                        </div>
                        <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded-md">
                          {item.Standard_Weight} kg
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.Item_ID, -1)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-lg bg-obsidian-950 border border-white/10 text-white flex items-center justify-center font-bold hover:bg-terracotta hover:border-terracotta disabled:opacity-30 disabled:hover:bg-obsidian-950 transition-colors"
                        >
                          -
                        </button>
                        <span className="font-mono text-sm font-bold text-white w-8 text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.Item_ID, 1)}
                          className="w-7 h-7 rounded-lg bg-obsidian-950 border border-white/10 text-white flex items-center justify-center font-bold hover:bg-sage hover:text-obsidian-950 hover:border-sage transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Weight Meter & Drop-Off Confirmation */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-5 rounded-2xl border-white/10 space-y-5 sticky top-24 shadow-glass">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 border-b border-white/5 pb-3">
                Cycle Weight Meter
              </h3>

              {/* Weight Display */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Total Calculated Weight</span>
                  <span
                    className={`font-mono text-2xl font-extrabold ${
                      isOverweight ? 'text-terracotta' : totalWeightKg > 6.5 ? 'text-gold' : 'text-sage'
                    }`}
                  >
                    {totalWeightKg.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-400">/ 8.00 kg max</span>
                  </span>
                </div>

                {/* Meter Bar (Max 8.0 kg) */}
                <div className="w-full h-3 rounded-full bg-obsidian-950 overflow-hidden border border-white/10 relative">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOverweight
                        ? 'bg-terracotta'
                        : totalWeightKg > 6.2
                        ? 'bg-gold'
                        : 'bg-sage'
                    }`}
                    style={{ width: `${Math.min(100, (totalWeightKg / 8.0) * 100)}%` }}
                  ></div>
                </div>

                {isOverweight ? (
                  <div className="text-[11px] text-terracotta flex items-center gap-1 font-semibold">
                    <span>Over limit by {(totalWeightKg - 8.0).toFixed(2)} kg! Maximum single wash is 8.0 kg.</span>
                  </div>
                ) : totalWeightKg > 6.2 ? (
                  <div className="text-[11px] text-gold flex items-center justify-between font-semibold">
                    <span>Crossed 6.2 kg &bull; Deducts 2 Cycles</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Standard: 1 Cycle up to 6.0kg</span>
                  </div>
                )}
              </div>

              {/* Cycle Burn Summary */}
              <div className="p-3.5 rounded-xl bg-obsidian-900/80 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Quota Deduction:</span>
                  <span className={`font-bold font-mono ${cyclesNeeded === 2 ? 'text-gold' : 'text-white'}`}>
                    {cyclesNeeded} {cyclesNeeded === 2 ? 'Cycles (> 6.2kg)' : 'Cycle (≤ 6.2kg)'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Remaining After Drop:</span>
                  <span className="font-bold text-white font-mono">
                    {student ? Math.max(0, student.cycle_remaining - cyclesNeeded) : '--'} / {student?.quota ?? 30}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Estimated Turnaround:</span>
                  <span className="font-bold text-slate-200">
                    {[5, 6].includes(new Date().getDay())
                      ? '3-5 Days (Fri/Sat Weekend Peak)'
                      : '2-3 Days (Mon-Thu Standard)'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Eligibility:</span>
                  <span className={`font-bold ${student && student.cycle_remaining >= cyclesNeeded ? 'text-sage' : 'text-terracotta'}`}>
                    {student && student.cycle_remaining >= cyclesNeeded ? 'Eligible' : 'Insufficient Cycles'}
                  </span>
                </div>
              </div>

              {/* Status & Error Alerts */}
              {submitError && (
                <div className="p-3 rounded-xl bg-terracotta/15 border border-terracotta/30 text-xs text-terracotta font-medium">
                  {submitError}
                </div>
              )}

              {submitResult && (
                <div className="p-3.5 rounded-xl bg-sage/15 border border-sage/30 text-xs space-y-1">
                  <div className="font-bold text-sage">
                    Drop-Off Registered Successfully!
                  </div>
                  <div className="text-slate-300">
                    Booking ID: <strong className="font-mono text-white">#{submitResult.transaction_id}</strong>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Expected Pickup: <strong>{new Date(submitResult.expected_delivery).toLocaleDateString()}</strong>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleDropOffSubmit}
                disabled={
                  submitting ||
                  isOverweight ||
                  totalItemsCount === 0 ||
                  !student ||
                  student.cycle_remaining < cyclesNeeded
                }
                className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-sage text-obsidian-950 hover:bg-sage-light disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-glass flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span>Registering Drop-Off...</span>
                ) : (
                  <>
                    <span>Confirm Drop-Off ({cyclesNeeded} {cyclesNeeded === 2 ? 'Cycles' : 'Cycle'})</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LAST 10 WASHES HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-panel p-5 rounded-2xl border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Data of Last 10 Washes &bull; Reg No: <span className="text-sage font-mono">{studentId}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Displays the 10 most recent laundry cycles with turnaround dates and vendor completion statuses.
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-obsidian-900 border border-white/10 text-slate-300 font-mono">
              Total Recorded: {studentOrders.length} / 10
            </span>
          </div>

          {studentOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No previous wash records found for this student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Drop Point</th>
                    <th className="py-2.5 px-3">Total Weight</th>
                    <th className="py-2.5 px-3">Drop-Off Date</th>
                    <th className="py-2.5 px-3">Expected Return</th>
                    <th className="py-2.5 px-3">Actual Washed Date</th>
                    <th className="py-2.5 px-3">Cycles Deducted</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {studentOrders.map((order: any, idx: number) => {
                    const isCompleted = order.Status === 'Completed'
                    const isCancelled = order.Status === 'Cancelled'
                    const isPending = !isCompleted && !isCancelled

                    return (
                      <tr key={order.Transaction_ID || idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-white flex items-center gap-1.5">
                          <span>#{order.Transaction_ID}</span>
                          {idx === 0 && isPending && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-gold/20 text-gold border border-gold/30 uppercase">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {order.drop_point_location || order.Drop_Point_ID}
                        </td>
                        <td className="py-3 px-3 font-mono text-gold">
                          {order.Total_Weight} kg
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {order.Drop_Off_Date ? new Date(order.Drop_Off_Date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {order.Expected_Completion_Date
                            ? new Date(order.Expected_Completion_Date).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-200">
                          {order.Actual_Completion_Date ? (
                            <span className="text-sage font-semibold">
                              {new Date(order.Actual_Completion_Date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">In Process</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {order.Cycles_Deducted ?? 1} Cycle
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCompleted
                                ? 'badge-sage'
                                : isCancelled
                                ? 'badge-terracotta'
                                : 'badge-gold'
                            }`}
                          >
                            {order.Status}
                          </span>
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

      {/* TAB 3: HOSTEL DROP POINTS */}
      {activeTab === 'kiosks' && (
        <div className="glass-panel p-5 rounded-2xl border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Hostel Laundry Drop Points &amp; Commercial Vendor Network
            </h3>
            <span className="text-xs text-slate-400">Standard 72h turnaround</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {kiosks.map((k) => (
              <div key={k.Drop_Point_ID} className="glass-card p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-base">{k.Location}</h4>
                    <span className="text-xs font-mono text-slate-400">Point ID: #{k.Drop_Point_ID}</span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      k.Operational_Status === 'Active' ? 'badge-sage' : 'badge-terracotta'
                    }`}
                  >
                    {k.Operational_Status}
                  </span>
                </div>

                <div className="border-t border-white/5 pt-2 text-xs text-slate-300 space-y-1">
                  <div>Assigned Vendor: <strong>{k.Vendor_Name}</strong></div>
                  <div>Contact: <span className="font-mono text-slate-400">{k.Contact_No}</span></div>
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
          Loading student session...
        </div>
      }
    >
      <StudentDashboardContent />
    </Suspense>
  )
}

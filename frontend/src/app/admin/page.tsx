'use client'

import { useState, useEffect } from 'react'
import {
  fetchDashboard,
  fetchKiosks,
  updateTransactionStatus,
  registerStudent,
  fetchTableRecords,
  addTableRecord,
  updateTableRecord,
  deleteTableRecord,
  DashboardMetrics,
  Kiosk,
  Transaction,
} from '@/lib/api'

const TABLE_SCHEMAS: Record<string, { label: string; pk: string; fields: { name: string; label: string; type: string; placeholder?: string; default?: any; options?: string[] }[] }> = {
  students: {
    label: 'Students Table',
    pk: 'std_id',
    fields: [
      { name: 'std_id', label: 'Registration Number *', type: 'text', placeholder: 'e.g. 2502050680' },
      { name: 'std_name', label: 'Student Full Name *', type: 'text', placeholder: 'e.g. Vikramaditya Sen' },
      { name: 'hostel', label: 'Hostel Block *', type: 'select', options: [...Array.from({ length: 12 }, (_, i) => `B${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `G${i + 1}`)] },
      { name: 'room', label: 'Room Number *', type: 'text', placeholder: 'e.g. 304' },
      { name: 'contact', label: 'Contact Number', type: 'text', placeholder: 'e.g. 9876543210' },
      { name: 'quota', label: 'Cycle Quota', type: 'number', default: 30 },
      { name: 'cycle_used', label: 'Cycles Used', type: 'number', default: 0 },
    ],
  },
  vendor: {
    label: 'Vendor Table',
    pk: 'Vendor_ID',
    fields: [
      { name: 'Vendor_ID', label: 'Vendor ID *', type: 'text', placeholder: 'e.g. VND03' },
      { name: 'Vendor_Name', label: 'Vendor Name *', type: 'text', placeholder: 'e.g. Royal Cleaners' },
      { name: 'Contact_No', label: 'Contact Number', type: 'text', placeholder: 'e.g. 9871122334' },
    ],
  },
  drop_point: {
    label: 'Drop Point Table',
    pk: 'Drop_Point_ID',
    fields: [
      { name: 'Drop_Point_ID', label: 'Drop Point ID *', type: 'text', placeholder: 'e.g. DP05' },
      { name: 'Location', label: 'Location (e.g. B2, G3) *', type: 'text', placeholder: 'e.g. B2' },
      { name: 'Operational_Status', label: 'Status', type: 'select', options: ['Active', 'Under Maintenance', 'Inactive'] },
      { name: 'Vendor_ID', label: 'Assigned Vendor ID *', type: 'text', placeholder: 'e.g. VND01' },
    ],
  },
  laundry_item: {
    label: 'Laundry Item Catalog Table',
    pk: 'Item_ID',
    fields: [
      { name: 'Item_ID', label: 'Item ID *', type: 'text', placeholder: 'e.g. ITM11' },
      { name: 'Item_Name', label: 'Item Name *', type: 'text', placeholder: 'e.g. Woolen Blanket' },
      { name: 'Category', label: 'Category', type: 'text', placeholder: 'e.g. Heavy Bedding' },
      { name: 'Standard_Weight', label: 'Standard Weight (kg) *', type: 'number', placeholder: 'e.g. 1.20', default: 0.5 },
    ],
  },
  laundry_transaction: {
    label: 'Laundry Transaction Table',
    pk: 'Transaction_ID',
    fields: [
      { name: 'Transaction_ID', label: 'Transaction ID *', type: 'text', placeholder: 'e.g. TXN99' },
      { name: 'std_id', label: 'Student Reg No *', type: 'text', placeholder: 'e.g. 2502050680' },
      { name: 'Drop_Point_ID', label: 'Drop Point ID *', type: 'text', placeholder: 'e.g. DP01' },
      { name: 'Vendor_ID', label: 'Vendor ID *', type: 'text', placeholder: 'e.g. VND01' },
      { name: 'Total_Weight', label: 'Total Weight (kg)', type: 'number', default: 3.5 },
      { name: 'Cycles_Deducted', label: 'Cycles Deducted', type: 'number', default: 1 },
      { name: 'Status', label: 'Status', type: 'select', options: ['Dropped', 'Washing', 'Ready', 'Completed', 'Cancelled'] },
    ],
  },
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [activeAdminTab, setActiveAdminTab] = useState<'stream' | 'tables'>('stream')

  // Table Management State
  const [selectedTable, setSelectedTable] = useState<string>('students')
  const [tableData, setTableData] = useState<any[]>([])
  const [tableLoading, setTableLoading] = useState<boolean>(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [formStatus, setFormStatus] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState<boolean>(false)

  // Edit Row State
  const [editingRow, setEditingRow] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [editStatus, setEditStatus] = useState<string | null>(null)

  // Top Single Safe Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [searchPk, setSearchPk] = useState<string>('')
  const [matchedRecord, setMatchedRecord] = useState<any | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)

  useEffect(() => {
    loadAdminData()
  }, [])

  useEffect(() => {
    if (activeAdminTab === 'tables') {
      loadSelectedTable(selectedTable)
      setSearchPk('')
      setMatchedRecord(null)
      setDeleteStatus(null)
    }
  }, [selectedTable, activeAdminTab])

  async function loadAdminData() {
    try {
      const [dashRes, kioskList] = await Promise.all([
        fetchDashboard(),
        fetchKiosks(),
      ])
      setMetrics(dashRes.metrics)
      setRecentTransactions(dashRes.recent_transactions || [])
      setKiosks(kioskList)
    } catch (err) {
      console.error('Failed to load admin metrics:', err)
    }
  }

  async function loadSelectedTable(tableName: string) {
    setTableLoading(true)
    try {
      const res = await fetchTableRecords(tableName)
      setTableData(res.records || [])
    } catch (err: any) {
      console.error(`Failed to load ${tableName}:`, err)
      setTableData([])
    } finally {
      setTableLoading(false)
    }
  }

  // Handle status update test
  async function handleStatusChange(txnId: string, newStatus: string) {
    try {
      await updateTransactionStatus(txnId, newStatus)
      await loadAdminData()
    } catch (err: any) {
      alert(`Could not update status: ${err.message}`)
    }
  }

  // Handle Add Record to Any Table
  async function handleAddRecordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormStatus('Adding record...')
    try {
      await addTableRecord(selectedTable, formData)
      setFormStatus('✓ Record added successfully!')
      setTimeout(() => {
        setFormStatus(null)
        setShowAddModal(false)
        setFormData({})
        loadSelectedTable(selectedTable)
        loadAdminData()
      }, 1000)
    } catch (err: any) {
      setFormStatus(`Error: ${err.message}`)
    }
  }

  // Open Edit Modal
  function handleOpenEdit(row: any) {
    setEditingRow(row)
    setEditFormData({ ...row })
    setEditStatus(null)
  }

  // Handle Submit Edit (Update Query)
  async function handleEditRecordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingRow) return
    const pkField = TABLE_SCHEMAS[selectedTable]?.pk || 'std_id'
    const pkVal = editingRow[pkField]

    setEditStatus('Updating record in MySQL...')
    try {
      await updateTableRecord(selectedTable, pkVal, editFormData)
      setEditStatus('✓ Changes saved successfully!')
      setTimeout(() => {
        setEditingRow(null)
        setEditStatus(null)
        loadSelectedTable(selectedTable)
        loadAdminData()
      }, 1000)
    } catch (err: any) {
      setEditStatus(`Error: ${err.message}`)
    }
  }

  // Search Record in Delete Modal by Primary Key
  function handleSearchRecordForDelete(term: string) {
    setSearchPk(term)
    setDeleteStatus(null)
    const pkField = TABLE_SCHEMAS[selectedTable]?.pk || 'std_id'
    if (!term.trim()) {
      setMatchedRecord(null)
      return
    }
    const found = tableData.find((row) =>
      String(row[pkField] || '').toLowerCase() === term.trim().toLowerCase()
    )
    setMatchedRecord(found || null)
  }

  // Confirm Single Delete
  async function handleConfirmDelete() {
    if (!matchedRecord) return
    const pkField = TABLE_SCHEMAS[selectedTable]?.pk || 'std_id'
    const pkVal = matchedRecord[pkField]

    setDeleteStatus(`Deleting ${pkField}='${pkVal}'...`)
    try {
      await deleteTableRecord(selectedTable, pkVal)
      setDeleteStatus(`✓ Record '${pkVal}' deleted successfully!`)
      setTimeout(() => {
        setShowDeleteModal(false)
        setMatchedRecord(null)
        setSearchPk('')
        setDeleteStatus(null)
        loadSelectedTable(selectedTable)
        loadAdminData()
      }, 1200)
    } catch (err: any) {
      setDeleteStatus(`Error: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Header Label */}
      <div className="pb-2 border-b border-white/5">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-gold">
          Hostel Admin &amp; Vendor Console
        </h1>
      </div>

      {/* 1. TOP STATS OVERVIEW CARDS (ADMIN ONLY) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Loads */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Active Loads</div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.active_loads ?? '...'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            2-3 day turnaround
          </div>
        </div>

        {/* Total Campus Students */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Enrolled Students</div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
            {metrics?.total_students ?? '...'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Hostel hostelers enrolled</div>
        </div>

        {/* 8-Month Quota Burn */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Campus Quota Burn</div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-gold">
            {metrics?.utilization_rate ?? '0'}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex justify-between">
            <span>{metrics?.total_cycles_used ?? 0} cycles used</span>
            <span>/ {metrics?.total_campus_quota ?? 0}</span>
          </div>
        </div>

        {/* Active Drop Points */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-medium">Operational Drop Points</div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-200">
            {metrics?.active_kiosks ?? '...'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Hostel collection hubs</div>
        </div>
      </section>

      {/* Admin Tab Switcher */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveAdminTab('stream')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            activeAdminTab === 'stream'
              ? 'bg-gold text-obsidian-950 font-bold shadow-glass'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Active Laundry Cycle
        </button>
        <button
          onClick={() => setActiveAdminTab('tables')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
            activeAdminTab === 'tables'
              ? 'bg-gold text-obsidian-950 font-bold shadow-glass'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Database Tables Manager
        </button>
      </div>

      {/* VIEW 1: LIVE ORDER STREAM */}
      {activeAdminTab === 'stream' && (
        <div className="space-y-8">
          {/* CAMPUS RECENT TRANSACTIONS & STATUS MANAGEMENT */}
          <section className="glass-panel p-5 rounded-2xl border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Active Cycle
                </h3>
              </div>
              <div className="text-xs font-mono text-slate-300 px-3 py-1.5 rounded-lg bg-obsidian-900 border border-white/5">
                Active Cycles: <strong className="text-gold font-bold">{recentTransactions.length}</strong>
              </div>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No active laundry cycle currently in progress.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Student Reg No</th>
                      <th className="py-2.5 px-3">Hostel Drop Point</th>
                      <th className="py-2.5 px-3">Weight (Cap 6kg)</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Current Status</th>
                      <th className="py-2.5 px-3 text-right">Vendor Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentTransactions.map((tx: any) => {
                      const txnId = tx.Transaction_ID || tx.transaction_id
                      const stdId = tx.std_id
                      const dropLoc = tx.drop_point_location || tx.Drop_Point_ID
                      const weight = tx.Total_Weight || tx.total_weight_kg || '0.00'
                      const dateVal = tx.Drop_Off_Date || tx.drop_time
                      const statusVal = tx.Status || tx.status || 'Submitted'
                      const isCompleted = statusVal === 'Completed'
                      const isCancelled = statusVal === 'Cancelled'

                      return (
                        <tr key={txnId} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-white">#{txnId}</td>
                          <td className="py-3 px-3 font-mono text-sage font-semibold">{stdId}</td>
                          <td className="py-3 px-3 font-medium text-white">{dropLoc}</td>
                          <td className="py-3 px-3 font-mono text-gold">{weight} kg</td>
                          <td className="py-3 px-3 text-slate-400">
                            {dateVal ? new Date(dateVal).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isCompleted
                                  ? 'badge-sage'
                                  : isCancelled
                                  ? 'badge-terracotta'
                                  : 'badge-gold'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isCompleted
                                    ? 'bg-sage'
                                    : isCancelled
                                    ? 'bg-terracotta'
                                    : 'bg-gold animate-pulse'
                                }`}
                              ></span>
                              <span>{statusVal}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {!isCompleted && !isCancelled ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {statusVal === 'Submitted' && (
                                  <button
                                    onClick={() => handleStatusChange(txnId, 'In Wash')}
                                    className="px-2.5 py-1 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 font-semibold text-xs"
                                  >
                                    Move to Wash
                                  </button>
                                )}
                                {statusVal === 'In Wash' && (
                                  <button
                                    onClick={() => handleStatusChange(txnId, 'Ready for Pickup')}
                                    className="px-2.5 py-1 rounded bg-sage/15 text-sage border border-sage/30 hover:bg-sage/25 font-semibold text-xs"
                                  >
                                    Ready for Pickup
                                  </button>
                                )}
                                {statusVal === 'Ready for Pickup' && (
                                  <button
                                    onClick={() => handleStatusChange(txnId, 'Completed')}
                                    className="px-2.5 py-1 rounded bg-sage text-obsidian-950 font-bold text-xs hover:bg-sage-light"
                                  >
                                    Mark Delivered
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirm('Cancel this laundry order? 1 cycle will be refunded to the student.')) {
                                      handleStatusChange(txnId, 'Cancelled')
                                    }
                                  }}
                                  className="px-2 py-1 rounded bg-terracotta/10 text-terracotta border border-terracotta/20 hover:bg-terracotta/20 text-xs"
                                  title="Cancel Order & Refund Cycle"
                                >
                                  &times; Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 font-mono text-[11px]">— Closed —</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* OPERATIONAL DROP POINTS LIST */}
          <section className="glass-panel p-5 rounded-2xl border-white/10 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Campus Drop Points &amp; Commercial Vendor Network
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {kiosks.map((k) => (
                <div key={k.Drop_Point_ID} className="glass-card p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-white text-base">{k.Location}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        k.Operational_Status === 'Active' ? 'badge-sage' : 'badge-terracotta'
                      }`}
                    >
                      {k.Operational_Status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">Vendor: <strong>{k.Vendor_Name}</strong></div>
                  <div className="text-xs text-slate-400">Contact: <span className="font-mono">{k.Contact_No}</span></div>
                  <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-white/5">
                    Point ID: #{k.Drop_Point_ID}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* VIEW 2: DATABASE TABLES MANAGER (FULL CRUD: ADD, EDIT, DELETE) */}
      {activeAdminTab === 'tables' && (
        <section className="glass-panel p-5 rounded-2xl border-white/10 space-y-6">
          {/* Table Selector Tabs & Top Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="flex flex-wrap gap-2">
              {Object.keys(TABLE_SCHEMAS).map((tbl) => (
                <button
                  key={tbl}
                  onClick={() => setSelectedTable(tbl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                    selectedTable === tbl
                      ? 'bg-gold text-obsidian-950 font-bold shadow-glass'
                      : 'bg-obsidian-900 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {tbl}
                </button>
              ))}
            </div>

            {/* TOP ACTION BUTTONS: INSERT AND DELETE */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFormData({})
                  setFormStatus(null)
                  setShowAddModal(true)
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sage text-obsidian-950 hover:bg-sage-light transition-all shadow-glass flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Insert</span>
              </button>

              {/* SINGLE SAFE DELETE BUTTON AT TOP */}
              <button
                onClick={() => {
                  setSearchPk('')
                  setMatchedRecord(null)
                  setDeleteStatus(null)
                  setShowDeleteModal(true)
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-terracotta text-white hover:bg-terracotta/90 transition-all shadow-glass flex items-center gap-1.5"
              >
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Table Data View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Showing all records in <strong className="text-white font-mono">{selectedTable}</strong></span>
              <span>Total rows: <strong className="text-gold font-mono">{tableData.length}</strong></span>
            </div>

            {tableLoading ? (
              <div className="text-center py-12 text-slate-400 text-xs animate-pulse">
                Loading...
              </div>
            ) : tableData.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No rows currently exist in table &apos;{selectedTable}&apos;.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] border border-white/5 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-obsidian-900 sticky top-0 border-b border-white/10 text-slate-300">
                    <tr>
                      {(() => {
                        if (tableData.length === 0) return null
                        const allCols = Object.keys(tableData[0])
                        if (selectedTable === 'students') {
                          // Requested order: reg no, name, year, block(hostel), room, contact, quota, cycle used, cycle remaining
                          const desiredOrder = [
                            'std_id',
                            'std_name',
                            'academic_year',
                            'hostel',
                            'room',
                            'contact',
                            'quota',
                            'cycle_used',
                            'cycle_remaining',
                          ]
                          const ordered = desiredOrder.filter((c) => allCols.includes(c))
                          const remaining = allCols.filter((c) => !desiredOrder.includes(c))
                          return [...ordered, ...remaining]
                        }
                        return allCols
                      })()?.map((col) => {
                        const labels: Record<string, string> = {
                          std_id: 'REG NO',
                          std_name: 'NAME',
                          academic_year: 'YEAR',
                          hostel: 'BLOCK',
                          room: 'ROOM',
                          contact: 'CONTACT',
                          quota: 'QUOTA',
                          cycle_used: 'CYCLE USED',
                          cycle_remaining: 'CYCLE REMAINING',
                        }
                        return (
                          <th key={col} className="py-2.5 px-3 font-mono font-bold uppercase tracking-wider text-[11px]">
                            {labels[col] || col}
                          </th>
                        )
                      })}
                      <th className="py-2.5 px-3 text-right font-mono font-bold uppercase tracking-wider text-[11px]">
                        Edit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-obsidian-950/60">
                    {tableData.map((row, idx) => {
                      const allCols = Object.keys(row)
                      let displayCols = allCols
                      if (selectedTable === 'students') {
                        const desiredOrder = [
                          'std_id',
                          'std_name',
                          'academic_year',
                          'hostel',
                          'room',
                          'contact',
                          'quota',
                          'cycle_used',
                          'cycle_remaining',
                        ]
                        const ordered = desiredOrder.filter((c) => allCols.includes(c))
                        const remaining = allCols.filter((c) => !desiredOrder.includes(c))
                        displayCols = [...ordered, ...remaining]
                      }

                      return (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          {displayCols.map((colKey, vIdx) => {
                            const val = row[colKey]
                            return (
                              <td key={vIdx} className="py-2.5 px-3 font-mono text-slate-300">
                                {val === null || val === undefined ? (
                                  <span className="text-slate-600">NULL</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            )
                          })}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="px-2.5 py-1 rounded bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25 font-semibold text-[11px] transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SINGLE SAFE DELETE MODAL (SEARCH PRIMARY KEY THEN DELETE) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-3xl border-terracotta/30 max-w-lg w-full space-y-4 shadow-glass max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🗑️</span> Delete from <span className="font-mono text-terracotta">{selectedTable}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Search by Primary Key (<span className="text-gold font-mono">{TABLE_SCHEMAS[selectedTable]?.pk}</span>) to preview before deleting.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1: Input Primary Key */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Enter Primary Key ({TABLE_SCHEMAS[selectedTable]?.pk}) to Search:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchPk}
                    onChange={(e) => handleSearchRecordForDelete(e.target.value)}
                    placeholder={`e.g. ${
                      selectedTable === 'students'
                        ? '2502050680'
                        : selectedTable === 'vendor'
                        ? 'VND01'
                        : selectedTable === 'drop_point'
                        ? 'DP01'
                        : 'ID'
                    }`}
                    className="flex-1 glass-input px-3 py-2 rounded-xl font-mono text-white text-sm"
                  />
                  {searchPk && (
                    <button
                      type="button"
                      onClick={() => handleSearchRecordForDelete('')}
                      className="px-3 py-2 rounded-xl bg-obsidian-900 border border-white/10 text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2: Show Found Record Preview */}
              {matchedRecord ? (
                <div className="p-4 rounded-2xl bg-terracotta/10 border border-terracotta/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-white">Record Found:</span>
                    <span className="font-mono text-gold font-bold">
                      {TABLE_SCHEMAS[selectedTable]?.pk}: {matchedRecord[TABLE_SCHEMAS[selectedTable]?.pk || 'std_id']}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-300 text-[11px] font-mono">
                    {Object.entries(matchedRecord).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-400">{key}:</span>
                        <span className="text-white font-semibold">{String(value ?? 'NULL')}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      className="w-full py-2.5 rounded-xl font-bold uppercase tracking-wider bg-terracotta text-white hover:bg-red-600 transition-all shadow-glass flex items-center justify-center gap-1.5"
                    >
                      <span>⚠️</span>
                      <span>Permanently Delete This Record</span>
                    </button>
                  </div>
                </div>
              ) : searchPk.trim() ? (
                <div className="p-3 rounded-xl bg-obsidian-900 border border-white/5 text-slate-400 text-center">
                  No record found in <strong className="text-white">{selectedTable}</strong> matching &quot;{searchPk}&quot;.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-obsidian-900/60 border border-white/5 text-slate-500 text-center">
                  Type the primary key above to preview and delete the record safely.
                </div>
              )}

              {deleteStatus && (
                <div
                  className={`p-2.5 rounded-xl text-center font-semibold text-xs ${
                    deleteStatus.includes('Error')
                      ? 'bg-terracotta/20 text-terracotta border border-terracotta/30'
                      : 'bg-sage/20 text-sage border border-sage/30'
                  }`}
                >
                  {deleteStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL ADD RECORD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-3xl border-white/20 max-w-lg w-full space-y-4 shadow-glass max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>➕</span> Add Record to <span className="font-mono text-gold">{selectedTable}</span>
                </h3>
                <p className="text-[11px] text-slate-400">Fill in the fields below to insert record.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRecordSubmit} className="space-y-3 text-xs">
              {TABLE_SCHEMAS[selectedTable]?.fields.map((f) => (
                <div key={f.name}>
                  <label className="text-slate-400 block mb-1 font-medium">{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      value={formData[f.name] || f.options?.[0] || ''}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full glass-input px-3 py-2 rounded-xl text-white bg-obsidian-900"
                    >
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt} className="bg-obsidian-900 text-white">
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      required={f.label.includes('*')}
                      placeholder={f.placeholder}
                      value={formData[f.name] ?? f.default ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className="w-full glass-input px-3 py-2 rounded-xl font-mono text-white"
                    />
                  )}
                </div>
              ))}

              {formStatus && (
                <div
                  className={`p-2.5 rounded-xl text-center font-semibold text-xs ${
                    formStatus.includes('Error')
                      ? 'bg-terracotta/20 text-terracotta border border-terracotta/30'
                      : 'bg-sage/20 text-sage border border-sage/30'
                  }`}
                >
                  {formStatus}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold uppercase tracking-wider bg-gold text-obsidian-950 hover:bg-gold-light transition-all shadow-glass"
              >
                Insert
              </button>
            </form>
          </div>
        </div>
      )}

      {/* UNIVERSAL EDIT / UPDATE RECORD MODAL */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel p-6 rounded-3xl border-white/20 max-w-lg w-full space-y-4 shadow-glass max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>✏️</span> Edit Record in <span className="font-mono text-gold">{selectedTable}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Primary Key: <strong className="font-mono text-sage">{editingRow[TABLE_SCHEMAS[selectedTable]?.pk || 'std_id']}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditingRow(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditRecordSubmit} className="space-y-3 text-xs">
              {TABLE_SCHEMAS[selectedTable]?.fields.map((f) => {
                const isPk = f.name === TABLE_SCHEMAS[selectedTable]?.pk
                return (
                  <div key={f.name}>
                    <label className="text-slate-400 block mb-1 font-medium">
                      {f.label} {isPk && <span className="text-gold">(Primary Key - Read Only)</span>}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        disabled={isPk}
                        value={editFormData[f.name] || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, [f.name]: e.target.value })}
                        className="w-full glass-input px-3 py-2 rounded-xl text-white bg-obsidian-900 disabled:opacity-50"
                      >
                        {f.options?.map((opt) => (
                          <option key={opt} value={opt} className="bg-obsidian-900 text-white">
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type}
                        disabled={isPk}
                        value={editFormData[f.name] ?? ''}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                          })
                        }
                        className="w-full glass-input px-3 py-2 rounded-xl font-mono text-white disabled:opacity-50"
                      />
                    )}
                  </div>
                )
              })}

              {editStatus && (
                <div
                  className={`p-2.5 rounded-xl text-center font-semibold text-xs ${
                    editStatus.includes('Error')
                      ? 'bg-terracotta/20 text-terracotta border border-terracotta/30'
                      : 'bg-sage/20 text-sage border border-sage/30'
                  }`}
                >
                  {editStatus}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold uppercase tracking-wider bg-gold text-obsidian-950 hover:bg-gold-light transition-all shadow-glass"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchDashboard,
  fetchKiosks,
  updateTransactionStatus,
  fetchTableRecords,
  addTableRecord,
  updateTableRecord,
  deleteTableRecord,
  checkAdminSession,
  adminLogout,
  DashboardMetrics,
  Kiosk,
  Transaction,
  AdminUser,
} from '@/lib/api'

const TABLE_SCHEMAS: Record<string, {
  label: string; pk: string;
  fields: { name: string; label: string; type: string; placeholder?: string; default?: any; options?: string[] }[]
}> = {
  students: {
    label: 'Students',
    pk: 'std_id',
    fields: [
      { name: 'std_id', label: 'Registration Number *', type: 'text', placeholder: '2502050680' },
      { name: 'std_name', label: 'Full Name *', type: 'text', placeholder: 'Vikramaditya Sen' },
      { name: 'hostel', label: 'Hostel Block *', type: 'select', options: [...Array.from({ length: 12 }, (_, i) => `B${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `G${i + 1}`)] },
      { name: 'room', label: 'Room *', type: 'text', placeholder: '304' },
      { name: 'contact', label: 'Contact', type: 'text', placeholder: '9876543210' },
      { name: 'quota', label: 'Quota', type: 'number', default: 30 },
      { name: 'cycle_used', label: 'Used', type: 'number', default: 0 },
    ],
  },
  vendor: {
    label: 'Vendors',
    pk: 'Vendor_ID',
    fields: [
      { name: 'Vendor_ID', label: 'Vendor ID *', type: 'text', placeholder: 'VND03' },
      { name: 'Vendor_Name', label: 'Name *', type: 'text', placeholder: 'Royal Cleaners' },
      { name: 'Contact_No', label: 'Contact', type: 'text', placeholder: '9871122334' },
    ],
  },
  drop_point: {
    label: 'Drop Points',
    pk: 'Drop_Point_ID',
    fields: [
      { name: 'Drop_Point_ID', label: 'Point ID *', type: 'text', placeholder: 'DP05' },
      { name: 'Location', label: 'Location *', type: 'text', placeholder: 'B2' },
      { name: 'Operational_Status', label: 'Status', type: 'select', options: ['Active', 'Under Maintenance', 'Inactive'] },
      { name: 'Vendor_ID', label: 'Vendor ID *', type: 'text', placeholder: 'VND01' },
    ],
  },
  laundry_item: {
    label: 'Laundry Items',
    pk: 'Item_ID',
    fields: [
      { name: 'Item_ID', label: 'Item ID *', type: 'text', placeholder: 'ITM11' },
      { name: 'Item_Name', label: 'Name *', type: 'text', placeholder: 'Woolen Blanket' },
      { name: 'Category', label: 'Category', type: 'text', placeholder: 'Heavy Bedding' },
      { name: 'Standard_Weight', label: 'Weight (kg)', type: 'number', default: 0.5 },
    ],
  },
  laundry_transaction: {
    label: 'Transactions',
    pk: 'Transaction_ID',
    fields: [
      { name: 'Transaction_ID', label: 'Transaction ID *', type: 'text', placeholder: 'TXN99' },
      { name: 'std_id', label: 'Student Reg No *', type: 'text', placeholder: '2502050680' },
      { name: 'Drop_Point_ID', label: 'Drop Point *', type: 'text', placeholder: 'DP01' },
      { name: 'Vendor_ID', label: 'Vendor *', type: 'text', placeholder: 'VND01' },
      { name: 'Total_Weight', label: 'Weight (kg)', type: 'number', default: 3.5 },
      { name: 'Cycles_Deducted', label: 'Cycles', type: 'number', default: 1 },
      { name: 'Status', label: 'Status', type: 'select', options: ['Submitted', 'In Wash', 'Ready for Pickup', 'Completed', 'Cancelled'] },
    ],
  },
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [activeTab, setActiveTab] = useState<'stream' | 'tables'>('stream')

  const [selectedTable, setSelectedTable] = useState<string>('students')
  const [tableData, setTableData] = useState<any[]>([])
  const [tableLoading, setTableLoading] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [formStatus, setFormStatus] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const [editingRow, setEditingRow] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [editStatus, setEditStatus] = useState<string | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [searchPk, setSearchPk] = useState('')
  const [matchedRecord, setMatchedRecord] = useState<any | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)

  // Auth check on mount
  useEffect(() => {
    async function checkAuth() {
      const session = await checkAdminSession()
      if (!session.authenticated) {
        router.push('/admin/login')
        return
      }
      setAdmin(session.admin || null)
      setAuthChecked(true)
      loadAdminData()
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (authChecked && activeTab === 'tables') {
      loadSelectedTable(selectedTable)
      setSearchPk('')
      setMatchedRecord(null)
      setDeleteStatus(null)
    }
  }, [selectedTable, activeTab, authChecked])

  async function loadAdminData() {
    try {
      const [dashRes, kioskList] = await Promise.all([fetchDashboard(), fetchKiosks()])
      setMetrics(dashRes.metrics)
      setRecentTransactions(dashRes.recent_transactions || [])
      setKiosks(kioskList)
    } catch (err) {
      console.error('Failed to load admin data:', err)
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

  async function handleStatusChange(txnId: string, newStatus: string) {
    try {
      await updateTransactionStatus(txnId, newStatus)
      await loadAdminData()
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    }
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormStatus('Inserting...')
    try {
      await addTableRecord(selectedTable, formData)
      setFormStatus('✓ Record added')
      setTimeout(() => { setFormStatus(null); setShowAddModal(false); setFormData({}); loadSelectedTable(selectedTable); loadAdminData() }, 800)
    } catch (err: any) {
      setFormStatus(`Error: ${err.message}`)
    }
  }

  function handleOpenEdit(row: any) {
    setEditingRow(row)
    setEditFormData({ ...row })
    setEditStatus(null)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingRow) return
    const pkField = TABLE_SCHEMAS[selectedTable]?.pk || 'std_id'
    setEditStatus('Saving...')
    try {
      await updateTableRecord(selectedTable, editingRow[pkField], editFormData)
      setEditStatus('✓ Saved')
      setTimeout(() => { setEditingRow(null); setEditStatus(null); loadSelectedTable(selectedTable); loadAdminData() }, 800)
    } catch (err: any) {
      setEditStatus(`Error: ${err.message}`)
    }
  }

  function handleSearchDelete(term: string) {
    setSearchPk(term)
    setDeleteStatus(null)
    const pkField = TABLE_SCHEMAS[selectedTable]?.pk || 'std_id'
    if (!term.trim()) { setMatchedRecord(null); return }
    setMatchedRecord(tableData.find((row) => String(row[pkField] || '').toLowerCase() === term.trim().toLowerCase()) || null)
  }

  async function handleConfirmDelete() {
    if (!matchedRecord) return
    const pkField = TABLE_SCHEMAS[selectedTable]?.pk || 'std_id'
    const pkVal = matchedRecord[pkField]
    setDeleteStatus('Deleting...')
    try {
      await deleteTableRecord(selectedTable, pkVal)
      setDeleteStatus('✓ Deleted')
      setTimeout(() => { setShowDeleteModal(false); setMatchedRecord(null); setSearchPk(''); setDeleteStatus(null); loadSelectedTable(selectedTable); loadAdminData() }, 800)
    } catch (err: any) {
      setDeleteStatus(`Error: ${err.message}`)
    }
  }

  async function handleLogout() {
    await adminLogout()
    router.push('/admin/login')
  }

  if (!authChecked) {
    return <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">Verifying session...</div>
  }

  const columnLabels: Record<string, string> = {
    std_id: 'Reg No', std_name: 'Name', academic_year: 'Year', hostel: 'Block',
    room: 'Room', contact: 'Contact', quota: 'Quota', cycle_used: 'Used', cycle_remaining: 'Remaining',
  }

  function getDisplayCols(row: any): string[] {
    const allCols = Object.keys(row)
    if (selectedTable === 'students') {
      const order = ['std_id', 'std_name', 'academic_year', 'hostel', 'room', 'contact', 'quota', 'cycle_used', 'cycle_remaining']
      return [...order.filter(c => allCols.includes(c)), ...allCols.filter(c => !order.includes(c))]
    }
    return allCols
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Admin Console</h1>
          {admin && <p className="text-xs text-slate-500">Logged in as {admin.full_name} ({admin.role})</p>}
        </div>
        <button onClick={handleLogout} className="btn btn-outline text-xs text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 dark:bg-[#201515] dark:border-[#482020] dark:text-[#f87171] dark:hover:bg-[#2c1a1a]">
          Logout
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="metric-label">Active Loads</div>
          <div className="metric-value">{metrics?.active_loads ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Students Enrolled</div>
          <div className="metric-value">{metrics?.total_students ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Quota Utilization</div>
          <div className="metric-value text-amber-600">{metrics?.utilization_rate ?? 0}%</div>
          <div className="text-[11px] text-slate-400 mt-1">{metrics?.total_cycles_used ?? 0} / {metrics?.total_campus_quota ?? 0} cycles</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active Drop Points</div>
          <div className="metric-value">{metrics?.active_kiosks ?? '—'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => setActiveTab('stream')} className={`tab-btn ${activeTab === 'stream' ? 'tab-btn-active' : ''}`}>
          Active Orders
        </button>
        <button onClick={() => setActiveTab('tables')} className={`tab-btn ${activeTab === 'tables' ? 'tab-btn-active' : ''}`}>
          Database Tables
        </button>
      </div>

      {/* Tab 1: Active Orders Stream */}
      {activeTab === 'stream' && (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Active Wash Cycles</h3>
              <span className="text-xs text-slate-400">{recentTransactions.length} orders</span>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400">No active orders.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Student</th>
                      <th>Drop Point</th>
                      <th>Weight</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx: any) => {
                      const txnId = tx.Transaction_ID
                      const status = tx.Status || 'Submitted'
                      const isDone = status === 'Completed' || status === 'Cancelled'
                      return (
                        <tr key={txnId}>
                          <td className="font-mono font-semibold">#{txnId}</td>
                          <td className="font-mono text-primary-800">{tx.std_id}</td>
                          <td>{tx.drop_point_location || tx.Drop_Point_ID}</td>
                          <td className="font-mono">{tx.Total_Weight} kg</td>
                          <td className="text-slate-500">{tx.Drop_Off_Date ? new Date(tx.Drop_Off_Date).toLocaleDateString() : '—'}</td>
                          <td>
                            <span className={`badge ${status === 'Completed' ? 'badge-green' : status === 'Cancelled' ? 'badge-red' : 'badge-yellow'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status === 'Completed' ? 'bg-green-600' : status === 'Cancelled' ? 'bg-red-600' : 'bg-amber-500 animate-pulse'}`}></span>
                              {status}
                            </span>
                          </td>
                          <td className="text-right">
                            {!isDone ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {status === 'Submitted' && (
                                  <button onClick={() => handleStatusChange(txnId, 'In Wash')} className="btn btn-outline text-xs py-1 px-2">Move to Wash</button>
                                )}
                                {status === 'In Wash' && (
                                  <button onClick={() => handleStatusChange(txnId, 'Ready for Pickup')} className="btn btn-outline text-xs py-1 px-2">Ready</button>
                                )}
                                {status === 'Ready for Pickup' && (
                                  <button onClick={() => handleStatusChange(txnId, 'Completed')} className="btn btn-success text-xs py-1 px-2">Delivered</button>
                                )}
                                <button
                                  onClick={() => { if (confirm('Cancel this order? Cycle will be refunded.')) handleStatusChange(txnId, 'Cancelled') }}
                                  className="btn btn-danger text-xs py-1 px-2"
                                >Cancel</button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Drop Points Grid */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Drop Points</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {kiosks.map((k) => (
                <div key={k.Drop_Point_ID} className="border border-slate-200 rounded-lg p-3 text-xs">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-semibold text-slate-800 text-sm">{k.Location}</span>
                    <span className={`badge ${k.Operational_Status === 'Active' ? 'badge-green' : 'badge-red'}`}>{k.Operational_Status}</span>
                  </div>
                  <div className="text-slate-500">Vendor: <strong className="text-slate-700">{k.Vendor_Name}</strong></div>
                  <div className="text-slate-400 font-mono mt-0.5">#{k.Drop_Point_ID}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Database Tables Manager */}
      {activeTab === 'tables' && (
        <div className="card overflow-hidden">
          {/* Table selector + actions */}
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(TABLE_SCHEMAS).map((tbl) => (
                <button
                  key={tbl}
                  onClick={() => setSelectedTable(tbl)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedTable === tbl
                      ? 'bg-primary-800 text-white dark:bg-[#1a261e] dark:text-[#a3c9a8] dark:border dark:border-[#2f4233]'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-[#131915] dark:text-[#8a958d] dark:border dark:border-[#1d2420] dark:hover:bg-[#18211b]'
                  }`}
                >{TABLE_SCHEMAS[tbl].label}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setFormData({}); setFormStatus(null); setShowAddModal(true) }}
                className="btn btn-primary text-xs"
              >+ Insert</button>
              <button
                onClick={() => { setSearchPk(''); setMatchedRecord(null); setDeleteStatus(null); setShowDeleteModal(true) }}
                className="btn btn-danger text-xs"
              >Delete</button>
            </div>
          </div>

          {/* Table data */}
          <div className="px-5 py-2 text-xs text-slate-400 flex justify-between">
            <span>Table: <strong className="text-slate-600 font-mono">{selectedTable}</strong></span>
            <span>{tableData.length} rows</span>
          </div>

          {tableLoading ? (
            <div className="text-center py-12 text-sm text-slate-400">Loading...</div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">No records in &lsquo;{selectedTable}&rsquo;.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {getDisplayCols(tableData[0]).map((col) => (
                      <th key={col}>{columnLabels[col] || col}</th>
                    ))}
                    <th className="text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => (
                    <tr key={idx}>
                      {getDisplayCols(row).map((col, ci) => (
                        <td key={ci} className="font-mono text-xs">
                          {row[col] === null || row[col] === undefined ? <span className="text-slate-300">NULL</span> : String(row[col])}
                        </td>
                      ))}
                      <td className="text-right">
                        <button onClick={() => handleOpenEdit(row)} className="btn btn-outline text-xs py-1 px-2">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-800">Delete from {TABLE_SCHEMAS[selectedTable]?.label}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Search by primary key (<strong className="font-mono">{TABLE_SCHEMAS[selectedTable]?.pk}</strong>) to preview the record before deleting.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchPk}
                onChange={(e) => handleSearchDelete(e.target.value)}
                placeholder={`Enter ${TABLE_SCHEMAS[selectedTable]?.pk}...`}
                className="input-field font-mono flex-1"
              />
              {searchPk && (
                <button onClick={() => handleSearchDelete('')} className="btn btn-outline text-xs">Clear</button>
              )}
            </div>

            {matchedRecord ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-red-700">Record Found:</div>
                <div className="space-y-1 text-xs font-mono">
                  {Object.entries(matchedRecord).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-500">{key}</span>
                      <span className="text-slate-800 font-semibold">{String(value ?? 'NULL')}</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleConfirmDelete} className="btn btn-danger w-full text-xs">
                  Permanently Delete This Record
                </button>
              </div>
            ) : searchPk.trim() ? (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 text-center">No record matching &ldquo;{searchPk}&rdquo;.</div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-400 text-center">Type the primary key above to find a record.</div>
            )}

            {deleteStatus && (
              <div className={`mt-3 rounded-lg p-2 text-xs text-center font-medium ${deleteStatus.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {deleteStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-800">Insert into {TABLE_SCHEMAS[selectedTable]?.label}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              {TABLE_SCHEMAS[selectedTable]?.fields.map((f) => (
                <div key={f.name}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      value={formData[f.name] || f.options?.[0] || ''}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="input-field"
                    >
                      {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      required={f.label.includes('*')}
                      placeholder={f.placeholder}
                      value={formData[f.name] ?? f.default ?? ''}
                      onChange={(e) => setFormData({ ...formData, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="input-field font-mono"
                    />
                  )}
                </div>
              ))}
              {formStatus && (
                <div className={`rounded-lg p-2 text-xs text-center font-medium ${formStatus.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {formStatus}
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full">Insert Record</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRow && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Edit Record</h3>
                <p className="text-xs text-slate-500">
                  {TABLE_SCHEMAS[selectedTable]?.pk}: <strong className="font-mono">{editingRow[TABLE_SCHEMAS[selectedTable]?.pk]}</strong>
                </p>
              </div>
              <button onClick={() => setEditingRow(null)} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              {TABLE_SCHEMAS[selectedTable]?.fields.map((f) => {
                const isPk = f.name === TABLE_SCHEMAS[selectedTable]?.pk
                return (
                  <div key={f.name}>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      {f.label} {isPk && <span className="text-slate-400">(Read Only)</span>}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        disabled={isPk}
                        value={editFormData[f.name] || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, [f.name]: e.target.value })}
                        className="input-field disabled:opacity-50"
                      >
                        {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type}
                        disabled={isPk}
                        value={editFormData[f.name] ?? ''}
                        onChange={(e) => setEditFormData({ ...editFormData, [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className="input-field font-mono disabled:opacity-50"
                      />
                    )}
                  </div>
                )
              })}
              {editStatus && (
                <div className={`rounded-lg p-2 text-xs text-center font-medium ${editStatus.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {editStatus}
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// CampusLaundry API Client
// Handles communication between Next.js App Router and Python Flask MySQL Backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';

export interface AcademicPolicy {
  academic_months: number;
  recommended_monthly_burn: number;
  cycle_weight_cap_kg: number;
  pace_status: string;
  pace_color: 'sage' | 'gold' | 'terracotta';
}

export interface Student {
  std_id: string;
  std_name: string;
  hostel: string;
  room: string | number;
  contact: string | number;
  academic_year: string;
  quota: number;
  cycle_used: number;
  cycle_remaining: number;
  burn_percentage: number;
  academic_policy: AcademicPolicy;
}

export interface Kiosk {
  Drop_Point_ID: string;
  Location: string;
  Operational_Status: 'Active' | 'Under Maintenance' | 'Inactive';
  Vendor_ID: string;
  Vendor_Name: string;
  Contact_No: string | number;
}

export interface LaundryItem {
  Item_ID: string;
  Item_Name: string;
  Category: string;
  Standard_Weight: number;
}

export interface OrderItemInput {
  item_id: string;
  quantity: number;
}

export interface DropOffPayload {
  std_id: string;
  drop_point_id: string;
  items: OrderItemInput[];
  remarks?: string;
}

export interface TransactionItem {
  Quantity: number;
  Item_ID: string;
  Item_Name: string;
  Category: string;
  Standard_Weight: number;
  line_weight: number;
}

export interface Transaction {
  Transaction_ID: string;
  std_id: string;
  std_name?: string;
  hostel?: string;
  room?: string | number;
  contact?: string | number;
  Drop_Point_ID: string;
  drop_point_location?: string;
  Vendor_ID: string;
  vendor_name?: string;
  Drop_Off_Date: string;
  Expected_Completion_Date: string;
  Total_Weight: number;
  Cycles_Deducted: number;
  Status: 'Submitted' | 'In Wash' | 'Ready for Pickup' | 'Completed' | 'Cancelled';
  items?: TransactionItem[];
}

export interface DashboardMetrics {
  active_loads: number;
  total_transactions: number;
  completed_loads: number;
  total_students: number;
  active_kiosks: number;
  total_cycles_used: number;
  total_campus_quota: number;
  utilization_rate: number;
  academic_year_months: number;
  cycle_weight_cap_kg: number;
  default_turnaround_days: number;
}

// Helper fetch wrapper
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      cache: 'no-store', // Always get fresh data from Flask
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  } catch (error: any) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

// 1. Fetch Student Quota and 8-Month Academic Pace
export async function fetchStudentQuota(stdId: string): Promise<{
  student: Student;
  recent_orders: Transaction[];
  active_order?: any;
  can_submit_new?: boolean;
}> {
  const res = await request<{
    success: boolean;
    student: Student;
    recent_orders: Transaction[];
    active_order?: any;
    can_submit_new?: boolean;
  }>(
    `/student/${encodeURIComponent(stdId)}`
  );
  return {
    student: res.student,
    recent_orders: res.recent_orders || [],
    active_order: res.active_order || null,
    can_submit_new: res.can_submit_new !== false,
  };
}

// 1b. Register Student with Registration Number
export async function registerStudent(payload: {
  std_id: string;
  std_name: string;
  hostel: string;
  room: string;
  contact: string;
  academic_year?: string;
}): Promise<any> {
  return await request<any>('/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// In-Memory Client Cache for instantaneous navigation
let _clientKiosks: Kiosk[] | null = null;
let _clientItems: { items: LaundryItem[]; cycle_policy: any } | null = null;
let _kiosksTime = 0;
let _itemsTime = 0;
const CLIENT_CACHE_TTL = 120000; // 2 minutes

// 2. Fetch Kiosk Drop Points
export async function fetchKiosks(forceRefresh = false): Promise<Kiosk[]> {
  const now = Date.now();
  if (!forceRefresh && _clientKiosks && (now - _kiosksTime < CLIENT_CACHE_TTL)) {
    return _clientKiosks;
  }
  const res = await request<{ success: boolean; kiosks: Kiosk[] }>('/kiosks');
  _clientKiosks = res.kiosks;
  _kiosksTime = now;
  return res.kiosks;
}

// 3. Fetch Laundry Items Catalog & Weights
export async function fetchLaundryItems(forceRefresh = false): Promise<{ items: LaundryItem[]; cycle_policy: any }> {
  const now = Date.now();
  if (!forceRefresh && _clientItems && (now - _itemsTime < CLIENT_CACHE_TTL)) {
    return _clientItems;
  }
  const res = await request<{ success: boolean; items: LaundryItem[]; cycle_policy: any }>('/items');
  _clientItems = res;
  _itemsTime = now;
  return res;
}

// 4. Submit Drop-off with Weight Calculation & Cycle Deduction
export async function submitDropOff(payload: DropOffPayload): Promise<any> {
  return await request<any>('/drop-off', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// 5. Fetch Transactions
export async function fetchTransactions(status?: string, stdId?: string): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (status && status !== 'All') params.append('status', status);
  if (stdId) params.append('std_id', stdId);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await request<{ success: boolean; transactions: Transaction[] }>(`/transactions${q}`);
  return res.transactions;
}

// 6. Fetch Transaction Detail
export async function fetchTransactionDetail(txnId: string): Promise<Transaction> {
  const res = await request<{ success: boolean; transaction: Transaction }>(`/transactions/${txnId}`);
  return res.transaction;
}

// 7. Update Status
export async function updateTransactionStatus(txnId: string, status: string): Promise<any> {
  return await request<any>(`/transactions/${txnId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// 8. Fetch Dashboard Metrics
export async function fetchDashboard(): Promise<{ metrics: DashboardMetrics; recent_transactions: Transaction[] }> {
  const res = await request<{ success: boolean; metrics: DashboardMetrics; recent_transactions: Transaction[] }>(
    '/dashboard'
  );
  return { metrics: res.metrics, recent_transactions: res.recent_transactions };
}

// 9. Admin Direct Table Management APIs
export async function fetchTableRecords(tableName: string): Promise<{ records: any[]; count: number }> {
  const res = await request<{ success: boolean; records: any[]; count: number }>(
    `/admin/tables/${tableName}`
  );
  return { records: res.records, count: res.count };
}

export async function addTableRecord(tableName: string, payload: Record<string, any>): Promise<any> {
  return await request<any>(`/admin/tables/${tableName}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTableRecord(tableName: string, recordId: string, payload: Record<string, any>): Promise<any> {
  return await request<any>(`/admin/tables/${tableName}/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTableRecord(tableName: string, recordId: string): Promise<any> {
  return await request<any>(`/admin/tables/${tableName}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}

/**
 * MyHours API Type Definitions
 */

// ============================================
// Time Log Types
// ============================================

export interface TimeLog {
  id: string;
  note: string | null;
  date: string;
  duration: number; // in seconds
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskName: string | null;
  clientId: string | null;
  clientName: string | null;
  billable: boolean;
  billed: boolean;
  projectInvoiceMethod: number;
  projectArchived: boolean;
  taskArchived: boolean;
  userId: string;
  userName: string;
  start: string | null;
  end: string | null;
  startTime: string | null;
  endTime: string | null;
  running: boolean;
}

export interface AddTimeLogRequest {
  projectId: string;
  taskId: string;
  note?: string;
  date: string;
  start?: string;
  end?: string;
  duration?: number; // in seconds, alternative to start/end
  billable?: boolean;
  expense?: number;
}

export interface EditTimeLogRequest {
  note?: string;
  date?: string;
  start?: string;
  end?: string;
  duration?: number;
  billable?: boolean;
  projectId?: string;
  taskId?: string;
}

export interface StartTimerRequest {
  projectId: string;
  taskId: string;
  note?: string;
}

export interface StopTimerRequest {
  logId: string;
}

// ============================================
// Project Types
// ============================================

export interface Task {
  id: string;
  name: string;
  billable: boolean;
  archived: boolean;
  budgetHours: number | null;
  budgetAmount: number | null;
}

export interface UserProjectTask {
  id: string;
  name: string;
  projectId: string;
  listName: string;
  archived: boolean;
  billableByDefault: boolean;
  customId: string | null;
  orderNo: number;
  listOrderNo: number;
}

export interface Project {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  budgetType: number;
  budgetValue: number | null;
  billable: boolean;
  archived: boolean;
  tasks: Task[];
  hourlyRate: number | null;
  color: string | null;
}

// ============================================
// Client Types
// ============================================

export interface Client {
  id: string;
  name: string;
  archived: boolean;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  avatarUrl: string | null;
}

// ============================================
// Tag Types
// ============================================

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

// ============================================
// Report Types
// ============================================

export interface ReportEntry {
  date: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  clientId: string | null;
  clientName: string | null;
  userId: string;
  userName: string;
  duration: number;
  billable: boolean;
  note: string | null;
}

export interface ReportSummary {
  totalDuration: number;
  billableDuration: number;
  nonBillableDuration: number;
  entries: ReportEntry[];
}

// ============================================
// API Response Types
// ============================================

export interface ApiError {
  message: string;
  statusCode: number;
  details?: string;
}

// ============================================
// MCP Tool Parameter Types
// ============================================

export interface GetDailySummaryParams {
  date?: string;
}

export interface GetWeeklySummaryParams {
  week_start?: string;
}

export interface GetTimeLogsParams {
  date_from: string;
  date_to?: string;
  project_id?: string;
  client_id?: string;
}

export interface AddTimeLogParams {
  project_id: string;
  task_id: string;
  date: string;
  duration_hours: number;
  note?: string;
  billable?: boolean;
}

export interface EditTimeLogParams {
  log_id: string;
  duration_hours?: number;
  note?: string;
  billable?: boolean;
  date?: string;
}

export interface DeleteTimeLogParams {
  log_id: string;
}

export interface StartTimerParams {
  project_id: string;
  task_id: string;
  note?: string;
}

export interface StopTimerParams {
  log_id: string;
}

export interface GenerateReportParams {
  date_from: string;
  date_to: string;
  group_by?: 'project' | 'client' | 'task' | 'date';
  format?: 'summary' | 'detailed' | 'invoice';
}

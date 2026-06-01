/**
 * MyHours API Client
 *
 * Handles all communication with the MyHours REST API.
 */

import type {
  TimeLog,
  AddTimeLogRequest,
  EditTimeLogRequest,
  StartTimerRequest,
  Project,
  Client,
  User,
  Tag,
  UserProjectTask,
} from './types/api.js';

export interface MyHoursClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class MyHoursClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: MyHoursClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api2.myhours.com/api';
  }

  /**
   * Make an authenticated request to the MyHours API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-version': '1.0',
      Authorization: `ApiKey ${this.apiKey}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `MyHours API error (${response.status}): ${errorText}`
      );
    }

    // Handle empty responses (e.g., DELETE)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  // ============================================
  // Time Logs
  // ============================================

  /**
   * Get recent time logs starting from a date
   * @param date - Date in YYYY-MM-DD format
   * @param step - Number of records to return (default 100)
   */
  async getRecentLogs(date: string, step: number = 100): Promise<TimeLog[]> {
    return this.request<TimeLog[]>(
      'GET',
      `/Logs?date=${encodeURIComponent(date)}&step=${step}`
    );
  }

  /**
   * Get time logs for a specific date range
   */
  async getLogsForDateRange(
    dateFrom: string,
    dateTo: string
  ): Promise<TimeLog[]> {
    return this.request<TimeLog[]>(
      'GET',
      `/Logs/getallbetweendates?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`
    );
  }

  /**
   * Add a new time log
   */
  async addTimeLog(data: AddTimeLogRequest): Promise<TimeLog> {
    return this.request<TimeLog>('POST', '/Logs/insertlog', data);
  }

  /**
   * Edit an existing time log
   */
  async editTimeLog(id: string, data: EditTimeLogRequest): Promise<TimeLog> {
    return this.request<TimeLog>('PUT', `/Logs/${encodeURIComponent(id)}`, data);
  }

  /**
   * Delete a time log
   */
  async deleteTimeLog(id: string): Promise<void> {
    await this.request<void>('DELETE', `/Logs/${encodeURIComponent(id)}`);
  }

  /**
   * Start a new timer
   */
  async startTimer(data: StartTimerRequest): Promise<TimeLog> {
    return this.request<TimeLog>('POST', '/Logs/startNewLog', data);
  }

  /**
   * Stop a running timer
   */
  async stopTimer(logId: string): Promise<TimeLog> {
    return this.request<TimeLog>('POST', '/Logs/stopTimer', { logId });
  }

  /**
   * Get the currently running timer, if any
   */
  async getRunningTimer(): Promise<TimeLog | null> {
    const logs = await this.request<TimeLog[]>('GET', '/Logs/running');
    return logs.length > 0 ? logs[0] : null;
  }

  // ============================================
  // Projects
  // ============================================

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/Projects');
  }

  /**
   * Get a specific project by ID
   */
  async getProject(id: string): Promise<Project> {
    return this.request<Project>('GET', `/Projects/${encodeURIComponent(id)}`);
  }

  /**
   * Get active (non-archived) projects only
   */
  async getActiveProjects(): Promise<Project[]> {
    const projects = await this.getProjects();
    return projects.filter((p) => !p.archived);
  }

  /**
   * Get all tasks available to the current user
   */
  async getUserProjectTasks(): Promise<UserProjectTask[]> {
    return this.request<UserProjectTask[]>('GET', '/Projects/userProjectTasks');
  }

  /**
   * Get projects with their tasks merged in
   */
  async getProjectsWithTasks(includeArchived: boolean = false): Promise<Project[]> {
    const [projects, tasks] = await Promise.all([
      this.getProjects(),
      this.getUserProjectTasks(),
    ]);

    // Group tasks by project ID
    const tasksByProject = new Map<string, UserProjectTask[]>();
    for (const task of tasks) {
      const projectTasks = tasksByProject.get(task.projectId) || [];
      projectTasks.push(task);
      tasksByProject.set(task.projectId, projectTasks);
    }

    // Merge tasks into projects
    const projectsWithTasks = projects.map((project) => ({
      ...project,
      tasks: (tasksByProject.get(project.id) || [])
        .filter((t) => includeArchived || !t.archived)
        .map((t) => ({
          id: t.id,
          name: t.name,
          billable: t.billableByDefault,
          archived: t.archived,
          budgetHours: null,
          budgetAmount: null,
        })),
    }));

    return includeArchived
      ? projectsWithTasks
      : projectsWithTasks.filter((p) => !p.archived);
  }

  // ============================================
  // Clients
  // ============================================

  /**
   * Get all clients
   */
  async getClients(): Promise<Client[]> {
    return this.request<Client[]>('GET', '/Clients');
  }

  /**
   * Get a specific client by ID
   */
  async getClient(id: string): Promise<Client> {
    return this.request<Client>('GET', `/Clients/${encodeURIComponent(id)}`);
  }

  // ============================================
  // Users
  // ============================================

  /**
   * Get all users/team members
   */
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('GET', '/Users');
  }

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User> {
    return this.request<User>('GET', '/Users/current');
  }

  // ============================================
  // Tags
  // ============================================

  /**
   * Get all tags
   */
  async getTags(): Promise<Tag[]> {
    return this.request<Tag[]>('GET', '/Tags');
  }

  /**
   * Add a tag to a time log
   */
  async addTagToLog(logId: string, tagId: string): Promise<void> {
    await this.request<void>(
      'POST',
      `/Logs/${encodeURIComponent(logId)}/tags`,
      { tagId }
    );
  }

  /**
   * Remove a tag from a time log
   */
  async removeTagFromLog(logId: string, tagId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/Logs/${encodeURIComponent(logId)}/tags/${encodeURIComponent(tagId)}`
    );
  }
}

export interface UserSummary {
  id: number; name: string; email: string; role: 'student' | 'teacher' | 'admin'; program_id: number | null;
  is_active: boolean; is_locked: boolean; mfa_enabled: boolean; last_login_at: string | null; created_at: string;
}
export interface AuditEntry {
  id: number; actor_id: number | null; actor_name: string | null; action: string; target_type: string | null;
  target_id: string | null; detail: Record<string, unknown>; ip: string | null; created_at: string;
}
export interface Announcement {
  id: number; title: string; body: string; program_id: number | null; created_at: string; expires_at: string | null; author: string | null;
  can_manage?: boolean; owner_name?: string | null;
}
export interface Profile {
  id: number; name: string; email: string; role: 'student' | 'teacher' | 'admin'; program_id: number | null; program_name: string | null;
  created_at: string; last_login_at: string | null;
  mfa_enabled: boolean; mfa_required: boolean; mfa_recovery_codes_left: number;
  // mfa_enabled means any second factor; these split it into the authenticator app and the registered passkeys
  totp_enabled: boolean; passkey_count: number;
  active_sessions: number; session_idle_minutes: number;
  // Teachers only; a limit of 0 means unlimited
  storage_used_bytes?: number; storage_limit_bytes?: number;
}
export interface SearchHit { id: number; title: string; description: string | null; [key: string]: unknown }
export interface SearchResults {
  query: string;
  models: SearchHit[]; videos: SearchHit[]; quizzes: SearchHit[]; resources: SearchHit[];
  annotations: (SearchHit & { model_id: number; model_title: string })[];
}
export interface QuizProgress {
  quiz_id: number; title: string; category: string | null; attempts: number; best_score: number | null; latest_score: number | null;
  recent_scores: number[]; last_attempted_at: string; pending_review: number;
}
export interface CategoryAccuracy { category: string; answered: number; accuracy: number }
export interface StudentStats {
  summary: { attempts: number; quizzes_taken: number; average_score: number | null; best_score: number | null };
  quizzes: QuizProgress[];
  categories: CategoryAccuracy[];
}
export interface RecentItem { item_type: 'model' | 'video' | 'quiz' | 'resource'; id: number; title: string; last_viewed_at: string }
export interface StudentDashboard extends StudentStats {
  role: 'student'; recent: RecentItem[]; announcements: Announcement[];
  counts: { models: number; videos: number; quizzes: number; resources: number };
}
export interface TeacherOverview {
  totals: { students: number; teachers: number; models: number; videos: number; quizzes: number; resources: number; unpublished: number; attempts_this_week: number };
  pending_review: number;
  recent_attempts: { id: number; score: number | null; status: string; attempted_at: string; quiz_title: string; quiz_id: number; student_name: string | null }[];
  quiz_performance: { quiz_id: number; title: string; attempts: number; average_score: number | null }[];
}
export interface TeacherDashboard extends TeacherOverview { role: 'teacher'; announcements: Announcement[] }
export interface Paged<T> { items: T[]; total: number }

export interface Passkey { id: number; name: string; device_type: string | null; backed_up: boolean; created_at: string; last_used_at: string | null }

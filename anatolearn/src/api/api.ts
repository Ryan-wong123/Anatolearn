import type { AnnotationPayload, AnnotationRecord, ModelRecord } from '../types/anatomy';
import type { Announcement, AuditEntry, Paged, Profile, SearchResults, StudentDashboard, StudentStats, TeacherDashboard, TeacherOverview, UserSummary } from '../types/portal';

const API_BASE = "/api";

// The session lives in an httpOnly cookie the page cannot read. State-changing requests echo the readable
// CSRF cookie back in a header so other sites cannot forge them.
function csrfHeaders(method = 'GET'): Record<string, string> {
    if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) || typeof document === 'undefined') return {};
    const match = document.cookie.split('; ').find((part) => part.startsWith('anatolearn_csrf='));
    return match ? { 'X-CSRF-Token': decodeURIComponent(match.slice('anatolearn_csrf='.length)) } : {};
}

function messageFor(status: number, body: unknown): string {
    let message = status === 401 ? 'Your session has expired. Please sign in again.'
        : status === 403 ? 'You do not have permission to perform this action.'
        : status === 404 ? 'This content is unavailable.'
        : status === 429 ? 'Too many requests. Please wait a moment and try again.'
        : status === 503 ? 'The service is restarting. Please try again in a moment.'
        : 'The server could not complete the request. Please try again.';
    if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' && body.message.trim()
        && (status < 500 || status === 503)) message = body.message;
    return message;
}

function sessionExpired() {
    sessionStorage.removeItem('anatolearn_user');
    window.dispatchEvent(new Event('anatolearn-session-expired'));
}

export type LoginResult = {
    user?: { id: number; name: string; email: string; role: 'student' | 'teacher' | 'admin'; program_id: number | null };
    mfa_setup_required?: boolean;
    mfa_required?: boolean;
    mfa_token?: string;
    recovery_codes_remaining?: number;
};

export class ApiError extends Error {
    status: number;
    constructor(message: string, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}

async function fetchResponse(endpoint: string, options: RequestInit = {}) {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${endpoint}`, {
            ...options, credentials: 'include',
            headers: {
                ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),
                ...csrfHeaders(options.method),
                ...(sessionStorage.getItem('anatolearn_program') ? {'X-Program-Name':encodeURIComponent(sessionStorage.getItem('anatolearn_program')!)} : {}),
                ...(options.headers || {}),
            },
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        throw new ApiError('Could not connect to the server. Check your connection and try again.');
    }
    if (res.status === 401 && !endpoint.startsWith('/auth/')) sessionExpired();
    if (!res.ok) {
        let body: unknown;
        try { body = await res.json(); } catch { /* Non-JSON proxy/server errors use the readable fallback. */ }
        if (res.status === 403 && typeof body === 'object' && body !== null && 'code' in body && body.code === 'mfa_setup_required')
            window.dispatchEvent(new Event('anatolearn-mfa-required'));
        throw new ApiError(messageFor(res.status, body), res.status);
    }
    return res;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetchResponse(endpoint, options);
    try { return await response.json(); }
    catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        throw new ApiError('The server returned an unreadable response. Please try again.', response.status);
    }
}

function request(endpoint: string) {
    return apiFetch(endpoint);
}

// List endpoints accept ?page&page_size and report the full count in X-Total-Count.
async function requestPaged<T>(endpoint: string): Promise<Paged<T>> {
    const response = await fetchResponse(endpoint);
    let items: T[];
    try { items = await response.json() as T[]; }
    catch { throw new ApiError('The server returned an unreadable response. Please try again.', response.status); }
    const total = Number(response.headers.get('X-Total-Count'));
    return { items, total: Number.isFinite(total) && total >= items.length ? total : items.length };
}

function query(params: Record<string, string | number | boolean | undefined | null>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
    const text = search.toString();
    return text ? `?${text}` : '';
}

export type FavoriteType = 'video' | 'quiz' | 'model' | 'resource';

export interface UploadOptions { onProgress?: (fraction: number) => void; signal?: AbortSignal }

// fetch() cannot report upload progress, so file uploads use XMLHttpRequest. Aborting rejects with an AbortError.
export function apiUpload<T = unknown>(endpoint: string, formData: FormData, { onProgress, signal }: UploadOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('Upload cancelled', 'AbortError'));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}${endpoint}`);
        xhr.withCredentials = true;
        for (const [name, value] of Object.entries(csrfHeaders('POST'))) xhr.setRequestHeader(name, value);
        const program = sessionStorage.getItem('anatolearn_program');
        if (program) xhr.setRequestHeader('X-Program-Name', encodeURIComponent(program));
        const abort = () => xhr.abort();
        signal?.addEventListener('abort', abort);
        const done = () => signal?.removeEventListener('abort', abort);
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded / event.total); };
        xhr.onload = () => {
            done();
            let body: unknown;
            try { body = JSON.parse(xhr.responseText); } catch { /* handled below */ }
            if (xhr.status === 401) sessionExpired();
            if (xhr.status >= 200 && xhr.status < 300 && body !== undefined) { onProgress?.(1); resolve(body as T); }
            else reject(new ApiError(xhr.status >= 200 && xhr.status < 300 ? 'The server returned an unreadable response. Please try again.' : messageFor(xhr.status, body), xhr.status));
        };
        xhr.onerror = () => { done(); reject(new ApiError('Could not connect to the server. Check your connection and try again.')); };
        xhr.onabort = () => { done(); reject(new DOMException('Upload cancelled', 'AbortError')); };
        xhr.send(formData);
    });
}

// For endpoints that return a file rather than JSON (model downloads,
// annotation exports). A plain <a href> can't carry the Authorization
// header, so this fetches as a blob with the header attached, then
// triggers a normal browser save using the filename the server provided.
async function downloadFile(endpoint: string) {
    const res = await fetchResponse(endpoint);

    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : 'download';

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export const api = {
    // Paged list helpers (page is 1-based). Filters match the unpaged endpoints.
    getModelsPage: (opts: { page: number; pageSize: number; publishedOnly?: boolean; system?: string; part?: string; q?: string }) =>
        requestPaged<ModelRecord>(`/models${query({ published: opts.publishedOnly ? 'true' : undefined, system: opts.system, part: opts.part, q: opts.q, page: opts.page, page_size: opts.pageSize })}`),
    getVideosPage: (opts: { page: number; pageSize: number; publishedOnly?: boolean }) =>
        requestPaged<Record<string, unknown>>(`/videos${query({ published: opts.publishedOnly ? 'true' : undefined, page: opts.page, page_size: opts.pageSize })}`),
    getQuizzesPage: (opts: { page: number; pageSize: number; publishedOnly?: boolean }) =>
        requestPaged<Record<string, unknown>>(`/quizzes${query({ published: opts.publishedOnly ? 'true' : undefined, page: opts.page, page_size: opts.pageSize })}`),
    getResourcesPage: (opts: { page: number; pageSize: number; publishedOnly?: boolean }) =>
        requestPaged<Record<string, unknown>>(`/resources${query({ published: opts.publishedOnly ? 'true' : undefined, page: opts.page, page_size: opts.pageSize })}`),

    // Account, profile and privacy
    getProfile: (): Promise<Profile> => request('/profile'),
    updateProfile: (data: { name: string; program_id?: number | null }): Promise<Profile> => apiFetch('/profile', { method: 'PUT', body: JSON.stringify(data) }),
    changePassword: (current_password: string, new_password: string): Promise<{ message: string }> =>
        apiFetch('/profile/password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) }),
    mfaSetup: (password: string): Promise<{ secret: string; otpauth_uri: string }> =>
        apiFetch('/profile/mfa/setup', { method: 'POST', body: JSON.stringify({ password }) }),
    mfaEnable: (code: string): Promise<{ recovery_codes: string[] }> =>
        apiFetch('/profile/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
    mfaDisable: (password: string, code: string): Promise<{ message: string }> =>
        apiFetch('/profile/mfa/disable', { method: 'POST', body: JSON.stringify({ password, code }) }),
    mfaRecoveryCodes: (password: string, code: string): Promise<{ recovery_codes: string[] }> =>
        apiFetch('/profile/mfa/recovery-codes', { method: 'POST', body: JSON.stringify({ password, code }) }),
    signOutEverywhere: (): Promise<{ message: string }> => apiFetch('/profile/sessions', { method: 'DELETE' }),
    exportMyData: () => downloadFile('/profile/export'),
    deleteMyAccount: (password: string) => apiFetch('/profile', { method: 'DELETE', body: JSON.stringify({ password }) }),

    // Teacher user management and audit log
    getUsers: (opts: { page: number; pageSize: number; q?: string; role?: string; status?: string }) =>
        requestPaged<UserSummary>(`/users${query({ q: opts.q, role: opts.role, status: opts.status, page: opts.page, page_size: opts.pageSize })}`),
    createUser: (data: { name: string; email: string; role: 'student' | 'teacher' | 'admin'; program_id?: number | null; password?: string }): Promise<{ user: UserSummary; temporary_password?: string }> =>
        apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: number, data: { name?: string; role?: 'student' | 'teacher' | 'admin'; program_id?: number | null; is_active?: boolean; unlock?: boolean }): Promise<UserSummary> =>
        apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    resetUserPassword: (id: number, password?: string): Promise<{ temporary_password?: string; message?: string }> =>
        apiFetch(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify(password ? { password } : {}) }),
    // Teachers: take ownership of content nobody owns. Administrators: move content between teachers.
    claimContent: (kind: string, id: number): Promise<{ message: string }> => apiFetch(`/${kind}/${id}/claim`, { method: 'POST' }),
    transferContent: (fromUserId: number, toUserId: number): Promise<{ total: number; to: string }> =>
        apiFetch(`/users/${fromUserId}/transfer-content`, { method: 'POST', body: JSON.stringify({ to_user_id: toUserId }) }),
    assignUnclaimedContent: (toUserId: number): Promise<{ total: number; to: string }> =>
        apiFetch('/content/assign-unclaimed', { method: 'POST', body: JSON.stringify({ to_user_id: toUserId }) }),
    resetUserMfa: (id: number): Promise<{ message: string }> => apiFetch(`/users/${id}/reset-mfa`, { method: 'POST' }),
    deleteUser: (id: number) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    getAuditLog: (opts: { page: number; pageSize: number; action?: string; actor?: number }) =>
        requestPaged<AuditEntry>(`/audit-log${query({ action: opts.action, actor: opts.actor, page: opts.page, page_size: opts.pageSize })}`),

    // Announcements, search and dashboards
    getAnnouncements: (): Promise<Announcement[]> => request('/announcements'),
    createAnnouncement: (data: { title: string; body: string; program_id?: number | null; expires_at?: string | null }): Promise<Announcement> =>
        apiFetch('/announcements', { method: 'POST', body: JSON.stringify(data) }),
    updateAnnouncement: (id: number, data: { title: string; body: string; program_id?: number | null; expires_at?: string | null }): Promise<Announcement> =>
        apiFetch(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAnnouncement: (id: number) => apiFetch(`/announcements/${id}`, { method: 'DELETE' }),
    search: (q: string): Promise<SearchResults> => request(`/search${query({ q })}`),
    getDashboard: (): Promise<StudentDashboard | TeacherDashboard> => request('/dashboard'),
    getMyStats: (): Promise<StudentStats> => request('/students/me/stats'),
    getTeacherOverview: (): Promise<TeacherOverview> => request('/teacher/overview'),

    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
    setProgram: (kind: string, id: number, program_id: number | null) => apiFetch(`/${kind}/${id}/program`, { method: 'PATCH', body: JSON.stringify({ program_id }) }),
    setDownloadPermission: (id: number, is_downloadable: boolean) => apiFetch(`/models/${id}/download-permission`, { method: 'PATCH', body: JSON.stringify({ is_downloadable }) }),
    setQuizTimer: (id: number, time_limit_seconds: number | null) => apiFetch(`/quizzes/${id}/timer`, { method: 'PATCH', body: JSON.stringify({ time_limit_seconds }) }),
    cancelQuizSession: (id: string) => apiFetch(`/quiz-sessions/${id}/cancel`, {method:'POST',keepalive:true}),
    startQuiz: (id: number) => apiFetch(`/quizzes/${id}/start`, { method: 'POST' }),
    getAllAttempts: (id: number) => request(`/quizzes/${id}/attempts`),
    getQuestionBank: () => request('/question-bank'),
    bankQuestion: (id: number, category: string) => apiFetch(`/question-bank/from-question/${id}`, { method:'POST', body:JSON.stringify({category}) }),
    importQuestion: (quizId: number, bankId: number) => apiFetch(`/quizzes/${quizId}/bank-questions/${bankId}`, {method:'POST'}),
    deleteBankQuestion: (id: number) => apiFetch(`/question-bank/${id}`, {method:'DELETE'}),
    updateBankQuestion: (id: number, data: object) => apiFetch(`/question-bank/${id}`, {method:'PUT',body:JSON.stringify(data)}),
    login: (email: string, password: string): Promise<LoginResult> =>
        apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        }),
    // Second step of sign-in for accounts with two-factor authentication: an authenticator code or a recovery code.
    verifyMfa: (mfa_token: string, code: string): Promise<LoginResult> =>
        apiFetch('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ mfa_token, code }) }),

    register: (data: {
        name: string;
        email: string;
        password: string;
        role: "student" | "teacher";
        program_id?: number;
        invite_code?: string;
    }) =>
        apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    getPrograms: () => request("/programs"),

    getModels: (publishedOnly?: boolean, filters?: { system?: string; part?: string; q?: string }) => {
        const params = new URLSearchParams();
        if (publishedOnly) params.set('published', 'true');
        if (filters?.system) params.set('system', filters.system);
        if (filters?.part) params.set('part', filters.part);
        if (filters?.q) params.set('q', filters.q);
        const qs = params.toString();
        return request(`/models${qs ? `?${qs}` : ''}`);
    },

    getModel: (id: number): Promise<ModelRecord> => request(`/models/${id}`),

    saveModelThumbnail: (id: number, thumbnailDataUrl: string) =>
        apiFetch(`/models/${id}/thumbnail`, {
            method: 'PATCH',
            body: JSON.stringify({ thumbnailDataUrl }),
        }),

    uploadModel: (data: {
        title: string;
        description?: string;
        program_id?: number;
        body_system?: string;
        body_part?: string;
        file: File;
    }, upload?: UploadOptions) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        if (data.program_id) formData.append('program_id', String(data.program_id));
        if (data.body_system) formData.append('body_system', data.body_system);
        if (data.body_part) formData.append('body_part', data.body_part);
        formData.append('model', data.file);

        return apiUpload(`/models/upload`, formData, upload);
    },

    deleteModel: (id: number) =>
        apiFetch(`/models/${id}`, { method: 'DELETE' }),

    publishModel: (id: number, isPublished: boolean) =>
        apiFetch(`/models/${id}/publish`, {
            method: 'PATCH',
            body: JSON.stringify({ is_published: isPublished }),
        }),

    updateModel: (
        id: number,
        data: { title: string; description?: string; body_system?: string; body_part?: string }
    ) =>
        apiFetch(`/models/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    getVideos: (publishedOnly?: boolean) =>
        request(`/videos${publishedOnly ? '?published=true' : ''}`),

    getVideo: (id: number) => request(`/videos/${id}`),

    saveVideoProgress: (id: number, position: number) =>
        fetchResponse(`/videos/${id}/progress`, { method: 'PUT', body: JSON.stringify({ position }), keepalive: true }),

    uploadVideo: (data: { title: string; description?: string; program_id?: number; file: File; captions?: File }, upload?: UploadOptions) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        if (data.program_id) formData.append('program_id', String(data.program_id));
        formData.append('video', data.file);
        if (data.captions) formData.append('captions', data.captions);

        return apiUpload(`/videos/upload`, formData, upload);
    },

    uploadVideoCaptions: (id: number, captions: File) => {
        const formData = new FormData();
        formData.append('captions', captions);
        return apiFetch(`/videos/${id}/captions`, { method: 'POST', body: formData });
    },

    removeVideoCaptions: (id: number) => apiFetch(`/videos/${id}/captions`, { method: 'DELETE' }),

    deleteVideo: (id: number) =>
        apiFetch(`/videos/${id}`, { method: 'DELETE' }),

    publishVideo: (id: number, isPublished: boolean) =>
        apiFetch(`/videos/${id}/publish`, {
            method: 'PATCH',
            body: JSON.stringify({ is_published: isPublished }),
        }),

    updateVideo: (id: number, data: { title: string; description?: string; annotation_id?: number | null }) =>
        apiFetch(`/videos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Task 7.6 — every annotation across every model, with its model's
    // title joined in, for the video-linking dropdown.
    getAllAnnotations: () => request(`/annotations`),

    downloadModel: (id: number) => downloadFile(`/models/${id}/download`),

    exportAnnotations: (modelId: number, format: 'json' | 'csv') =>
        downloadFile(`/models/${modelId}/annotations/export?format=${format}`),

    getQuizzes: (publishedOnly?: boolean) =>
        request(`/quizzes${publishedOnly ? '?published=true' : ''}`),

    deleteQuiz: (id: number) =>
        apiFetch(`/quizzes/${id}`, { method: 'DELETE' }),

    updateQuiz: (id: number, data: { title: string; description?: string; category?: string }) =>
        apiFetch(`/quizzes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    getQuizQuestions: (id: number) => request(`/quizzes/${id}/questions`),

    getResources: (publishedOnly?: boolean) =>
        request(`/resources${publishedOnly ? '?published=true' : ''}`),

    uploadResource: (data: {
        title: string;
        description?: string;
        resource_type: 'pdf' | 'document' | 'link' | 'image';
        url?: string;
        file?: File;
        program_id?: number;
    }, upload?: UploadOptions) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        formData.append('resource_type', data.resource_type);
        if (data.url) formData.append('url', data.url);
        if (data.file) formData.append('file', data.file);
        if (data.program_id) formData.append('program_id', String(data.program_id));

        return apiUpload(`/resources/upload`, formData, upload);
    },

    deleteResource: (id: number) =>
        apiFetch(`/resources/${id}`, { method: 'DELETE' }),

    updateResource: (id: number, data: { title: string; description?: string; url?: string }) =>
        apiFetch(`/resources/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    publishResource: (id: number, isPublished: boolean) =>
        apiFetch(`/resources/${id}/publish`, {
            method: 'PATCH',
            body: JSON.stringify({ is_published: isPublished }),
        }),

    getAnnotations: (modelId: number): Promise<AnnotationRecord[]> =>
        request(`/models/${modelId}/annotations`),

    createAnnotation: (
        modelId: number,
        data: AnnotationPayload
    ): Promise<AnnotationRecord> =>
        apiFetch(`/models/${modelId}/annotations`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    deleteAnnotation: (id: number) =>
        apiFetch(`/annotations/${id}`, { method: 'DELETE' }),

    updateAnnotation: (
        id: number,
        data: AnnotationPayload
    ): Promise<AnnotationRecord> =>
        apiFetch(`/annotations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    saveNeutralView: (
        id: number,
        neutralView: {
            cameraPosition: {
            x: number;
            y: number;
            z: number;
            };
            target: {
            x: number;
            y: number;
            z: number;
            };
        }
    ) =>
        apiFetch(`/models/${id}/neutral-view`, {
            method: 'PATCH',
            body: JSON.stringify(neutralView),
        }),

    createQuiz: (data: {
        title: string;
        description?: string;
        type: 'MCQ' | 'Practical' | 'Mixed';
        category?: string;
        program_id?: number;
    }) =>
        apiFetch(`/quizzes`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    createQuizQuestion: (
        quizId: number,
        data: {
            question: string;
            format: 'mcq' | 'open_ended';
            option_a?: string;
            option_b?: string;
            option_c?: string;
            option_d?: string;
            correct_option?: 'A' | 'B' | 'C' | 'D';
            model_answer?: string;
        }
    ) =>
        apiFetch(`/quizzes/${quizId}/questions`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    publishQuiz: (id: number, isPublished: boolean) =>
        apiFetch(`/quizzes/${id}/publish`, {
            method: 'PATCH',
            body: JSON.stringify({ is_published: isPublished }),
        }),

    deleteQuizQuestion: (id: number) =>
        apiFetch(`/questions/${id}`, { method: 'DELETE' }),

    updateQuizType: (id: number, type: 'MCQ' | 'Practical' | 'Mixed') =>
        apiFetch(`/quizzes/${id}/type`, {
            method: 'PATCH',
            body: JSON.stringify({ type }),
        }),

    updateQuizQuestion: (
        id: number,
        data: {
            question: string;
            format: 'mcq' | 'open_ended';
            option_a?: string;
            option_b?: string;
            option_c?: string;
            option_d?: string;
            correct_option?: 'A' | 'B' | 'C' | 'D';
            model_answer?: string;
        }
    ) =>
        apiFetch(`/questions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    submitQuiz: (
        quizId: number,
        answers: { question_id: number; selected_option?: string; answer_text?: string }[],
        sessionId: string
    ) =>
        apiFetch(`/quizzes/${quizId}/submit`, {
            method: 'POST',
            body: JSON.stringify({ answers, session_id: sessionId }),
        }),

    getPendingAttempts: (quizId: number) =>
        request(`/quizzes/${quizId}/attempts/pending`),

    getMyAttempts: () => request(`/students/me/attempts`),

    getAttemptAnswers: (attemptId: number) =>
        request(`/attempts/${attemptId}/answers`),

    getAttempt: (id: number) => request(`/attempts/${id}`),

    gradeAttemptAnswer: (answerId: number, teacherScore: number) =>
        apiFetch(`/attempt-answers/${answerId}/grade`, {
            method: 'PATCH',
            body: JSON.stringify({ teacher_score: teacherScore }),
        }),

    getFavorites: () => request(`/favorites`),

    addFavorite: (itemType: FavoriteType, itemId: number) =>
        apiFetch(`/favorites`, {
            method: 'POST',
            body: JSON.stringify({ item_type: itemType, item_id: itemId }),
        }),

    removeFavorite: (itemType: FavoriteType, itemId: number) =>
        apiFetch(`/favorites/${itemType}/${itemId}`, { method: 'DELETE' }),
};

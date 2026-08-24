const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

// Single source of truth for where the JWT lives in sessionStorage.
// AppContext.tsx imports this too, so both stay in sync automatically.
export const TOKEN_STORAGE_KEY = "anatolearn_token";

function getAuthHeaders(): Record<string, string> {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// Every request (GET, upload, mutation) goes through this, so the
// Authorization header only needs to be handled in one place.
async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const isFormData = options.body instanceof FormData;

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            // FormData sets its own multipart Content-Type + boundary —
            // setting it manually here would break file uploads.
            ...(isFormData ? {} : { "Content-Type": "application/json" }),
            ...getAuthHeaders(),
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        // Surface the backend's own error message (e.g. "Invalid email or
        // password") instead of a generic "API error: 401" where possible —
        // needed for the login page to show a real error.
        let message = `API error: ${res.status}`;
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            // response body wasn't JSON — keep the generic message
        }
        throw new Error(message);
    }

    return res.json();
}

function request(endpoint: string) {
    return apiFetch(endpoint);
}

// For endpoints that return a file rather than JSON (model downloads,
// annotation exports). A plain <a href> can't carry the Authorization
// header, so this fetches as a blob with the header attached, then
// triggers a normal browser save using the filename the server provided.
async function downloadFile(endpoint: string) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { ...getAuthHeaders() },
    });

    if (!res.ok) {
        let message = `API error: ${res.status}`;
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            // response body wasn't JSON — keep the generic message
        }
        throw new Error(message);
    }

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
    login: (email: string, password: string) =>
        apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        }),

    register: (data: {
        name: string;
        email: string;
        password: string;
        role: "student" | "teacher";
        program_id?: number;
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

    getModel: (id: number) => request(`/models/${id}`),

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
    }) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        if (data.program_id) formData.append('program_id', String(data.program_id));
        if (data.body_system) formData.append('body_system', data.body_system);
        if (data.body_part) formData.append('body_part', data.body_part);
        formData.append('model', data.file);

        return apiFetch(`/models/upload`, {
            method: 'POST',
            body: formData,
        });
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

    uploadVideo: (data: { title: string; description?: string; program_id?: number; file: File }) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        if (data.program_id) formData.append('program_id', String(data.program_id));
        formData.append('video', data.file);

        return apiFetch(`/videos/upload`, {
            method: 'POST',
            body: formData,
        });
    },

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
        resource_type: 'pdf' | 'document' | 'link';
        url?: string;
        file?: File;
        program_id?: number;
    }) => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        formData.append('resource_type', data.resource_type);
        if (data.url) formData.append('url', data.url);
        if (data.file) formData.append('file', data.file);
        if (data.program_id) formData.append('program_id', String(data.program_id));

        return apiFetch(`/resources/upload`, {
            method: 'POST',
            body: formData,
        });
    },

    deleteResource: (id: number) =>
        apiFetch(`/resources/${id}`, { method: 'DELETE' }),

    publishResource: (id: number, isPublished: boolean) =>
        apiFetch(`/resources/${id}/publish`, {
            method: 'PATCH',
            body: JSON.stringify({ is_published: isPublished }),
        }),

    getAnnotations: (modelId: number) =>
        request(`/models/${modelId}/annotations`),

    createAnnotation: (
        modelId: number,
        data: {
            annotation_type: 'point' | 'highlight' | 'region_fill';
            label: string;
            description: string;
            color?: string | null;
            annotation_data: object;
        }
    ) =>
        apiFetch(`/models/${modelId}/annotations`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    deleteAnnotation: (id: number) =>
        apiFetch(`/annotations/${id}`, { method: 'DELETE' }),

    updateAnnotation: (
        id: number,
        data: {
            annotation_type: 'point' | 'highlight' | 'region_fill';
            label: string;
            description: string;
            color?: string | null;
            annotation_data: object;
        }
    ) =>
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
        answers: { question_id: number; selected_option?: string; answer_text?: string }[]
    ) =>
        apiFetch(`/quizzes/${quizId}/submit`, {
            method: 'POST',
            body: JSON.stringify({ answers }),
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
};

import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import Dialog from '../components/Dialog';
import ContentSettings from '../components/ContentSettings';
import OwnerNote from '../components/OwnerNote';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Play, Upload, X, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContextState';
import { useToast } from '../context/ToastContextState';
import { useConfirm } from '../context/ConfirmContextState';
import { api } from '../api/api';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import UploadProgress from '../components/UploadProgress';
import { usePageState } from '../components/content/usePageState';
import { useUpload } from '../components/content/useUpload';

const PAGE_SIZE = 12;
const NO_VIDEOS = { items: [] as Video[], total: 0 };

interface Video {
  id: number;
  program_id: number | null;
  title: string;
  description: string | null;
  video_path: string;
  captions_path: string | null;
  thumbnail_path: string | null;
  is_published: boolean;
  annotation_id: number | null;
  created_at: string;
  can_manage?: boolean;
  owner_name?: string | null;
}

interface AnnotationOption {
  id: number;
  label: string;
  annotation_type: string;
  model_title: string;
}

export default function Videos() {
  const { role, program } = useAppContext();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();


  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaptions, setUploadCaptions] = useState<File | null>(null);
  const upload = useUpload();
  const uploading = upload.uploading;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAnnotationId, setEditAnnotationId] = useState<string>('');
  const [editCaptions, setEditCaptions] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Task 7.6 — populated once, teacher-only (the endpoint itself is
  // teacher-gated too, so this just avoids firing a request that would 403
  // for a student viewing this page).


  // Students only — which video ids are currently favorited, so the heart
  // icon on each card can render filled/unfilled.


  const fetchAnnotations = useCallback(() => role === 'teacher' ? api.getAllAnnotations() : Promise.resolve([]), [role]);
  const annotations = useResource<AnnotationOption[]>(fetchAnnotations, [], program);
  const annotationOptions = annotations.data;
  const fetchFavorites = useCallback(async () => {
    if (role !== 'student') return new Set<number>();
    const data:{videos:{id:number}[]} = await api.getFavorites();
    return new Set(data.videos.map((video) => video.id));
  }, [role]);
  const favorites = useResource<Set<number>>(fetchFavorites, new Set(), program);
  const {data:favoritedVideoIds,setData:setFavoritedVideoIds} = favorites;

  const toggleFavorite = async (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFavorited = favoritedVideoIds.has(video.id);
    try {
      if (isFavorited) {
        await api.removeFavorite('video', video.id);
        setFavoritedVideoIds((prev) => {
          const next = new Set(prev);
          next.delete(video.id);
          return next;
        });
      } else {
        await api.addFavorite('video', video.id);
        setFavoritedVideoIds((prev) => new Set(prev).add(video.id));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast('Failed to update favorite. Please try again.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const filterKey = `${role}|${program}|${debouncedSearch}`;
  const [page, setPage] = usePageState(filterKey);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const changePage = (next: number) => {
    setPage(next);
    requestAnimationFrame(() => { listHeading.current?.focus(); listHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); });
  };

  // Without a search the server pages the list. Title search is matched in the browser (the API has no text filter),
  // so a search loads the full list and pages the matches.
  const fetchVideos = useCallback(async () => {
    const publishedOnly = role === 'student';
    if (!debouncedSearch) return api.getVideosPage({ page, pageSize: PAGE_SIZE, publishedOnly }) as unknown as Promise<{ items: Video[]; total: number }>;
    const term = debouncedSearch.toLowerCase();
    const matches = ((await api.getVideos(publishedOnly)) as Video[]).filter((video) => video.title.toLowerCase().includes(term));
    return { items: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: matches.length };
  }, [role, page, debouncedSearch]);
  const { data: videoPage, reload: loadVideos, loading, error: loadError } = useResource(fetchVideos, NO_VIDEOS, `${program}|${page}|${filterKey}`);
  const filtered = videoPage.items;
  const afterRemoval = () => { if (filtered.length === 1 && page > 1) changePage(page - 1); loadVideos(); };
  const clearSearch = () => { setSearch(''); setDebouncedSearch(''); };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please select a video file.');
      return;
    }

    try {
      setUploadError(null);
      const outcome = await upload.run((options) => api.uploadVideo({
        title: uploadTitle,
        description: uploadDescription || undefined,
        file: uploadFile,
        captions: uploadCaptions ?? undefined,
      }, options));
      if (outcome.cancelled) { toast('Upload cancelled'); return; }
      loadVideos();
      closeUploadModal();
      toast('Video uploaded successfully');
    } catch (err) {
      console.error('Failed to upload video:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const closeUploadModal = () => {
    upload.cancel();
    setShowUpload(false);
    setUploadTitle('');
    setUploadDescription('');
    setUploadFile(null);
    setUploadCaptions(null);
    setUploadError(null);
  };

  const handleTogglePublish = async (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.publishVideo(video.id, !video.is_published);
      loadVideos();
      toast(video.is_published ? 'Video unpublished' : 'Video published');
    } catch (err) {
      console.error('Failed to update publish state:', err);
      toast('The change could not be saved. Please try again.', 'error');
    }
  };

  const handleDelete = async (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Video',
      message: `Are you sure you want to delete "${video.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.deleteVideo(video.id);
      afterRemoval();
      toast('Video deleted');
    } catch (err) {
      console.error('Failed to delete video:', err);
      toast('The change could not be saved. Please try again.', 'error');
    }
  };

  const openEdit = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || '');
    setEditAnnotationId(video.annotation_id ? String(video.annotation_id) : '');
    setEditCaptions(null);
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingVideo(null);
    setEditTitle('');
    setEditDescription('');
    setEditAnnotationId('');
    setEditCaptions(null);
    setEditError(null);
  };

  const handleSaveCaptions = async () => {
    if (!editingVideo) return;
    try {
      const updated = editCaptions
        ? await api.uploadVideoCaptions(editingVideo.id, editCaptions)
        : await api.removeVideoCaptions(editingVideo.id);
      setEditingVideo({ ...editingVideo, captions_path: updated.captions_path });
      setEditCaptions(null);
      loadVideos();
      toast(editCaptions ? 'Captions updated' : 'Captions removed');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not update captions.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;

    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }

    try {
      await api.updateVideo(editingVideo.id, {
        title: editTitle,
        description: editDescription || undefined,
        annotation_id: editAnnotationId ? Number(editAnnotationId) : null,
      });
      loadVideos();
      closeEdit();
      toast('Video updated');
    } catch (err) {
      console.error('Failed to update video:', err);
      setEditError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Educational Videos
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bite-sized visual explanations of anatomical structures.
          </p>
        </div>

        {role === 'teacher' && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            + Upload Video
          </button>
        )}
      </div>

      <div className="mt-6 mb-6 flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search videos"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-slate-900 dark:text-slate-100 w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400"
          />
        </div>
      </div>

      <RequestState loading={false} error={role === 'teacher' ? annotations.error : favorites.error} onRetry={role === 'teacher' ? annotations.reload : favorites.reload} label={role === 'teacher' ? 'annotation links' : 'video favourites'} />
      <h2 ref={listHeading} tabIndex={-1} className="sr-only">Videos, page {page}</h2>
      <RequestState loading={loading} error={loadError} onRetry={loadVideos} label="videos" />
      {!loading && !loadError && filtered.length === 0 && (
        debouncedSearch ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No videos match your search"
            action={<button type="button" onClick={clearSearch} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Clear search</button>}>
            Try a different title.
          </EmptyState>
        ) : (
          <EmptyState icon={<Play className="h-10 w-10" />} title="No videos yet"
            action={role === 'teacher' ? <button type="button" onClick={() => setShowUpload(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Upload the first video</button> : undefined}>
            {role === 'teacher' ? 'Upload a video and publish it so students can watch it.' : 'No videos have been published for your programme yet. Check back soon.'}
          </EmptyState>
        )
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => (
          <div
            key={video.id}
            role="link" tabIndex={0} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/videos/${video.id}`); } }}
            onClick={() => navigate(`/videos/${video.id}`)}
            className="text-left bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="relative w-full h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              {video.thumbnail_path ? (
                <img
                  src={video.thumbnail_path}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-white/90 rounded-full shadow flex items-center justify-center">
                  <Play className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              )}

              {role === 'teacher' && !video.is_published && (
                <span className="absolute top-2 left-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  Unpublished
                </span>
              )}

              {role === 'student' && (
                <button
                  onClick={(e) => toggleFavorite(video, e)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center hover:bg-white dark:hover:bg-slate-900 transition-colors"
                  disabled={favorites.loading || Boolean(favorites.error)}
                    title={favoritedVideoIds.has(video.id) ? 'Remove from favourites' : 'Save to favourites'}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favoritedVideoIds.has(video.id)
                        ? 'fill-red-500 text-red-500'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  />
                </button>
              )}
            </div>

            <div className="p-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-display">
                {video.title}
              </p>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                {video.description || 'No description provided.'}
              </p>

              <p className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                Watch Video →
              </p>

              <ContentSettings kind="videos" id={video.id} programId={video.program_id} canManage={video.can_manage} onSaved={loadVideos} />
              <OwnerNote kind="videos" item={video} onChanged={loadVideos} />
              {role === 'teacher' && video.can_manage !== false && (
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={(e) => openEdit(video, e)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleTogglePublish(video, e)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {video.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={(e) => handleDelete(video, e)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={videoPage.total} onPageChange={changePage} label="Video pages" />

      {showUpload && (
        <Dialog onClose={closeUploadModal} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
                Upload Video
              </h2>
              <button aria-label="Close dialog"
                onClick={closeUploadModal}
                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="videos-field-1" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="videos-field-1"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. Introduction to the Muscular System"
                />
              </div>

              <div>
                <label htmlFor="videos-field-2" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="videos-field-2"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                  placeholder="Optional"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Video File
                </p>
                <div className="mt-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input
                    aria-label="Video file"
                    type="file"
                    accept=".mp4,.webm"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="bg-white dark:bg-slate-900 w-full text-sm text-slate-600 dark:text-slate-400"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                    Supported formats: .mp4, .webm
                  </p>
                  {uploadFile && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="videos-captions-upload" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">English captions (optional)</label>
                <input id="videos-captions-upload" aria-describedby="videos-captions-help" type="file" accept=".vtt,text/vtt" onChange={(e) => setUploadCaptions(e.target.files?.[0] || null)} className="mt-1 w-full text-sm text-slate-600 dark:text-slate-400" />
                <p id="videos-captions-help" className="mt-1 text-xs text-slate-600 dark:text-slate-400">WebVTT (.vtt), up to 2 MiB. Captions are recommended for every spoken video.</p>
              </div>
            </div>

            {uploading && <div className="mt-4"><UploadProgress fraction={upload.progress} fileName={uploadFile?.name} onCancel={upload.cancel} /></div>}
            {uploadError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
                {uploadError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeUploadModal}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {editingVideo && (
        <Dialog onClose={closeEdit} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Edit Video
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="videos-field-3" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="videos-field-3"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="videos-field-4" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="videos-field-4"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                />
              </div>

              <div>
                <label htmlFor="videos-field-5" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Linked Annotation
                </label>
                <select id="videos-field-5"
                  disabled={annotations.loading || Boolean(annotations.error)}
                  value={editAnnotationId}
                  onChange={(e) => setEditAnnotationId(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                >
                  <option value="">No linked annotation</option>
                  {annotationOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.model_title} — {a.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  When linked, this video is available to play from that annotation in the 3D Viewer.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <label htmlFor="videos-edit-captions" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">English captions</label>
                <input id="videos-edit-captions" aria-describedby="videos-edit-captions-help" type="file" accept=".vtt,text/vtt" onChange={(e) => setEditCaptions(e.target.files?.[0] || null)} className="mt-1 w-full text-sm text-slate-600 dark:text-slate-400" />
                <p id="videos-edit-captions-help" className="mt-1 text-xs text-slate-600 dark:text-slate-400">{editingVideo.captions_path ? 'Captions are attached. Choose a file to replace them, or remove them below.' : 'No captions attached. Upload an English WebVTT file up to 2 MiB.'}</p>
                <div className="mt-2 flex gap-3">
                  <button type="button" disabled={!editCaptions && !editingVideo.captions_path} onClick={handleSaveCaptions} className="text-xs font-medium text-blue-600 dark:text-blue-400 disabled:opacity-50">{editCaptions ? 'Save captions' : 'Remove captions'}</button>
                </div>
              </div>
            </div>

            {editError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
                {editError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEdit}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

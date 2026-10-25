import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import Dialog from '../components/Dialog';
import ContentSettings from '../components/ContentSettings';
import OwnerNote from '../components/OwnerNote';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Upload, X, Search, Download, FileJson, FileText } from 'lucide-react';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import UploadProgress from '../components/UploadProgress';
import FavoriteButton from '../components/FavoriteButton';
import { useFavorites } from '../components/content/useFavorites';
import { usePageState } from '../components/content/usePageState';
import { useUpload } from '../components/content/useUpload';
import { useAppContext } from '../context/AppContextState';
import { useToast } from '../context/ToastContextState';
import { useConfirm } from '../context/ConfirmContextState';
import { api } from '../api/api';

interface ModelRecord {
  id: number;
  program_id: number | null;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
  is_published: boolean;
  is_downloadable: boolean;
  body_system: string | null;
  body_part: string | null;
  can_manage?: boolean;
  owner_name?: string | null;
}

const PAGE_SIZE = 12;
const NO_MODELS = { items: [] as ModelRecord[], total: 0 };

export default function ModelGallery() {
  const { role, program } = useAppContext();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const favorites = useFavorites('model', 'models');


  // Search/filter — Tasks 4.1/4.3/4.4
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadBodySystem, setUploadBodySystem] = useState('');
  const [uploadBodyPart, setUploadBodyPart] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const upload = useUpload();
  const uploading = upload.uploading;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingModel, setEditingModel] = useState<ModelRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBodySystem, setEditBodySystem] = useState('');
  const [editBodyPart, setEditBodyPart] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [openExportMenuId, setOpenExportMenuId] = useState<number | null>(null);

  // Debounce the free-text search — Task 4.3 explicitly calls for 300ms,
  // no API call on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filterKey = `${role}|${program}|${debouncedSearch}|${systemFilter}|${partFilter}`;
  const [page, setPage] = usePageState(filterKey);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const changePage = (next: number) => {
    setPage(next);
    requestAnimationFrame(() => { listHeading.current?.focus(); listHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); });
  };

  const fetchModels = useCallback(() => api.getModelsPage({
    page, pageSize: PAGE_SIZE, publishedOnly: role === 'student',
    q: debouncedSearch || undefined, system: systemFilter || undefined, part: partFilter || undefined,
  }) as unknown as Promise<{ items: ModelRecord[]; total: number }>, [role, page, debouncedSearch, systemFilter, partFilter]);
  const { data: modelPage, reload: reloadPage, loading, error: loadError } = useResource(fetchModels, NO_MODELS, `${program}|${page}|${filterKey}`);
  const models = modelPage.items;

  // Task 4.4: system/part dropdowns are populated from unique values actually present in the visible model set
  // (not only the current page), so they stay complete while paging.
  const fetchAllModels = useCallback(() => api.getModels(role === 'student') as Promise<ModelRecord[]>, [role]);
  const { data: allModels, reload: reloadAll } = useResource<ModelRecord[]>(fetchAllModels, [], program);
  const loadModels = () => { reloadPage(); reloadAll(); };
  const afterRemoval = () => { if (models.length === 1 && page > 1) changePage(page - 1); loadModels(); };
  const availableSystems = useMemo(
    () => Array.from(new Set(allModels.map((m) => m.body_system).filter((v): v is string => !!v))).sort(),
    [allModels]
  );
  // Body part options narrow to whatever's available within the currently
  // selected system, per Task 4.4's acceptance criteria.
  const availableParts = useMemo(() => {
    const relevant = systemFilter ? allModels.filter((m) => m.body_system === systemFilter) : allModels;
    return Array.from(new Set(relevant.map((m) => m.body_part).filter((v): v is string => !!v))).sort();
  }, [allModels, systemFilter]);
  const hasFilters = Boolean(debouncedSearch || systemFilter || partFilter);
  const clearFilters = () => { setSearchInput(''); setDebouncedSearch(''); setSystemFilter(''); setPartFilter(''); };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }
    if (!uploadFile) {
      setUploadError('Please select a model file.');
      return;
    }

    try {
      setUploadError(null);
      const outcome = await upload.run((options) => api.uploadModel({
        title: uploadTitle,
        description: uploadDescription || undefined,
        body_system: uploadBodySystem || undefined,
        body_part: uploadBodyPart || undefined,
        file: uploadFile,
      }, options));
      if (outcome.cancelled) { toast('Upload cancelled'); return; }
      loadModels();
      closeUploadModal();
      toast('Model uploaded successfully');
    } catch (err) {
      console.error('Failed to upload model:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const closeUploadModal = () => {
    upload.cancel();
    setShowUpload(false);
    setUploadTitle('');
    setUploadDescription('');
    setUploadBodySystem('');
    setUploadBodyPart('');
    setUploadFile(null);
    setUploadError(null);
  };

  const handleTogglePublish = async (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.publishModel(model.id, !model.is_published);
      loadModels();
      toast(model.is_published ? 'Model unpublished' : 'Model published');
    } catch (err) {
      console.error('Failed to update publish state:', err);
      toast('The change could not be saved. Please try again.', 'error');
    }
  };

  const handleDelete = async (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Model',
      message: `Are you sure you want to delete "${model.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.deleteModel(model.id);
      afterRemoval();
      toast('Model deleted');
    } catch (err) {
      console.error('Failed to delete model:', err);
      toast('The change could not be saved. Please try again.', 'error');
    }
  };

  const openEdit = (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModel(model);
    setEditTitle(model.title);
    setEditDescription(model.description || '');
    setEditBodySystem(model.body_system || '');
    setEditBodyPart(model.body_part || '');
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingModel(null);
    setEditTitle('');
    setEditDescription('');
    setEditBodySystem('');
    setEditBodyPart('');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingModel) return;

    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }

    try {
      await api.updateModel(editingModel.id, {
        title: editTitle,
        description: editDescription || undefined,
        body_system: editBodySystem || undefined,
        body_part: editBodyPart || undefined,
      });
      loadModels();
      closeEdit();
      toast('Model updated');
    } catch (err) {
      console.error('Failed to update model:', err);
      setEditError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    }
  };

  const handleDownload = async (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(model.id);
      await api.downloadModel(model.id);
    } catch (err) {
      console.error('Failed to download model:', err);
      toast(err instanceof Error ? err.message : 'Failed to download this model. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExport = async (model: ModelRecord, format: 'json' | 'csv', e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenExportMenuId(null);
    try {
      setExportingId(model.id);
      await api.exportAnnotations(model.id, format);
    } catch (err) {
      console.error('Failed to export annotations:', err);
      toast(err instanceof Error ? err.message : 'Failed to export annotations. Please try again.', 'error');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
            3D Model Library
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select an anatomical model to open it in the interactive 3D viewer.
          </p>
        </div>

        {role === 'teacher' && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            + Upload Model
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search models"
            placeholder="Search models..."
            className="text-slate-900 dark:text-slate-100 pl-9 pr-3 py-2 w-full border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
          />
        </div>

        <select
          aria-label="Body system" value={systemFilter}
          onChange={(e) => {
            const newSystem = e.target.value;
            setSystemFilter(newSystem);
            // Reset the part filter if it no longer applies under the newly
            // selected system, rather than leaving a stale/invalid combo.
            const stillValid = allModels.some(
              (m) => (!newSystem || m.body_system === newSystem) && m.body_part === partFilter
            );
            if (!stillValid) setPartFilter('');
          }}
          className="text-slate-900 dark:text-slate-100 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none"
        >
          <option value="">All Systems</option>
          {availableSystems.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          aria-label="Body part" value={partFilter}
          onChange={(e) => setPartFilter(e.target.value)}
          className="text-slate-900 dark:text-slate-100 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none"
        >
          <option value="">All Body Parts</option>
          {availableParts.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <h2 ref={listHeading} tabIndex={-1} className="sr-only">Models, page {page}</h2>
      <RequestState loading={loading} error={loadError} onRetry={loadModels} label="models" />
      {favorites.enabled && <RequestState loading={false} error={favorites.error} onRetry={favorites.reload} label="model favourites" />}
      {!loading && !loadError && models.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<Search className="h-10 w-10" />} title="No models match your search"
            action={<button type="button" onClick={clearFilters} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Clear filters</button>}>
            Try a different search term, or choose another body system or part.
          </EmptyState>
        ) : (
          <EmptyState icon={<Box className="h-10 w-10" />} title="No models yet"
            action={role === 'teacher' ? <button type="button" onClick={() => setShowUpload(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Upload the first model</button> : undefined}>
            {role === 'teacher' ? 'Upload a 3D model to get started. Students will see it once you publish it.' : 'Your teachers have not published any 3D models for your programme yet. Check back soon.'}
          </EmptyState>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {models.map((model) => (
            <div
              key={model.id}
              role="link" tabIndex={0} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/3dviewer/${model.id}`); } }}
            onClick={() => navigate(`/3dviewer/${model.id}`)}
              className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="relative">
                {model.thumbnail_path ? (
                  <img
                    src={`${model.thumbnail_path}`}
                    alt={model.title}
                    className="w-full h-44 object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-44 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-4">
                    <Box className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
                )}

                {favorites.enabled && (
                  <FavoriteButton title={model.title} active={favorites.ids.has(model.id)} onToggle={() => void favorites.toggle(model.id)}
                    disabled={favorites.loading || Boolean(favorites.error) || favorites.pending === model.id} className="absolute top-2 right-2" />
                )}

                {role === 'teacher' && !model.is_published && (
                  <span className="absolute top-2 left-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">
                    Unpublished
                  </span>
                )}
              </div>

              <h2 className="font-semibold text-slate-900 dark:text-slate-100 font-display">
                {model.title}
              </h2>

              {(model.body_system || model.body_part) && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {[model.body_system, model.body_part].filter(Boolean).join(' · ')}
                </p>
              )}

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-3">
                {model.description || 'No description provided.'}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Open Viewer →
                </p>

                <button
                  onClick={(e) => handleDownload(model, e)}
                  disabled={!model.is_downloadable || downloadingId === model.id}
                  title={model.is_downloadable ? "Download model file" : "Downloads disabled by teacher"}
                  className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              <ContentSettings kind="models" id={model.id} programId={model.program_id} downloadable={model.is_downloadable} canManage={model.can_manage} onSaved={loadModels} />
              <OwnerNote kind="models" item={model} onChanged={loadModels} />
              {role === 'teacher' && model.can_manage !== false && (
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 relative">
                  <button
                    onClick={(e) => openEdit(model, e)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleTogglePublish(model, e)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {model.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={(e) => handleDelete(model, e)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenExportMenuId(openExportMenuId === model.id ? null : model.id);
                    }}
                    disabled={exportingId === model.id}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                  >
                    Export Annotations
                  </button>

                  {openExportMenuId === model.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md z-10 py-1 w-40"
                    >
                      <button
                        onClick={(e) => handleExport(model, 'json', e)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <FileJson className="w-3.5 h-3.5" /> JSON
                      </button>
                      <button
                        onClick={(e) => handleExport(model, 'csv', e)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" /> CSV
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={modelPage.total} onPageChange={changePage} label="Model pages" />

      {showUpload && (
        <Dialog onClose={closeUploadModal} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
                Upload Model
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
                <label htmlFor="modelgallery-field-1" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="modelgallery-field-1"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. Cardiovascular System"
                />
              </div>

              <div>
                <label htmlFor="modelgallery-field-2" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="modelgallery-field-2"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                  placeholder="Optional"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modelgallery-field-3" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body System
                  </label>
                  <input id="modelgallery-field-3"
                    type="text"
                    value={uploadBodySystem}
                    onChange={(e) => setUploadBodySystem(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="e.g. Cardiovascular"
                  />
                </div>
                <div>
                  <label htmlFor="modelgallery-field-4" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body Part
                  </label>
                  <input id="modelgallery-field-4"
                    type="text"
                    value={uploadBodyPart}
                    onChange={(e) => setUploadBodyPart(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="e.g. Chest"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Model File
                </p>
                <div className="mt-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input
                    aria-label="Model file"
                    type="file"
                    accept=".glb,.gltf,.obj,.usdz"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="bg-white dark:bg-slate-900 w-full text-sm text-slate-600 dark:text-slate-400"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                    Supported: GLB, embedded glTF, OBJ, USDZ. Export Unreal assets to GLB before uploading.
                  </p>
                  {uploadFile && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
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

      {editingModel && (
        <Dialog onClose={closeEdit} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Edit Model
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="modelgallery-field-5" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="modelgallery-field-5"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="modelgallery-field-6" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="modelgallery-field-6"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modelgallery-field-7" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body System
                  </label>
                  <input id="modelgallery-field-7"
                    type="text"
                    value={editBodySystem}
                    onChange={(e) => setEditBodySystem(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="modelgallery-field-8" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body Part
                  </label>
                  <input id="modelgallery-field-8"
                    type="text"
                    value={editBodyPart}
                    onChange={(e) => setEditBodyPart(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  />
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

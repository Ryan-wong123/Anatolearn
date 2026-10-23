import RequestState from '../components/RequestState';
import { useResource } from '../hooks/useResource';
import Dialog from '../components/Dialog';
import ContentSettings from '../components/ContentSettings';
import { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, ExternalLink, Upload, X, Search } from 'lucide-react';
import { useAppContext } from '../context/AppContextState';
import { useToast } from '../context/ToastContextState';
import { useConfirm } from '../context/ConfirmContextState';
import { api } from '../api/api';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import UploadProgress from '../components/UploadProgress';
import { usePageState } from '../components/content/usePageState';
import { useUpload } from '../components/content/useUpload';

const PAGE_SIZE = 10;

type ResourceType = 'pdf' | 'document' | 'link' | 'image';

interface Resource {
  id: number;
  program_id: number | null;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  file_path: string;
  is_published: boolean;
  created_at: string;
}

function ResourceIcon({ type }: { type: ResourceType }) {
  if (type === 'link') return <ExternalLink className="w-8 h-8 text-blue-500 dark:text-blue-400" />;
  return <FileText className="w-8 h-8 text-green-500 dark:text-green-400" />;
}

const NO_RESOURCES = { items: [] as Resource[], total: 0 };

export default function Library() {
  const { role, program } = useAppContext();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFileType, setUploadFileType] = useState<'pdf' | 'document' | 'image'>('pdf');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState('');
  const upload = useUpload();
  const uploading = upload.uploading;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(resourceSearchTerm.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [resourceSearchTerm]);

  const filterKey = `${role}|${program}|${debouncedSearch}`;
  const [page, setPage] = usePageState(filterKey);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const changePage = (next: number) => {
    setPage(next);
    requestAnimationFrame(() => { listHeading.current?.focus(); listHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); });
  };

  // Without a search the server pages the list. Text search is matched in the browser (the API has no text filter),
  // so a search loads the full list and pages the matches.
  const fetchResources = useCallback(async () => {
    const publishedOnly = role === 'student';
    if (!debouncedSearch) return api.getResourcesPage({ page, pageSize: PAGE_SIZE, publishedOnly }) as unknown as Promise<{ items: Resource[]; total: number }>;
    const matches = ((await api.getResources(publishedOnly)) as Resource[]).filter((resource) =>
      resource.title.toLowerCase().includes(debouncedSearch) || (resource.description || '').toLowerCase().includes(debouncedSearch));
    return { items: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: matches.length };
  }, [role, page, debouncedSearch]);
  const { data: resourcePage, reload: loadResources, loading, error: loadError } = useResource(fetchResources, NO_RESOURCES, `${program}|${page}|${filterKey}`);
  const filteredResources = resourcePage.items;
  const afterRemoval = () => { if (filteredResources.length === 1 && page > 1) changePage(page - 1); loadResources(); };
  const clearSearch = () => { setResourceSearchTerm(''); setDebouncedSearch(''); };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setUploadError('Title is required.');
      return;
    }

    if (uploadMode === 'link') {
      if (!uploadUrl.trim()) {
        setUploadError('URL is required.');
        return;
      }
    } else {
      if (!uploadFile) {
        setUploadError('Please select a file.');
        return;
      }
    }

    try {
      setUploadError(null);
      const outcome = await upload.run((options) => api.uploadResource({
        title: uploadTitle,
        description: uploadDescription || undefined,
        resource_type: uploadMode === 'link' ? 'link' : uploadFileType,
        url: uploadMode === 'link' ? uploadUrl : undefined,
        file: uploadMode === 'file' ? uploadFile || undefined : undefined,
      }, options));
      if (outcome.cancelled) { toast('Upload cancelled'); return; }
      loadResources();
      closeUploadModal();
      toast('Resource uploaded successfully');
    } catch (err) {
      console.error('Failed to upload resource:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const closeUploadModal = () => {
    upload.cancel();
    setShowUpload(false);
    setUploadMode('file');
    setUploadTitle('');
    setUploadDescription('');
    setUploadFileType('pdf');
    setUploadFile(null);
    setUploadUrl('');
    setUploadError(null);
  };

  const openEditResource = (resource: Resource) => {
    setEditingResource(resource);
    setEditTitle(resource.title);
    setEditDescription(resource.description || '');
    setEditUrl(resource.resource_type === 'link' ? resource.file_path : '');
    setEditError(null);
  };

  const closeEditResource = () => {
    setEditingResource(null);
    setEditTitle('');
    setEditDescription('');
    setEditUrl('');
    setEditError(null);
  };

  const handleSaveResourceEdit = async () => {
    if (!editingResource) return;

    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }

    if (editingResource.resource_type === 'link' && !editUrl.trim()) {
      setEditError('URL is required.');
      return;
    }

    try {
      setSaving(true);
      await api.updateResource(editingResource.id, {
        title: editTitle,
        description: editDescription || undefined,
        url: editingResource.resource_type === 'link' ? editUrl : undefined,
      });
      loadResources();
      toast('Resource updated');
      closeEditResource();
    } catch (err) {
      console.error('Failed to update resource:', err);
      setEditError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (resource: Resource) => {
    try {
      await api.publishResource(resource.id, !resource.is_published);
      loadResources();
      toast(resource.is_published ? 'Resource unpublished' : 'Resource published');
    } catch (err) {
      console.error('Failed to update publish state:', err);
      toast('The change could not be saved. Please try again.', 'error');
    }
  };

  const handleDelete = async (resource: Resource) => {
    const ok = await confirm({
      title: 'Delete Resource',
      message: `Are you sure you want to delete "${resource.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.deleteResource(resource.id);
      afterRemoval();
      toast('Resource deleted');
    } catch (err) {
      console.error('Failed to delete resource:', err);
      toast('The change could not be saved. Please try again.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display">
            Content Library
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Access supporting anatomy resources and reference materials.
          </p>
        </div>

        {role === 'teacher' && (
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Content
          </button>
        )}
      </div>

      <div className="mt-4 relative">
        <Search className="w-4 h-4 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={resourceSearchTerm}
          onChange={(e) => setResourceSearchTerm(e.target.value)}
          aria-label="Search resources"
            placeholder="Search resources by title or description..."
          className="bg-white dark:bg-slate-900 w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-300"
        />
      </div>

      <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <h2 ref={listHeading} tabIndex={-1} className="sr-only">Resources, page {page}</h2>
        <RequestState loading={loading} error={loadError} onRetry={loadResources} label="resources" />
      {!loading && !loadError && filteredResources.length === 0 ? (
          <div className="p-4">
            {debouncedSearch ? (
              <EmptyState icon={<Search className="h-10 w-10" />} title="No resources match your search"
                action={<button type="button" onClick={clearSearch} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Clear search</button>}>
                Try a different title or description.
              </EmptyState>
            ) : (
              <EmptyState icon={<FileText className="h-10 w-10" />} title="No resources yet"
                action={role === 'teacher' ? <button type="button" onClick={() => setShowUpload(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500">Upload the first resource</button> : undefined}>
                {role === 'teacher' ? 'Upload notes, photos or links and publish them for your students.' : 'No learning materials have been published for your programme yet. Check back soon.'}
              </EmptyState>
            )}
          </div>
        ) : (
          filteredResources.map((resource) => (
            <div
              key={resource.id}
              className="px-5 py-4 flex flex-wrap items-center gap-4 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex-shrink-0">
                <ResourceIcon type={resource.resource_type} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {resource.title}
                  </p>
                  {role === 'teacher' && !resource.is_published && (
                    <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                      Unpublished
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {resource.description || 'No description provided.'}
                </p>
              </div>

              {/*  Added "<a" below */}
              <a
                href={resource.resource_type === 'link' ? resource.file_path : `${resource.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-1 flex-shrink-0"
              >
                {resource.resource_type === 'link' ? 'Visit' : 'Open'}
                <ExternalLink className="w-4 h-4" />
              </a>

              <ContentSettings kind="resources" id={resource.id} programId={resource.program_id} onSaved={loadResources} />
              {role === 'teacher' && (
                <div className="flex items-center gap-3 flex-shrink-0 pl-4 border-l border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => openEditResource(resource)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublish(resource)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {resource.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(resource)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={resourcePage.total} onPageChange={changePage} label="Resource pages" />

      {showUpload && (
        <Dialog onClose={closeUploadModal} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
                Upload Content
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
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Content Type
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    aria-pressed={uploadMode === 'file'} onClick={() => setUploadMode('file')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadMode === 'file'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    File
                  </button>
                  <button
                    type="button"
                    aria-pressed={uploadMode === 'link'} onClick={() => setUploadMode('link')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadMode === 'link'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    Link
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="library-field-1" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="library-field-1"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. TeachMeAnatomy"
                />
              </div>

              <div>
                <label htmlFor="library-field-2" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="library-field-2"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                  placeholder="Optional"
                />
              </div>

              {uploadMode === 'file' ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      File Type
                    </p>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        aria-pressed={uploadFileType === 'pdf'} onClick={() => setUploadFileType('pdf')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadFileType === 'pdf'
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        PDF
                      </button>
                      <button type="button" aria-pressed={uploadFileType === 'image'} onClick={() => setUploadFileType('image')} className={`flex-1 rounded-lg border p-2 text-sm ${uploadFileType==='image' ? 'bg-blue-50 text-blue-700 border-blue-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Photo</button>
                      <button
                        type="button"
                        aria-pressed={uploadFileType === 'document'} onClick={() => setUploadFileType('document')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${uploadFileType === 'document'
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        Document
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      File
                    </p>
                    <div className="mt-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <input
                        aria-label="Resource file"
                    type="file"
                        accept={uploadFileType === 'pdf' ? '.pdf' : uploadFileType === 'image' ? '.png,.jpg,.jpeg,.webp' : '.doc,.docx'}
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="bg-white dark:bg-slate-900 w-full text-sm text-slate-600 dark:text-slate-400"
                      />
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                        Supported formats: PDF, DOC/DOCX, PNG, JPEG, WebP
                      </p>
                      {uploadFile && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                          Selected: {uploadFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="library-field-3" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    URL
                  </label>
                  <input id="library-field-3"
                    type="url"
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="https://example.com"
                  />
                </div>
              )}
            </div>

            {uploading && uploadMode === 'file' && <div className="mt-4"><UploadProgress fraction={upload.progress} fileName={uploadFile?.name} onCancel={upload.cancel} /></div>}
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

      {editingResource && (
        <Dialog onClose={closeEditResource} className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
                Edit Resource
              </h2>
              <button aria-label="Close dialog"
                onClick={closeEditResource}
                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="library-field-4" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input id="library-field-4"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-300"
                />
              </div>

              <div>
                <label htmlFor="library-field-5" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea id="library-field-5"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-300"
                />
              </div>

              {editingResource.resource_type === 'link' && (
                <div>
                  <label htmlFor="library-field-6" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    URL
                  </label>
                  <input id="library-field-6"
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 dark:focus:border-blue-300"
                  />
                </div>
              )}
            </div>

            {editError && (
              <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">{editError}</p>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={closeEditResource}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResourceEdit}
                disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

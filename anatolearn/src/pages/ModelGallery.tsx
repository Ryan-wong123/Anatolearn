import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Upload, X, Search, Download, FileJson, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../api/api';

interface ModelRecord {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
  is_published: boolean;
  body_system: string | null;
  body_part: string | null;
}

export default function ModelGallery() {
  const { role } = useAppContext();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelRecord[]>([]);

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
  const [uploading, setUploading] = useState(false);
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

  const loadModels = () => {
    api
      .getModels(role === 'student', {
        q: debouncedSearch || undefined,
        system: systemFilter || undefined,
        part: partFilter || undefined,
      })
      .then(setModels)
      .catch((err) => console.error('Failed to load models:', err));
  };

  useEffect(() => {
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, debouncedSearch, systemFilter, partFilter]);

  // Task 4.4: system/part dropdowns are populated from unique values
  // actually present in the current model list, not a fixed hardcoded set.
  const availableSystems = useMemo(
    () => Array.from(new Set(models.map((m) => m.body_system).filter((v): v is string => !!v))).sort(),
    [models]
  );
  // Body part options narrow to whatever's available within the currently
  // selected system, per Task 4.4's acceptance criteria.
  const availableParts = useMemo(() => {
    const relevant = systemFilter ? models.filter((m) => m.body_system === systemFilter) : models;
    return Array.from(new Set(relevant.map((m) => m.body_part).filter((v): v is string => !!v))).sort();
  }, [models, systemFilter]);

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
      setUploading(true);
      setUploadError(null);
      await api.uploadModel({
        title: uploadTitle,
        description: uploadDescription || undefined,
        body_system: uploadBodySystem || undefined,
        body_part: uploadBodyPart || undefined,
        file: uploadFile,
      });
      loadModels();
      closeUploadModal();
      toast('Model uploaded successfully');
    } catch (err) {
      console.error('Failed to upload model:', err);
      setUploadError('Failed to upload model. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
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
      loadModels();
      toast('Model deleted');
    } catch (err) {
      console.error('Failed to delete model:', err);
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
      setEditError('Failed to save changes. Please try again.');
    }
  };

  const handleDownload = async (model: ModelRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(model.id);
      await api.downloadModel(model.id);
    } catch (err) {
      console.error('Failed to download model:', err);
      alert('Failed to download this model. Please try again.');
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
      alert('Failed to export annotations. Please try again.');
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
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search models..."
            className="text-slate-900 dark:text-slate-100 pl-9 pr-3 py-2 w-full border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
          />
        </div>

        <select
          value={systemFilter}
          onChange={(e) => {
            const newSystem = e.target.value;
            setSystemFilter(newSystem);
            // Reset the part filter if it no longer applies under the newly
            // selected system, rather than leaving a stale/invalid combo.
            const stillValid = models.some(
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
          value={partFilter}
          onChange={(e) => setPartFilter(e.target.value)}
          className="text-slate-900 dark:text-slate-100 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:outline-none"
        >
          <option value="">All Body Parts</option>
          {availableParts.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {models.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No models match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {models.map((model) => (
            <div
              key={model.id}
              onClick={() => navigate(`/3dviewer/${model.id}`)}
              className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="relative">
                {model.thumbnail_path ? (
                  <img
                    src={`http://localhost:5000${model.thumbnail_path}`}
                    alt={model.title}
                    className="w-full h-44 object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-44 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-4">
                    <Box className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  </div>
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
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
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
                  disabled={downloadingId === model.id}
                  title="Download model file"
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {role === 'teacher' && (
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

      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">
                Upload Model
              </h2>
              <button
                onClick={closeUploadModal}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  placeholder="e.g. Cardiovascular System"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                  placeholder="Optional"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body System
                  </label>
                  <input
                    type="text"
                    value={uploadBodySystem}
                    onChange={(e) => setUploadBodySystem(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="e.g. Cardiovascular"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body Part
                  </label>
                  <input
                    type="text"
                    value={uploadBodyPart}
                    onChange={(e) => setUploadBodyPart(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    placeholder="e.g. Chest"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Model File
                </label>
                <div className="mt-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input
                    type="file"
                    accept=".glb,.gltf,.obj"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="bg-white dark:bg-slate-900 w-full text-sm text-slate-600 dark:text-slate-400"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    Supported formats: .glb, .gltf, .obj
                  </p>
                  {uploadFile && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {uploadError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
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
        </div>
      )}

      {editingModel && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-display mb-4">
              Edit Model
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body System
                  </label>
                  <input
                    type="text"
                    value={editBodySystem}
                    onChange={(e) => setEditBodySystem(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Body Part
                  </label>
                  <input
                    type="text"
                    value={editBodyPart}
                    onChange={(e) => setEditBodyPart(e.target.value)}
                    className="text-slate-900 dark:text-slate-100 mt-1 w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {editError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mt-4">
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
        </div>
      )}
    </div>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadOptions } from '../../api/api';

export type UploadOutcome<T> = { cancelled: false; value: T } | { cancelled: true };

// Tracks one in-flight upload: progress fraction, cancel, and automatic abort if the page is left.
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async <T,>(start: (options: UploadOptions) => Promise<T>): Promise<UploadOutcome<T>> => {
    const abort = new AbortController();
    controller.current = abort;
    setProgress(0);
    setUploading(true);
    try {
      return { cancelled: false, value: await start({ onProgress: setProgress, signal: abort.signal }) };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return { cancelled: true };
      throw error;
    } finally {
      if (controller.current === abort) controller.current = null;
      setUploading(false);
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);
  return { uploading, progress, run, cancel };
}

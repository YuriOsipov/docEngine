let uploadConfig: {
  uploadUrl: string;
  stub: boolean;
  uploadByFile?: (file: File) => Promise<any>;
  uploadByUrl?: (url: string) => Promise<any>;
  listExistingImages?: () => Promise<any[]>;
  resolveExistingImage?: (id: string) => Promise<any>;
} = {
  uploadUrl: typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_UPLOAD_BASE_URL ?? '' : '',
  stub: true,
};

export function configureImageUpload(config: any = {}) {
  uploadConfig = { ...uploadConfig, ...config };
  if (config.uploadUrl) {
    uploadConfig.stub = !config.uploadUrl || config.stub === true;
  }
  if (typeof config.uploadByFile === 'function' || typeof config.uploadByUrl === 'function') {
    uploadConfig.stub = false;
  }
  // Browse-existing is host-only (Salesforce LWC). Omit the callbacks to hide that UI.
  if (typeof config.listExistingImages !== 'function') {
    delete uploadConfig.listExistingImages;
  }
  if (typeof config.resolveExistingImage !== 'function') {
    delete uploadConfig.resolveExistingImage;
  }
}

function uploadEndpoints() {
  const base = String(uploadConfig.uploadUrl ?? '').replace(/\/$/, '');
  return {
    byFile: `${base}/uploadFile`,
    byUrl: `${base}/fetchUrl`,
  };
}

function useStub() {
  if (typeof uploadConfig.uploadByFile === 'function' || typeof uploadConfig.uploadByUrl === 'function') {
    return false;
  }
  return uploadConfig.stub || !uploadConfig.uploadUrl;
}

function normalizeResponse(data: any) {
  if (!data || data.success !== 1 || !data.file?.url) {
    throw new Error(data?.message ?? 'Image upload failed');
  }
  return { success: 1, file: { ...data.file } };
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Persistable data URL — blob: URLs die after navigation and fail HTML/PDF preview. */
export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const mime = file.type || 'application/octet-stream';
  return `data:${mime};base64,${bytesToBase64(new Uint8Array(buffer))}`;
}

async function stubUpload(fileOrUrl: any, kind: any) {
  if (kind === 'file' && fileOrUrl instanceof File) {
    const url = await fileToDataUrl(fileOrUrl);
    return {
      success: 1,
      file: {
        url,
        name: fileOrUrl.name,
        stub: true,
      },
    };
  }
  if (kind === 'url' && typeof fileOrUrl === 'string') {
    return {
      success: 1,
      file: {
        url: fileOrUrl,
        stub: true,
      },
    };
  }
  throw new Error('Invalid upload input');
}

export async function uploadByFile(file: any) {
  if (!(file instanceof File)) throw new Error('Expected a File');

  if (typeof uploadConfig.uploadByFile === 'function') {
    return normalizeResponse(await uploadConfig.uploadByFile(file));
  }

  if (useStub()) {
    console.warn(
      '[image-upload] Using stub uploader (data URL). Configure imageUpload.uploadUrl for server upload.',
    );
    return stubUpload(file, 'file');
  }

  const { byFile } = uploadEndpoints();
  const body = new FormData();
  body.append('image', file);

  const res = await fetch(byFile, { method: 'POST', body });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return normalizeResponse(await res.json());
}

export async function uploadByUrl(url: any) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) throw new Error('URL is required');

  if (typeof uploadConfig.uploadByUrl === 'function') {
    return normalizeResponse(await uploadConfig.uploadByUrl(trimmed));
  }

  if (useStub()) {
    console.warn(
      '[image-upload] Using stub uploader — configure imageUpload.uploadUrl for server upload.',
    );
    return stubUpload(trimmed, 'url');
  }

  const { byUrl } = uploadEndpoints();
  const res = await fetch(byUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: trimmed }),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return normalizeResponse(await res.json());
}

export function canListExistingImages() {
  return typeof uploadConfig.listExistingImages === 'function';
}

export async function listExistingImages() {
  if (typeof uploadConfig.listExistingImages !== 'function') {
    return [];
  }
  const rows = await uploadConfig.listExistingImages();
  return Array.isArray(rows) ? rows : [];
}

export async function resolveExistingImage(id: any) {
  const trimmed = String(id ?? '').trim();
  if (!trimmed) throw new Error('Image id is required');
  if (typeof uploadConfig.resolveExistingImage !== 'function') {
    throw new Error('Existing image resolve is not configured');
  }
  return normalizeResponse(await uploadConfig.resolveExistingImage(trimmed));
}

export function createEmptyImageValue() {
  return { url: '', caption: '' };
}

export function normalizeImageValue(value: any) {
  if (!value) return createEmptyImageValue();
  if (typeof value === 'string') {
    return value ? { url: value, caption: '' } : createEmptyImageValue();
  }
  if (typeof value === 'object') {
    return {
      url: value.url ?? value.file?.url ?? '',
      caption: value.caption ?? '',
    };
  }
  return createEmptyImageValue();
}

export function isImageValueEmpty(value: any) {
  const normalized = normalizeImageValue(value);
  return !normalized.url;
}

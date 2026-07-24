let uploadConfig = {
  uploadUrl: typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_UPLOAD_BASE_URL ?? '' : '',
  stub: true,
};

export function configureImageUpload(config: any = {}) {
  uploadConfig = { ...uploadConfig, ...config };
  if (config.uploadUrl) {
    uploadConfig.stub = !config.uploadUrl || config.stub === true;
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
  return uploadConfig.stub || !uploadConfig.uploadUrl;
}

function normalizeResponse(data: any) {
  if (!data || data.success !== 1 || !data.file?.url) {
    throw new Error(data?.message ?? 'Image upload failed');
  }
  return { success: 1, file: { ...data.file } };
}

async function stubUpload(fileOrUrl: any,kind: any) {
  if (kind === 'file' && fileOrUrl instanceof File) {
    const url = URL.createObjectURL(fileOrUrl);
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

  if (useStub()) {
    console.warn('[image-upload] Using stub uploader — configure imageUpload.uploadUrl for server upload.');
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

  if (useStub()) {
    console.warn('[image-upload] Using stub uploader — configure imageUpload.uploadUrl for server upload.');
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

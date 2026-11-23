import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';

export interface RuntimeStorageConfig {
  runtimeEnv: 'local' | 'cloud';
  storageBackend: 'local' | 'gcs' | 'bigquery';
  isCloudRun: boolean;
  dataDir: string;
  localStoreFile: string;
  gcsBucket: string;
  gcsObject: string;
  bqProjectId: string;
  bqDatasetId: string;
  bqLocation: string;
  lockSettingsInCloud: boolean;
}

export function getRuntimeStorageConfig(): RuntimeStorageConfig {
  const explicitBackend = (process.env.STORAGE_BACKEND || '').toLowerCase().trim();
  const gcsBucket = (process.env.GCS_DATA_BUCKET || '').trim();
  const gcsObject = (process.env.GCS_DATA_OBJECT || 'store.json.gz').trim();
  const bqProjectId = (
    process.env.BQ_PROJECT_ID ||
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ''
  ).trim();
  const bqDatasetId = (process.env.BQ_DATASET_ID || 'skillsboost_analytics').trim();
  const bqLocation = (process.env.BQ_LOCATION || process.env.GCP_REGION || 'us-central1').trim();
  const isCloudRun = Boolean(process.env.K_SERVICE);
  const appEnv = (process.env.APP_ENV || '').toLowerCase().trim();

  let storageBackend: 'local' | 'gcs' | 'bigquery' = 'local';
  if (explicitBackend === 'local') {
    storageBackend = 'local';
  } else if ((explicitBackend === 'bigquery' || explicitBackend === 'bq') && bqProjectId) {
    storageBackend = 'bigquery';
  } else if ((explicitBackend === 'gcs' || isCloudRun || appEnv === 'cloud') && gcsBucket) {
    storageBackend = 'gcs';
  } else if ((isCloudRun || appEnv === 'cloud') && bqProjectId && process.env.BQ_DATASET_ID) {
    storageBackend = 'bigquery';
  }

  const runtimeEnv: 'local' | 'cloud' =
    isCloudRun || appEnv === 'cloud' || storageBackend === 'gcs' || storageBackend === 'bigquery'
      ? 'cloud'
      : 'local';

  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), '.data');

  const localStoreFile = path.join(dataDir, 'store.json');

  const lockSettingsInCloud =
    process.env.LOCK_SETTINGS_IN_CLOUD !== undefined
      ? process.env.LOCK_SETTINGS_IN_CLOUD === 'true'
      : isCloudRun;

  return {
    runtimeEnv,
    storageBackend,
    isCloudRun,
    dataDir,
    localStoreFile,
    gcsBucket,
    gcsObject,
    bqProjectId,
    bqDatasetId,
    bqLocation,
    lockSettingsInCloud,
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function fetchMetadataToken(): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(2500),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    return { token: json.access_token, expiresIn: json.expires_in || 1800 };
  } catch {
    return null;
  }
}

async function fetchAdcUserToken(): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const adcPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
    if (!fs.existsSync(adcPath)) return null;
    const raw = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
    if (
      raw.type === 'authorized_user' &&
      raw.client_id &&
      raw.client_secret &&
      raw.refresh_token
    ) {
      const body = new URLSearchParams({
        client_id: raw.client_id,
        client_secret: raw.client_secret,
        refresh_token: raw.refresh_token,
        grant_type: 'refresh_token',
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!json.access_token) return null;
      return { token: json.access_token, expiresIn: json.expires_in || 1800 };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getGcpAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  // 1. On Cloud Run / GCE, try Metadata Server first
  if (process.env.K_SERVICE || process.env.GCP_USE_METADATA === 'true') {
    const meta = await fetchMetadataToken();
    if (meta) {
      cachedToken = { token: meta.token, expiresAt: now + meta.expiresIn * 1000 };
      return meta.token;
    }
  }

  // 2. Try Application Default Credentials (ADC) refresh token file
  const adc = await fetchAdcUserToken();
  if (adc) {
    cachedToken = { token: adc.token, expiresAt: now + adc.expiresIn * 1000 };
    return adc.token;
  }

  // 3. Fallback to gcloud CLI (local developer workstation)
  try {
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 6000,
    }).trim();
    if (token) {
      cachedToken = { token, expiresAt: now + 25 * 60 * 1000 };
      return token;
    }
  } catch {
    // ignore and try metadata server one last time
  }

  // 4. Final fallback: Metadata server on Cloud Workstations / GCE VMs
  const metaFallback = await fetchMetadataToken();
  if (metaFallback) {
    cachedToken = { token: metaFallback.token, expiresAt: now + metaFallback.expiresIn * 1000 };
    return metaFallback.token;
  }

  throw new Error(
    'No se encontraron credenciales de Google Cloud (ADC). Ejecuta "gcloud auth application-default login" localmente o asigna una Service Account en Cloud Run.'
  );
}

export function compressStoreJson(data: unknown, stripSecrets = true): Buffer {
  let payload = data as Record<string, any>;
  if (stripSecrets && payload && typeof payload === 'object' && payload.apiConfig) {
    payload = {
      ...payload,
      apiConfig: {
        ...payload.apiConfig,
        accessKey: '',
        secretKey: '',
      },
    };
  }
  const serialized = JSON.stringify(payload);
  return zlib.gzipSync(Buffer.from(serialized, 'utf8'), { level: 6 });
}

export function decompressStoreBuffer<T = any>(buf: Buffer): T {
  const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const decoded = isGzip ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  return JSON.parse(decoded) as T;
}

export async function downloadGcsStore<T = any>(
  bucket: string,
  objectName: string
): Promise<T | null> {
  const token = await getGcpAccessToken();
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
    bucket
  )}/o/${encodeURIComponent(objectName)}?alt=media`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(25000),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Error descargando gs://${bucket}/${objectName} (HTTP ${res.status}): ${errText.slice(0, 200)}`
    );
  }

  const arrayBuf = await res.arrayBuffer();
  return decompressStoreBuffer<T>(Buffer.from(arrayBuf));
}

export async function uploadGcsStore(
  bucket: string,
  objectName: string,
  data: unknown
): Promise<{ bytesCompressed: number }> {
  const token = await getGcpAccessToken();
  const compressed = compressStoreJson(data, true);
  const contentType = objectName.endsWith('.gz') ? 'application/gzip' : 'application/json';
  const payload = objectName.endsWith('.gz')
    ? compressed
    : zlib.gunzipSync(compressed);

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
    bucket
  )}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': String(payload.byteLength),
    },
    body: new Uint8Array(payload),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Error subiendo gs://${bucket}/${objectName} (HTTP ${res.status}): ${errText.slice(0, 200)}`
    );
  }

  return { bytesCompressed: payload.byteLength };
}

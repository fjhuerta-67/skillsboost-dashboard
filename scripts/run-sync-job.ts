import 'dotenv/config';
import { storage } from '../src/lib/storage';
import { syncService } from '../src/lib/sync-service';

/**
 * Cloud Run Job Worker: Sincronización Desatendida hacia BigQuery / Cloud Storage
 * Invocado por Cloud Scheduler (ej. diariamente a las 02:00 AM) o manualmente con:
 *   npm run sync:job
 */
async function runScheduledSyncJob() {
  const startedMs = Date.now();
  console.log('==================================================================');
  console.log('🚀 Iniciando Cloud Run Sync Job — Google Skills for Organizations');
  console.log(`🕒 Fecha UTC: ${new Date().toISOString()}`);
  console.log('==================================================================');

  await storage.init();
  const rt = storage.getRuntimeInfo();

  console.log(`💾 Backend de persistencia activo: ${rt.storageBackend.toUpperCase()}`);
  if (rt.storageBackend === 'bigquery') {
    console.log(`📊 Destino BigQuery: ${rt.bqProjectId}.${rt.bqDatasetId} (${rt.bqLocation})`);
  } else if (rt.storageBackend === 'gcs') {
    console.log(`☁️  Destino Cloud Storage: gs://${rt.gcsBucket}/${rt.gcsObject}`);
  }

  // Optional incremental lookback window (e.g. SYNC_LOOKBACK_DAYS=30 for fast daily deltas; 0 = full history)
  const lookbackDays = Number(process.env.SYNC_LOOKBACK_DAYS || '0');
  let startDate: string | undefined;
  const endDate = new Date().toISOString().split('.')[0] + 'Z';

  if (lookbackDays > 0) {
    const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    startDate = from.toISOString().split('.')[0] + 'Z';
    console.log(`📅 Ventana incremental activa: últimos ${lookbackDays} días (${startDate} -> ${endDate})`);
  } else {
    console.log('📅 Ventana histórica completa activa (2020-01-01 -> presente)');
  }

  const finalStatus = await syncService.sync({
    forceDemo: false,
    startDate,
    endDate,
  });

  if (finalStatus.status === 'error') {
    console.error(`❌ El Job de sincronización terminó con error: ${finalStatus.message}`);
    process.exit(1);
  }

  // Notify running Cloud Run Service instances to reload cache immediately if URL is configured
  const serviceUrl = (process.env.CLOUD_RUN_SERVICE_URL || '').trim().replace(/\/+$/, '');
  const cronSecret = (process.env.CRON_REFRESH_TOKEN || '').trim();
  if (serviceUrl) {
    try {
      console.log(`🔔 Notificando refresco de caché al servicio web (${serviceUrl}/api/cron/refresh-cache)...`);
      await fetch(`${serviceUrl}/api/cron/refresh-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cronSecret ? { 'X-Cron-Token': cronSecret } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch (notifyErr: any) {
      console.warn(
        `ℹ️ No se pudo notificar inmediatamente al servicio web (se actualizará por TTL automático): ${notifyErr.message}`
      );
    }
  }

  const elapsedSec = ((Date.now() - startedMs) / 1000).toFixed(1);
  console.log('==================================================================');
  console.log(`✅ Job finalizado exitosamente en ${elapsedSec}s`);
  console.log(`📈 Resumen: ${finalStatus.message}`);
  console.log('==================================================================');
}

runScheduledSyncJob().catch((err) => {
  console.error('❌ Error fatal en Cloud Run Sync Job:', err);
  process.exit(1);
});

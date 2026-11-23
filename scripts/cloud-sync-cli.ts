import 'dotenv/config';
import fs from 'fs';
import {
  getRuntimeStorageConfig,
  compressStoreJson,
  decompressStoreBuffer,
  downloadGcsStore,
  uploadGcsStore,
} from '../src/lib/gcs-adapter';
import {
  ensureBigQuerySchema,
  persistSnapshotToBigQuery,
  loadSnapshotFromBigQuery,
} from '../src/lib/bigquery-adapter';

async function main() {
  const action = (process.argv[2] || '').toLowerCase().trim();
  const cfg = getRuntimeStorageConfig();
  const bucket = (process.env.GCS_DATA_BUCKET || '').trim();
  const objectName = (process.env.GCS_DATA_OBJECT || 'store.json.gz').trim();

  if (!['push', 'pull', 'verify', 'init-bq', 'push-bq', 'pull-bq'].includes(action)) {
    console.log(`
Uso de Herramienta de Portabilidad y Migración de Datos:

  [Validación Local]
  npm run data:verify     Verifica compresión GZIP y limpieza de secretos en memoria (sin tocar nube)

  [Google Cloud Storage (Snapshot GZIP)]
  npm run data:push       Sube .data/store.json comprimido (sin claves API) a gs://<GCS_DATA_BUCKET>/${objectName}
  npm run data:pull       Descarga gs://<GCS_DATA_BUCKET>/${objectName} hacia .data/store.json local

  [Google BigQuery (Data Warehouse Empresarial)]
  npm run data:init-bq    Crea/verifica el Dataset, las 8 tablas particionadas y las 4 vistas BI en BigQuery
  npm run data:push-bq    Migra .data/store.json local hacia BigQuery (${cfg.bqProjectId || '<GCP_PROJECT_ID>'}.${cfg.bqDatasetId})
  npm run data:pull-bq    Descarga las tablas de BigQuery hacia .data/store.json local
`);
    process.exit(1);
  }

  if (action === 'verify') {
    if (!fs.existsSync(cfg.localStoreFile)) {
      console.error(`❌ No existe el archivo local: ${cfg.localStoreFile}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(cfg.localStoreFile, 'utf8');
    const rawBytes = Buffer.byteLength(raw, 'utf8');
    const parsed = JSON.parse(raw);
    const compressed = compressStoreJson(parsed, true);
    const roundTrip = decompressStoreBuffer<any>(compressed);

    const ratio = ((1 - compressed.byteLength / rawBytes) * 100).toFixed(1);
    console.log(`✅ Verificación de portabilidad Cloud/Local exitosa:`);
    console.log(`   • Archivo local:        ${cfg.localStoreFile}`);
    console.log(`   • Tamaño sin comprimir: ${(rawBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   • Tamaño GZIP (.gz):    ${(compressed.byteLength / (1024 * 1024)).toFixed(2)} MB (-${ratio}%)`);
    console.log(`   • Actividades íntegras: ${(roundTrip.activities?.length || 0).toLocaleString()}`);
    console.log(
      `   • Secretos removidos:   ${
        roundTrip.apiConfig?.accessKey === '' && roundTrip.apiConfig?.secretKey === ''
          ? 'Sí (Seguro para GCS / BigQuery)'
          : 'No'
      }`
    );
    return;
  }

  // ==========================================================================
  // BigQuery Data Warehouse Actions
  // ==========================================================================
  if (action === 'init-bq' || action === 'push-bq' || action === 'pull-bq') {
    if (!cfg.bqProjectId) {
      console.error(
        '❌ Falta definir GCP_PROJECT_ID (o BQ_PROJECT_ID) en .env o en la línea de comandos.\n' +
          '   Ejemplo: GCP_PROJECT_ID="mi-proyecto-gcp" npm run data:init-bq'
      );
      process.exit(1);
    }

    if (action === 'init-bq') {
      console.log(
        `📊 Verificando/creando Dataset, 8 tablas y 4 vistas BI en ${cfg.bqProjectId}.${cfg.bqDatasetId} (${cfg.bqLocation})...`
      );
      const res = await ensureBigQuerySchema({ force: true, includeViews: true });
      console.log(
        `✅ Esquema de BigQuery listo en ${res.projectId}.${res.datasetId} (ubicación: ${res.location}).`
      );
      return;
    }

    if (action === 'push-bq') {
      if (!fs.existsSync(cfg.localStoreFile)) {
        console.error(`❌ No se encontró base de datos local en ${cfg.localStoreFile}`);
        process.exit(1);
      }
      console.log(`📦 Leyendo almacén local ${cfg.localStoreFile}...`);
      const parsed = JSON.parse(fs.readFileSync(cfg.localStoreFile, 'utf8'));
      console.log(
        `📊 Cargando catálogo, equipos, miembros, OKRs y actividades hacia BigQuery (${cfg.bqProjectId}.${cfg.bqDatasetId})...`
      );
      const { activitiesStored, syncId } = await persistSnapshotToBigQuery(parsed);
      console.log(
        `✅ Migración a BigQuery completada (${activitiesStored.toLocaleString()} actividades únicas • lote ${syncId}).`
      );
      return;
    }

    if (action === 'pull-bq') {
      console.log(
        `📊 Descargando almacén desde BigQuery (${cfg.bqProjectId}.${cfg.bqDatasetId})...`
      );
      const bqData = await loadSnapshotFromBigQuery();
      if (!bqData) {
        console.error(
          `❌ El dataset ${cfg.bqProjectId}.${cfg.bqDatasetId} está vacío o no tiene registros sincronizados.`
        );
        process.exit(1);
      }

      let localApiConfig: Record<string, any> = {};
      if (fs.existsSync(cfg.localStoreFile)) {
        try {
          const existing = JSON.parse(fs.readFileSync(cfg.localStoreFile, 'utf8'));
          localApiConfig = existing?.apiConfig || {};
        } catch {
          // ignore
        }
      }

      const merged = bqData.snapshot;
      merged.apiConfig = {
        ...merged.apiConfig,
        accessKey:
          localApiConfig.accessKey || process.env.SKILLS_ACCESS_KEY || merged.apiConfig.accessKey || '',
        secretKey:
          localApiConfig.secretKey || process.env.SKILLS_SECRET_KEY || merged.apiConfig.secretKey || '',
        organizationSlug:
          merged.apiConfig.organizationSlug ||
          localApiConfig.organizationSlug ||
          process.env.SKILLS_ORGANIZATION_SLUG ||
          '',
      };

      if (!fs.existsSync(cfg.dataDir)) {
        fs.mkdirSync(cfg.dataDir, { recursive: true });
      }
      const tmpPath = `${cfg.localStoreFile}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(merged), 'utf8');
      fs.renameSync(tmpPath, cfg.localStoreFile);

      console.log(
        `✅ Almacén local actualizado desde BigQuery en ${cfg.localStoreFile} (${merged.activities.length.toLocaleString()} actividades).`
      );
      return;
    }
  }

  // ==========================================================================
  // Google Cloud Storage (GCS) Actions
  // ==========================================================================
  if (!bucket) {
    console.error(
      '❌ Falta definir la variable GCS_DATA_BUCKET (en .env o en la línea de comandos).\n' +
        '   Ejemplo: GCS_DATA_BUCKET="mi-proyecto-skillsboost-data" npm run data:push'
    );
    process.exit(1);
  }

  if (action === 'push') {
    if (!fs.existsSync(cfg.localStoreFile)) {
      console.error(`❌ No se encontró base de datos local en ${cfg.localStoreFile}`);
      process.exit(1);
    }
    console.log(`📦 Leyendo almacén local ${cfg.localStoreFile}...`);
    const raw = fs.readFileSync(cfg.localStoreFile, 'utf8');
    const rawMb = (Buffer.byteLength(raw, 'utf8') / (1024 * 1024)).toFixed(2);
    const parsed = JSON.parse(raw);

    console.log(
      `☁️  Comprimiendo (${rawMb} MB) y subiendo (sin claves secretas) a gs://${bucket}/${objectName}...`
    );
    const { bytesCompressed } = await uploadGcsStore(bucket, objectName, parsed);
    console.log(
      `✅ Sincronización hacia Google Cloud completada: ${(bytesCompressed / (1024 * 1024)).toFixed(
        2
      )} MB transferidos (${(parsed.activities?.length || 0).toLocaleString()} actividades).`
    );
    return;
  }

  if (action === 'pull') {
    console.log(`☁️  Descargando gs://${bucket}/${objectName}...`);
    const remoteData = await downloadGcsStore<any>(bucket, objectName);
    if (!remoteData) {
      console.error(`❌ No se encontró el objeto gs://${bucket}/${objectName} en Google Cloud Storage.`);
      process.exit(1);
    }

    let localApiConfig: Record<string, any> = {};
    if (fs.existsSync(cfg.localStoreFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(cfg.localStoreFile, 'utf8'));
        localApiConfig = existing?.apiConfig || {};
      } catch {
        // ignore
      }
    }

    remoteData.apiConfig = {
      ...remoteData.apiConfig,
      accessKey:
        localApiConfig.accessKey || process.env.SKILLS_ACCESS_KEY || remoteData.apiConfig?.accessKey || '',
      secretKey:
        localApiConfig.secretKey || process.env.SKILLS_SECRET_KEY || remoteData.apiConfig?.secretKey || '',
      organizationSlug:
        remoteData.apiConfig?.organizationSlug ||
        localApiConfig.organizationSlug ||
        process.env.SKILLS_ORGANIZATION_SLUG ||
        '',
    };

    if (!fs.existsSync(cfg.dataDir)) {
      fs.mkdirSync(cfg.dataDir, { recursive: true });
    }

    const tmpPath = `${cfg.localStoreFile}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(remoteData), 'utf8');
    fs.renameSync(tmpPath, cfg.localStoreFile);

    console.log(
      `✅ Base de datos local actualizada en ${cfg.localStoreFile} (${(
        remoteData.activities?.length || 0
      ).toLocaleString()} actividades).`
    );
  }
}

main().catch((err) => {
  console.error('❌ Error en herramienta de sincronización Cloud/Local:', err.message || err);
  process.exit(1);
});

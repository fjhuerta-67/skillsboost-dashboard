import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { execSync, spawnSync } from 'child_process';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function banner(title: string, subtitle?: string) {
  console.log(`\n${C.blue}======================================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  if (subtitle) {
    console.log(`${C.dim}  ${subtitle}${C.reset}`);
  }
  console.log(`${C.blue}======================================================================${C.reset}`);
}

function stepHeader(stepNum: number, title: string) {
  console.log(`\n${C.bold}${C.blue}[Paso ${stepNum}/6] ${title}${C.reset}`);
  console.log(`${C.dim}----------------------------------------------------------------------${C.reset}`);
}

function checkBinary(bin: string): string | null {
  try {
    return execSync(`which ${bin}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function detectGcloudProject(): string {
  try {
    const val = execSync('gcloud config get-value project', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return val && val !== '(unset)' ? val : '';
  } catch {
    return '';
  }
}

function checkAdcActive(): boolean {
  try {
    execSync('gcloud auth application-default print-access-token', {
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 6000,
    });
    return true;
  } catch {
    return false;
  }
}

function upsertSecretVersion(projectId: string, secretName: string, secretValue: string) {
  if (!secretValue.trim()) return;
  const res = spawnSync(
    'gcloud',
    ['secrets', 'versions', 'add', secretName, '--data-file=-', `--project=${projectId}`],
    {
      input: secretValue,
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'pipe'],
    }
  );
  if (res.status !== 0) {
    throw new Error(
      `Error cargando secreto '${secretName}' en Secret Manager: ${(res.stderr || '').trim()}`
    );
  }
}

function runStreaming(cmd: string, args: string[], cwd: string) {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    throw new Error(`El comando "${cmd} ${args.join(' ')}" finalizó con código ${res.status}`);
  }
}

function renderTfvars(cfg: {
  projectId: string;
  region: string;
  serviceName: string;
  containerImage: string;
  storageBackend: 'bigquery' | 'gcs';
  bqDatasetId: string;
  bqDeletionProtection: boolean;
  createGcsBucket: boolean;
  authMode: 'iam_private' | 'basic_auth' | 'public_iap';
  useVertexAi: boolean;
  geminiModel: string;
  skillsOrgSlug: string;
  contractedLicenses: number;
  hasSkillsSecrets: boolean;
  hasGeminiSecret: boolean;
  hasBasicAuthSecret: boolean;
  enableScheduledSync: boolean;
  syncCronSchedule: string;
  syncTimeZone: string;
  syncLookbackDays: number;
  minInstances: number;
  maxInstances: number;
}): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `# Archivo autogenerado por el Asistente Interactivo (npm run deploy:wizard)
# Fecha: ${new Date().toISOString()}
# NOTA: Los valores secretos reales residen únicamente en Google Secret Manager.

project_id                    = "${esc(cfg.projectId)}"
region                        = "${esc(cfg.region)}"
service_name                  = "${esc(cfg.serviceName)}"
container_image               = "${esc(cfg.containerImage)}"
storage_backend               = "${cfg.storageBackend}"
bq_dataset_id                 = "${esc(cfg.bqDatasetId)}"
bq_deletion_protection        = ${cfg.bqDeletionProtection}
create_gcs_bucket             = ${cfg.createGcsBucket}
auth_mode                     = "${cfg.authMode}"
use_vertex_ai                 = ${cfg.useVertexAi}
gemini_model                  = "${esc(cfg.geminiModel)}"
skills_organization_slug      = "${esc(cfg.skillsOrgSlug)}"
skills_contracted_licenses    = ${cfg.contractedLicenses}

has_skills_secrets_versions   = ${cfg.hasSkillsSecrets}
has_gemini_secret_version     = ${cfg.hasGeminiSecret}
has_basic_auth_secret_version = ${cfg.hasBasicAuthSecret}

enable_scheduled_sync         = ${cfg.enableScheduledSync}
sync_cron_schedule            = "${esc(cfg.syncCronSchedule)}"
sync_time_zone                = "${esc(cfg.syncTimeZone)}"
sync_lookback_days            = ${cfg.syncLookbackDays}

min_instances                 = ${cfg.minInstances}
max_instances                 = ${cfg.maxInstances}
`;
}

async function testSkillsCredentialsLive(
  accessKey: string,
  secretKey: string,
  baseUrl = 'https://www.skills.google/api/v2'
): Promise<{ ok: boolean; message: string }> {
  try {
    const params = new URLSearchParams();
    params.append('access_key', accessKey);
    params.append('secret_key', secretKey);
    const res = await fetch(`${baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, message: `HTTP ${res.status}: ${txt.slice(0, 160)}` };
    }
    const json = (await res.json()) as Record<string, any>;
    const token = json.auth_token || json.token || json.access_token;
    return token
      ? { ok: true, message: 'Token Bearer de Google Skills API v2 emitido correctamente.' }
      : { ok: false, message: 'Respuesta inesperada del servidor de autenticación.' };
  } catch (err: any) {
    return { ok: false, message: err.message || String(err) };
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const rootDir = process.cwd();
  const tfDir = path.join(rootDir, 'terraform');

  banner(
    'Asistente Interactivo de Despliegue — Cloud Run + BigQuery + Terraform',
    'Google Skills for Organizations Dashboard v1.1'
  );

  // ==========================================================================
  // PASO 1: Verificación de Herramientas y Credenciales GCP
  // ==========================================================================
  stepHeader(1, 'Verificación de Prerrequisitos Locales');

  const gcloudBin = checkBinary('gcloud');
  const terraformBin = checkBinary('terraform');

  console.log(`  • Google Cloud SDK (gcloud): ${gcloudBin ? `${C.green}Detectado (${gcloudBin})${C.reset}` : `${C.red}No instalado${C.reset}`}`);
  console.log(`  • HashiCorp Terraform:       ${terraformBin ? `${C.green}Detectado (${terraformBin})${C.reset}` : `${C.red}No instalado${C.reset}`}`);

  if (!gcloudBin || !terraformBin) {
    console.error(
      `\n${C.red}❌ Faltan herramientas requeridas. Instala Google Cloud SDK y Terraform >= 1.5 antes de continuar.${C.reset}`
    );
    process.exit(1);
  }

  const detectedProject = process.env.GCP_PROJECT_ID || detectGcloudProject();
  const adcOk = checkAdcActive();
  console.log(
    `  • Credenciales ADC activas:  ${
      adcOk
        ? `${C.green}Sí (listas para Terraform)${C.reset}`
        : `${C.yellow}Pendientes (se requerirá 'gcloud auth application-default login')${C.reset}`
    }`
  );

  if (isDryRun) {
    const samplePreview = renderTfvars({
      projectId: 'ejemplo-proyecto-gcp',
      region: 'us-central1',
      serviceName: 'skillsboost-dashboard',
      containerImage: '',
      storageBackend: 'bigquery',
      bqDatasetId: 'skillsboost_analytics',
      bqDeletionProtection: true,
      createGcsBucket: true,
      authMode: 'iam_private',
      useVertexAi: true,
      geminiModel: 'gemini-2.5-flash',
      skillsOrgSlug: 'mi-organizacion',
      contractedLicenses: 500,
      hasSkillsSecrets: true,
      hasGeminiSecret: false,
      hasBasicAuthSecret: false,
      enableScheduledSync: true,
      syncCronSchedule: '0 2 * * *',
      syncTimeZone: 'UTC',
      syncLookbackDays: 0,
      minInstances: 0,
      maxInstances: 3,
    });

    console.log(`\n${C.green}✅ Modo --dry-run completado sin modificar recursos.${C.reset}`);
    console.log(`${C.dim}Vista previa de terraform.tfvars generado:${C.reset}\n`);
    console.log(samplePreview);
    return;
  }

  const rl = readline.createInterface({ input, output });
  const ask = async (promptText: string, defaultVal = ''): Promise<string> => {
    const suffix = defaultVal ? ` ${C.dim}[${defaultVal}]${C.reset}` : '';
    const ans = (await rl.question(`  ${promptText}${suffix}: `)).trim();
    return ans || defaultVal;
  };

  try {
    if (!adcOk) {
      const loginNow = await ask(
        '¿Deseas iniciar sesión ADC ahora mismo con "gcloud auth application-default login"? (s/n)',
        's'
      );
      if (loginNow.toLowerCase().startsWith('s')) {
        runStreaming('gcloud', ['auth', 'application-default', 'login'], rootDir);
      } else {
        console.log(`${C.yellow}⚠️ Cancelado: Terraform requiere credenciales ADC activas.${C.reset}`);
        process.exit(1);
      }
    }

    // ========================================================================
    // PASO 2: Proyecto GCP, Región y Servicio
    // ========================================================================
    stepHeader(2, 'Configuración de Proyecto y Región en Google Cloud');

    let projectId = '';
    while (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
      projectId = await ask('ID del Proyecto de Google Cloud (project_id)', detectedProject);
      if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
        console.log(
          `  ${C.red}El ID del proyecto debe tener entre 6 y 30 caracteres (minúsculas, dígitos y guiones).${C.reset}`
        );
      }
    }

    console.log(`\n  Regiones recomendadas:`);
    console.log(`    1) us-central1 (Iowa — baja latencia en América y soporte completo Vertex AI)`);
    console.log(`    2) us-east1 (Carolina del Sur)`);
    console.log(`    3) us-west1 (Oregón)`);
    console.log(`    4) southamerica-east1 (São Paulo)`);
    console.log(`    5) Escribir otra región manualmente`);
    const regChoice = await ask('Selecciona la región (1-5)', '1');
    const regionMap: Record<string, string> = {
      '1': 'us-central1',
      '2': 'us-east1',
      '3': 'us-west1',
      '4': 'southamerica-east1',
    };
    const region =
      regionMap[regChoice] ||
      (regChoice === '5'
        ? await ask('Ingresa el nombre exacto de la región GCP', process.env.GCP_REGION || 'us-central1')
        : regChoice);

    const serviceName = await ask(
      'Nombre del servicio en Cloud Run',
      process.env.SERVICE_NAME || 'skillsboost-dashboard'
    );

    // ========================================================================
    // PASO 3: Arquitectura de Datos (BigQuery + Cloud Storage)
    // ========================================================================
    stepHeader(3, 'Arquitectura de Datos (BigQuery Data Warehouse y Respaldo)');

    console.log(`  Motores de persistencia disponibles:`);
    console.log(`    1) BigQuery Data Warehouse + 4 Vistas Looker Studio + Caché RAM (Recomendado)`);
    console.log(`    2) Google Cloud Storage (Archivo comprimido store.json.gz)`);
    const storageChoice = await ask('Selecciona el backend primario (1-2)', '1');
    const storageBackend: 'bigquery' | 'gcs' = storageChoice === '2' ? 'gcs' : 'bigquery';

    const bqDatasetId = await ask(
      'Nombre del Dataset en BigQuery',
      process.env.BQ_DATASET_ID || 'skillsboost_analytics'
    );
    const protectAns = await ask(
      '¿Activar protección contra borrado accidental en tablas BigQuery? (s/n)',
      's'
    );
    const bqDeletionProtection = protectAns.toLowerCase().startsWith('s');

    const gcsAns = await ask(
      '¿Crear también bucket privado en Cloud Storage para snapshots GZIP de respaldo? (s/n)',
      's'
    );
    const createGcsBucket = gcsAns.toLowerCase().startsWith('s');

    // ========================================================================
    // PASO 4: Motor Gemini (Vertex AI vs API Key) y Seguridad de Acceso
    // ========================================================================
    stepHeader(4, 'Motor de Inteligencia Gemini y Control de Acceso');

    console.log(`  Autenticación para los módulos de Inteligencia Artificial (Gemini):`);
    console.log(`    1) Vertex AI con Service Account (ADC) — Sin administrar API Keys (Recomendado en GCP)`);
    console.log(`    2) Google AI Studio API Key almacenada en Secret Manager`);
    const aiChoice = await ask('Selecciona el modo de Gemini (1-2)', '1');
    const useVertexAi = aiChoice !== '2';

    let geminiApiKey = '';
    if (!useVertexAi) {
      geminiApiKey = await ask(
        'Ingresa tu GEMINI_API_KEY (se enviará directo a Secret Manager)',
        process.env.GEMINI_API_KEY ? 'Usar clave actual en .env' : ''
      );
      if (geminiApiKey === 'Usar clave actual en .env') {
        geminiApiKey = process.env.GEMINI_API_KEY || '';
      }
    }
    const geminiModel = await ask(
      'Modelo Gemini primario',
      useVertexAi ? 'gemini-2.5-flash' : process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    );

    console.log(`\n  Esquema de seguridad para abrir el tablero en Cloud Run:`);
    console.log(`    1) Privado con Google Cloud IAM / Proxy autenticado (Máxima seguridad corporativa)`);
    console.log(`    2) Protegido con contraseña HTTP Basic Auth en Secret Manager`);
    console.log(`    3) Acceso gestionado externamente (detrás de Cloud IAP / Load Balancer)`);
    const authChoice = await ask('Selecciona el esquema de acceso (1-3)', '1');
    const authMode: 'iam_private' | 'basic_auth' | 'public_iap' =
      authChoice === '2' ? 'basic_auth' : authChoice === '3' ? 'public_iap' : 'iam_private';

    let basicAuthPassword = '';
    if (authMode === 'basic_auth') {
      while (!basicAuthPassword) {
        basicAuthPassword = await ask(
          'Define la contraseña corporativa de acceso al Dashboard',
          process.env.DASHBOARD_ACCESS_PASSWORD || ''
        );
      }
    }

    // ========================================================================
    // PASO 5: Credenciales Google Skills API v2 y Sincronización Programada
    // ========================================================================
    stepHeader(5, 'Credenciales de Google Skills API v2 y Cron Nocturno');

    const rawOrgSlug = await ask(
      'Slug de Organización en Google Skills (o deja vacío para iniciar en Modo Demo)',
      process.env.SKILLS_ORGANIZATION_SLUG || ''
    );
    const slugMatch = rawOrgSlug.match(/organization\/([^/]+)/);
    const skillsOrgSlug = (slugMatch ? slugMatch[1] : rawOrgSlug).trim().replace(/^\/+|\/+$/g, '');

    const contractedLicenses =
      Number(
        await ask(
          'Cupo anual de licencias contratadas',
          String(process.env.SKILLS_CONTRACTED_LICENSES || 500)
        )
      ) || 500;

    let skillsAccessKey = '';
    let skillsSecretKey = '';

    if (skillsOrgSlug) {
      const envAk = process.env.SKILLS_ACCESS_KEY || '';
      const envSk = process.env.SKILLS_SECRET_KEY || '';
      const akInput = await ask(
        'SKILLS_ACCESS_KEY (AK_...)',
        envAk ? 'Usar clave en .env' : ''
      );
      skillsAccessKey = akInput === 'Usar clave en .env' ? envAk : akInput;

      const skInput = await ask(
        'SKILLS_SECRET_KEY (SK_...)',
        envSk ? 'Usar clave en .env' : ''
      );
      skillsSecretKey = skInput === 'Usar clave en .env' ? envSk : skInput;

      if (skillsAccessKey && skillsSecretKey) {
        const verifyLive = await ask(
          '¿Probar conexión en vivo contra Google Skills API v2 antes de desplegar? (s/n)',
          's'
        );
        if (verifyLive.toLowerCase().startsWith('s')) {
          process.stdout.write('  🔄 Verificando credenciales con Google Skills API v2... ');
          const test = await testSkillsCredentialsLive(skillsAccessKey, skillsSecretKey);
          if (test.ok) {
            console.log(`${C.green}¡Éxito! ${test.message}${C.reset}`);
          } else {
            console.log(`${C.yellow}Advertencia: ${test.message}${C.reset}`);
            const proceedAnyway = await ask('¿Continuar con el despliegue de todos modos? (s/n)', 's');
            if (!proceedAnyway.toLowerCase().startsWith('s')) {
              process.exit(1);
            }
          }
        }
      }
    }

    const schedAns = await ask(
      '¿Habilitar sincronización automática diaria (Cloud Scheduler -> Cloud Run Job)? (s/n)',
      's'
    );
    const enableScheduledSync = schedAns.toLowerCase().startsWith('s');
    const syncCronSchedule = enableScheduledSync
      ? await ask('Horario Cron diario', '0 2 * * *')
      : '0 2 * * *';
    const syncTimeZone = enableScheduledSync
      ? await ask('Zona horaria IANA del Cron', 'UTC')
      : 'UTC';

    const minInstances = Number(await ask('Instancias mínimas en Cloud Run (0 = escala a cero)', '0')) || 0;
    const maxInstances = Number(await ask('Instancias máximas en Cloud Run', '3')) || 3;

    // ========================================================================
    // PASO 6: Construcción de Imagen, Secret Manager y Terraform Apply
    // ========================================================================
    stepHeader(6, 'Ejecución Guiada de Cloud Build + Secret Manager + Terraform');

    const imageTag = `${region}-docker.pkg.dev/${projectId}/skillsboost/${serviceName}:latest`;
    const hasSkillsSecrets = Boolean(skillsAccessKey && skillsSecretKey);
    const hasGeminiSecret = Boolean(!useVertexAi && geminiApiKey);
    const hasBasicAuthSecret = Boolean(authMode === 'basic_auth' && basicAuthPassword);

    const tfvarsContent = renderTfvars({
      projectId,
      region,
      serviceName,
      containerImage: imageTag,
      storageBackend,
      bqDatasetId,
      bqDeletionProtection,
      createGcsBucket,
      authMode,
      useVertexAi,
      geminiModel,
      skillsOrgSlug,
      contractedLicenses,
      hasSkillsSecrets,
      hasGeminiSecret,
      hasBasicAuthSecret,
      enableScheduledSync,
      syncCronSchedule,
      syncTimeZone,
      syncLookbackDays: 0,
      minInstances,
      maxInstances,
    });

    const tfvarsPath = path.join(tfDir, 'terraform.tfvars');
    fs.writeFileSync(tfvarsPath, tfvarsContent, 'utf8');
    console.log(`  ✅ Archivo de variables generado en: ${C.cyan}terraform/terraform.tfvars${C.reset}`);

    const confirmRun = await ask(
      '\n¿Ejecutar ahora el aprovisionamiento completo (Terraform Init -> Build Imagen -> Secretos -> Apply)? (s/n)',
      's'
    );
    if (!confirmRun.toLowerCase().startsWith('s')) {
      console.log(
        `\n${C.green}Configuración guardada en terraform/terraform.tfvars.${C.reset} Puedes aplicar manualmente cuando gustes siguiendo docs/manuales/04-manual-terraform-interactivo.md.`
      );
      return;
    }

    console.log(`\n${C.cyan}▶ Fase 6.1: Inicializando proveedores Terraform...${C.reset}`);
    runStreaming('terraform', ['init'], tfDir);

    console.log(
      `\n${C.cyan}▶ Fase 6.2: Habilitando APIs base, Artifact Registry y contenedores Secret Manager...${C.reset}`
    );
    runStreaming(
      'terraform',
      [
        'apply',
        '-auto-approve',
        '-target=google_project_service.apis',
        '-target=google_artifact_registry_repository.docker_repo',
        '-target=google_secret_manager_secret.skills_access_key',
        '-target=google_secret_manager_secret.skills_secret_key',
        '-target=google_secret_manager_secret.gemini_api_key',
        '-target=google_secret_manager_secret.dashboard_password',
      ],
      tfDir
    );

    if (hasSkillsSecrets || hasGeminiSecret || hasBasicAuthSecret) {
      console.log(`\n${C.cyan}▶ Fase 6.3: Inyectando versiones seguras en Google Secret Manager...${C.reset}`);
      if (hasSkillsSecrets) {
        upsertSecretVersion(projectId, 'skillsboost-access-key', skillsAccessKey);
        upsertSecretVersion(projectId, 'skillsboost-secret-key', skillsSecretKey);
      }
      if (hasGeminiSecret) {
        upsertSecretVersion(projectId, 'skillsboost-gemini-api-key', geminiApiKey);
      }
      if (hasBasicAuthSecret) {
        upsertSecretVersion(projectId, 'skillsboost-access-password', basicAuthPassword);
      }
      console.log(`  ✅ Secretos almacenados de forma cifrada fuera del estado de Git.`);
    }

    console.log(
      `\n${C.cyan}▶ Fase 6.4: Compilando y publicando imagen Docker en Artifact Registry vía Cloud Build...${C.reset}`
    );
    runStreaming(
      'gcloud',
      ['builds', 'submit', '--tag', imageTag, `--project=${projectId}`],
      rootDir
    );

    console.log(`\n${C.cyan}▶ Fase 6.5: Generando plan completo de infraestructura (BigQuery + Cloud Run + Cron)...${C.reset}`);
    runStreaming('terraform', ['plan', '-out=tfplan'], tfDir);

    const confirmApply = await ask(
      '\n¿Confirmas aplicar este plan de Terraform en Google Cloud? (s/n)',
      's'
    );
    if (!confirmApply.toLowerCase().startsWith('s')) {
      console.log(`${C.yellow}Ejecución pausada antes de apply. El plan quedó guardado en terraform/tfplan.${C.reset}`);
      return;
    }

    runStreaming('terraform', ['apply', 'tfplan'], tfDir);

    // Opcional: Migrar datos locales existentes (.data/store.json) o disparar primer Sync Job
    const localStore = path.join(rootDir, '.data', 'store.json');
    if (storageBackend === 'bigquery' && fs.existsSync(localStore)) {
      const migrateLocal = await ask(
        '\nSe detectó una base local en .data/store.json. ¿Deseas migrarla ahora mismo a BigQuery? (s/n)',
        's'
      );
      if (migrateLocal.toLowerCase().startsWith('s')) {
        execSync(`GCP_PROJECT_ID="${projectId}" BQ_DATASET_ID="${bqDatasetId}" npm run data:push-bq`, {
          cwd: rootDir,
          stdio: 'inherit',
        });
      }
    } else if (hasSkillsSecrets) {
      const runFirstJob = await ask(
        '\n¿Deseas disparar en segundo plano la primera sincronización oficial con el Cloud Run Job? (s/n)',
        's'
      );
      if (runFirstJob.toLowerCase().startsWith('s')) {
        runStreaming(
          'gcloud',
          [
            'run',
            'jobs',
            'execute',
            `${serviceName}-sync-job`,
            `--project=${projectId}`,
            `--region=${region}`,
          ],
          rootDir
        );
      }
    }

    banner('🎉 ¡Despliegue Empresarial Completado con Éxito!');
    runStreaming('terraform', ['output'], tfDir);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n${C.red}❌ Error en el asistente interactivo:${C.reset}`, err.message || err);
  process.exit(1);
});

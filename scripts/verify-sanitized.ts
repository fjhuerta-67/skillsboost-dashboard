import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Pre-GitHub Sanitization & Leak Prevention Scanner
 * Supports two strict modes:
 *   1. Default (Public Edition): Zero secrets, zero PII, zero PDFs, zero internal Google models/paths,
 *      AND zero customer names/slugs.
 *   2. --allow-coppel-branding (Private Coppel Edition): Allows non-secret Coppel UI/org labels,
 *      while STILL strictly blocking API keys, .env, .data/store.json, @coppel.com employee PII emails,
 *      confidential PDFs, internal Google models, and corporate @google.com Git emails.
 */

const ROOT = process.cwd();
const allowCoppelBranding = process.argv.includes('--allow-coppel-branding');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.data',
  '.private-backup',
  'releases',
  'dist',
  '.git',
  '.terraform',
  '.vscode',
  '.idea',
  'coverage',
]);

const FORBIDDEN_FILE_PATTERNS: { label: string; test: (relPath: string) => boolean }[] = [
  {
    label: 'Confidential or local PDF document',
    test: (p) => p.toLowerCase().endsWith('.pdf'),
  },
  {
    label: 'Local .env file with secrets',
    test: (p) => {
      const base = path.basename(p);
      return (base === '.env' || base.startsWith('.env.')) && base !== '.env.example';
    },
  },
  {
    label: 'Local data store, backup, or nested release folder',
    test: (p) =>
      p.startsWith('.data/') || p.startsWith('.private-backup/') || p.startsWith('releases/'),
  },
  {
    label: 'Terraform state or concrete tfvars file',
    test: (p) => {
      const base = path.basename(p);
      if (base === 'terraform.tfvars.example') return false;
      return (
        base.endsWith('.tfstate') ||
        base.includes('.tfstate.') ||
        base.endsWith('.tfvars') ||
        base.endsWith('.tfvars.json') ||
        base === 'tfplan'
      );
    },
  },
  {
    label: 'Private key or service account JSON',
    test: (p) => {
      const lower = p.toLowerCase();
      return (
        lower.endsWith('.pem') ||
        lower.endsWith('.key') ||
        lower.includes('credentials.json') ||
        lower.includes('service-account')
      );
    },
  },
];

function buildSensitiveRules(): { label: string; regex: RegExp }[] {
  const rules: { label: string; regex: RegExp }[] = [
    {
      label: 'Hardcoded Google API Key (AIza...)',
      regex: /AIza[0-9A-Za-z_-]{25,}/,
    },
    {
      label: 'Hardcoded OAuth / Client Secret (GOCSPX-...)',
      regex: /GOCSPX-[0-9A-Za-z_-]{15,}/,
    },
    {
      label: 'Hardcoded Private Key Block',
      regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    },
    {
      label: 'Hardcoded Skills API Key Value',
      regex: /\b(?:AK|SK)_[A-Za-z0-9]{16,}\b/,
    },
    {
      label: 'Customer Employee Email PII',
      regex: new RegExp('[a-zA-Z0-9._%+-]+@(?:grupo)?cop' + 'pel\\.com', 'i'),
    },
    {
      label: 'Internal / Pre-release Model Identifier',
      regex: new RegExp(['gemini-4', 'gemini-3', 'hydrogen'].join('|'), 'i'),
    },
    {
      label: 'Internal Workstation / Corporate Identifier',
      regex: new RegExp(
        [
          '/usr/local/google',
          'jet' + 'ski-server',
          'anti' + 'gravity',
          'corp\\.google',
          'googlers\\.com',
          '@google\\.com',
          'computeengine-' + '506321',
        ].join('|'),
        'i'
      ),
    },
  ];

  if (!allowCoppelBranding) {
    rules.push({
      label: 'Customer Organization Identifier or Team Slug (Public Edition)',
      regex: new RegExp(
        [
          'cop' + 'pel',
          'bancop' + 'pel',
          'tech-' + 'academy',
          'cloud-digital-leader-para-lideres-ti',
        ].join('|'),
        'i'
      ),
    });
  }

  return rules;
}

function collectPublishableFiles(): string[] {
  const gitDir = path.join(ROOT, '.git');
  if (fs.existsSync(gitDir)) {
    try {
      const out = execSync('git ls-files --cached --others --exclude-standard', {
        cwd: ROOT,
        encoding: 'utf8',
      });
      return out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      // Fallback to directory walk
    }
  }

  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(full);
      } else {
        const base = entry.name;
        if ((base === '.env' || base.startsWith('.env.')) && base !== '.env.example') {
          continue;
        }
        results.push(rel);
      }
    }
  }
  walk(ROOT);
  return results.sort();
}

function checkGitAuthorSafety(): string[] {
  const issues: string[] = [];
  if (!fs.existsSync(path.join(ROOT, '.git'))) return issues;

  const getCfg = (key: string) => {
    try {
      return execSync(`git config --get ${key}`, { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };

  const name = getCfg('user.name');
  const email = getCfg('user.email');

  if (!name || !email) {
    issues.push(
      'Git user.name or user.email is unset — committing on a corporate machine may embed your OS username and workstation hostname!'
    );
  } else if (/(@google\.com|corp\.|googlers\.com)/i.test(email)) {
    issues.push(
      `Git user.email ("${email}") uses a corporate domain. Set a GitHub noreply address: git config user.email "<handle>@users.noreply.github.com"`
    );
  }
  return issues;
}

function main() {
  const files = collectPublishableFiles();
  const rules = buildSensitiveRules();
  const findings: string[] = [];

  for (const rel of files) {
    for (const fp of FORBIDDEN_FILE_PATTERNS) {
      if (fp.test(rel)) {
        findings.push(`[FORBIDDEN FILE] ${rel} -> ${fp.label}`);
      }
    }

    if (rel === 'scripts/verify-sanitized.ts') continue;

    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;

    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) continue;

    const lines = buf.toString('utf8').split('\n');
    lines.forEach((line, idx) => {
      for (const rule of rules) {
        const match = line.match(rule.regex);
        if (match) {
          findings.push(
            `[CONTENT LEAK] ${rel}:${idx + 1} (${rule.label}) -> matched "${match[0]}"`
          );
        }
      }
    });
  }

  for (const gitIssue of checkGitAuthorSafety()) {
    findings.push(`[GIT AUTHOR] ${gitIssue}`);
  }

  const modeLabel = allowCoppelBranding
    ? 'Edición Privada Coppel (Cero Secretos / Cero PII / Cero Modelos Internos)'
    : 'Edición Pública Open-Source (100% Genérica / Cero Datos Privados)';

  console.log('==================================================================');
  console.log(`🛡️  Auditoría Pre-GitHub — ${modeLabel}`);
  console.log(`📂 Archivos publicables inspeccionados: ${files.length}`);
  console.log('==================================================================');

  if (findings.length > 0) {
    console.error(`\n❌ Se detectaron ${findings.length} hallazgos bloqueantes:\n`);
    for (const f of findings) {
      console.error(`  • ${f}`);
    }
    process.exit(1);
  }

  console.log('✅ CERO fugas detectadas: repositorio verificado y seguro para GitHub.');
}

main();

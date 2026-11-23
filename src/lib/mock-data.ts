import { CatalogItem, Team, Member, LearningActivity } from '../types';

export const MOCK_CATALOG: CatalogItem[] = [
  {
    content_id: 'gcp-genai-gemini-fundamentals',
    content_type: 'Course',
    name: 'Introduction to Generative AI & Gemini Architecture',
    description: 'Learn the fundamentals of generative models, multimodal understanding, and Google Gemini architecture.',
    duration: 180,
    level: 'introductory',
    available_locales: ['English', 'Spanish', 'Japanese'],
    url: 'https://www.skills.google/course_templates/101',
    category: 'AI & Machine Learning',
  },
  {
    content_id: 'gcp-prompt-engineering-agentic',
    content_type: 'Lab',
    name: 'Hands-on: Prompt Engineering & Agentic Workflows with Gemini API',
    description: 'Build reasoning agents with function calling, structured outputs, and grounding.',
    duration: 90,
    level: 'intermediate',
    available_locales: ['English'],
    url: 'https://www.skills.google/focuses/202?parent=catalog',
    category: 'AI & Machine Learning',
  },
  {
    content_id: 'gcp-vertex-ai-pipelines',
    content_type: 'Course',
    name: 'Production MLOps with Vertex AI Pipelines',
    description: 'End-to-end model training, registry, continuous deployment, and evaluation.',
    duration: 240,
    level: 'advanced',
    available_locales: ['English'],
    url: 'https://www.skills.google/course_templates/303',
    category: 'AI & Machine Learning',
  },
  {
    content_id: 'gcp-gke-foundations',
    content_type: 'Course',
    name: 'Architecting with Google Kubernetes Engine (GKE)',
    description: 'Deploy, scale, and manage microservices on GKE Autopilot and Standard clusters.',
    duration: 360,
    level: 'intermediate',
    available_locales: ['English', 'Spanish'],
    url: 'https://www.skills.google/course_templates/404',
    category: 'Containers & Kubernetes',
  },
  {
    content_id: 'gcp-cloud-run-microservices',
    content_type: 'Lab',
    name: 'Containerized Microservices on Cloud Run & Eventarc',
    description: 'Build serverless APIs with autoscaling to zero, traffic splitting, and event triggers.',
    duration: 75,
    level: 'intermediate',
    available_locales: ['English'],
    url: 'https://www.skills.google/focuses/505?parent=catalog',
    category: 'Containers & Kubernetes',
  },
  {
    content_id: 'gcp-bigquery-lakehouse',
    content_type: 'Course',
    name: 'Modern Data Warehousing & Lakehouse with BigQuery',
    description: 'Petabyte-scale querying, partitioning, clustering, and BigLake Iceberg federated catalogs.',
    duration: 300,
    level: 'intermediate',
    available_locales: ['English', 'Spanish'],
    url: 'https://www.skills.google/course_templates/606',
    category: 'Data & Analytics',
  },
  {
    content_id: 'gcp-bigquery-ml-lab',
    content_type: 'Lab',
    name: 'Lab: In-Database Machine Learning with BigQuery ML',
    description: 'Train classification, forecasting, and text embeddings directly using SQL.',
    duration: 60,
    level: 'intermediate',
    available_locales: ['English'],
    url: 'https://www.skills.google/focuses/707?parent=catalog',
    category: 'Data & Analytics',
  },
  {
    content_id: 'gcp-security-iam-kms',
    content_type: 'Course',
    name: 'Hardening Security: IAM, Workload Identity, and Cloud KMS',
    description: 'Zero Trust architecture, least privilege access, audit logging, and encryption at rest.',
    duration: 210,
    level: 'advanced',
    available_locales: ['English'],
    url: 'https://www.skills.google/course_templates/808',
    category: 'Cloud Security & IAM',
  },
  {
    content_id: 'gcp-devops-sre-observability',
    content_type: 'Course',
    name: 'Site Reliability Engineering (SRE): SLOs and Cloud Monitoring',
    description: 'Define meaningful Service Level Objectives, error budgets, and synthetic alerting.',
    duration: 180,
    level: 'intermediate',
    available_locales: ['English', 'Spanish'],
    url: 'https://www.skills.google/course_templates/909',
    category: 'DevOps & SRE',
  },
  {
    content_id: 'gcp-terraform-iac',
    content_type: 'Lab',
    name: 'Lab: Infrastructure as Code with Terraform and Cloud Foundation',
    description: 'Automate multi-tier VPCs, firewall rules, and compute instances with Terraform state in GCS.',
    duration: 90,
    level: 'intermediate',
    available_locales: ['English'],
    url: 'https://www.skills.google/focuses/1010?parent=catalog',
    category: 'DevOps & SRE',
  },
  {
    content_id: 'gcp-pro-architect-cert-prep',
    content_type: 'Path',
    name: 'Professional Cloud Architect Certification Journey',
    description: 'Comprehensive preparation path for the Google Cloud Professional Cloud Architect certification.',
    duration: 900,
    level: 'advanced',
    available_locales: ['English'],
    url: 'https://www.skills.google/paths/11',
    category: 'Cloud Infrastructure',
  },
  {
    content_id: 'gcp-cert-pro-cloud-developer',
    content_type: 'Certification',
    name: 'Google Cloud Certified Professional Cloud Developer Exam Assessment',
    description: 'Official assessment and practice exam for Professional Cloud Developer.',
    duration: 120,
    level: 'advanced',
    available_locales: ['English'],
    url: 'https://www.skills.google/course_templates/1212',
    category: 'Cloud Infrastructure',
  },
];

export const MOCK_TEAMS: Team[] = [
  {
    name: 'Cloud Solutions & Architecture',
    slug: 'cloud-architecture',
    description: 'Designing resilient enterprise cloud architectures and multi-region migrations.',
    active: true,
  },
  {
    name: 'Data & AI Engineering',
    slug: 'data-ai-engineering',
    description: 'Building generative AI agents, data pipelines, and analytics lakes.',
    active: true,
  },
  {
    name: 'Cybersecurity & Governance',
    slug: 'security-compliance',
    description: 'Zero Trust enforcement, vulnerability posture management, and IAM hardening.',
    active: true,
  },
  {
    name: 'Platform & Site Reliability (SRE)',
    slug: 'devops-sre',
    description: 'Infrastructure automation, Kubernetes fleet operations, and reliability engineering.',
    active: true,
  },
  {
    name: 'Modern App Development',
    slug: 'app-development',
    description: 'Building microservices, mobile backends, and modern customer portals.',
    active: true,
  },
];

export const MOCK_MEMBERS: Member[] = [
  // Cloud Solutions & Architecture
  { first_name: 'Elena', last_name: 'Rostova', email: 'elena.rostova@company.com', status: 'active', team_slug: 'cloud-architecture', team_name: 'Cloud Solutions & Architecture' },
  { first_name: 'Carlos', last_name: 'Mendez', email: 'carlos.mendez@company.com', status: 'active', team_slug: 'cloud-architecture', team_name: 'Cloud Solutions & Architecture' },
  { first_name: 'Sarah', last_name: 'Jenkins', email: 'sarah.jenkins@company.com', status: 'active', team_slug: 'cloud-architecture', team_name: 'Cloud Solutions & Architecture' },
  { first_name: 'Hiroshi', last_name: 'Tanaka', email: 'hiroshi.tanaka@company.com', status: 'active', team_slug: 'cloud-architecture', team_name: 'Cloud Solutions & Architecture' },

  // Data & AI Engineering
  { first_name: 'Amina', last_name: 'Al-Mansoor', email: 'amina.mansoor@company.com', status: 'active', team_slug: 'data-ai-engineering', team_name: 'Data & AI Engineering' },
  { first_name: 'Mateo', last_name: 'Silva', email: 'mateo.silva@company.com', status: 'active', team_slug: 'data-ai-engineering', team_name: 'Data & AI Engineering' },
  { first_name: 'Priya', last_name: 'Sharma', email: 'priya.sharma@company.com', status: 'active', team_slug: 'data-ai-engineering', team_name: 'Data & AI Engineering' },
  { first_name: 'Liam', last_name: 'O\'Connor', email: 'liam.oconnor@company.com', status: 'active', team_slug: 'data-ai-engineering', team_name: 'Data & AI Engineering' },
  { first_name: 'Wei', last_name: 'Chen', email: 'wei.chen@company.com', status: 'active', team_slug: 'data-ai-engineering', team_name: 'Data & AI Engineering' },

  // Cybersecurity & Governance
  { first_name: 'Marcus', last_name: 'Vance', email: 'marcus.vance@company.com', status: 'active', team_slug: 'security-compliance', team_name: 'Cybersecurity & Governance' },
  { first_name: 'Olga', last_name: 'Petrova', email: 'olga.petrova@company.com', status: 'active', team_slug: 'security-compliance', team_name: 'Cybersecurity & Governance' },
  { first_name: 'Devon', last_name: 'Brooks', email: 'devon.brooks@company.com', status: 'active', team_slug: 'security-compliance', team_name: 'Cybersecurity & Governance' },

  // Platform & SRE
  { first_name: 'Kenji', last_name: 'Sato', email: 'kenji.sato@company.com', status: 'active', team_slug: 'devops-sre', team_name: 'Platform & Site Reliability (SRE)' },
  { first_name: 'Fatima', last_name: 'Zahra', email: 'fatima.zahra@company.com', status: 'active', team_slug: 'devops-sre', team_name: 'Platform & Site Reliability (SRE)' },
  { first_name: 'Alex', last_name: 'Novak', email: 'alex.novak@company.com', status: 'active', team_slug: 'devops-sre', team_name: 'Platform & Site Reliability (SRE)' },
  { first_name: 'Chloe', last_name: 'Dupont', email: 'chloe.dupont@company.com', status: 'active', team_slug: 'devops-sre', team_name: 'Platform & Site Reliability (SRE)' },

  // Modern App Development
  { first_name: 'Lucas', last_name: 'Gomez', email: 'lucas.gomez@company.com', status: 'active', team_slug: 'app-development', team_name: 'Modern App Development' },
  { first_name: 'Ananya', last_name: 'Iyer', email: 'ananya.iyer@company.com', status: 'active', team_slug: 'app-development', team_name: 'Modern App Development' },
  { first_name: 'Jordan', last_name: 'Lee', email: 'jordan.lee@company.com', status: 'active', team_slug: 'app-development', team_name: 'Modern App Development' },
];

/**
 * Generate synthetic realistic activities over the past 90 days
 */
export function generateMockActivities(): LearningActivity[] {
  const activities: LearningActivity[] = [];
  const now = new Date('2026-11-17T12:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Curated activity patterns matching team specializations
  const memberActivityProfiles: Record<string, { courses: string[]; completionsMultiplier: number }> = {
    'amina.mansoor@company.com': {
      courses: ['gcp-genai-gemini-fundamentals', 'gcp-prompt-engineering-agentic', 'gcp-vertex-ai-pipelines', 'gcp-bigquery-ml-lab', 'gcp-bigquery-lakehouse'],
      completionsMultiplier: 2.2,
    },
    'priya.sharma@company.com': {
      courses: ['gcp-bigquery-lakehouse', 'gcp-bigquery-ml-lab', 'gcp-vertex-ai-pipelines', 'gcp-genai-gemini-fundamentals'],
      completionsMultiplier: 1.8,
    },
    'elena.rostova@company.com': {
      courses: ['gcp-pro-architect-cert-prep', 'gcp-gke-foundations', 'gcp-security-iam-kms', 'gcp-cloud-run-microservices'],
      completionsMultiplier: 2.0,
    },
    'kenji.sato@company.com': {
      courses: ['gcp-gke-foundations', 'gcp-terraform-iac', 'gcp-devops-sre-observability', 'gcp-cloud-run-microservices'],
      completionsMultiplier: 1.9,
    },
    'marcus.vance@company.com': {
      courses: ['gcp-security-iam-kms', 'gcp-gke-foundations', 'gcp-terraform-iac'],
      completionsMultiplier: 1.5,
    },
    'lucas.gomez@company.com': {
      courses: ['gcp-cloud-run-microservices', 'gcp-prompt-engineering-agentic', 'gcp-cert-pro-cloud-developer'],
      completionsMultiplier: 1.4,
    },
  };

  let idCounter = 1000;

  for (const member of MOCK_MEMBERS) {
    const profile = memberActivityProfiles[member.email] || {
      courses: MOCK_CATALOG.map((c) => c.content_id),
      completionsMultiplier: 1.0,
    };

    const count = Math.floor((3 + Math.random() * 5) * profile.completionsMultiplier);

    for (let i = 0; i < count; i++) {
      const courseId = profile.courses[i % profile.courses.length];
      const catalogItem = MOCK_CATALOG.find((c) => c.content_id === courseId) || MOCK_CATALOG[0];

      // Stagger activities across past 90 days
      const daysAgo = Math.floor(Math.random() * 85) + 1;
      const startDate = new Date(now - daysAgo * dayMs - Math.random() * 10000000);
      const isCompleted = Math.random() > 0.12; // 88% completion rate
      const isPassed = isCompleted ? (Math.random() > 0.08 ? 'true' : 'false') : 'false';
      const durationMinutes = catalogItem.duration ? Math.round(catalogItem.duration * (0.8 + Math.random() * 0.4)) : 60;
      const completedDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      const maxScore = catalogItem.content_type === 'Lab' || catalogItem.content_type === 'Exam' ? '100.0' : '1.0';
      const givenScore = isPassed === 'true'
        ? (maxScore === '100.0' ? (80 + Math.floor(Math.random() * 21)).toFixed(1) : '1.0')
        : (maxScore === '100.0' ? (30 + Math.floor(Math.random() * 40)).toFixed(1) : '0.0');

      activities.push({
        id: `act-${idCounter++}`,
        Member: member.email,
        Activity: catalogItem.name,
        'Activity Type': catalogItem.content_type,
        Passed: isPassed,
        'Given Score': givenScore,
        'Maximum Score': maxScore,
        'Date started': startDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        'Date completed': isCompleted ? completedDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : '',
        'Content ID': catalogItem.content_id,
        'Learning time (minutes)': isCompleted ? durationMinutes : Math.floor(durationMinutes * 0.3),
        'Content Url': catalogItem.url,
        category: catalogItem.category,
        team_slug: member.team_slug,
        team_name: member.team_name,
        memberName: `${member.first_name} ${member.last_name}`,
      });
    }
  }

  // Sort chronologically desc
  return activities.sort((a, b) => new Date(b['Date started']).getTime() - new Date(a['Date started']).getTime());
}

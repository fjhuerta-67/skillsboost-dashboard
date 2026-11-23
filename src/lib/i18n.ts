const LABEL_MAP: Record<string, string> = {
  // Categories
  'AI & Machine Learning': 'IA y Machine Learning',
  'Data & Analytics': 'Datos y Analítica',
  'Cloud Security & IAM': 'Seguridad en la Nube e IAM',
  'Containers & Kubernetes': 'Contenedores y Kubernetes',
  'DevOps & SRE': 'DevOps y SRE',
  'Cloud Infrastructure': 'Infraestructura en la Nube',
  'General Cloud': 'Nube General',

  // Content & Activity Types
  'Course': 'Curso',
  'course': 'Curso',
  'CourseTemplate': 'Curso',
  'Lab': 'Laboratorio',
  'lab': 'Laboratorio',
  'Hands-on Lab': 'Laboratorio Práctico',
  'Focus': 'Ruta de Enfoque',
  'Path': 'Ruta de Aprendizaje',
  'Quest': 'Misión / Ruta',
  'quest': 'Misión / Ruta',
  'Learning Path': 'Ruta de Aprendizaje',
  'learning_path': 'Ruta de Aprendizaje',
  'Skill Badge': 'Insignia de Habilidad',
  'skill_badge': 'Insignia de Habilidad',
  'Certification': 'Certificación',
  'Exam': 'Examen',
  'Game': 'Juego',

  // Levels
  'introductory': 'Introductorio',
  'Introductory': 'Introductorio',
  'fundamental': 'Fundamental',
  'Fundamental': 'Fundamental',
  'intermediate': 'Intermedio',
  'Intermediate': 'Intermedio',
  'advanced': 'Avanzado',
  'Advanced': 'Avanzado',
  'expert': 'Experto',
  'Expert': 'Experto',
  'unspecified': 'General / Sin Nivel',

  // Member Invite Statuses
  'active': 'Activo',
  'pending': 'Invitación Pendiente',
  'revoked': 'Revocado',

  // Fallback teams
  'Organization Member': 'Miembro de la Organización',
  'Unassigned': 'Sin Asignar',
  'unassigned': 'Sin Asignar',
};

export function translateLabel(value?: string | null): string {
  if (!value) return '';
  return LABEL_MAP[value] || value;
}

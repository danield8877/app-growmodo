/** Stub – les projets collaboratifs ne sont pas activés sur cette installation. */

export interface Project {
  id: string;
  name: string;
  status: 'draft' | 'active';
}

export async function getMyProjects(_userId: string): Promise<Project[]> {
  return [];
}

export async function getProject(_projectId: string): Promise<Project | null> {
  return null;
}

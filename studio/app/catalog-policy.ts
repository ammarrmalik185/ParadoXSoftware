export const COMPANY_PROJECTS_COLLECTION = 'paradoxSoftwareProjects';
export const COMPANY_SETTINGS_COLLECTION = 'paradoxSoftwareSettings';
// Existing Firebase portfolio owner. Keep this list aligned with the rule fragment.
export const EDITOR_UIDS = ['Lyc9SMw7dGPhtkbHMw8QADWgmFc2'];
export function isCatalogEditor(user:{uid:string}|null):boolean {
  return !!user && EDITOR_UIDS.includes(user.uid);
}

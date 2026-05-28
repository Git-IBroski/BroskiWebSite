// Complete list of all Minecraft versions (same as Mods.tsx sidebar)
export const MC_VERSIONS = [
  '26.1.2','26.1.1','26.1',
  '1.21.11','1.21.10','1.21.9','1.21.8','1.21.7','1.21.6','1.21.5','1.21.4','1.21.3','1.21.2','1.21.1','1.21',
  '1.20.6','1.20.5','1.20.4','1.20.3','1.20.2','1.20.1','1.20',
  '1.19.4','1.19.3','1.19.2','1.19.1','1.19',
  '1.18.2','1.18.1','1.18',
  '1.17.1','1.17',
  '1.16.5','1.16.4','1.16.3','1.16.2','1.16.1','1.16',
  '1.15.2','1.15.1','1.15',
  '1.14.4','1.14.3','1.14.2','1.14.1','1.14',
  '1.13.2','1.13.1','1.13',
  '1.12.2','1.12.1','1.12',
  '1.11.2','1.11.1','1.11',
  '1.10.2','1.10.1','1.10',
  '1.9.4','1.9.3','1.9.2','1.9.1','1.9',
  '1.8.9','1.8.8','1.8.7','1.8.6','1.8.5','1.8.4','1.8.3','1.8.2','1.8.1','1.8',
  '1.7.10','1.7.9','1.7.8','1.7.7','1.7.6','1.7.5','1.7.4','1.7.3','1.7.2',
  '1.6.4','1.6.2','1.6.1',
  '1.5.2','1.5.1',
  '1.4.7','1.4.6','1.4.5','1.4.4','1.4.2',
  '1.3.2','1.3.1',
  '1.2.5','1.2.4','1.2.3','1.2.2','1.2.1',
  '1.1','1.0',
];

/**
 * Groups MC versions by major.minor prefix.
 * e.g. { '1.21': ['1.21', '1.21.1', ..., '1.21.11'], '1.20': [...] }
 */
export function groupMcVersions(): { prefix: string; versions: string[] }[] {
  const groups: Record<string, string[]> = {};
  for (const v of MC_VERSIONS) {
    const parts = v.split('.');
    const prefix = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : v;
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(v);
  }
  return Object.entries(groups).map(([prefix, versions]) => ({ prefix, versions }));
}

/**
 * Given a list of selected versions, returns a compact display string.
 * If ALL versions of a major.minor group are selected, shows "1.21.x" instead of listing them all.
 */
export function formatVersionsCompact(selected: string[]): string[] {
  if (!selected || selected.length === 0) return [];
  const groups = groupMcVersions();
  const result: string[] = [];

  for (const group of groups) {
    const selectedInGroup = group.versions.filter(v => selected.includes(v));
    if (selectedInGroup.length === 0) continue;
    if (selectedInGroup.length === group.versions.length && group.versions.length > 1) {
      // All versions in this group are selected → show "1.21.x"
      result.push(`${group.prefix}.x`);
    } else {
      // Only some versions selected → show them individually
      result.push(...selectedInGroup);
    }
  }
  return result;
}

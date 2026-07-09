export function isSmpHost(hostname: string): boolean {
  return hostname.startsWith('smp.')
}

export function isDiscordHost(hostname: string): boolean {
  return hostname.startsWith('discord.')
}

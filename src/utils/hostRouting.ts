export function isSmpHost(hostname: string): boolean {
  return hostname.startsWith('smp.')
}

export function isDiscordHost(hostname: string): boolean {
  return hostname.startsWith('discord.')
}

export function isVerifyHost(hostname: string): boolean {
  return hostname.startsWith('verify.')
}

export function isCollabHost(hostname: string): boolean {
  return hostname.startsWith('collabs.')
}

export function isBotHost(hostname: string): boolean {
  return hostname.startsWith('bot.')
}

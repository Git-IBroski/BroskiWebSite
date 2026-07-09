import { describe, expect, it } from 'vitest'
import { isDiscordHost, isSmpHost } from './hostRouting'

describe('host routing helpers', () => {
  it('detects the Discord subdomain', () => {
    expect(isDiscordHost('discord.ibroski.net')).toBe(true)
    expect(isDiscordHost('discord.example.com')).toBe(true)
    expect(isDiscordHost('www.ibroski.net')).toBe(false)
  })

  it('detects the SMP subdomain', () => {
    expect(isSmpHost('smp.ibroski.net')).toBe(true)
    expect(isSmpHost('smp.example.com')).toBe(true)
    expect(isSmpHost('www.ibroski.net')).toBe(false)
  })
})

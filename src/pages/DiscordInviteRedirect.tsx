import { useEffect } from 'react'
import { LINKS_CONFIG } from '../config/linksConfig'

export default function DiscordInviteRedirect() {
  useEffect(() => {
    window.location.replace(LINKS_CONFIG.discord)
  }, [])

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-tertiary">Discord</p>
        <h1 className="text-3xl font-semibold text-white">Reindirizzamento al server</h1>
        <p className="text-sm text-on-surface-variant">
          Stai per essere portato all’invito Discord. Se non vieni reindirizzato automaticamente, clicca il pulsante qui sotto.
        </p>
        <a
          href={LINKS_CONFIG.discord}
          className="inline-flex items-center justify-center rounded-full bg-tertiary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Entra nel Discord
        </a>
      </div>
    </main>
  )
}

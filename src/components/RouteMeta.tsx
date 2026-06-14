import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const routeMeta: Record<string, { title: string; description: string; url: string; image: string }> = {
  '/': {
    title: 'Broski Community',
    description: 'La community Minecraft più caotica d’Italia.',
    url: 'https://www.ibroski.net',
    image: 'https://www.ibroski.net/og-cover.png',
  },
  '/tierlist': {
    title: 'Broski Tierlist',
    description: 'Classifica PvP e SMP della Broski Community.',
    url: 'https://www.ibroski.net/tierlist',
    image: 'https://www.ibroski.net/og-cover.png',
  },
  '/mods': {
    title: 'Our Mods',
    description: 'The mods that we use in our videos!',
    url: 'https://www.ibroski.net/mods',
    image: 'https://www.ibroski.net/og-cover.png'
  },
  '/wiki': {
    title: 'Our Wiki',
    description: 'Here you can find every information you want about us!',
    url: 'https://www.ibroski.net/wiki',
    image: 'https://www.ibroski.net/og-cover.png'
  },
  '/progetti': {
    title: 'Broski Projects',
    description: 'I nostri progetti (in fase di sviluppo). Se vuoi qui puoi suggerire le tue idee!!',
    url: 'https://www.ibroski.net/progetti',
    image: 'https://www.ibroski.net/og-cover.png'
  }
}

const setMeta = (attr: 'name' | 'property', key: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

export function RouteMeta() {
  const location = useLocation()

  useEffect(() => {
    const meta = routeMeta[location.pathname] ?? routeMeta['/']
    document.title = meta.title
    setMeta('name', 'description', meta.description)
    setMeta('property', 'og:title', meta.title)
    setMeta('property', 'og:description', meta.description)
    setMeta('property', 'og:url', meta.url)
    setMeta('property', 'og:image', meta.image)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', meta.title)
    setMeta('name', 'twitter:description', meta.description)
    setMeta('name', 'twitter:image', meta.image)
  }, [location.pathname])

  return null
}
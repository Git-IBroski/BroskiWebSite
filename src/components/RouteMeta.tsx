import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

type MetaContent = { title: string; description: string; url: string; image: string }
type Language = 'it' | 'en'

const routeMeta: Record<string, Record<Language, MetaContent>> = {
  '/': {
    it: {
      title: 'Broski Community — iBroski',
      description: 'La community italiana di Minecraft fatta dai creator. PvP, SMP, eventi e molto altro.',
      url: 'https://www.ibroski.net',
      image: 'https://www.ibroski.net/og-cover.png',
    },
    en: {
      title: 'Broski Community — iBroski',
      description: 'The Italian Minecraft community built by creators. PvP, SMPs, events and much more.',
      url: 'https://www.ibroski.net',
      image: 'https://www.ibroski.net/og-cover.png',
    },
  },
  '/tierlist': {
    it: {
      title: 'Broski Tierlist',
      description: 'La classifica PvP e SMP della Broski Community.',
      url: 'https://www.ibroski.net/tierlist',
      image: 'https://www.ibroski.net/og-cover.png',
    },
    en: {
      title: 'Broski Tierlist',
      description: 'The PvP and SMP ranking of the Broski Community.',
      url: 'https://www.ibroski.net/tierlist',
      image: 'https://www.ibroski.net/og-cover.png',
    },
  },
  '/mods': {
    it: {
      title: 'Broski Mods',
      description: 'Le mod e i plugin che usiamo nei nostri video.',
      url: 'https://www.ibroski.net/mods',
      image: 'https://www.ibroski.net/og-cover.png',
    },
    en: {
      title: 'Broski Mods',
      description: 'The mods and plugins we use in our videos.',
      url: 'https://www.ibroski.net/mods',
      image: 'https://www.ibroski.net/og-cover.png',
    },
  },
  '/wiki': {
    it: {
      title: 'Broski Wiki',
      description: 'Tutto quello che c’è da sapere sulla Broski Community.',
      url: 'https://www.ibroski.net/wiki',
      image: 'https://www.ibroski.net/og-cover.png',
    },
    en: {
      title: 'Broski Wiki',
      description: 'Everything you need to know about the Broski Community.',
      url: 'https://www.ibroski.net/wiki',
      image: 'https://www.ibroski.net/og-cover.png',
    },
  },
  '/progetti': {
    it: {
      title: 'Broski Projects',
      description: 'I nostri progetti in sviluppo. Hai un’idea? Proponila pure.',
      url: 'https://www.ibroski.net/progetti',
      image: 'https://www.ibroski.net/og-cover.png',
    },
    en: {
      title: 'Broski Projects',
      description: 'Our projects in development. Got an idea? Feel free to pitch it.',
      url: 'https://www.ibroski.net/progetti',
      image: 'https://www.ibroski.net/og-cover.png',
    },
  },
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
  const { language } = useLanguage()

  useEffect(() => {
    const entry = routeMeta[location.pathname] ?? routeMeta['/']
    const meta = entry[language] ?? entry.it
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
  }, [location.pathname, language])

  return null
}

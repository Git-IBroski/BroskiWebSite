import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: string;
  [key: string]: unknown;
}

interface TranslatedNews extends NewsItem {
  originalTitle: string;
  originalContent: string;
  isTranslated: boolean;
}

// Cache per le traduzioni (evita di chiamare l'API ogni volta)
const translationCache: Record<string, Record<string, { title: string; content: string }>> = {
  it: {},
  en: {}
};

// LibraTranslate API - servizio gratuito di traduzione
const translateText = async (text: string, targetLang: 'it' | 'en', sourceLang: 'it' | 'en'): Promise<string> => {
  if (sourceLang === targetLang) return text;
  
  const cacheKey = `${sourceLang}-${targetLang}-${text}`;
  
  // Controlla cache
  if (translationCache[targetLang][cacheKey]) {
    return translationCache[targetLang][cacheKey].title || text;
  }

  try {
    // Usa LibreTranslate API (gratuita, open source)
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      // Fallback: se l'API fallisce, ritorna il testo originale
      console.warn('Translation API failed, returning original text');
      return text;
    }

    const data = await response.json();
    const translatedText = data.translatedText || text;
    
    // Salva in cache
    translationCache[targetLang][cacheKey] = { title: translatedText, content: translatedText };
    
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback al testo originale
  }
};

export const useTranslatedNews = (news: NewsItem[]): TranslatedNews[] => {
  const { language } = useLanguage();
  const [translatedNews, setTranslatedNews] = useState<TranslatedNews[]>([]);

  const translateNews = useCallback(async () => {
    if (!news.length) {
      setTranslatedNews([]);
      return;
    }

    // Se la lingua è italiana, mostra il testo originale
    if (language === 'it') {
      setTranslatedNews(news.map(item => ({
        ...item,
        originalTitle: item.title,
        originalContent: item.content,
        isTranslated: false
      })));
      return;
    }

    try {
      const translated = await Promise.all(
        news.map(async (item) => {
          // Controlla se abbiamo già la traduzione in cache
          const cacheKey = `${item.id}`;
          
          if (translationCache.en[cacheKey]) {
            return {
              ...item,
              title: translationCache.en[cacheKey].title,
              content: translationCache.en[cacheKey].content,
              originalTitle: item.title,
              originalContent: item.content,
              isTranslated: true
            };
          }

          // Traduci titolo e contenuto
          const [translatedTitle, translatedContent] = await Promise.all([
            translateText(item.title, 'en', 'it'),
            translateText(item.content, 'en', 'it')
          ]);

          // Salva in cache
          translationCache.en[cacheKey] = {
            title: translatedTitle,
            content: translatedContent
          };

          return {
            ...item,
            title: translatedTitle,
            content: translatedContent,
            originalTitle: item.title,
            originalContent: item.content,
            isTranslated: true
          };
        })
      );

      setTranslatedNews(translated);
    } catch (error) {
      console.error('Error translating news:', error);
      // In caso di errore, mostra il testo originale
      setTranslatedNews(news.map(item => ({
        ...item,
        originalTitle: item.title,
        originalContent: item.content,
        isTranslated: false
      })));
    }
  }, [news, language]);

  useEffect(() => {
    translateNews();
  }, [translateNews]);

  return translatedNews;
};

export default useTranslatedNews;

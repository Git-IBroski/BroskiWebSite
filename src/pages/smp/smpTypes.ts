// Shared types for the BroskiSMP feature (info page + application flow).

export type Lang = 'it' | 'en';

export type SmpQuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'multiple_choice'
  | 'checkbox'
  | 'boolean'
  | 'url';

// Base columns hold Italian; *_en columns hold English (fall back to base when empty).
// Mirrors the `news` table convention used elsewhere on the site.
export interface SmpInfo {
  id: string;
  hero_title: string;
  hero_title_en: string | null;
  hero_subtitle: string;
  hero_subtitle_en: string | null;
  about: string;
  about_en: string | null;
  rules: string | null;
  rules_en: string | null;
  discord_url: string | null;
  applications_open: boolean;
  updated_at: string | null;
}

export interface SmpPlugin {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  icon: string | null;
  sort_order: number;
  created_at?: string | null;
}

export interface SmpQuestion {
  id: string;
  label: string;
  label_en: string | null;
  helper: string | null;
  helper_en: string | null;
  type: SmpQuestionType;
  options: string[];
  options_en: string[] | null;
  // Required URL prefix for 'url' questions (e.g. https://www.youtube.com/@). Language-independent.
  url_prefix: string | null;
  required: boolean;
  sort_order: number;
  active: boolean;
  created_at?: string | null;
}

// Snapshot of an answer stored on the application, so it survives later edits to the question.
export interface SmpAnswer {
  question_id: string;
  label: string;
  type: SmpQuestionType;
  value: string | string[] | number | boolean | null;
}

export interface SmpApplication {
  id: string;
  applicant_id: string;
  applicant_name: string | null;
  answers: SmpAnswer[];
  status: 'pending' | 'accepted' | 'rejected';
  admin_note: string | null;
  created_at: string;
}

// Pick the localized value for a base/_en column pair, falling back to the base (Italian).
export function pick(lang: Lang, base: string | null | undefined, en: string | null | undefined): string {
  if (lang === 'en') return (en && en.trim()) || base || '';
  return base || '';
}

// Localized option list for a question (falls back to base options).
export function pickOptions(lang: Lang, q: Pick<SmpQuestion, 'options' | 'options_en'>): string[] {
  if (lang === 'en' && q.options_en && q.options_en.length) return q.options_en;
  return q.options || [];
}

export const SMP_QUESTION_TYPES: { value: SmpQuestionType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'URL / Link' },
  { value: 'multiple_choice', label: 'Multiple choice (pick one)' },
  { value: 'checkbox', label: 'Checkboxes (pick many)' },
  { value: 'boolean', label: 'Yes / No' },
];

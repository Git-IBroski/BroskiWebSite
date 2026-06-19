import React from 'react';
import PageAnimator from '../components/PageAnimator';
import TransitionLink from '../components/TransitionLink';
import { useLanguage } from '../context/LanguageContext';

const PrivacyPolicy: React.FC = () => {
  const { t } = useLanguage();
  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-surface-container-lowest" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px)', backgroundSize: '28px 28px' }} />
      <div className="pointer-events-none absolute -right-32 top-20 h-72 w-72 rounded-full bg-tertiary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-40 h-80 w-80 rounded-full bg-primary-container/15 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="inline-flex -rotate-2 items-center gap-2 self-start rounded-2xl border-[3px] border-black bg-tertiary px-4 py-2 font-label-caps text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[18px]">shield</span>
            {t('pp.header.badge')}
          </div>
          <h1 className="font-headline-lg text-[48px] uppercase leading-none tracking-tighter text-white drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] sm:text-[64px]">
            {t('pp.header.title.part1')}<span className="block text-tertiary">{t('pp.header.title.part2')}</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant">{t('pp.header.updated')}</p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6">
          <Section title={t('pp.section.intro.title')}>
            {t('pp.section.intro.body')}
          </Section>

          <Section title={t('pp.section.collected.title')}>
            {t('pp.section.collected.body')}
          </Section>

          <Section title={t('pp.section.legal_basis.title')}>
            {t('pp.section.legal_basis.body')}
          </Section>

          <Section title={t('pp.section.purpose.title')}>
            {t('pp.section.purpose.body')}
          </Section>

          <Section title={t('pp.section.sharing.title')}>
            {t('pp.section.sharing.body')}
          </Section>

          <Section title={t('pp.section.retention.title')}>
            {t('pp.section.retention.body')}
          </Section>

          <Section title={t('pp.section.rights.title')}>
            {t('pp.section.rights.body')}
          </Section>

          <Section title={t('pp.section.cookies.title')}>
            {t('pp.section.cookies.body')}
          </Section>

          <Section title={t('pp.section.security.title')}>
            {t('pp.section.security.body')}
          </Section>

          <Section title={t('pp.section.minors.title')}>
            {t('pp.section.minors.body')}
          </Section>

          <Section title={t('pp.section.transfer.title')}>
            {t('pp.section.transfer.body')}
          </Section>

          <Section title={t('pp.section.changes.title')}>
            {t('pp.section.changes.body')}
          </Section>

          <Section title={t('pp.section.contact.title')}>
            {t('pp.section.contact.body')}
          </Section>
        </div>

        {/* Back link */}
        <div className="mt-10">
          <TransitionLink
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-surface-container-high px-6 py-3 font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            {t('common.gohome')}
          </TransitionLink>
        </div>
      </div>
    </PageAnimator>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
    <h2 className="mb-3 font-headline-md text-[22px] text-tertiary">{title}</h2>
    <p className="whitespace-pre-line font-body-sm text-on-surface-variant leading-relaxed">{children}</p>
  </div>
);

export default PrivacyPolicy;

import React from 'react';
import PageAnimator from '../components/PageAnimator';
import TransitionLink from '../components/TransitionLink';

const TermsOfUse: React.FC = () => {
  return (
    <PageAnimator className="relative w-full overflow-hidden px-4 pb-14 pt-8 sm:px-margin">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-surface-container-lowest" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px)', backgroundSize: '28px 28px' }} />
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary-container/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-40 h-80 w-80 rounded-full bg-secondary-container/15 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[900px]">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="inline-flex -rotate-2 items-center gap-2 self-start rounded-2xl border-[3px] border-black bg-primary-container px-4 py-2 font-label-caps text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            LEGAL
          </div>
          <h1 className="font-headline-lg text-[48px] uppercase leading-none tracking-tighter text-white drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] sm:text-[64px]">
            TERMINI DI<span className="block text-primary-container">SERVIZIO</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant">Ultimo aggiornamento: 25 Maggio 2026</p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6">
          <Section title="1. Accettazione dei Termini">
            Accedendo e utilizzando il sito web della Broski Community (di seguito "il Sito"), accetti di essere vincolato dai presenti Termini di Servizio. Se non accetti questi termini, ti preghiamo di non utilizzare il Sito.
          </Section>

          <Section title="2. Descrizione del Servizio">
            Il Sito è una piattaforma comunitaria dedicata ai giocatori di Minecraft. Offre informazioni sulla community, classifiche PvP (Tier List), news, contenuti dei creator e accesso a risorse correlate. Il Sito non è un prodotto ufficiale Minecraft/Mojang.
          </Section>

          <Section title="3. Account Utente">
            Per accedere ad alcune funzionalità del Sito potrebbe essere necessario creare un account. Sei responsabile di mantenere la riservatezza delle tue credenziali e di tutte le attività che avvengono sotto il tuo account. Devi fornire informazioni accurate e aggiornate durante la registrazione.
          </Section>

          <Section title="4. Comportamento dell'Utente">
            Utilizzando il Sito, ti impegni a:
            {'\n'}• Non pubblicare contenuti offensivi, diffamatori o illegali
            {'\n'}• Non tentare di accedere a sezioni non autorizzate del Sito
            {'\n'}• Non utilizzare bot, scraper o strumenti automatizzati senza autorizzazione
            {'\n'}• Rispettare gli altri membri della community
            {'\n'}• Non impersonare altri utenti o membri dello staff
          </Section>

          <Section title="5. Proprietà Intellettuale">
            Tutti i contenuti presenti sul Sito (testi, grafica, loghi, design) sono di proprietà della Broski Community o dei rispettivi autori. Non è consentita la riproduzione, distribuzione o modifica dei contenuti senza autorizzazione scritta. Minecraft è un marchio registrato di Mojang Studios/Microsoft.
          </Section>

          <Section title="6. Tier List e Classifiche">
            Le classifiche e i rank assegnati nella Tier List sono determinati dallo staff della community sulla base di criteri interni. Le decisioni dello staff sono definitive. Non garantiamo l'accuratezza assoluta delle classifiche e ci riserviamo il diritto di modificarle in qualsiasi momento.
          </Section>

          <Section title="7. Contenuti di Terze Parti">
            Il Sito può contenere link a siti web di terze parti (Discord, YouTube, Twitch, ecc.). Non siamo responsabili per i contenuti, le politiche sulla privacy o le pratiche di tali siti. L'accesso a siti di terze parti avviene a tuo rischio.
          </Section>

          <Section title="8. Limitazione di Responsabilità">
            Il Sito è fornito "così com'è" senza garanzie di alcun tipo. La Broski Community non sarà responsabile per danni diretti, indiretti, incidentali o consequenziali derivanti dall'uso o dall'impossibilità di utilizzare il Sito.
          </Section>

          <Section title="9. Modifiche ai Termini">
            Ci riserviamo il diritto di modificare questi Termini di Servizio in qualsiasi momento. Le modifiche saranno effettive dal momento della pubblicazione sul Sito. L'uso continuato del Sito dopo le modifiche costituisce accettazione dei nuovi termini.
          </Section>

          <Section title="10. Terminazione">
            Ci riserviamo il diritto di sospendere o terminare l'accesso al Sito a qualsiasi utente che violi questi Termini di Servizio, senza preavviso e a nostra esclusiva discrezione.
          </Section>

          <Section title="11. Legge Applicabile">
            Questi Termini di Servizio sono regolati dalla legge italiana. Qualsiasi controversia sarà sottoposta alla giurisdizione esclusiva del tribunale competente in Italia.
          </Section>

          <Section title="12. Contatti">
            Per domande relative a questi Termini di Servizio, puoi contattarci tramite il nostro server Discord o la pagina Contatti del Sito.
          </Section>
        </div>

        {/* Back link */}
        <div className="mt-10">
          <TransitionLink
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border-[3px] border-black bg-surface-container-high px-6 py-3 font-headline-md text-[16px] text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            TORNA ALLA HOME
          </TransitionLink>
        </div>
      </div>
    </PageAnimator>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
    <h2 className="mb-3 font-headline-md text-[22px] text-primary-container">{title}</h2>
    <p className="whitespace-pre-line font-body-sm text-on-surface-variant leading-relaxed">{children}</p>
  </div>
);

export default TermsOfUse;

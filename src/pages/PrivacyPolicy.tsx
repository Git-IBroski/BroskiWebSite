import React from 'react';
import PageAnimator from '../components/PageAnimator';
import TransitionLink from '../components/TransitionLink';

const PrivacyPolicy: React.FC = () => {
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
            LEGAL
          </div>
          <h1 className="font-headline-lg text-[48px] uppercase leading-none tracking-tighter text-white drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] sm:text-[64px]">
            PRIVACY<span className="block text-tertiary">POLICY</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant">Ultimo aggiornamento: 25 Maggio 2026</p>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6">
          <Section title="1. Introduzione">
            La Broski Community (di seguito "noi", "nostro") rispetta la tua privacy e si impegna a proteggere i tuoi dati personali. Questa Privacy Policy spiega come raccogliamo, utilizziamo e proteggiamo le informazioni quando utilizzi il nostro sito web.
          </Section>

          <Section title="2. Dati Raccolti">
            Raccogliamo i seguenti tipi di dati:
            {'\n'}• Dati di registrazione: username Minecraft, email, password (criptata)
            {'\n'}• Dati di profilo: username Geometry Dash (opzionale), regione
            {'\n'}• Dati di navigazione: pagine visitate, timestamp di accesso
            {'\n'}• Dati tecnici: tipo di browser, sistema operativo, indirizzo IP (anonimizzato)
            {'\n\n'}Non raccogliamo dati sensibili come informazioni finanziarie, dati sanitari o orientamento politico/religioso.
          </Section>

          <Section title="3. Base Giuridica del Trattamento">
            Trattiamo i tuoi dati sulla base di:
            {'\n'}• Consenso: fornito al momento della registrazione
            {'\n'}• Esecuzione contrattuale: necessario per fornirti il servizio
            {'\n'}• Interesse legittimo: per migliorare il Sito e prevenire abusi
          </Section>

          <Section title="4. Finalità del Trattamento">
            Utilizziamo i tuoi dati per:
            {'\n'}• Gestire il tuo account e fornirti accesso alle funzionalità del Sito
            {'\n'}• Mantenere le classifiche della Tier List
            {'\n'}• Comunicare aggiornamenti sulla community
            {'\n'}• Migliorare l'esperienza utente e le prestazioni del Sito
            {'\n'}• Prevenire frodi e garantire la sicurezza
          </Section>

          <Section title="5. Condivisione dei Dati">
            Non vendiamo i tuoi dati personali a terze parti. Potremmo condividere dati con:
            {'\n'}• Supabase: il nostro provider di database e autenticazione (server EU)
            {'\n'}• Vercel/Hosting provider: per l'hosting del Sito
            {'\n\n'}Tutti i nostri fornitori sono conformi al GDPR e trattano i dati esclusivamente per nostro conto.
          </Section>

          <Section title="6. Conservazione dei Dati">
            Conserviamo i tuoi dati personali per il tempo necessario a fornirti il servizio. In caso di cancellazione dell'account, i tuoi dati saranno eliminati entro 30 giorni, ad eccezione dei dati che siamo obbligati a conservare per legge.
          </Section>

          <Section title="7. I Tuoi Diritti (GDPR)">
            In conformità al Regolamento Europeo sulla Protezione dei Dati (GDPR), hai diritto a:
            {'\n'}• Accesso: richiedere una copia dei tuoi dati personali
            {'\n'}• Rettifica: correggere dati inesatti o incompleti
            {'\n'}• Cancellazione: richiedere l'eliminazione dei tuoi dati ("diritto all'oblio")
            {'\n'}• Limitazione: limitare il trattamento dei tuoi dati
            {'\n'}• Portabilità: ricevere i tuoi dati in formato strutturato
            {'\n'}• Opposizione: opporti al trattamento dei tuoi dati
            {'\n\n'}Per esercitare questi diritti, contattaci tramite Discord o la pagina Contatti.
          </Section>

          <Section title="8. Cookie e Tecnologie di Tracciamento">
            Il Sito utilizza esclusivamente cookie tecnici necessari al funzionamento (autenticazione, preferenze lingua). Non utilizziamo cookie di profilazione o di marketing di terze parti. Non è richiesto un banner cookie in quanto utilizziamo solo cookie strettamente necessari.
          </Section>

          <Section title="9. Sicurezza">
            Adottiamo misure tecniche e organizzative appropriate per proteggere i tuoi dati, tra cui:
            {'\n'}• Crittografia delle password (hashing)
            {'\n'}• Connessioni HTTPS
            {'\n'}• Row Level Security (RLS) sul database
            {'\n'}• Accesso limitato ai dati da parte dello staff
          </Section>

          <Section title="10. Minori">
            Il Sito non è destinato a minori di 13 anni. Non raccogliamo consapevolmente dati di minori di 13 anni. Se sei un genitore e ritieni che tuo figlio ci abbia fornito dati personali, contattaci per la rimozione.
          </Section>

          <Section title="11. Trasferimenti Internazionali">
            I tuoi dati sono conservati su server situati nell'Unione Europea (Supabase EU-West). Non trasferiamo dati al di fuori dello Spazio Economico Europeo senza adeguate garanzie.
          </Section>

          <Section title="12. Modifiche alla Privacy Policy">
            Ci riserviamo il diritto di aggiornare questa Privacy Policy. Le modifiche saranno pubblicate su questa pagina con la data di aggiornamento. Ti consigliamo di consultare periodicamente questa pagina.
          </Section>

          <Section title="13. Contatti">
            Per qualsiasi domanda relativa alla privacy o per esercitare i tuoi diritti, puoi contattarci:
            {'\n'}• Tramite il server Discord della Broski Community
            {'\n'}• Tramite la pagina Contatti del Sito
            {'\n'}• Via email all'indirizzo indicato nella pagina Contatti
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
    <h2 className="mb-3 font-headline-md text-[22px] text-tertiary">{title}</h2>
    <p className="whitespace-pre-line font-body-sm text-on-surface-variant leading-relaxed">{children}</p>
  </div>
);

export default PrivacyPolicy;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import BotStatus from './BotStatus';
import TicketManager from './TicketManager';
import EmbedManager from './EmbedManager';

type Tab = 'status' | 'tickets' | 'embeds';

const BotDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('status');

  return (
    <div className="min-h-[calc(100vh-76px)] w-full px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline-lg text-[48px] uppercase leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              🤖 BOT DASHBOARD
            </h1>
            <p className="mt-2 font-body-sm text-on-surface-variant">
              Gestisci il BroskiBOT • Loggato come{' '}
              <span className="font-bold text-primary-container">{profile?.minecraft_username}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['status', 'tickets', 'embeds'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl border-[3px] border-black px-6 py-3 font-headline-md text-[16px] shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all ${
                activeTab === tab
                  ? 'bg-primary-container text-white'
                  : 'bg-surface-container text-on-surface hover:-translate-y-1'
              }`}
            >
              <span className="material-symbols-outlined mr-2 inline-block">
                {tab === 'status' ? 'monitoring' : tab === 'tickets' ? 'confirmation_number' : 'palette'}
              </span>
              {tab === 'status' ? 'STATUS' : tab === 'tickets' ? 'TICKET' : 'EMBED'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
          {activeTab === 'status' && <BotStatus />}
          {activeTab === 'tickets' && <TicketManager />}
          {activeTab === 'embeds' && <EmbedManager />}
        </div>
      </div>
    </div>
  );
};

export default BotDashboard;

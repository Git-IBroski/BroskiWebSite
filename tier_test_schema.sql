-- Crea i tipi Enum
CREATE TYPE public.region AS ENUM ('NA', 'EU', 'AS', 'SA', 'GLOBAL');
CREATE TYPE public.category AS ENUM ('CRYSTAL', 'SWORD', 'AXE', 'POT', 'UHC', 'SMP');
CREATE TYPE public.tier AS ENUM ('HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5', 'UNRANKED');

-- Crea la tabella players
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ign TEXT UNIQUE NOT NULL,
    discord_id TEXT,
    region public.region NOT NULL
);

-- Crea la tabella player_ranks
CREATE TABLE public.player_ranks (
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    category public.category NOT NULL,
    tier public.tier NOT NULL,
    UNIQUE (player_id, category)
);

-- Crea la tabella test_logs
CREATE TABLE public.test_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tester_id UUID NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    category public.category NOT NULL,
    old_tier public.tier,
    new_tier public.tier NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Abilita RLS (Best practice Supabase)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_logs ENABLE ROW LEVEL SECURITY;

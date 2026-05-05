/**
 * UFC Card Service — fetches upcoming UFC events from ESPN's public scoreboard API.
 *
 * Endpoint: https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard
 *
 * Strategy:
 *   - Pull the scoreboard (returns upcoming + recent events).
 *   - Pick the next event whose date is today or in the future. After Saturday's
 *     event finishes, the API drops it and the next week's card automatically
 *     becomes the "next" event — so rotation is free.
 *   - Normalize ESPN's nested structure into our flat UpcomingEvent shape.
 *
 * Caching: light in-memory cache (5 min) so navigation across pages doesn't
 * thrash the API.
 */

import type { UpcomingEvent, UpcomingFight, UpcomingFighter } from '@/types/ufcCard';

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { data: UpcomingEvent | null; fetchedAt: number } | null = null;

interface EspnAthlete {
  id?: string | number;
  displayName?: string;
  shortName?: string;
  headshot?: { href?: string } | string;
  flag?: { href?: string };
}

interface EspnCompetitor {
  id?: string;
  athlete?: EspnAthlete;
  records?: Array<{ summary?: string }>;
  winner?: boolean;
  order?: number;
}

interface EspnCompetition {
  id?: string;
  date?: string;
  type?: { abbreviation?: string; text?: string };
  notes?: Array<{ type?: string; headline?: string }>;
  competitors?: EspnCompetitor[];
  status?: { type?: { completed?: boolean; state?: string } };
  format?: { regulation?: { periods?: number } };
}

interface EspnEvent {
  id?: string;
  name?: string;
  shortName?: string;
  date?: string;
  competitions?: EspnCompetition[];
  status?: { type?: { completed?: boolean; state?: string } };
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

function extractPhoto(athlete: EspnAthlete | undefined): string | undefined {
  if (!athlete?.headshot) return undefined;
  if (typeof athlete.headshot === 'string') return athlete.headshot;
  return athlete.headshot.href;
}

function buildFighter(c: EspnCompetitor | undefined): UpcomingFighter {
  const a = c?.athlete;
  return {
    id: String(c?.id ?? a?.id ?? ''),
    name: a?.displayName ?? a?.shortName ?? 'TBD',
    photo: extractPhoto(a),
    record: c?.records?.[0]?.summary,
  };
}

function extractWeightClass(comp: EspnCompetition): string | undefined {
  const headline = comp.notes?.find((n) => n.headline)?.headline;
  if (headline) return headline;
  return comp.type?.text;
}

function isTitleFight(comp: EspnCompetition): boolean {
  const headline = comp.notes?.find((n) => n.headline)?.headline?.toLowerCase() ?? '';
  return headline.includes('title') || headline.includes('championship');
}

function normalizeEvent(ev: EspnEvent): UpcomingEvent | null {
  if (!ev?.id || !ev?.competitions?.length) return null;

  const fights: UpcomingFight[] = ev.competitions
    .map((comp, idx): UpcomingFight | null => {
      const competitors = comp.competitors ?? [];
      if (competitors.length < 2) return null;

      const sorted = [...competitors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const total = ev.competitions?.length ?? 1;

      return {
        fightId: String(comp.id ?? `${ev.id}-${idx}`),
        cardPosition: total - idx,
        weightClass: extractWeightClass(comp),
        scheduledTime: comp.date,
        isMainEvent: idx === 0,
        isTitleFight: isTitleFight(comp),
        fighterA: buildFighter(sorted[0]),
        fighterB: buildFighter(sorted[1]),
      };
    })
    .filter((f): f is UpcomingFight => f !== null);

  if (fights.length === 0) return null;

  return {
    eventId: String(ev.id),
    name: ev.name ?? ev.shortName ?? 'UFC Event',
    shortName: ev.shortName,
    date: ev.date ?? '',
    fights,
  };
}

/**
 * Returns the next upcoming UFC event (today or future). Returns null when no
 * upcoming event is found. Network errors throw.
 */
export async function getUpcomingUfcCard(opts: { force?: boolean } = {}): Promise<UpcomingEvent | null> {
  if (!opts.force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const res = await fetch(ESPN_SCOREBOARD, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  const json = (await res.json()) as EspnScoreboard;

  const events = json.events ?? [];
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const upcoming = events
    .map(normalizeEvent)
    .filter((e): e is UpcomingEvent => e !== null)
    .filter((e) => {
      if (!e.date) return false;
      const eventTime = new Date(e.date).getTime();
      // Keep events from today onward; past events filtered out automatically
      // because ESPN drops them after the Sunday rollover.
      return eventTime >= startOfToday.getTime() || eventTime >= now - 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const next = upcoming[0] ?? null;
  cache = { data: next, fetchedAt: Date.now() };
  return next;
}

export function clearUfcCardCache() {
  cache = null;
}

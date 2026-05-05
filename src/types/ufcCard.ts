/**
 * Types for the upcoming UFC card fetched from ESPN's public MMA scoreboard.
 * Source: https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard
 */

export interface UpcomingFighter {
  id: string;
  name: string;
  photo?: string;
  record?: string;
}

export interface UpcomingFight {
  fightId: string;
  cardPosition: number;
  weightClass?: string;
  scheduledTime?: string;
  isMainEvent?: boolean;
  isTitleFight?: boolean;
  fighterA: UpcomingFighter;
  fighterB: UpcomingFighter;
}

export interface UpcomingEvent {
  eventId: string;
  name: string;
  shortName?: string;
  date: string;
  venue?: string;
  fights: UpcomingFight[];
}

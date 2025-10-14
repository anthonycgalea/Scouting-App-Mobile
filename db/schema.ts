import { integer, primaryKey, sqliteTable, text, foreignKey } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const teamRecords = sqliteTable('teamrecord', {
  teamNumber: integer('team_number').primaryKey(),
  teamName: text('team_name').notNull(),
  location: text('location'),
});

export type TeamRecord = InferSelectModel<typeof teamRecords>;
export type NewTeamRecord = InferInsertModel<typeof teamRecords>;

export const loggedInEvents = sqliteTable('logged_in_event', {
  id: integer('id').primaryKey(),
  event: text('event'),
});

export type LoggedInEvent = InferSelectModel<typeof loggedInEvents>;
export type NewLoggedInEvent = InferInsertModel<typeof loggedInEvents>;

export const frcEvents = sqliteTable('frcevent', {
  eventKey: text('event_key').primaryKey(),
  eventName: text('event_name').notNull(),
  shortName: text('short_name'),
  year: integer('year').notNull(),
  week: integer('week').notNull(),
});

export type FRCEvent = InferSelectModel<typeof frcEvents>;
export type NewFRCEvent = InferInsertModel<typeof frcEvents>;

export const seasons = sqliteTable('season', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  year: integer('year').notNull(),
  name: text('name').notNull(),
});

export type Season = InferSelectModel<typeof seasons>;
export type NewSeason = InferInsertModel<typeof seasons>;

export const matchSchedules = sqliteTable(
  'matchschedule',
  {
    eventKey: text('event_key').notNull(),
    matchNumber: integer('match_number').notNull(),
    matchLevel: text('match_level').notNull(),
    red1Id: integer('red1_id').notNull(),
    red2Id: integer('red2_id').notNull(),
    red3Id: integer('red3_id').notNull(),
    blue1Id: integer('blue1_id').notNull(),
    blue2Id: integer('blue2_id').notNull(),
    blue3Id: integer('blue3_id').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventKey, table.matchNumber, table.matchLevel] }),
    eventRef: foreignKey({
      columns: [table.eventKey],
      foreignColumns: [frcEvents.eventKey],
      name: 'matchschedule_event_fk',
    }),
    red1Ref: foreignKey({
      columns: [table.red1Id],
      foreignColumns: [teamRecords.teamNumber],
      name: 'matchschedule_red1_fk',
    }),
    red2Ref: foreignKey({
      columns: [table.red2Id],
      foreignColumns: [teamRecords.teamNumber],
      name: 'matchschedule_red2_fk',
    }),
    red3Ref: foreignKey({
      columns: [table.red3Id],
      foreignColumns: [teamRecords.teamNumber],
      name: 'matchschedule_red3_fk',
    }),
    blue1Ref: foreignKey({
      columns: [table.blue1Id],
      foreignColumns: [teamRecords.teamNumber],
      name: 'matchschedule_blue1_fk',
    }),
    blue2Ref: foreignKey({
      columns: [table.blue2Id],
      foreignColumns: [teamRecords.teamNumber],
      name: 'matchschedule_blue2_fk',
    }),
    blue3Ref: foreignKey({
      columns: [table.blue3Id],
      foreignColumns: [teamRecords.teamNumber],
      name: 'matchschedule_blue3_fk',
    }),
  }),
);

export type MatchSchedule = InferSelectModel<typeof matchSchedules>;
export type NewMatchSchedule = InferInsertModel<typeof matchSchedules>;

export const teamEvents = sqliteTable(
  'teamevent',
  {
    eventKey: text('event_key').notNull(),
    teamNumber: integer('team_number').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventKey, table.teamNumber] }),
    eventRef: foreignKey({
      columns: [table.eventKey],
      foreignColumns: [frcEvents.eventKey],
      name: 'teamevent_event_fk',
    }),
    teamRef: foreignKey({
      columns: [table.teamNumber],
      foreignColumns: [teamRecords.teamNumber],
      name: 'teamevent_team_fk',
    }),
  }),
);

export type TeamEvent = InferSelectModel<typeof teamEvents>;
export type NewTeamEvent = InferInsertModel<typeof teamEvents>;

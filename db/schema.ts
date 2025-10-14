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

export const organizations = sqliteTable('organization', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  teamNumber: integer('team_number').notNull(),
});

export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

export const userOrganizations = sqliteTable(
  'userorganization',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    organizationId: integer('organization_id').notNull(),
    teamNumber: integer('team_number').notNull(),
  },
  (table) => ({
    organizationRef: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'userorganization_organization_fk',
    }),
  }),
);

export type UserOrganization = InferSelectModel<typeof userOrganizations>;
export type NewUserOrganization = InferInsertModel<typeof userOrganizations>;

export const pitData2025 = sqliteTable(
  'pitdata2025',
  {
    eventKey: text('event_key').notNull(),
    teamNumber: integer('team_number').notNull(),
    notes: text('notes'),
    drivetrain: text('drivetrain'),
    driveteam: text('driveteam'),
    autoNotes: text('auto_notes'),
    teleNotes: text('tele_notes'),
    overallNotes: text('overall_notes'),
    robotWeight: integer('robot_weight'),
    autoCoralCount: integer('auto_coral_count').default(0),
    autoAlgaeNet: integer('auto_algae_net').default(0),
    autoAlgaeProcessor: integer('auto_algae_processor').default(0),
    startPositionLeft: integer('start_position_left').notNull().default(0),
    startPositionCenter: integer('start_position_center').notNull().default(0),
    startPositionRight: integer('start_position_right').notNull().default(0),
    autoL4Coral: integer('auto_l4_coral').notNull().default(0),
    autoL3Coral: integer('auto_l3_coral').notNull().default(0),
    autoL2Coral: integer('auto_l2_coral').notNull().default(0),
    autoL1Coral: integer('auto_l1_coral').notNull().default(0),
    teleL4Coral: integer('tele_l4_coral').notNull().default(0),
    teleL3Coral: integer('tele_l3_coral').notNull().default(0),
    teleL2Coral: integer('tele_l2_coral').notNull().default(0),
    teleL1Coral: integer('tele_l1_coral').notNull().default(0),
    pickupGround: integer('pickup_ground').notNull().default(0),
    pickupFeeder: integer('pickup_feeder').notNull().default(0),
    teleAlgaeNet: integer('tele_algae_net').notNull().default(0),
    teleAlgaeProcessor: integer('tele_algae_processor').notNull().default(0),
    endgame: text('endgame', { enum: ['NONE', 'SHALLOW', 'DEEP'] }).notNull().default('NONE'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventKey, table.teamNumber] }),
    eventRef: foreignKey({
      columns: [table.eventKey],
      foreignColumns: [frcEvents.eventKey],
      name: 'pitdata2025_event_fk',
    }),
    teamRef: foreignKey({
      columns: [table.teamNumber],
      foreignColumns: [teamRecords.teamNumber],
      name: 'pitdata2025_team_fk',
    }),
  }),
);

export type PitData2025 = InferSelectModel<typeof pitData2025>;
export type NewPitData2025 = InferInsertModel<typeof pitData2025>;

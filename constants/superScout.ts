export type SuperScoutFieldDefinition = {
  key: string;
  label: string;
  /**
   * When true, selecting this field should reveal the defense rating input.
   */
  requiresDefenseRating?: boolean;
};

export const DEFAULT_SUPER_SCOUT_FIELDS: SuperScoutFieldDefinition[] = [
  { key: 'played_defense', label: 'Played Defense', requiresDefenseRating: true },
  { key: 'died', label: 'Died on Field' },
  { key: 'tipped', label: 'Tipped Over' },
  { key: 'yellow_card', label: 'Yellow Card' },
  { key: 'red_card', label: 'Red Card' },
  { key: 'sustained_damage', label: 'Sustained Damage' },
];

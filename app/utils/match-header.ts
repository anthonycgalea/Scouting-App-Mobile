export type MatchHeaderParams = {
  teamNumber?: string | string[];
  matchNumber?: string | string[];
  eventKey?: string | string[];
  driverStation?: string | string[];
  matchLevel?: string | string[];
};

const toSingleValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const normalize = (value?: string) => value?.trim();

const getMatchLevelLabel = (matchLevel: string | undefined) => {
  const normalized = matchLevel?.toLowerCase();

  switch (normalized) {
    case 'qm':
      return 'QUALS';
    case 'sf':
      return 'SEMIS';
    case 'qf':
      return 'QUARTERS';
    case 'f':
      return 'FINALS';
    default:
      return matchLevel?.toUpperCase() ?? '';
  }
};

export const buildMatchHeaderTitle = (rawParams: MatchHeaderParams | undefined) => {
  if (!rawParams) {
    return '';
  }

  const eventKey = normalize(toSingleValue(rawParams.eventKey));
  const matchNumber = normalize(toSingleValue(rawParams.matchNumber));
  const teamNumber = normalize(toSingleValue(rawParams.teamNumber));
  const driverStation = normalize(toSingleValue(rawParams.driverStation));
  const matchLevel = normalize(toSingleValue(rawParams.matchLevel));

  const hasAllDetails = Boolean(eventKey && matchNumber && teamNumber && driverStation);

  if (!hasAllDetails) {
    return '';
  }

  const levelLabel = getMatchLevelLabel(matchLevel);
  const matchLabel = levelLabel ? `${levelLabel} MATCH ${matchNumber}` : `MATCH ${matchNumber}`;
  const driverStationLabel = driverStation.toUpperCase();

  return `${eventKey.toUpperCase()} ${matchLabel}: TEAM ${teamNumber} (${driverStationLabel})`;
};

export type PickListRank = {
  rank: number;
  teamNumber: number;
  notes: string;
  dnp: boolean;
};

export type PickList = {
  id: string;
  season: number | null;
  organizationId: number | null;
  eventKey: string | null;
  title: string;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
  favorited: boolean;
  ranks: PickListRank[];
};

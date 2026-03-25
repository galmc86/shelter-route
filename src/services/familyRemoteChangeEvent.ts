export interface FamilyRemoteChangeEvent {
  kind: 'updated' | 'cleared';
  groupCode: string;
}

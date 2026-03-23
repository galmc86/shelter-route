import type { ShelterKind } from '../types';
import type { useLanguage } from '../i18n';

type Translate = ReturnType<typeof useLanguage>['t'];

export function getShelterKindLabel(kind: ShelterKind | undefined, t: Translate): string | null {
  switch (kind) {
    case 'migunit':
      return t('shelters.kindMigunit');
    case 'protected-space':
      return t('shelters.kindProtectedSpace');
    case 'community-protection':
      return t('shelters.kindCommunityProtection');
    default:
      return null;
  }
}

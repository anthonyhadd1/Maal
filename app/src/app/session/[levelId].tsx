import { Redirect, useLocalSearchParams } from 'expo-router';

import { SessionScreen } from '@/features/session/SessionScreen';

/** MODAL /session/:levelId — question loop (design_mobile.md §4b). */
export default function SessionLevelRoute() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  const id = Number(levelId);

  if (!Number.isFinite(id) || id <= 0) {
    return <Redirect href="/" />;
  }

  return <SessionScreen levelId={id} />;
}

import { router } from 'expo-router';

import { Body, Button, Screen, Title } from '@/components/ui';
import { parentStrings, type ParentLang } from '@/lib/parent-strings';

/** A parent-mode screen that is laid out in the hi-fi but not built yet. */
export function ParentStub({ title, lang = 'vi' }: { title: string; lang?: ParentLang }) {
  const t = parentStrings(lang);
  return (
    <Screen surface="parent">
      <Button surface="parent" variant="secondary" label={`← ${t.back}`} onPress={() => router.back()} />
      <Title surface="parent">{title}</Title>
      <Body surface="parent" muted>
        {t.comingSoon}
      </Body>
    </Screen>
  );
}

import type {StyleProfile} from './types';
import {warmLight} from './warmLight';

// Все стили. Ключ — название из настройки.toml (["оформление"] "стиль").
export const styles: Record<string, StyleProfile> = {
  [warmLight.name]: warmLight,
};

export function getStyle(name: string): StyleProfile {
  const s = styles[name];
  if (!s) throw new Error(`Стиль «${name}» не найден. Есть: ${Object.keys(styles).join(', ')}`);
  return s;
}
export type {StyleProfile};

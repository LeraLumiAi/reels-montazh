// Звук появления графики. Звуки лежат в public/sfx/<папка>/<файл>.wav — их кладёт сам человек (свой пак).
// Список имеющихся файлов — sfx-list.json, его пишет scripts/sfx_index.py (запускать после того, как добавили звуки).
// Нет файла — звук молча пропускается, ролик всё равно собирается.
import React from 'react';
import {Html5Audio, staticFile} from 'remotion';
import list from './sfx-list.json';

const HAVE = new Set<string>(list as string[]);

export const hasSfx = (file: string) => HAVE.has(file);

export const Sfx: React.FC<{file: string; volume?: number}> = ({file, volume}) =>
  HAVE.has(file) ? <Html5Audio src={staticFile('sfx/' + file)} volume={volume} /> : null;

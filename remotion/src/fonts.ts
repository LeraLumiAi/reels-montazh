// Шрифты лежат локально (npm @fontsource), интернет при сборке не нужен.
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';   // подписи заглавными (canvas-caption)
import '@fontsource/onest/600.css';
import '@fontsource/playfair-display/400-italic.css';
import {continueRender, delayRender} from 'remotion';

const handle = delayRender('Загрузка шрифтов');
Promise.all([
  document.fonts.load('600 64px Onest', 'Привет'),
  document.fonts.load('400 64px Onest', 'Привет'),
  document.fonts.load('500 64px Onest', 'Привет'),
  document.fonts.load('italic 400 64px "Playfair Display"', 'Привет'),
]).then(() => continueRender(handle));

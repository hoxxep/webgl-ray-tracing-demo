import './style.css';
import { createIcons, Github, Play } from 'lucide';
import { initRangeSliders } from './range';
import { Controls } from './controls';

createIcons({ icons: { Github, Play } });
initRangeSliders();
new Controls(
  document.getElementById('screen')!,
  document.getElementById('controls')!,
);

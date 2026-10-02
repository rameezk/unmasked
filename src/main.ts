import { mount } from 'svelte';
import App from './App.svelte';
import { characters } from './characters/characters';
import { seededRandom } from './engine/random';

const seedParam = new URLSearchParams(window.location.search).get('seed');
const seed = seedParam === null ? NaN : Number(seedParam);
const random = Number.isFinite(seed) ? seededRandom(seed) : Math.random;

mount(App, {
  target: document.getElementById('app')!,
  props: { characters, random },
});

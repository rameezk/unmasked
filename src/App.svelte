<script lang="ts">
  import {
    answerPick,
    answerType,
    currentCard,
    nextCard,
    revealCard,
    roundScore,
    startRound,
    ROUND_LENGTH,
    type Round,
  } from './engine/round';
  import type { Character, Mode, Random, Tier } from './engine/types';
  import '@fontsource/bangers/latin-400.css';
  import '@fontsource-variable/fredoka/wght.css';
  import { browserStore, createSaved } from './saved/saved';

  interface Props {
    characters: Character[];
    random: Random;
  }

  let { characters, random }: Props = $props();

  const pools: { value: Tier; label: string }[] = [
    { value: 'rookie', label: 'Rookie' },
    { value: 'pro', label: 'Pro' },
    { value: 'legend', label: 'Legend' },
  ];

  const modes: { value: Mode; label: string }[] = [
    { value: 'pick', label: 'Pick' },
    { value: 'type', label: 'Type' },
  ];

  const saved = createSaved(browserStore());
  const initial = saved.settings();
  let mode = $state<Mode>(initial.mode);
  let pool = $state<Tier>(initial.pool);
  let bestScores = $state(readBestScores());
  let typed = $state('');
  let round = $state<Round | null>(null);
  let page = $state<'game' | 'about'>(location.hash === '#about' ? 'about' : 'game');

  const confetti = Array.from({ length: 14 }, (_, i) => ({
    left: 4 + i * 7,
    delay: (i % 5) * 0.15,
    colour: ['var(--red)', 'var(--yellow)', 'var(--blue)'][i % 3],
  }));

  const card = $derived(round !== null && !round.finished ? currentCard(round) : null);
  const bursting = $derived(
    card !== null && card.revealed && (round?.mode === 'pick' || card.scored === true),
  );

  function readBestScores() {
    return modes.flatMap((m) =>
      pools.flatMap((p) => {
        const score = saved.bestScore(m.value, p.value);
        if (score === null) return [];
        return [{ key: `${m.value}:${p.value}`, label: `${m.label} + ${p.label}`, score }];
      }),
    );
  }

  function play() {
    saved.saveSettings({ mode, pool });
    typed = '';
    round = startRound({ characters, mode, pool, random });
  }

  function pick(id: string) {
    if (round) round = answerPick(round, id);
  }

  function guess(event: SubmitEvent) {
    event.preventDefault();
    if (round) round = answerType(round, typed);
  }

  function reveal() {
    if (round) round = revealCard(round);
  }

  function next() {
    typed = '';
    if (!round) return;
    round = nextCard(round);
    if (round.finished) {
      saved.recordScore(round.mode, round.pool, roundScore(round));
      bestScores = readBestScores();
    }
  }

  function showPage() {
    page = location.hash === '#about' ? 'about' : 'game';
  }

  function backToStart() {
    round = null;
  }
</script>

<svelte:window onhashchange={showPage} />

<main>
  <h1><a href="#start" class="logo">unmasked</a></h1>

  {#if page === 'about'}
    <section aria-label="About" class="panel about">
      <h2>About</h2>
      <p>
        The characters and artwork in this game belong to Marvel. unmasked is an unofficial fan game
        and is not made, endorsed or sponsored by Marvel.
      </p>
      <a class="button" href="#start">Back</a>
    </section>
  {:else if round === null}
    <section aria-label="Start" class="start">
      <fieldset class="panel">
        <legend>Mode</legend>
        <div class="segments">
          {#each modes as m (m.value)}
            <label class="segment">
              <input type="radio" name="mode" value={m.value} bind:group={mode} />
              <span>{m.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset class="panel">
        <legend>Pool</legend>
        <div class="segments three">
          {#each pools as p (p.value)}
            <label class="segment">
              <input type="radio" name="pool" value={p.value} bind:group={pool} />
              <span>{p.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      {#if bestScores.length > 0}
        <div class="panel">
          <h2>Best Scores</h2>
          <ul class="scores">
            {#each bestScores as best (best.key)}
              <li data-testid="best-score">{best.label}: {best.score}/{ROUND_LENGTH}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <button type="button" class="big primary" onclick={play}>Play</button>
      <a class="about-link" href="#about">About</a>
    </section>
  {:else if card}
    <section aria-label="Card" class="card-screen">
      <div class="frame" data-testid="card-frame">
        <img
          src={`${import.meta.env.BASE_URL}${card.picture.file}`}
          alt="Who is this?"
          width="240"
          height="320"
        />
        <span class="counter">{round.index + 1} / {ROUND_LENGTH}</span>
        {#if bursting}
          <div class="burst" data-testid="burst" aria-hidden="true"><span>POW!</span></div>
        {/if}
        {#if card.revealed}
          <p class="reveal" data-testid="reveal">
            <span class="name">{card.character.name}</span>
            <span class="badge {card.character.side}" data-testid="side-badge"
              >{card.character.side === 'hero' ? 'Hero' : 'Villain'}</span
            >
          </p>
        {/if}
      </div>
      {#if round.mode === 'type'}
        {#if !card.revealed}
          <form onsubmit={guess}>
            <input
              type="text"
              aria-label="Your answer"
              bind:value={typed}
              autocapitalize="none"
              autocorrect="off"
              autocomplete="off"
              spellcheck="false"
              enterkeyhint="go"
            />
            <button type="submit" class="primary">Guess</button>
            <button type="button" class="secondary" onclick={reveal}>Reveal</button>
          </form>
        {/if}
      {:else}
        <div class="choices">
          {#each card.choices as choice (choice.id)}
            <button
              type="button"
              data-testid="choice"
              disabled={card.wrongIds.includes(choice.id) || card.revealed}
              class:correct={card.revealed && choice.id === card.character.id}
              onclick={() => pick(choice.id)}
            >
              {choice.name}
            </button>
          {/each}
        </div>
      {/if}
      {#if card.revealed}
        <button type="button" class="big primary" onclick={next}>
          {round.index + 1 >= ROUND_LENGTH ? 'Finish' : 'Next'}
        </button>
      {/if}
    </section>
  {:else}
    <section aria-label="End of Round" class="end">
      <div class="celebration" data-testid="celebration" aria-hidden="true">
        {#each confetti as piece, i (i)}
          <i
            style="left: {piece.left}%; animation-delay: {piece.delay}s; background: {piece.colour}"
          ></i>
        {/each}
      </div>
      <p class="score-burst" data-testid="score">{roundScore(round)}/{ROUND_LENGTH}</p>
      <ul class="roster">
        {#each round.cards as c (c.character.id)}
          <li data-testid="round-character">{c.character.name}</li>
        {/each}
      </ul>
      <button type="button" class="big primary" onclick={backToStart}>Play again</button>
    </section>
  {/if}
</main>

<style>
  :global(:root) {
    --red: #e62429;
    --yellow: #ffd400;
    --blue: #1f5fd6;
    --ink: #111;
    --paper: #fffbe8;
    --outline: 3px solid var(--ink);
    --shadow: 4px 4px 0 var(--ink);
    --display: 'Bangers', 'Impact', sans-serif;
    color-scheme: light;
  }
  :global(body) {
    margin: 0;
    min-height: 100dvh;
    font-family: 'Fredoka Variable', 'Trebuchet MS', system-ui, sans-serif;
    font-weight: 500;
    color: var(--ink);
    background-color: var(--yellow);
    background-image: radial-gradient(rgb(230 36 41 / 0.35) 20%, transparent 21%);
    background-size: 14px 14px;
  }
  :global(*) {
    box-sizing: border-box;
  }
  main {
    max-width: 28rem;
    margin: 0 auto;
    padding: 0.5rem 1rem 1rem;
  }
  h1 {
    margin: 0 0 0.5rem;
    text-align: center;
    font-family: var(--display);
    font-weight: 400;
    font-size: 2.4rem;
    letter-spacing: 0.06em;
    line-height: 1;
  }
  .logo {
    color: var(--red);
    text-decoration: none;
    -webkit-text-stroke: 2px var(--ink);
    paint-order: stroke fill;
    text-shadow: 3px 3px 0 var(--ink);
  }
  h2 {
    margin: 0 0 0.5rem;
    font-family: var(--display);
    font-weight: 400;
    font-size: 1.5rem;
    letter-spacing: 0.05em;
  }
  .panel {
    margin: 0 0 1rem;
    padding: 0.75rem;
    background: var(--paper);
    border: var(--outline);
    border-radius: 14px;
    box-shadow: var(--shadow);
  }
  legend {
    padding: 0 0.5rem;
    font-family: var(--display);
    font-size: 1.25rem;
    letter-spacing: 0.05em;
    background: var(--blue);
    color: white;
    border: var(--outline);
    border-radius: 8px;
  }
  .segments {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .segments.three {
    grid-template-columns: repeat(3, 1fr);
  }
  .segment {
    position: relative;
  }
  .segment input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .segment span {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 3.5rem;
    font-size: 1.2rem;
    font-weight: 600;
    background: white;
    border: var(--outline);
    border-radius: 12px;
    cursor: pointer;
  }
  .segment input:checked + span {
    background: var(--red);
    color: white;
    box-shadow: inset 0 -4px 0 rgb(0 0 0 / 0.25);
  }
  .segment input:focus-visible + span {
    outline: 4px solid var(--blue);
    outline-offset: 2px;
  }
  .scores {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.25rem;
  }
  button,
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 3.5rem;
    padding: 0.5rem 0.75rem;
    font: inherit;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    background: white;
    border: var(--outline);
    border-radius: 12px;
    box-shadow: 3px 3px 0 var(--ink);
    cursor: pointer;
  }
  button:active:not(:disabled),
  .button:active {
    transform: translate(3px, 3px);
    box-shadow: none;
  }
  button:focus-visible,
  .button:focus-visible,
  a:focus-visible,
  input[type='text']:focus-visible {
    outline: 4px solid var(--blue);
    outline-offset: 2px;
  }
  button:disabled {
    color: #777;
    background: #ddd;
    box-shadow: none;
    cursor: not-allowed;
    text-decoration: line-through;
  }
  .primary {
    color: white;
    background: var(--red);
  }
  .secondary {
    background: var(--yellow);
  }
  .big {
    width: 100%;
    min-height: 4rem;
    font-family: var(--display);
    font-weight: 400;
    font-size: 2rem;
    letter-spacing: 0.08em;
  }
  .about-link {
    display: block;
    margin-top: 1rem;
    text-align: center;
    font-weight: 600;
    color: var(--ink);
  }
  .about p {
    font-size: 1.1rem;
    line-height: 1.4;
  }
  .card-screen {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
  }
  .frame {
    position: relative;
    width: min(100%, calc((100dvh - 14rem) * 0.75));
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background: white;
    border: 5px solid var(--ink);
    border-radius: 14px;
    box-shadow: 6px 6px 0 var(--ink);
  }
  .frame img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .frame::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(rgb(0 0 0 / 0.18) 20%, transparent 21%);
    background-size: 8px 8px;
    mask-image: linear-gradient(135deg, black, transparent 35%);
  }
  .counter {
    position: absolute;
    top: 0.4rem;
    left: 0.4rem;
    padding: 0.1rem 0.6rem;
    font-family: var(--display);
    font-size: 1.1rem;
    letter-spacing: 0.05em;
    background: var(--yellow);
    border: 2px solid var(--ink);
    border-radius: 6px;
  }
  .reveal {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 2;
    margin: 0;
    padding: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem 0.6rem;
    background: var(--paper);
    border-top: var(--outline);
  }
  .name {
    font-family: var(--display);
    font-size: 1.7rem;
    letter-spacing: 0.05em;
    line-height: 1;
  }
  .badge {
    padding: 0.1rem 0.7rem;
    font-family: var(--display);
    font-size: 1.2rem;
    letter-spacing: 0.06em;
    color: white;
    border: 2px solid var(--ink);
    border-radius: 999px;
  }
  .badge.hero {
    background: var(--blue);
  }
  .badge.villain {
    background: var(--red);
  }
  .burst {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    pointer-events: none;
    animation: burst-out 1.6s ease-out forwards;
  }
  .burst span {
    display: grid;
    place-items: center;
    width: 70%;
    aspect-ratio: 1;
    font-family: var(--display);
    font-size: 3.2rem;
    letter-spacing: 0.05em;
    color: var(--red);
    -webkit-text-stroke: 2px var(--ink);
    paint-order: stroke fill;
    background: var(--yellow);
    clip-path: polygon(
      50% 0%,
      61% 15%,
      79% 6%,
      80% 25%,
      98% 28%,
      88% 44%,
      100% 58%,
      83% 65%,
      86% 84%,
      67% 82%,
      58% 100%,
      46% 85%,
      28% 96%,
      25% 77%,
      6% 75%,
      15% 58%,
      0% 45%,
      17% 36%,
      12% 17%,
      32% 20%
    );
    animation: burst-pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  @keyframes burst-pop {
    from {
      transform: scale(0.1) rotate(-25deg);
    }
    to {
      transform: scale(1) rotate(-6deg);
    }
  }
  @keyframes burst-out {
    0%,
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
  }
  .choices button {
    line-height: 1.1;
  }
  .choices .correct {
    color: white;
    background: #1b8a3a;
    text-decoration: none;
  }
  form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    width: 100%;
  }
  form input {
    grid-column: 1 / -1;
    min-height: 3.5rem;
    padding: 0 0.75rem;
    font: inherit;
    font-size: 1.2rem;
    background: white;
    border: var(--outline);
    border-radius: 12px;
  }
  .end {
    position: relative;
    display: grid;
    gap: 1rem;
    justify-items: center;
    text-align: center;
  }
  .score-burst {
    display: grid;
    place-items: center;
    width: 12rem;
    aspect-ratio: 1;
    margin: 0;
    font-family: var(--display);
    font-size: 4.5rem;
    letter-spacing: 0.05em;
    color: var(--red);
    -webkit-text-stroke: 2px var(--ink);
    paint-order: stroke fill;
    background: var(--yellow);
    border: var(--outline);
    border-radius: 50%;
    box-shadow: 6px 6px 0 var(--ink);
    animation: burst-pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  .roster {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .roster li {
    padding: 0.2rem 0.7rem;
    font-weight: 600;
    background: var(--paper);
    border: 2px solid var(--ink);
    border-radius: 999px;
  }
  .celebration {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .celebration i {
    position: absolute;
    top: -1.4rem;
    width: 0.8rem;
    height: 1.2rem;
    border: 2px solid var(--ink);
    animation: fall 2.4s ease-in infinite backwards;
  }
  @keyframes fall {
    from {
      transform: translateY(0) rotate(0deg);
    }
    to {
      transform: translateY(32rem) rotate(540deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .celebration {
      display: none;
    }
    .burst span,
    .score-burst {
      animation: none;
    }
  }
</style>

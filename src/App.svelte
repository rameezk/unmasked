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

  let mode = $state<Mode>('pick');
  let pool = $state<Tier>('rookie');
  let typed = $state('');
  let round = $state<Round | null>(null);

  const card = $derived(round !== null && !round.finished ? currentCard(round) : null);

  function play() {
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
    if (round) round = nextCard(round);
  }

  function backToStart() {
    round = null;
  }
</script>

<main>
  <h1>unmasked</h1>

  {#if round === null}
    <section aria-label="Start">
      <fieldset>
        <legend>Mode</legend>
        {#each modes as m (m.value)}
          <label>
            <input type="radio" name="mode" value={m.value} bind:group={mode} />
            {m.label}
          </label>
        {/each}
      </fieldset>
      <fieldset>
        <legend>Pool</legend>
        {#each pools as p (p.value)}
          <label>
            <input type="radio" name="pool" value={p.value} bind:group={pool} />
            {p.label}
          </label>
        {/each}
      </fieldset>
      <button type="button" onclick={play}>Play</button>
    </section>
  {:else if card}
    <section aria-label="Card">
      <p>Card {round.index + 1} of {ROUND_LENGTH}</p>
      <img src={`${import.meta.env.BASE_URL}${card.picture.file}`} alt="Who is this?" width="240" />
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
            <button type="submit">Guess</button>
            <button type="button" onclick={reveal}>Reveal</button>
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
        <p data-testid="reveal">
          {card.character.name} - {card.character.side === 'hero' ? 'Hero' : 'Villain'}
        </p>
        <button type="button" onclick={next}>
          {round.index + 1 >= ROUND_LENGTH ? 'Finish' : 'Next'}
        </button>
      {/if}
    </section>
  {:else}
    <section aria-label="End of Round">
      <p data-testid="score">{roundScore(round)}/{ROUND_LENGTH}</p>
      <ul>
        {#each round.cards as c (c.character.id)}
          <li data-testid="round-character">{c.character.name}</li>
        {/each}
      </ul>
      <button type="button" onclick={backToStart}>Play again</button>
    </section>
  {/if}
</main>

<style>
  main {
    max-width: 28rem;
    margin: 0 auto;
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }
  img {
    display: block;
    margin: 0 auto 1rem;
    aspect-ratio: 3 / 4;
    object-fit: cover;
  }
  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  button {
    padding: 0.75rem;
    font-size: 1rem;
  }
  .correct {
    background: #2e7d32;
    color: white;
  }
  fieldset {
    margin-bottom: 1rem;
  }
</style>

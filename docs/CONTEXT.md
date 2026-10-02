# unmasked

A game where players guess the names of superheroes and villains from pictures.

## Language

**Character**:
A hero or villain that can be guessed, identified by its hero/villain name (e.g. Spider-Man), never its real name.
_Avoid_: hero, entry

**Universe**:
The publisher world a Character belongs to, such as Marvel.
_Avoid_: publisher, franchise

**Side**:
Whether a Character is a hero or a villain. Every Character has exactly one Side, using the one it is best known for.
_Avoid_: alignment, team

**Tier**:
How well known a Character is: Rookie (famous to everyone), Pro (known to fans) or Legend (deep cut).
_Avoid_: difficulty, rarity

**Pool**:
The Tier chosen for a Round. It includes every Character at that Tier and every easier Tier, so Legend includes everyone.
_Avoid_: deck, category

**Picture**:
One image of a Character in a single art style (comic, movie or cartoon). A Character has one to three Pictures.
_Avoid_: variant, image, art

**Card**:
A single Character shown to the player using one of its Pictures, waiting for a guess.
_Avoid_: question, turn

**Round**:
A fixed sequence of Cards played as one game, currently ten.
_Avoid_: game, session, level

**Alias**:
An extra accepted spelling of a Character's name for typed answers, such as "cap" for Captain America.
_Avoid_: nickname, synonym

**Mode**:
How the player answers a Card: Pick (choose from four names) or Type (type the name).
_Avoid_: easy mode, hard mode, difficulty

**Score**:
The number of Cards guessed correctly in a Round, shown out of the Round length (e.g. 7/10).
_Avoid_: stars, points

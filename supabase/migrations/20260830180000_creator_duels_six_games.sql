-- Preserve the four completed game modes and admit the two v9 modes.
alter table public.creator_duels
  drop constraint if exists creator_duels_game_mode_check;

alter table public.creator_duels
  add constraint creator_duels_game_mode_check
  check (
    game_mode = any (
      array[
        'choice'::text,
        'tap'::text,
        'puzzle'::text,
        'shoot'::text,
        'quest'::text,
        'race'::text
      ]
    )
  );

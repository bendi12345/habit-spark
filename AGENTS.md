<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Game-state transitions (complete/fail/fallback) live in SQL RPCs `complete_field` / `fail_field` — keeps checkpoint and 3-failure rules atomic and server-enforced.
- Starter path comes from `src/lib/path-template.ts` (sawtooth); later AI generation should produce the same field shape.
- Signed-in screens live under `src/routes/_authenticated/`; UI copy is Hungarian.

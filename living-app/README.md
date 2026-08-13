# living-app — the Living Book application source

The code half of the `/living/` build. This is the state machine and the four
SET modules; the painted assets it draws are ~13 MB and live on the deploy
branch (`main`, under `site-deploy/living/assets/`), not here.

    index.html          the page
    app/units.js        THE SCRIPT — 95 units, emitted from CONTENT*.md by
                        tools/living/emit_units.py and byte-identical across
                        every product version of this book
    app/main.js         the reader state machine: verbs, gates, leaves, turns,
                        the Beat VI clock
    app/stage.js        the compositor: plates, layers, actors, focus lenses,
                        the gap reporter
    app/margin.js       margin typography and the speaker leader
    app/audio.js        diegetic beds + moment cues
    app/clock.js        the sim clock, latched into harness mode by the lap
    app/setkit.js       shared set helpers (marks, floor lines, px/m)
    app/sets/{room,street,chase,church}.js
                        one module per SET: its own geometry, its own rigs,
                        its own close lenses

To run it, serve a tree that has this code and the deploy branch's
`assets/` beside it; there is no build step. To verify it, run the lap
(`tools/living/lap.mjs`) — preferably with `--base <deployed-url>`, which is
the only thing that proves the bytes a reader actually gets.

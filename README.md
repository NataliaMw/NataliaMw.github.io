# nataliamw.github.io

My personal site. The hero runs [TypeDNA](https://github.com/NataliaMw/type-dna) live: type a sentence and your keystroke rhythm draws itself as a helix next to mine. The page's colors come from my own typing.

- `typedna.js` is TypeDNA's `visual-generator.ts` and `analyzer.ts` with only the TypeScript types removed.
- `app.js` is the capture layer, the slowed clock (150×, so the helix drifts instead of spins) and the page interactions.
- `mercor/` holds my Mercor Research Fellowship proposal.

Plain HTML, CSS and JS. No framework, no build step. Open `index.html` or serve the folder.

Record my rhythm: open `/#record`, type the sentence, copy the recording into `HER_RECORDING` in `app.js`.

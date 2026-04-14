# Battleship example scaffold

Self-contained **Battleship** game (classic 10×10 grid, standard fleet) built with **React 19**, **Vite 6**, and **TypeScript**, using the same **ESLint / Prettier** extension pattern as [`project-template`](../../project-template).

## Generate a project

From the directory where you want the new folder (default name `battleship-game`):

```sh
sh ~/dotfiles/examples/battleship/scaffold.sh
```

Or pass a path:

```sh
sh ~/dotfiles/examples/battleship/scaffold.sh ./my-battleship
```

Then:

```sh
cd battleship-game   # or your chosen path
npm install
npm run dev
```

Open the printed local URL. You play against a simple AI: click the **enemy** grid to fire; the AI shoots back after each of your valid shots.

## Requirements

- **Node.js 22** (matches the style guides).
- Dotfiles at **`$HOME/dotfiles`** so `eslint.config.js` and `.prettierrc.js` can load `eslint.base.js` and `prettier.base.js`.

## Lint / format

```sh
npm run lint
npm run format
```

## Rules implemented

- Ships: lengths 5, 4, 3, 3, 2; no overlap; horizontal or vertical only.
- Win when every enemy ship cell has been hit.

The template source lives in [`template/`](template/); edit there if you want to change the default game, then re-run the scaffold into a new directory.

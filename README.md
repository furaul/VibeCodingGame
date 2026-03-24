# VibeCodingGame

[中文文档](./docs/README_zh.md)

A terminal snake game designed for the tmux + Claude Code workflow. Play snake in one pane while waiting for AI responses in the other. The game auto-pauses when you switch panes and gives you a 3-second countdown when you come back.

## Quick Start

### 1. Install tmux (if needed)

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

### 2. Configure tmux

Add to `~/.tmux.conf`:

```
set -g mouse on
set -g focus-events on
```

Then reload:

```bash
tmux source-file ~/.tmux.conf
```

`mouse on` enables click-to-switch between panes. `focus-events on` allows the game to detect pane focus changes.

### 3. Launch

```bash
# Start tmux, split panes, run Claude Code on the left and the game on the right
tmux new-session -d 'claude' \; split-window -h 'node snake.js' \; attach
```

Or manually:

```bash
tmux                  # start tmux
# Ctrl+B then %      # split left/right
claude                # run Claude Code in the left pane
# click right pane
node snake.js         # start the game
```

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow keys | Move |
| P | Pause |
| Q / Esc | Quit |
| R | Restart (on Game Over) |
| Ctrl+Z | Suspend (resume with `fg`) |

## Features

- **Focus-aware**: Auto-pauses when you switch to another tmux pane, 3-second countdown on return
- **Adaptive layout**: Game area adjusts to terminal size, handles resize gracefully
- **Zero dependencies**: Only requires Node.js, no npm packages needed

## Requirements

- Node.js >= 14
- tmux (recommended, for split-screen and focus detection)

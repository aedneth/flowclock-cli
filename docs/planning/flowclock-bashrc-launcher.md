# FlowClock — current launch mechanism (live, in daily use)

Eduardo runs this every day. Typing 'flowclock' opens a dedicated HUD window.

## ~/.bashrc alias
```bash
alias flowclock='gnome-terminal --profile="Pop Clock" --hide-menubar --geometry=70x18'
```

## How it actually launches the script
The alias opens GNOME Terminal with the dedicated **Pop Clock** profile.
That profile's 'Run a custom command instead of my shell' is set to:
```bash
/home/eduardo.borjas/flowtime.sh
```
So: flowclock -> GNOME Terminal (Pop Clock profile) -> ~/flowtime.sh (count-up HUD).
The full count-up script is seeded alongside this file as flowtime.sh.

## Pop Clock profile (proven visual config, from the HUD note)
- Font: JetBrains Mono ~20pt · neon/green text · dark/transparent background
- Cursor: underline, no blink · menubar hidden · geometry 70x18 (45x8 also used)
- Note: there is no ~/.flowtime file; flowtime.sh is the canonical script.

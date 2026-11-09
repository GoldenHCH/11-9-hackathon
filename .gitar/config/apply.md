Fix findings in TypeScript, SCSS, HTML, Markdown and Kubernetes manifests.

Skip findings that change how check-in tokens are signed or verified, or how XP is calculated. Those need a human to read the fix.

Never add or change a secret value, and never edit `.github/workflows/`.

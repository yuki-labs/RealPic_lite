---
description: Rebase workflow - keep new-features synced with main
---

# Rebase Workflow

This workflow keeps `new-features` branch always on top of `main`, ensuring a clean linear history.

## Daily Development

1. Work on `new-features` branch:
```bash
git checkout new-features
# ... make changes ...
git add .
git commit -m "Your commit message"
git push
```

## Sync with main (Rebase)

When you want to include latest changes from `main`:

// turbo
1. Make sure you're on new-features:
```bash
git checkout new-features
```

// turbo
2. Rebase on top of main:
```bash
git rebase main
```

// turbo
3. Force push (required because history was rewritten):
```bash
git push --force
```

## Merge to main (for deployment)

When ready to deploy changes to Railway:

// turbo
1. Switch to main:
```bash
git checkout main
```

// turbo
2. Merge (will be fast-forward if rebased):
```bash
git merge new-features
```

// turbo
3. Push main:
```bash
git push
```

// turbo
4. Go back to new-features for continued development:
```bash
git checkout new-features
```

## Quick Reference

| Action | Command |
|--------|---------|
| Sync from main | `git rebase main && git push --force` |
| Deploy to main | `git checkout main && git merge new-features && git push` |
| Check status | `git log --oneline --graph -10` |

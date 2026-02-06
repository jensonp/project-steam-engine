# Push to CherryQuartzio/project-steam-engine — Prerequisites & Steps

## 1. Prerequisite checks (run in terminal)

```bash
# 1) GitHub CLI logged in and can see the repo
gh auth status

# 2) You have access to the target repo (exit 0 = you can push)
gwh api repos/CherryQuartzio/project-steam-engine/collaborators/jensonp

# 3) Optional: confirm it appears in repos you can access
gh api user/repos --paginate -q '.[] | "\(.owner.login)/\(.name)"' | grep -i project-steam-engine
```

## 2. Initialize Git and push (from project root)

```bash
cd /Users/jensonphan/cs125

# 4) Initialize repo (only if not already)
git init

# 5) Add remote
git remote add origin https://github.com/CherryQuartzio/project-steam-engine.git

# 6) Stage and commit
git add .
git status   # sanity check before commit
git commit -m "Initial commit: Steam game recommender"

# 7) Branch name and first push (remote may have main + README)
git branch -M main
git pull origin main --allow-unrelated-histories   # if remote has commits
git push -u origin main
```

If the remote is empty or you want to overwrite it:
- `git push -u origin main --force`   # use only if you intend to replace remote history

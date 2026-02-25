# Dungeon Crawler (Browser)

Et 2D browser-spil med:
- karakterklasser
- loot/inventory
- levels og boss floors
- tidsbaseret sværhedsgrad

## Kør lokalt

```bash
python3 -m http.server 8000
```

Åbn derefter: `http://localhost:8000`

## Klargjort til GitHub

Repoet er sat op med `.gitignore`, så midlertidige filer ikke ryger med i commits.

### Flyt til GitHub igen

1. Opret et nyt tomt repository på GitHub.
2. Tilføj remote lokalt:

```bash
git remote add origin <DIN_GITHUB_REPO_URL>
```

3. Push nuværende branch:

```bash
git push -u origin work
```

Hvis du vil bruge `main` i stedet:

```bash
git branch -M main
git push -u origin main
```

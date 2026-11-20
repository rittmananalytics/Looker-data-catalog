# Branding a client's Data Catalog

The app's layout, features and copy are the same for every client. Only the values below change, all in `catalog_builder/catalog.yml`. Never edit `app.src.js` to brand a client: a change there changes every client's app.

## What to collect from the client

| Item | Where it goes | Notes |
|---|---|---|
| Client name as they write it | `client.name` | Shown top left and in the eyebrow on the home page |
| One-line tagline | `client.tagline` | Plain words: what the catalog covers |
| Full logo, SVG | `brand/logo.svg`, `client.logo_svg` | Dark on light. No embedded scripts, no links to external images |
| Square mark, SVG | `brand/mark.svg`, `client.mark_svg` | Used in the narrow header. Can be the same file as the logo |
| Primary brand colour | `brand.primary` | The one accent. Links, active tab, buttons with white text |
| Fonts the client licenses for web use | `brand/fonts/`, `brand.fonts` | woff2, Latin subset. Leave empty for the system font stack |

Good sources: the client's design system or brand guidelines, their website's CSS (colours and font names only; never copy font files from a website), or their marketing team. If there is no brand guide, ask for the logo and one colour and derive the rest.

## Deriving the colour tokens from one primary colour

| Token | Rule of thumb |
|---|---|
| `primary` | The brand colour, darkened until white text on it reaches 4.5:1 |
| `primary_soft` | The primary at about 12% on white: a pale tint |
| `primary_ink` | The primary darkened until it reaches 4.5:1 on `primary_soft` |
| `ink` | Near-black, slightly towards the primary's hue |
| `muted` | Grey with 4.5:1 or more on white |
| `subtle` | Lighter grey, 3:1 or more on white |
| `border` | Very light grey |
| `canvas`, `card` | Off-white page, white cards |
| `tints` | Six pale colours for domain icons and charts |

Red, amber and green status colours stay fixed so health and test results read the same for every client. Do not set the primary to a red or a green.

`check_brand.py` tests every pair the app uses and fails a build that would be hard to read. Run it after each brand change.

## Fonts

- Embed at most two weights in total. The whole app must stay under Looker's 900 KB limit, and the catalog snapshot needs most of it.
- Convert to woff2 and subset to Latin (`subset: latin` in the file entry).
- `display` is the body font, `heading` is used for headings, labels, numbers and navigation. They can be the same family.
- If the client's font is not licensed for embedding, leave `files` empty and name only a common fallback, or leave both blank.

## Words

- `search.examples`: three to five prompts in the client's words, using names from their model ("net revenue last week", "which stores are behind target").
- `search.column_example`, `search.sql_example`: a real column name and a real SQL fragment from their LookML.
- `search.filter_examples`: phrases like "undocumented tables in finance", using one of their domain names.
- `domains`: their business areas, with icons from the list in `catalog.yml`. There is a `pound` icon but no dollar or euro icon; use `calculator` for finance outside the UK.

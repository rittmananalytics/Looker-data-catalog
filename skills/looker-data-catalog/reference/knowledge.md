# Knowledge content: drafting and confirming

The Knowledge pages (data products, glossary, business rules, verified questions, context graph) come from `glossary.yml` and `knowledge.yml`. They are what makes the catalog more than a list of tables, and they are also where a wrong statement does the most harm. Treat every item as a claim that needs evidence.

## Draft

1. Read the client's LookML (view and field descriptions, explores, dashboards), dbt docs and tests, and any metric definitions they have shared.
2. Write 5 to 8 data products, 15 to 25 glossary terms, 8 to 15 business rules and 10 to 15 verified questions. Fewer, correct items beat many vague ones.
3. Every item gets `status: draft` and an empty `owner`. The app shows "Draft, needs an owner".
4. Reference fields as `view.field` using the view name, not a join alias. Reference Looker dashboards by id under `looker_dashboards`, and only LookML dashboards the model includes under `dashboards`.

## Check against the code

Before anything is marked confirmed, check each item against the code. A subagent works well for this: give it the two files and the repo paths, read-only, and ask for a verdict per item (matches, wrong with the corrected wording and file:line evidence, or cannot be checked from code). On the first run of this catalog, 23 of 55 drafted items needed a correction. The usual problems:

| Problem | Example |
|---|---|
| Field in the wrong unit | A "margin" measure in currency where the rule talks about a percentage |
| Wrong implementation listed | A pace rule pointing at a different pace measure than the one the status uses |
| Test listed that does not test the rule | A date-consistency test listed under a "worst status wins" rule |
| Definition from memory, not code | NPS described as promoters less detractors when the measure is an average score |
| Dashboard deleted or not deployed | Dashboard ids that no longer exist; LookML dashboards at the repo root that the model does not include |
| Two targets in use | Different targets on a dashboard and in a KPI table |

Check dashboard ids exist on the client's instance (Looker API, through the toolkit's own helpers; never read the toolkit config file).

## Confirm

- Mark `status: confirmed` only when the code matches AND a named person at the client agrees the definition. Record the owner as they prefer (name or role).
- Items the code cannot settle (a business policy, a manually maintained sheet, a model built outside the repo) stay as draft, with a YAML comment saying what is missing.
- Never invent an owner or a target.

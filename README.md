# Shortlist College Planner

A college-list planner for the 2026–27 application cycle.

## What each file does

| File | What's in it | Edit it to… |
|---|---|---|
| `schools.json` | Every school's deadlines, testing policy, essay prompts and stats | Fix a date, update a prompt, add a school |
| `index.html` | The page skeleton: header, search box, tabs | Change the site name or the search placeholder text |
| `style.css` | Colors, fonts, spacing | Change the look (colors are at the top) |
| `app.js` | How everything works: tabs, countdowns, essay tracker | Change behavior (the file starts with a map of its sections) |

## Common edits

**Fix a deadline.** In `schools.json`, find the school (search for its name). Under `"plans"`, each line looks like `["ED", "2026-11-01"]`: the plan name, then the date as year-month-day.

**Change an essay prompt.** Under the school's `"essays"`, each line is `["prompt text", word limit]`. Use `0` when there's no limit.

**Update stats.** At the bottom of `schools.json` under `"stats"`, each school has `[applicants, admit rate %, [SAT 25th, SAT 75th], [ACT 25th, ACT 75th]]`. Use `null` when a number isn't reported.

**Add a school.** Copy a whole school block (from `{` to `},`), paste it after another school, give it a new `"id"`, and add a matching line under `"stats"`.

**Change the main color.** In `style.css`, change `--accent` in the first `:root` block (light mode) and in the two dark-mode blocks below it.

## JSON rules that trip people up

- Every piece of text goes in "straight double quotes".
- Items in a list are separated by commas, with **no comma after the last one**.
- If the site shows "School data didn't load" after an edit, there's a typo in `schools.json`. Paste the file into jsonlint.com and it will point to the line.

## Where the data comes from

- Rankings: U.S. News 2027 (released Sept 22, 2026).
- Applicants, admit rate and SAT/ACT middle 50%: Compass Prep's college profiles table (updated July 1, 2026), compiled from each school's most recent Common Data Set or admissions release.
- Testing policies: Compass Prep (July 2026).
- Deadlines follow each school's usual calendar. Confirm them on each school's site.
- Essay prompts are short summaries of the 2025–26 versions, not the official wording.

# Mahera's Pocket — Personal Finance Tracker

A clean, offline-first personal budgeting app built with vanilla HTML, CSS, and JavaScript.

🔗 **Live demo:** [https://financialtrackerrr.netlify.app/](https://financialtrackerrr.netlify.app/)

---

## Features

- **Quick-add cards** — add transactions per category inline (no modal needed), with last-input memory
- **Dashboard** — summary cards, donut chart, bar chart, daily trend line, and smart insights
- **Pie chart** — category breakdown with Day / Week / Month filter
- **Bar chart** — Expense vs Savings vs Income grouped bars with Daily / Weekly / Monthly filter
- **Smart suggestions** — data-driven tips: savings rate vs goal, month-end projection, week-over-week trend alerts, unusual spend detection
- **Calendar view** — browse spending day by day with totals on each cell
- **Transaction history** — search, filter, sort by any column
- **Export** — CSV, Excel (.xlsx), and PDF
- **Draft recovery** — unfinished forms are restored on next open
- **Settings** — compact mode, savings goal %, sample data loader

## Tech

- Pure HTML / CSS / JavaScript — no framework, no build step
- Data stored in `localStorage` (fully offline)
- [SheetJS](https://sheetjs.com/) for Excel export (loaded via CDN)

## Run locally

Just open `index.html` in any browser — no server required.

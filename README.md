# DeadlineHub — Student Homework & Deadline Tracker

A modern, responsive student dashboard built with pure HTML, CSS, and JavaScript. No frameworks, external build steps, paid APIs, or servers are required.

## Architecture
- `index.html` and `style.css`: interface, dashboard, forms, dialogs, responsive layout, and themes.
- `script.js`: UI events, forms, filters, search, and rendering.
- `storage.js`: asynchronous CRUD operations backed by browser `localStorage`.

## Features
- Dashboard summaries for total, pending, overdue, and completed tasks.
- Add and edit homework with subject, title, notes, due date/time, priority, and estimated effort.
- Upcoming deadlines with urgency labels, filters, search, subject filtering, and sorting.
- Mark tasks complete and delete with confirmation.
- Browser `localStorage` persistence, JSON export, and sample-data reset.
- Dark/light theme and responsive mobile-friendly interface.

## Run locally
Open `index.html` in a modern browser. No installation or build process is required.

## Tests
Open `tests.html` in a browser to run the included storage-layer test suite.

## Files
- `index.html` — application interface
- `style.css` — responsive styling and themes
- `script.js` — application logic
- `storage.js` — local storage/data access layer
- `tests.html` — automated test page
- `README.md` — project documentation

**Note:** Tasks are stored in the browser on the device where they are created. This version does not include cloud sync or user accounts.

# OSI Time Tracker

OSI Time Tracker lets an IT consultant track time locally and export it on demand to the issue trackers their clients use.

Every term carries its canonical Polish word (`_Polish_`, singular nominative), used in the Polish UI. `_Polish avoid_` lists Polish words that must not stand in for it.

## Language

### Time tracking

**Time entry**:
A span of time the user worked on something: a start and, once stopped, a stop. Its title names the Task it belongs to; an entry without a title belongs to no Task.
_Polish_: Wpis czasu
_Avoid_: Log, record, session
_Polish avoid_: Log, rejestr

**Running time entry**:
The Time entry that has started and not yet stopped. A user has at most one; the timer in the top bar shows and stops it.
_Polish_: Aktywny wpis czasu
_Avoid_: Running timer, active entry, timer
_Polish avoid_: Trwający wpis, uruchomiony stoper

**Task**:
What a Time entry's title names: a name within one Project or within none, optionally linked to one Remote issue. Never managed on its own: entry titles create, match, rename and merge it, and it is deleted once no entry is left.
_Polish_: Zadanie
_Avoid_: Ticket, activity, todo
_Polish avoid_: Aktywność

**Project**:
A body of work that groups Tasks, either a Local project or bound to one Tracker and, optionally, to a Remote project scope within it.
_Polish_: Projekt
_Avoid_: Client, workspace

**Local project**:
A Project bound to no Tracker. Its time is tracked and reported but never exported.
_Polish_: Projekt lokalny

### Trackers and connection

**Tracker**:
The user's connection to one OpenProject or Redmine instance: its address, whether the browser may reach it directly, and its Rounding rule. Projects bind to it, and their time is exported to it.
_Polish_: Tracker
_Avoid_: Integration, connection, server, instance
_Polish avoid_: Integracja, serwer

**API key**:
The user's secret for one Tracker. It lives only in the user's browser and never reaches the server; without it nothing can be read from or sent to the Tracker.
_Polish_: Klucz API
_Avoid_: API secret, token, password
_Polish avoid_: Hasło, token

**Direct browser access**:
Whether the browser may call a Tracker straight from the Time Tracker App. Some installations block that, and their Tracker then needs the Browser extension.
_Polish_: Bezpośrednie połączenie z przeglądarki
_Avoid_: CORS, direct mode, client transport

**Browser extension**:
The OSI extension for Chrome and Edge that makes Tracker calls through the user's browser for Trackers without Direct browser access. It acts only for a Time Tracker App and a Tracker URL the user approved in it.
_Polish_: Rozszerzenie
_Avoid_: Plugin, add-on, proxy
_Polish avoid_: Wtyczka, dodatek

**Time Tracker App**:
An installation of OSI Time Tracker, known by its address. The Browser extension contacts a Tracker only for a Time Tracker App the user approved in it.
_Polish_: Time Tracker App
_Avoid_: Website, site, origin
_Polish avoid_: Witryna, strona

**Tracker URL**:
A Tracker's address (its type, origin and base path) as the user approved it in the Browser extension for one Time Tracker App. The extension contacts no other address.
_Polish_: URL trackera
_Avoid_: Destination, target, host
_Polish avoid_: Cel, miejsce docelowe

**Rounding rule**:
How a Tracker rounds the durations exported to it: not at all, or to the nearest increment. It never rounds a non-zero duration to zero and never changes local Time entries.
_Polish_: Reguła zaokrąglania

### Remote work

**Remote issue**:
An issue in a Tracker (an OpenProject work package, a Redmine issue) that a Task's time is exported against. A Task is linked to at most one; two Tasks with the same name and different Remote issues are different Tasks.
_Polish_: Zgłoszenie
_Avoid_: Work package, ticket
_Polish avoid_: Pakiet roboczy

**Link**:
Connecting a Task to a Remote issue for one day: that day's Time entries move to the Task with that issue, found or created. Unlinking moves them to the same-named Task without an issue.
_Polish_: Połączenie (verb: połączyć)
_Avoid_: Assign, bind, attach

**Remote project**:
A project inside a Tracker, as the Tracker itself organises its issues.
_Polish_: Zdalny projekt

**Remote project scope**:
The Remote project that a Project is narrowed to within its Tracker. Issue search covers it by default, and import sends a Tracker's Remote logs to the Project scoped to their Remote project or its nearest scoped ancestor.
_Polish_: Zakres projektu
_Avoid_: Remote filter, subproject binding

### Exporting and importing

**Remote log**:
A time record in a Tracker: a duration on one day against a Remote issue, with an Activity and a comment. Export creates one; the user may also have entered it in the Tracker directly.
_Polish_: Zdalny wpis
_Avoid_: Remote entry, remote time entry, tracker entry, time log
_Polish avoid_: Wpis (on its own), log

**Activity**:
The Tracker's classification of work (such as development or a meeting) that every exported Remote log needs. Its options come from the Tracker.
_Polish_: Czynność
_Avoid_: Category, work type
_Polish avoid_: Aktywność, kategoria

**Export**:
Sending a Task's whole day of completed Time entries to its Tracker as one Remote log on the Task's Remote issue. It never locks those entries or the Task, and a day already exported is not exported again.
_Polish_: Eksport (verb: eksportować)
_Avoid_: Push, upload, sync
_Polish avoid_: Wypchnięcie

**Export record**:
The local record that a Task's day is in its Tracker as a given Remote log, made by Export, by matching a Remote log, or by Import. A Task's day with one is Sent.
_Polish_: Zapis eksportu (a term for code and docs only; the UI shows the state, Wysłane)
_Avoid_: Provenance, export provenance, lock

**Matched remote log**:
A Remote log of the day that has an Export record. An Unmatched remote log has none; the user can match it to a Task's day or leave it alone.
_Polish_: Powiązany zdalny wpis (verb: powiązać)
_Avoid_: Linked remote log

**Reconciliation**:
Bringing the day's Remote logs and Export records into agreement: matching an Unmatched remote log to a Task's day without writing to the Tracker, or deleting a Matched remote log together with its Export record.
_Polish_: Uzgadnianie

**Import**:
Backfilling local history from a Tracker: each Remote log of a period becomes a Task, a stopped Time entry and an Export record in the Project its Remote project scope points to. It never writes to the Tracker, and importing twice adds nothing.
_Polish_: Import historii
_Avoid_: Pull, backfill, sync

**Remote Sync**:
The per-day page where the day's Tasks are reviewed, linked and exported, with that day's Remote logs alongside.
_Polish_: Synchronizacja zdalna
_Avoid_: Sync page, export page

**Tracked time**:
The sum of a Task's completed Time entries on one day.
_Polish_: Czas zarejestrowany

**Export duration**:
What goes out for a Task's day: its Tracked time after the Rounding rule, editable before Export. Zero leaves the Task out.
_Polish_: Czas do eksportu
_Avoid_: To send, rounded duration

**Export comment**:
The note sent with a Task's Remote log. It defaults to the comment of the issue's latest Remote log, else the Task's name, and never renames the Task.
_Polish_: Komentarz eksportu
_Avoid_: Title to send

**Export backlog**:
The past days on which a Task has Tracked time in a Project with an active Tracker and no Export record: time not yet Sent.
_Polish_: Zaległy eksport
_Avoid_: Pending sync, unsynced time, export queue
_Polish avoid_: Kolejka eksportu

### Reports

**Dashboard**:
The page that sums up the user's local Time entries and Export records over a period. It never contacts a Tracker.
_Polish_: Pulpit
_Avoid_: Home, overview, statistics
_Polish avoid_: Dashboard, kokpit

**Monthly timesheet**:
A month's local Time entries side by side with the Remote logs on the user's Trackers, per day. Remote hours split into Exported (Matched remote logs) and Direct (Unmatched remote logs).
_Polish_: Zestawienie miesięczne
_Avoid_: Monthly report, timesheet report

**Client report**:
A monthly PDF for one client, built only from the Remote logs on the Trackers of its Report preset, never from local Time entries.
_Polish_: Raport dla klienta
_Avoid_: Invoice, timesheet PDF
_Polish avoid_: Faktura

**Report preset**:
A saved setup for a Client report: the client's name, its Trackers, the hours format, the PDF language and the Contractor details.
_Polish_: Szablon raportu
_Avoid_: Template, profile
_Polish avoid_: Preset

**Contractor details**:
The user's own details (such as company name and tax ID) printed on a Client report's title page.
_Polish_: Dane wykonawcy
_Avoid_: Company info, seller details
_Polish avoid_: Dane firmy, dane sprzedawcy

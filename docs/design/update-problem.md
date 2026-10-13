# Update problem, versions, verify and publish (GRD-119)

Status: **designed by Claude in session, to be reviewed by Kanon.** Claude Design was not available, so this page
copies the structure of Create Problem and reuses Verdale components only (no new component, no raw colour).
Desktop first, wide container; phones stack the same blocks. Core decides the real outcome; the page only predicts.

## 1. The update page (published problem, route `/spaces/<slug>/problems/<problem>/edit`)

Same zones as Create Problem: header (title, slug, version), Details, Statement with live preview, then the bar.

```
 team / sum                                   [ View as solver ]
 Sum of two numbers
 [Published] [v2.1]
 ---------------------------------------------------------------
 Statement | Testcases 12 | Solutions 2 | History          <- TabNav
 ---------------------------------------------------------------
 (Banner info) Solvers use v2.1 now. Edits wait for Save.
 ---------------------------------------------------------------
 This save will be:  [ Minor ]  (expected)      Changes: Title, Statement
                     [ Major ]  (expected)      Makes it Major: Time limit, Languages
 [ ] Force major update
     Creates a draft of the next Major even when only Minor fields changed.
     It has to pass verification before solvers get it.
 ---------------------------------------------------------------
 Details       Title [..........]   Slug [sum] (locked)
               Time limit [1000]    Memory [256]   Languages [x] C [x] C++ [ ] Python
 Statement     Markdown | preview
 ---------------------------------------------------------------
 (UnsavedBar, sticky)  3 unsaved changes        [Discard] [Save as Minor update]
```

1. **Expected-type chip** (`Badge`): "Minor update" (info tone) or "Major update" (warning tone), always with the word
   "expected" and an icon. Under it, the list of changed fields that make it Major, taken from
   `constraints.version_fields.major`. With nothing changed: "No changes yet". The chip text is never a promise:
   when Core answers with another type, the Toast and the page follow Core.
2. **Force major update** (`Checkbox`, default off, `description` explains it). When a Major field already changed the
   box is shown checked and disabled with the note "Already a Major update because of: ...". It is not remembered
   after Save (Core does not remember it either). Observers do not see it.
3. **Save label** follows the expected type: "Save as Minor update" / "Save as Major draft". One primary button per view.
4. **Slug** is shown locked (disabled `TextField`), as on the editor.
5. **Tests and reference solutions** are not on this form: they are always Major. The Testcases and Solutions tabs of a
   published problem show a `Banner` "Tests and solutions can only change in a Major draft" with **Start a Major draft**.

## 2. Version label

`vMajor.Minor` (`Badge`) next to the status badge in: the problem page header, the editor header, the update page,
the problem list, the solving page and the submission tables (the Major a submission was sent to). The first publish is v1.0.

## 3. History tab (`.../edit/history`)

Not a diff of every field. One row per event, newest first, with the page's `Pagination`.

```
 When        Version  Type             Who      Fields
 2 min ago   v2.2     Minor update     Edith    Title, Statement      [v]
 yesterday   v3.0     Major draft      Ming     Time limit  (Forced)  [v]
 yesterday   v3.0     Verified         Ming     draft -> verified
   expanded: Time limit   1000 ms  ->  2000 ms
```

Columns: version, type (Minor / Major, `Badge`), "Forced" mark when Major only because of Force major update, who,
when, fields changed. Expanding a row (a disclosure button) shows old and new value per field. State changes (draft,
verifying, verified, published) are single lines "draft -> verified". Visible to owner, administrator, editor and
observer; solvers do not get the tab. Observer: view only anyway.

## 4. Verify and publish (draft, including a Major draft)

```
 Before you publish (7 of 9 ready)                      [ Verify ]   [ Publish ] (enabled when can_publish)
  v statement  v languages  v limits  v samples  v tests  v hidden tests  v outputs  v solution  o verified
 Verification: Running 4 of 12 tests ...  (polls every 2 s)
 Result failed: Test 4 (hidden) WA - slowest 812 ms - peak 64 MB   [table of tests]
```

States: not verified (Verify enabled when the cheap checks pass), **verifying** (progress, edits paused, notice),
**verified** (green, Publish enabled, an edit moves it back to draft), **failed or error** (`Banner` danger: reason,
failing tests with verdict `VerdictBadge`, hidden ones marked "Hidden"). Slowest time and peak memory are always shown
to help choose limits. Publish opens a `Dialog` confirm that names the version. Status badge of the version
(Draft, Verifying, Verified, Published, Archived) + label sits in the editor header and the problem list.

## 5. Other states

- **Major draft open**: a `Banner` (brand/info) on every tab: "Solvers use v2.1. You are editing the draft v3.0",
  link to the open version, **Discard draft** (`Dialog` confirm: the open version is untouched). While verifying, Discard is disabled.
- **Edit conflict** (`VERSION_CONFLICT`): `Banner` danger "Someone changed this problem. It is now v2.3." with
  **Reload**. Reload fetches the open version and keeps what you typed; fields that changed meanwhile are listed
  ("Also changed by someone else: Title") so you can decide. Nothing is overwritten silently.
- **Observer**: everything visible, fields disabled, no Save, no Force major, no Verify / Publish / Start / Discard,
  one line "You can read this as an observer".
- **Space archived / problem archived**: read-only, as today.

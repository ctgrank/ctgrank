# PCM rank data — what to supply

The PCM checker ranks students by their Physics, Chemistry and Higher Math
marks. Chattogram HSC 2026 Science is already loaded. The other ten boards
show as "not loaded yet" until their data lands here.

Drop one JSON file per board into `sources/`, then run:

```bash
python3 tools/build_pcm.py          # compile
python3 tools/build_pcm_page.py     # regenerate the page (only if the HTML changed)
```

The page reads `index.json`, so a new board appears the moment it is compiled —
no code changes.

## The file

`sources/dhaka.json` (name it anything ending in `.json`):

```json
{
  "board": "dhaka",
  "exam": "HSC",
  "year": 2026,
  "group": "Science",
  "kind": "records",
  "students": [
    {
      "roll": 1234567,
      "name": "FULL NAME IN CAPITALS",
      "gpa": 5.00,
      "physics": 183,
      "chemistry": 162,
      "math": 186,
      "english": 150,
      "biology": 171
    }
  ]
}
```

| field | required | notes |
|---|---|---|
| `board` | yes | one of `dhaka`, `rajshahi`, `cumilla`, `chattogram`, `barishal`, `sylhet`, `dinajpur`, `jashore`, `mymensingh`, `madrasah`, `technical` |
| `exam` | yes | `HSC` or `SSC` |
| `year` | yes | e.g. `2026` |
| `group` | yes | `Science`, `Commerce` or `Arts` |
| `students[].roll` | yes | digits only; unique within the board |
| `students[].gpa` | yes | `5.00` or `500` — both accepted |
| `students[].name` | no | shown to confirm the right student |
| `students[].physics` etc. | — | raw marks out of `full` (default 200) |

**Missing marks:** omit the key or use `null` for a subject the student did not
take. Those students simply don't qualify for the categories that need it —
they are not dropped from PCM ALL.

**Rejected rows:** a row with no usable `roll` or `gpa` is dropped and counted
in the build output. Duplicate rolls keep the first and drop the rest.

## Reusing a dataset already on the site

If the marks already live in `data/<id>.json` (the format the rank lists use),
point at it instead of repeating every student:

```json
{
  "board": "chattogram",
  "exam": "HSC", "year": 2026, "group": "Science",
  "kind": "dataset",
  "dataset": "hsc_2026_science"
}
```

That is exactly what `sources/chattogram.json` does.

## What the build needs from a board

Physics, Chemistry, Higher Math, English, Biology marks and the overall GPA.
English and Biology are only needed for the KUET/BUTEX and BME categories —
a board without them still works, it just makes those categories unavailable
for its students.

## Merit rules

The rules deliberately do not live in the build script. Eligibility gates and
tie-break order are defined once, in `assets/pcm.js`, at the top of the
`CATS` array — one entry per category, each with its `spec` (sort order) and
`requires` (gate). Change a requirement there and both the ranking and the
displayed reason follow.

## Privacy

The compiled file is public, like every other list on the site: roll, name,
GPA and the five subject marks. Nothing else is stored — no registration
numbers, no institution, no contact details.

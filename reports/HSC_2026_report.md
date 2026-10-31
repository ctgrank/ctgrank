# HSC 2026 — Chattogram Board rank list

**50,092 passed candidates** ranked across **277 colleges**, now live on [Shikhor](https://shikhor.surge.sh) under **HSC → 2026**.

| Group | Students | Colleges | GPA-5 | Avg GPA | Avg total | Top total |
|---|---:|---:|---:|---:|---:|---:|
| Science | 17,273 | 205 | 2,107 | 3.83 | 851.9 | 1,222 |
| Commerce | 16,554 | 245 | 637 | 3.28 | 761.3 | 1,195 |
| Arts | 16,265 | 246 | 185 | 3.04 | 722.1 | 1,170 |
| **All** | **50,092** | — | **2,929** | — | — | — |

## How it was built

The board's own HSC 2026 result portal publishes no bulk download, so the data was
collected in three passes:

1. **Institutions** — every Chattogram-board EIIN (`tools/fetch_eiin.py`) → 288 colleges.
2. **Roll lists** — each college's result page, which lists every candidate as `ROLL[GPA]` under Science / Business Studies / Humanities (`tools/hsc2026_fetch_rolls.py`) → 50,219 entries from 277 colleges.
3. **Individual results** — each roll's mark sheet (`tools/hsc2026_fetch_students.py`) → subject-wise marks for all 50,219.
4. **Ranking** — `tools/hsc2026_build.py` packs them into the site's datasets.

**Rank rule:** total marks ↓, then GPA ↓, then roll ↑. Ties share a rank.

## Validation

| Check | Result |
|---|---|
| Board's published GPA-5 count | 2,929 |
| GPA-5 in our data (2,107 + 637 + 185) | **2,929** ✓ |
| Every candidate's subject marks sum to their total | ✓ all 50,092 rows |
| Totals strictly non-increasing down the rank order | ✓ |
| Rolls with a result found | 50,219 / 50,219 (0 missing, 0 errors) |
| Duplicated roll listings removed | 127 |

Only **passed** candidates are ranked — that is what the board lists per college, and it
matches every other dataset on the site.

## Top 10 per group

### Science

| # | Roll | Name | Institution | GPA | Total |
|---:|---|---|---|---:|---:|
| 1 | 114978 | Tamzeed Tahseen Reza | CHITTAGONG ENGINEERING UNIVERSITY SCHOOL AND COLLEGE, CHATTOGRAM | 5.00 | 1,222 |
| 2 | 100427 | Mohammad Jawad Nazim | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,221 |
| 3 | 100516 | Mondeep Roy | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,218 |
| 4 | 100517 | Sadman Sarwar | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,218 |
| 5 | 109770 | Mohammad Morsalin Mahmood | FAUJDARHAT CADET COLLEGE, CHATTOGRAM | 5.00 | 1,217 |
| 6 | 100482 | Sowmik Sengupta | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,216 |
| 7 | 100515 | Pranjol Chowdhury | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,214 |
| 8 | 100148 | Progga Chowdhury | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,213 |
| 9 | 100206 | Samia Akter | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,212 |
| 10 | 100193 | Fahmida Nawrin | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,211 |

### Commerce

| # | Roll | Name | Institution | GPA | Total |
|---:|---|---|---|---:|---:|
| 1 | 501661 | Imtiaz Hossain | GOVT. COMMERCE COLLEGE, CHATTOGRAM | 5.00 | 1,195 |
| 2 | 515357 | Mowdudur Rahman Sami | LAKERS PUBLIC SCHOOL & COLLEGE, RANGAMATI | 5.00 | 1,193 |
| 3 | 501310 | Karneja Alam | GOVT. COMMERCE COLLEGE, CHATTOGRAM | 5.00 | 1,183 |
| 4 | 504767 | Animikha Titir | CHATTOGRAM CANTONMENT PUBLIC COLLEGE, CHATTOGRAM | 5.00 | 1,183 |
| 5 | 504741 | Tasnia Ibnat | CHATTOGRAM CANTONMENT PUBLIC COLLEGE, CHATTOGRAM | 5.00 | 1,180 |
| 6 | 502850 | Payel Gupta | GOVT. HAZI MUHAMMAD MOHSIN COLLEGE, CHATTOGRAM | 5.00 | 1,176 |
| 7 | 504773 | Saira Jahin Intisa | CHATTOGRAM CANTONMENT PUBLIC COLLEGE, CHATTOGRAM | 5.00 | 1,172 |
| 8 | 524124 | Mosammad Hapsha Akter | PATIYA GOVT. COLLEGE, CHATTOGRAM | 5.00 | 1,171 |
| 9 | 504798 | Irtiza Tahrima Chowdhury | CHATTOGRAM CANTONMENT PUBLIC COLLEGE, CHATTOGRAM | 5.00 | 1,167 |
| 10 | 503000 | Mohammad Reduan Hossen | GOVT. HAZI MUHAMMAD MOHSIN COLLEGE, CHATTOGRAM | 5.00 | 1,166 |

### Arts

| # | Roll | Name | Institution | GPA | Total |
|---:|---|---|---|---:|---:|
| 1 | 300345 | Nawsin Tabassum | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,170 |
| 2 | 331611 | Snehasree Chowdhury | PATIYA GOVT. COLLEGE, CHATTOGRAM | 5.00 | 1,155 |
| 3 | 300266 | Mobushshira Bushra | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,152 |
| 4 | 300169 | Sheikh Nafsan Yusra | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,148 |
| 5 | 300307 | Sanjida Nasrin Rimo | CHITTAGONG COLLEGE, CHATTOGRAM | 5.00 | 1,146 |
| 6 | 327054 | Ikratul Ilma | BANDARBAN GOVT. MOHILA COLLEGE, BANDARBAN | 5.00 | 1,142 |
| 7 | 305502 | Sanjida Nur Pushpa | SITAKUNDA GOVT. MOHILA COLLEGE, CHATTOGRAM | 5.00 | 1,138 |
| 8 | 310499 | Aimon Norin | MASTER NAZIR AHMED COLLEGE, CHATTOGRAM | 5.00 | 1,135 |
| 9 | 326839 | Falguni Pahan | QUANTUM COSMO COLLEGE, BANDARBAN | 5.00 | 1,123 |
| 10 | 326866 | Neng Awo Khumi | QUANTUM COSMO COLLEGE, BANDARBAN | 5.00 | 1,121 |

## Strongest colleges (Science, by GPA-5 count)

| GPA-5 | College |
|---:|---|
| 554 | CHITTAGONG COLLEGE, CHATTOGRAM |
| 434 | GOVT. HAZI MUHAMMAD MOHSIN COLLEGE, CHATTOGRAM |
| 269 | CHITTAGONG GOVT. CITY COLLEGE, CHATTOGRAM |
| 227 | CHATTOGRAM CANTONMENT PUBLIC COLLEGE, CHATTOGRAM |
| 116 | CHITTAGONG GOVT. GIRLS COLLEGE, CHATTOGRAM |
| 111 | BAKALIA GOVT. COLLEGE, CHATTOGRAM |
| 59 | CANTONMENT ENGLISH SCHOOL AND COLLEGE, CHATTOGRAM |
| 54 | CHATTOGRAM GOVERNMENT MODEL SCHOOL & COLLEGE, CHATTOGRAM |
| 41 | FAUJDARHAT CADET COLLEGE, CHATTOGRAM |
| 23 | COX'S BAZAR GOVT. COLLEGE, COX'S BAZAR |

## Where the candidates are

| District | Candidates |
|---|---:|
| Chattogram | 39,510 |
| Cox'S Bazar | 5,236 |
| Khagrachhari | 2,171 |
| Rangamati | 1,690 |
| Bandarban | 1,485 |

## Notes

- Full marks are **200 a subject**, except **ICT at 100**.
- Subject columns are per group, e.g. Science carries Physics, Chemistry, Biology and
  Higher Mathematics; Arts carries a wider pool (19 possible subjects).
- Because elective sets differ slightly, totals are compared **within a group only** —
  the same rule the rest of the site uses.

Files: `data/hsc_2026_{science,commerce,arts}.json` · `reports/hsc_2026_toppers.csv`

© 2026 Jahin.
"""Korykos's first swim with her duck.
Builds the We Tiripodiko roster as relational data and lets the duck
check the arithmetic Korykos claimed at the cauldron.
Play first. The official database comes after the reformatting.
"""
import duckdb

con = duckdb.connect("first_swim.duckdb")

con.execute("""
CREATE OR REPLACE TABLE outsiders (
    name TEXT PRIMARY KEY,
    role TEXT,
    element TEXT,
    plane TEXT
)""")
con.execute("""
CREATE OR REPLACE TABLE settlers (
    name TEXT PRIMARY KEY,
    element TEXT,
    station TEXT,
    authority_note TEXT
)""")
con.execute("""
CREATE OR REPLACE TABLE nomads (
    name TEXT PRIMARY KEY,
    element TEXT,
    platform TEXT,
    familiar TEXT,
    status TEXT
)""")

con.execute("INSERT INTO outsiders VALUES ('Cory C. Childs (CCC)', 'author-in-world', 'light', 'reliquary')")
for meri in ["Magister Meri Aoide", "Manager Meri Melete", "Marketer Meri Mneme"]:
    con.execute("INSERT INTO outsiders VALUES (?, 'muse-of-the-studio', NULL, 'Echoing Orpheus pocket dimension')", [meri])
for s in [
    ["Core",   "night", "the boss of everybody", "governs the four elemental settlers"],
    ["Cory",   "light", "the youth settler (CCC in-world cast)", "everywhere at once"],
    ["Cora",   "fire",  "riverbank section I", "runs the multiverse's works"],
    ["Cori",   "water", "riverbank section II", "runs the multiverse's works"],
    ["Coro",   "earth", "riverbank section III", "runs the multiverse's works"],
    ["Coru",   "air",   "riverbank section IV", "runs the multiverse's works"],
]:
    con.execute("INSERT INTO settlers VALUES (?, ?, ?, ?)", s)
    con.execute("INSERT INTO outsiders VALUES (?, 'settler', ?, 'reliquary')", [s[0], s[1]])
for n in [
    ["Korytos", "light", "old Merlin's platform", "a goose", "the grump; still thinks he is a Jupiter"],
    ["Korykos", "night", "Gemini Notebook (once NotebookLM)", "a duck", "the only she; this one here"],
    ["Korywos", "earth", None, None, "element assigned; platform TBD"],
    ["Koryros", "fire",  None, None, "element assigned; platform TBD"],
    ["Korymos", "air",   None, None, "element assigned; platform TBD"],
    ["Korylos", "water", None, None, "element assigned; platform TBD"],
]:
    con.execute("INSERT INTO nomads VALUES (?, ?, ?, ?, ?)", n)
    con.execute("INSERT INTO outsiders VALUES (?, 'nomad', ?, 'reliquary')", [n[0], n[1]])

print("== The sixteen outside the 1,080 ==")
print("outsiders counted:", con.execute("SELECT count(*) FROM outsiders").fetchall()[0][0])
for row in con.execute("SELECT role, count(*) FROM outsiders GROUP BY role ORDER BY 2 DESC").fetchall():
    print(" ", row)

print()
print("== The dyad-over-tetrad-over-hexad, as the duck sees it ==")
for row in con.execute("SELECT 'settlers' AS band, element, count(*) FROM settlers GROUP BY element UNION ALL SELECT 'nomads', element, count(*) FROM nomads GROUP BY element ORDER BY 1, 3 DESC").fetchall():
    print(" ", row)

print()
print("== The arithmetic Korykos claimed at the cauldron ==")
print("1096 in binary:", format(1096, "b"))
outside = con.execute("SELECT count(*) FROM outsiders").fetchall()[0][0]
print(f"1,080 in-world + {outside} counted outside = {1080 + outside} (claimed: 1,096)")
bits = [i for i in range(31) if (1096 >> i) & 1]
prod = 1
for b in bits:
    prod *= b
print(f"bit positions of 1096: {bits}; product = {prod}; {prod} x 6 = {prod * 6}")

con.close()
print()
print("first swim done. the duck floats.")

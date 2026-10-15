"""Compile explicitly reviewed sequence alternatives to the existing flat model.

Only publication-bound profiles invoke these transformations. Original templates
and mappings remain attached to the result for review.
"""
import copy
from itertools import product


def apply_template_rules(assets, mappings, profile, label_for, options_for, status_for, notes_for):
    assets, mappings = copy.deepcopy(assets), copy.deepcopy(mappings)
    by_cell = {m["templateCellId"]: m["articulation"] for m in mappings}
    consumed = set()
    added = []
    changes = []

    def composite(rows, alternatives, identity):
        cells = []
        for row in rows:
            if len(row["cells"]) != 1 or row.get("attributes"):
                raise ValueError("Reviewed sequence has multi-cell rows or row instructions")
            cell = row["cells"][0]
            if cell.get("requisites"):
                raise ValueError("Reviewed sequence has receiving prerequisites")
            cells.append(cell)
        covered = {i for alternative in alternatives for i in alternative}
        if covered != set(range(len(cells))) or any(not a for a in alternatives):
            raise ValueError("Reviewed alternatives must cover every source row")
        branches, sending_options, notes, states = [], [], [], []
        for indices in alternatives:
            if len(set(indices)) != len(indices):
                raise ValueError("A reviewed sequence contains duplicate rows")
            chosen = [cells[i] for i in indices]
            branches.append(" AND ".join(label_for(cell) for cell in chosen))
            option_sets = []
            for cell in chosen:
                articulation = by_cell.get(cell["id"])
                status = status_for(articulation)
                if status == "partial":
                    raise ValueError("Partial sequence options need per-option completion statuses")
                states.append(status)
                option_sets.append([o["courses"] for o in options_for(articulation)])
                notes.extend(f"{label_for(cell)}: {note}" for note in notes_for(articulation))
            if all(option_sets):
                if len(sending_options) + _product_size(option_sets) > 512:
                    raise ValueError("Reviewed composite would produce more than 512 options")
                for combination in product(*option_sets):
                    codes = list(dict.fromkeys(code for option in combination for code in option))
                    if codes not in sending_options:
                        sending_options.append(codes)
        consumed.update(cell["id"] for cell in cells)
        text = " OR ".join(f"({branch})" if len(alternatives) > 1 else branch for branch in branches)
        sending = {
            "items": [{"position": n, "type": "CourseGroup", "courseConjunction": "And",
                       "items": [{"position": i, "type": "Course", "course": {
                           "prefix": code.rsplit(" ", 1)[0], "courseNumber": code.rsplit(" ", 1)[1]}}
                           for i, code in enumerate(codes)]}
                      for n, codes in enumerate(sending_options)],
            "courseGroupConjunctions": [{"groupConjunction": "Or", "sendingCourseGroupBeginPosition": n - 1,
                                          "sendingCourseGroupEndPosition": n}
                                         for n in range(1, len(sending_options))],
            "attributes": [{"position": i, "content": note} for i, note in enumerate(dict.fromkeys(notes))]
        }
        if not sending_options and states and all(s == "university_only" for s in states):
            sending["noArticulationReason"] = "This course must be taken at the university after transfer"
        added.append({"templateCellId": identity, "articulation": {"sendingArticulation": sending}})
        return {"position": 0, "attributes": [], "cells": [{
            "position": 0, "id": identity, "type": "Requirement", "requirement": {"name": text}
        }]}

    groups = {a["position"]: a for a in assets if a["type"] == "RequirementGroup" and a["area"] == "Requirements"}
    for rule in profile.get("sequence_rules", []):
        group = groups[rule["group_position"]]
        section = next(s for s in group["sections"] if s["position"] == rule["section_position"])
        rows = sorted(section["rows"], key=lambda row: row["position"])
        actual = [label_for(row["cells"][0]) for row in rows]
        if actual != rule["expected_rows"]:
            raise ValueError("Reviewed sequence rows changed")
        changes.append({"rule": rule, "original_section": copy.deepcopy(section)})
        section["rows"] = [composite(rows, rule["alternatives"],
                                      f"reviewed-sequence-{group['position']}-{section['position']}")]
        section["advisements"] = []

    for position in profile.get("or_group_rules", []):
        group = groups[position]
        sections = sorted((s for s in group["sections"] if s["type"] == "Section"), key=lambda s: s["position"])
        if any(s.get("attributes") for s in sections):
            raise ValueError("Reviewed OR branches have additional notes")
        rows, alternatives = [], []
        for section in sections:
            members = sorted(section["rows"], key=lambda row: row["position"])
            advice = section.get("advisements", [])
            if advice and not (len(advice) == 1 and advice[0].get("amount") in {1, len(members)}
                               and advice[0].get("amountUnitType") in {"Course", "Series"}):
                raise ValueError("Reviewed OR branch does not require all its rows")
            if advice and advice[0].get("amountUnitType") == "Course" and advice[0]["amount"] != len(members):
                raise ValueError("Reviewed OR branch needs a course subset")
            alternatives.append(list(range(len(rows), len(rows) + len(members))))
            rows.extend(members)
        changes.append({"rule": "or_group", "original_group": copy.deepcopy(group)})
        group["sections"] = [{"position": 0, "type": "Section", "attributes": [], "advisements": [],
                              "rows": [composite(rows, alternatives, f"reviewed-or-{position}")]}]
        group["instruction"] = None
        group["showConjunctionBetweenSections"] = False

    for position in profile.get("independent_sections", []):
        group = groups[position]
        if group.get("instruction") is not None:
            raise ValueError("Independent section rule expected an absent instruction")
        changes.append({"rule": "independent_sections", "original_group": copy.deepcopy(group)})
        group["instruction"] = {"type": "Conjunction", "conjunction": "And", "selectionType": "Complete"}
    if changes:
        changes.append({"original_articulations": mappings})
    return assets, [m for m in mappings if m["templateCellId"] not in consumed] + added, changes


def _product_size(options):
    size = 1
    for choices in options:
        size *= len(choices)
    return size

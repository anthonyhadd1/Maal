#!/usr/bin/env python3
"""End-to-end smoke test against a running ACE backend (stdlib only).

Exercises the full game loop over HTTP:
register -> subjects -> map -> start attempt -> answer every question ->
complete -> player state -> league -> mistakes practice.

Usage: python scripts/e2e_smoke.py [base_url]   (default http://localhost:8000/api/v1)
Exits non-zero on first failure. Safe to run repeatedly (fresh random user each run).
"""
import json
import random
import string
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api/v1").rstrip("/")
TOKEN = None
PASSED = 0


def call(method: str, path: str, body: dict | None = None, expect: int = 200):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req) as resp:
            status, payload = resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read().decode(errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw[:300]}
    if status != expect:
        fail(f"{method} {path} -> {status} (expected {expect}): {json.dumps(payload)[:300]}")
    return payload


def ok(msg: str):
    global PASSED
    PASSED += 1
    print(f"  ok  {msg}")


def fail(msg: str):
    print(f" FAIL {msg}")
    sys.exit(1)


def main():
    global TOKEN
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    username = f"smoke_{suffix}"

    print(f"e2e smoke against {BASE}")

    # --- auth ---
    reg = call("POST", "/auth/register/", {"username": username, "password": "Sm0ke!pass", "display_name": "Smoke"}, expect=201)
    TOKEN = reg["tokens"]["access"]
    ok(f"register {username}")
    me = call("GET", "/me/")
    assert me["username"] == username
    ok("GET /me/")

    # --- tracks ---
    tracks = call("GET", "/tracks/")
    if len(tracks) != 2:
        fail(f"expected 2 tracks (concours, specialite), got {len(tracks)}")
    ok(f"{len(tracks)} tracks: {[t['slug'] for t in tracks]}")

    specialite = call("GET", "/subjects/?track=specialite")
    if "years" not in specialite or specialite.get("track") != "specialite":
        fail("subjects?track=specialite did not return the tiered shape")
    years = specialite["years"]
    if len(years) != 1:
        fail(f"expected 1 program year for specialite, got {len(years)}")
    total_specialite_subjects = sum(len(sem["subjects"]) for y in years for sem in y["semesters"])
    if total_specialite_subjects != 12:
        fail(f"expected 12 total subjects across specialite semesters, got {total_specialite_subjects}")
    ok(f"subjects?track=specialite: 1 year, {len(years[0]['semesters'])} semesters, {total_specialite_subjects} subjects")

    # --- content ---
    subjects = call("GET", "/subjects/")
    if not subjects:
        fail("no subjects — is DEMO_SEED=1?")
    ok(f"{len(subjects)} subjects")
    slug = subjects[0]["slug"]
    game_map = call("GET", f"/subjects/{slug}/map/")
    units = game_map["units"]
    levels = [lvl for u in units for lvl in u["levels"]]
    unlocked = [lvl for lvl in levels if lvl["status"] == "unlocked"]
    if not unlocked:
        fail("map has no unlocked level")
    level = unlocked[0]
    ok(f"map {slug}: {len(units)} units / {len(levels)} levels, level {level['id']} unlocked")

    # --- attempt loop ---
    start = call("POST", f"/levels/{level['id']}/attempts/", {}, expect=201)
    attempt_id, questions = start["attempt_id"], start["questions"]
    if any("is_correct" in c for q in questions for c in q["choices"]):
        fail("SECURITY: is_correct leaked in start payload")
    ok(f"attempt {attempt_id} started, {len(questions)} questions, answers not leaked")

    correct_count = 0
    for q in questions:
        answer = call(
            "POST",
            f"/attempts/{attempt_id}/answers/",
            {"question_id": q["id"], "selected_choice_ids": [q["choices"][0]["id"]], "time_ms": 1500},
        )
        assert "is_correct" in answer and "correct_choice_ids" in answer
        correct_count += bool(answer["is_correct"])
    ok(f"answered {len(questions)} questions ({correct_count} correct picking first choice)")

    result = call("POST", f"/attempts/{attempt_id}/complete/", {})
    for key in ("score_pct", "stars", "xp", "hearts", "streak"):
        assert key in result, f"missing {key} in complete payload"
    ok(f"complete: {result['score_pct']}% -> {result['stars']} stars, +{result['xp']['total']} XP")

    # double-complete must be rejected
    call("POST", f"/attempts/{attempt_id}/complete/", {}, expect=409)
    ok("double-complete rejected (409)")

    # --- gamification ---
    game = call("GET", "/me/game/")
    assert game["xp_total"] >= result["xp"]["total"]
    ok(f"player state: {game['xp_total']} XP, {game['hearts']} hearts, streak {game['streak_current']}")
    league = call("GET", "/league/")
    assert any(row.get("is_me") for row in league["rows"]), "user missing from own league"
    ok(f"league: tier {league['tier']['name']}, {len(league['rows'])} rows")

    # --- practice (only meaningful if we made mistakes) ---
    mistakes = call("GET", "/practice/mistakes/")
    ok(f"mistakes queue: {len(mistakes['questions'])} due")

    print(f"\nALL {PASSED} CHECKS PASSED")


if __name__ == "__main__":
    main()

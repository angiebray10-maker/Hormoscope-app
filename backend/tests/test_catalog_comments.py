"""Standalone verification for the Gift Catalog community wall
(Angelita, Oct 31, 2026): ONE public comment area at the bottom
of the Gift Catalog instead of a review on every product. The
women comment on which items they tried and liked and leave
suggestions of what they would like to see; Angelita finds the
suggested items.

Proven here:
(a) posting stores the comment trimmed, with only her first
    name, and returns the created comment;
(b) the list comes back latest first and caps at 100;
(c) the author can delete her own comment;
(d) nobody can delete another woman's comment (403, and the
    comment stays), and a missing comment is a 404;
(e) empty, whitespace-only and over-500-character texts are
    rejected; exactly 500 characters is accepted.

Runs server.py against in-memory fake collections. No network,
no real Mongo.
"""
import os, sys, asyncio

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))
import server
from fastapi import HTTPException
from test_v59_log_replace import FakeDB, FakeCollection, OWNER, OTHER


async def call(fn, *args):
    try:
        return ("ok", await fn(*args))
    except HTTPException as e:
        return (e.status_code, e.detail)


async def post(user, text):
    return await call(server.create_catalog_comment,
                      server.CatalogCommentCreate(text=text), dict(user))


async def main():
    results = []

    def check(name, ok):
        results.append((name, bool(ok)))

    db = FakeDB()
    db.catalog_comments = FakeCollection()
    server.db = db

    # --- (a) post: shape, trimming, first name only.
    code, created = await post(OWNER, "  The tulips lasted two weeks!  ")
    check("post ok", code == "ok")
    check("post returns an id", bool(created.get("id")))
    check("text is stored trimmed",
          created.get("text") == "The tulips lasted two weeks!")
    check("only her first name is carried",
          created.get("name") == "Olivia")
    check("created_at is set", bool(created.get("created_at")))
    check("the comment is in storage",
          len(db.catalog_comments.docs) == 1)

    # A user with no name on file falls back like the devotional
    # comments do.
    code, anon = await post({"id": "u-anon", "email": "a@example.com"},
                            "Please find a good heating pad")
    check("nameless user posts as 'A sister'",
          code == "ok" and anon.get("name") == "A sister")

    # --- (b) list order: seed known timestamps directly, since
    # endpoint posts share a clock.
    db.catalog_comments = FakeCollection([
        {"id": "c-old", "user_id": OWNER["id"], "name": "Olivia",
         "text": "oldest", "created_at": "2026-10-01T10:00:00+00:00"},
        {"id": "c-new", "user_id": OTHER["id"], "name": "Oona",
         "text": "newest", "created_at": "2026-10-31T10:00:00+00:00"},
        {"id": "c-mid", "user_id": OWNER["id"], "name": "Olivia",
         "text": "middle", "created_at": "2026-10-15T10:00:00+00:00"},
    ])
    server.db = db
    code, listing = await call(server.get_catalog_comments, dict(OTHER))
    texts = [c["text"] for c in listing["comments"]]
    check("list ok for any signed-in user", code == "ok")
    check("list is latest first", texts == ["newest", "middle", "oldest"])
    check("list entries carry id, name, text, created_at",
          all({"id", "name", "text", "created_at"} <= set(c)
              for c in listing["comments"]))

    many = [{"id": f"c-{i:03d}", "user_id": OWNER["id"], "name": "Olivia",
             "text": f"comment {i}",
             "created_at": f"2026-10-{(i % 28) + 1:02d}T10:{i % 60:02d}:00+00:00"}
            for i in range(105)]
    db.catalog_comments = FakeCollection(many)
    code, listing = await call(server.get_catalog_comments, dict(OWNER))
    check("list caps at 100", len(listing["comments"]) == 100)

    # --- (c) + (d) deletes.
    db.catalog_comments = FakeCollection([
        {"id": "c-mine", "user_id": OWNER["id"], "name": "Olivia",
         "text": "mine", "created_at": "2026-10-31T09:00:00+00:00"},
        {"id": "c-hers", "user_id": OTHER["id"], "name": "Oona",
         "text": "hers", "created_at": "2026-10-31T09:30:00+00:00"},
    ])
    code, _ = await call(server.delete_catalog_comment, "c-hers",
                         dict(OWNER))
    check("deleting another woman's comment is refused (403)",
          code == 403)
    check("her comment is still there after the refused delete",
          any(d["id"] == "c-hers" for d in db.catalog_comments.docs))
    code, res = await call(server.delete_catalog_comment, "c-mine",
                           dict(OWNER))
    check("the author can delete her own comment",
          code == "ok" and res.get("message") == "Comment deleted")
    check("her comment is gone",
          not any(d["id"] == "c-mine" for d in db.catalog_comments.docs))
    code, _ = await call(server.delete_catalog_comment, "c-missing",
                         dict(OWNER))
    check("deleting a missing comment is a 404", code == 404)

    # --- (e) validation.
    code, _ = await post(OWNER, "")
    check("empty text is rejected", code == 400)
    code, _ = await post(OWNER, "   \n  ")
    check("whitespace-only text is rejected", code == 400)
    code, _ = await post(OWNER, "x" * 501)
    check("501 characters is rejected", code == 400)
    code, created = await post(OWNER, "x" * 500)
    check("exactly 500 characters is accepted",
          code == "ok" and len(created.get("text") or "") == 500)

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

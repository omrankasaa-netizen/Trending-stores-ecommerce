# Railway data persistence (fixes “categories/data disappear after every deploy”)

## What was happening (root cause)

The store keeps all data (categories, products, orders, settings, users…) in a
single SQLite file (`better-sqlite3`). By default that file is written to
`<repo>/data.db` — i.e. **inside the container’s filesystem**.

Railway containers have an **ephemeral filesystem**: every deploy (and many
restarts) starts from a fresh image, so anything written to the container disk —
including `data.db` and the local `/uploads` folder — is **wiped**. On the next
boot the app re-creates an empty database and re-runs the seed, which is why the
client’s hand-created categories vanished after each deploy.

Seeding itself is **not** the culprit — it is idempotent and only inserts
defaults when a collection is empty (it never overwrites existing rows). The data
loss is purely the ephemeral-disk problem.

## The code fix (already in this PR)

`server/db.js` now reads the database location from an environment variable:

```
DATABASE_PATH   (preferred)   e.g.  /data/data.db
MINIYO_DB_PATH  (legacy alias, still honored)
```

If neither is set it falls back to `<repo>/data.db` for local development.
When the path points at a mounted Volume the code also switches the SQLite
journal mode to `DELETE` (WAL is unreliable on some network-backed volumes).

**Code alone is not enough** — you must attach a persistent Volume in Railway and
point `DATABASE_PATH` at it. Do the manual steps below **once**.

---

## REQUIRED manual Railway steps (do this once)

1. Open your project in the Railway dashboard and select the **backend service**
   (the Node/Express service that runs `npm start`).
2. Go to the **Volumes** tab → **New Volume** (a.k.a. “Add Volume”).
3. Set the **Mount path** to:

   ```
   /data
   ```

   Give it a small size (1 GB is plenty for SQLite + growth). Create it.
4. Go to the service’s **Variables** tab and add:

   | Variable        | Value            |
   | --------------- | ---------------- |
   | `DATABASE_PATH` | `/data/data.db`  |

5. **Deploy / redeploy** the service. On boot you should see a log line like
   `[db] ...` and no crash. The DB now lives on the Volume and survives future
   deploys.

> The parent directory is created automatically, so `/data/data.db` works even
> though only `/data` is the mount point.

### First-deploy note (migrating existing data)

The Volume starts empty, so the **first** deploy after mounting it will seed the
default categories/products again. Any data created *before* the Volume existed
lived on the old ephemeral disk and cannot be recovered — the client should
re-enter their categories **once** after the Volume is mounted. From that point
on the data persists across all future deploys.

---

## Also recommended: persist uploaded media (images + video) on R2

Uploaded files (`/uploads`) live on the **same ephemeral disk** and are lost on
redeploy too. The app already supports **Cloudflare R2** (S3-compatible) object
storage and uses it automatically when these variables are ALL set (see
`server/storage.js`):

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL      # public base URL of the bucket, e.g. https://media.example.com
R2_ENDPOINT             # optional; derived from the account id when omitted
```

Set these as Railway **Variables** (never commit them). With R2 configured,
product images **and videos** are stored durably and served from the R2 public
URL, surviving redeploys.

If you prefer to keep uploads on disk instead of R2, mount a second Volume at
`/data/uploads` — but R2 is the recommended path for media.

## Optional upload tuning

Video uploads are larger than images. The JSON body size limit for
`POST /api/upload` is configurable:

```
UPLOAD_MAX_MB   (default 150)   # max upload size in MB
```

Raise it if you need to accept longer/higher-bitrate videos.

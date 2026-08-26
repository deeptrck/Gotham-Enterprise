# MongoDB Atlas inspection

Date: 2026-08-26

Authenticated MongoDB Atlas project: **Gotham Enterprise**.

Cluster: **Gotham**.

Data Explorer databases visible:

| Database | Storage | Data size | Collections | Indexes |
|---|---:|---:|---:|---:|
| admin | 0 B | 0 B | 0 | 0 |
| local | — | — | 0 | — |
| test | 21.84 MB | 11.00 MB | 5 | 14 |

No data was modified. The cluster and Data Explorer were inspected in read-only mode. The populated application database appears to be `test`; this must be confirmed before migration because production configuration may use a different database name. The next safe inspection is to enumerate the five collections and their approximate document counts/indexes without running destructive actions.

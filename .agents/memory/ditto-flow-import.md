---
name: Ditto flow import format
description: Ditto flow exports can be binary length-prefixed records with gzip response bodies and encrypted ed payloads
---

Ditto flow exports are not always JSON. The `flows` format stores response bodies as a byte length followed by gzip data; those bodies commonly contain an `ed` field encrypted with the Ditto AES payload format. Importers must decompress and recursively decrypt `ed` in memory before extracting session fields, while returning only extraction status to the client.

**Why:** Treating the export as plain UTF-8 misses the credentials even though the capture contains complete Ditto login responses.

**How to apply:** Keep the upload memory-only, scan both plain text and length-prefixed gzip bodies, recursively process encrypted `ed` fields, and persist extracted credentials only through the existing encrypted `ditto_sessions` storage.
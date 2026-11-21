# Read-only sync API

`GET /api/sync` fetches both shared Google Sheet CSV exports server-side, normalizes the creator pipeline, and returns the raw UGC rows. It never writes to Google Sheets or Drive.

The response is cached for 30 seconds at the edge with a 120-second stale fallback. Deploy this folder to Vercel to make the endpoint available to the browser without CORS issues.

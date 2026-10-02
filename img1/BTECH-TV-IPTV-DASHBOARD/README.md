# BTECH-TV WORLD IPTV DASHBOARD

## Start
Because browsers restrict some requests from `file://`, serve this folder through a local web server.

### Python
```bash
python -m http.server 8080
```
Then open:
http://localhost:8080

## Features
- Dynamic global IPTV catalog
- Search
- Country/category/language/quality filters
- Favorites saved in localStorage
- HLS playback
- Responsive dashboard
- Download/open the complete public M3U playlist
- No hard-coded thousands of channel cards

## Data
The dashboard uses the public iptv-org API for channel metadata, streams, logos, countries and languages, and the public all-channel M3U playlist for the download button.

A stream can still fail because it is offline, geo-blocked, requires a referrer/user-agent, or is incompatible with the browser. This dashboard does not bypass those restrictions.

Use only streams you are authorized to access.

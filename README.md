# Track & Tide — European Rail & Ferry Map

Interactive map of European train stations, ferry ports, and routes. Discover rail operators, ferry lines, and plan intermodal journeys across Europe.

![Track & Tide](trackandtide%20logo%20full.png)

## Features

- **Interactive Map** — Browse thousands of train stations and ferry ports across Europe on an OpenStreetMap-based map with rail infrastructure overlay
- **Departure Boards** — Real-time train departures from stations across Europe (powered by [Transitous](https://transitous.org/))
- **Journey Planner** — Plan multi-leg journeys combining rail, ferry, and bus connections
- **Operator Directory** — Comprehensive database of 2000+ European train and ferry operators with logos, websites, and app links
- **Ferry Routes** — Detailed ferry route maps with operators, ports, and schedules
- **Station Explorer** — Browse stations by country with operator information
- **PWA Support** — Install as a standalone app on mobile and desktop
- **Offline Maps** — Service worker caches map tiles for offline use
- **Dark/Light Theme** — Automatic and manual theme switching
- **System Status** — Live monitoring of backend services

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Map** | [MapLibre GL JS](https://maplibre.org/) with OpenStreetMap & OpenRailwayMap tiles |
| **API** | [Transitous](https://transitous.org/) public transit API (MOTIS) — called directly from the browser |
| **Data** | Static JSON datasets (`stations.json`, `ferries.json`, `ferry_ports.json`, `data.json`) |
| **Real-time** | Firebase Firestore for crowd-sourced data |
| **Caching** | Service Worker for offline tile caching |
| **Deployment** | Static files served via Nginx (or any web server) |
| **Analytics** | Google Analytics |
| **Structured Data** | JSON-LD & Open Graph for SEO |

## Project Structure

```
trackandtide/
├── index.html              # Main interactive map page
├── journey.html            # Journey planner page
├── explore.html            # Station & port explorer
├── features.html           # Feature overview page
├── about.html              # About the project
├── more.html               # Additional resources
├── status.html             # System status dashboard
├── privacy.html            # Privacy policy
├── terms.html              # Terms of service
├── 404.html                # Custom 404 page
├── data.json               # Train & ferry operator database
├── stations.json           # Train stations by country
├── ferries.json            # Ferry routes data
├── ferry_ports.json        # Ferry port information
├── sw.js                   # Service Worker (tile caching)
├── manifest.json           # PWA manifest
├── bottom-nav.js           # Shared navigation component
├── footer.js               # Shared footer component
├── search-utils.js         # Search utility functions
├── report-modal.js         # Reporting modal component
├── system-status.js        # System status logic
├── nginx.conf              # Nginx server configuration
├── robots.txt              # SEO robots rules
├── sitemap.xml             # XML sitemap
├── flags/                  # Country flag images
├── operator logos/         # Train & ferry operator logos
├── transport icons/        # Transport mode icons
├── webapp icons/           # PWA app icons
├── features page pictures/ # Feature showcase images
└── departures-server/      # MOTIS departure proxy
    ├── Dockerfile
    ├── package.json
    └── index.js
```

## Getting Started

### Prerequisites

- A web server (Nginx recommended) to serve static files
- [Docker](https://www.docker.com/) (for the departures server)
- A [MOTIS](https://github.com/motis-project/motis) instance (for real-time departures)
- A [Firebase](https://firebase.google.com/) project (for crowd-sourced data)

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/trackandtide.git
   cd trackandtide
   ```

2. **Set up Firebase configuration** (optional — only needed for crowd-sourced comments)

   ```bash
   cp firebase-config.example.js firebase-config.js
   ```

   Edit `firebase-config.js` and replace the placeholder values with your
   Firebase project credentials. This file is gitignored.

3. **Serve static files**

   Any static file server works — no backend required:

   ```bash
   npx serve .
   ```

   Or with Python:

   ```bash
   python3 -m http.server 8080
   ```

   Open `http://localhost:3000` (or the port shown) in your browser.

### Optional: Run a proxy server

The app calls the [Transitous](https://transitous.org/) API directly from the browser by default — no server needed. If you prefer to route requests through your own proxy (e.g., for caching or logging):

```bash
cd departures-server
npm install
npm start
```

Then update the fetch URLs in the HTML files from `https://api.transitous.org/api/` to `/api/`.

### Docker Deployment (optional proxy)

If you prefer to run a local proxy server:

```bash
cd departures-server
docker build -t departures-server .
docker run -d -p 3098:3098 departures-server
```

### Production Deployment

Refer to `nginx.conf` for the recommended Nginx configuration. Key points:

- Static files served from `/usr/share/nginx/html`
- `journey.html` as the default index
- Service Worker served with appropriate cache headers
- Gzip compression enabled
- Security headers configured

## Data Sources

- **Train stations**: Wikidata, OpenStreetMap
- **Ferry routes**: Operator websites and public timetable data
- **Operator information**: Official operator websites
- **Real-time departures**: MOTIS transit routing engine

## Transitous Compliance

This project uses the [Transitous](https://transitous.org/) public transit API. In accordance with their [usage policy](https://transitous.org/api/):

- The source code is published under the **MIT License** (OSI-approved open source)
- All API requests include a proper `User-Agent` header with app name, version, and contact URL
- Data source attribution is provided via a visible link to [transitous.org/sources](https://transitous.org/sources/)
- OpenStreetMap attribution follows the [OSM attribution guidelines](https://www.openstreetmap.org/copyright)

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [MapLibre GL JS](https://maplibre.org/) for the map rendering engine
- [OpenStreetMap](https://www.openstreetmap.org/) contributors for map data
- [OpenRailwayMap](https://www.openrailwaymap.org/) for rail infrastructure overlay
- [MOTIS](https://github.com/motis-project/motis) for transit routing
- All the European train and ferry operators whose services make this map useful

# KubeCon NA 2026 venue research notes

Researched 2026-11-09. Every source below was public and nothing was blocked.

## Official maps (direct URLs)

- Venue map PDF: https://events.linuxfoundation.org/wp-content/uploads/2026/10/KCNA26-VenueMap-118x96-3.pdf (short link https://events.linuxfoundation.org/kcna26-venue-map, also bit.ly/kcna26maps)
- Solutions Showcase map PDF, 2 pages (map + exhibitor directory): https://events.linuxfoundation.org/wp-content/uploads/2026/11/KCNA26-ExpoHallMap_Digital.pdf (short link https://events.linuxfoundation.org/kcna26-expo-map)
- Sponsor directory with tier and booth: https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/sponsor/sponsor-directory/
- Project Pavilion kiosk directory (Google Sheet embedded in the project-engagement page): https://docs.google.com/spreadsheets/d/1lvCMruje6s5C1iQ0EyAiqy3vcwOYCi47SoJCgLWXpMI
- Schedule: Sessionize, not sched.com. https://kubecon-cloudnativecon-north-america-2026.sessionize.com/ ; raw JSON at `/api/schedule` (600 sessions, 37 rooms)
- Salt Palace's own floor plan (generic, not event-specific): https://res.cloudinary.com/simpleview/image/upload/v1/clients/saltlake/SPCCFloorPlans2pg_ddefcdd5-9dc9-4182-bfe0-c00dce6d4e72.pdf

## Files

- `maps/KCNA26-VenueMap.pdf`, `maps/KCNA26_ExpoHallMap.pdf`: local copies of the official venue map and Solutions Showcase (expo hall) map PDFs above.
- `sponsors.json`: 235 rows. 229 come from the LF sponsor directory (10 Diamond, 30 Platinum, 32 Gold, 123 Silver, 33 Start-Up, 1 End User). 6 more appear only in the expo PDF's exhibitor directory: Cloud Native Studios (337-339), Techstrong (197), TFiR (148), The New Stack (156), theCube (146), all media-partner orange, plus New Orleans CVB (306). Each row with a booth has `zone`, `hall`, `hallConfidence` and `mapX`/`mapY` (PDF points on the local `maps/KCNA26_ExpoHallMap.pdf`, synced from `booth_positions.json`).
- `booth_positions.json`: re-extracted 2026-11-09 from the local `maps/KCNA26_ExpoHallMap.pdf`. One entry per booth number (237, all directory booths plus unassigned 261) and per Project Pavilion kiosk side (P-1A..P-18B): label centre `x`/`y` in PDF points, `size` (booth footprint from the vector shape under the label), `rotated` (the diamond booths in Halls A-C), `zone` (point-in-polygon against the zone fills) and `hall`.
- `project_pavilion_kiosks.json`: 86 project-to-kiosk rows (P-1A … P-18B) with shift times. Many kiosks are shared by AM and PM shifts.
- `session_rooms.json`: all 37 Sessionize room strings with session counts.

## Confirmed

- All 7 sample booths match: AWS Diamond 115, Google Cloud Diamond 122, HAProxy Diamond 124, Dash0 Platinum 134, Docker Platinum 141, Datadog Platinum 152, Elastic Gold 196.
- Booth numbers. The website directory and the expo PDF's text layer agree exactly. Every directory booth appears on the map, and every map booth except 261 has an exhibitor. The PDF directory page is outlined text, so I read it visually; I spot-checked it against the site but did not compare it line by line.
- No booth for Anthropic (Diamond) or Northflank (Silver). Neither appears in the PDF directory.
- HPE has two booths, 145 and 151.
- Zone of every booth: taken from the map's fill colour around the booth (Cosmic Canyon, Amber Hive, Honeycomb Hub, Alpine Overlook, Starlight Summit, Astral Peak). Booths on a colour edge are noted in `booth_pos.json` votes: 191-197, 243-257, 330-339.
- Named spots and their schedule strings:
  - Demo Theater and Network Nook: Hall 1, Alpine Overlook
  - Cloud Native Theater and Project Pavilion: Hall 5, Cosmic Canyon
  - Learning Lounge content: Hall B, Starlight Summit
  - Community Hub: Grand Ballroom J
  - The Meeting Point: Salt Palace Level 2 North Foyer (red pin)
  - Media Lounge: 355 D
  - Quiet Rooms: 260 AB
  - Speaker Lounge: 253
  - Speaker Ready Room: 252 A
  - Prayer Room: Hyatt L5 Zion
  - Ambassador + Kubestronaut + Maintainer Lounge: Hyatt L4 Broadcast Lounge
- The schedule also uses a "Halls A-C, Halls 1-5" catch-all room for the poster showcase and in-booth demos.
- Hyatt levels: L2 Salt Lake Ballrooms, L3 Park City and sponsor rooms, L4 Regency Ballrooms, L5 Zion through Capitol Reef. The venue map and Sessionize agree on all of them.
- Sponsor meeting rooms at the Hyatt, from the logos on the venue map:
  - L3: Alta (VMware), Snowbird (Solo.io), Solitude (Teleport), Brighton (Google Cloud), Powder Mountain (Docker), Woodward (Nutanix), Snowbasin (Isovalent), Deer Valley (Chronosphere)
  - L2: Juniper (Microsoft Azure), Cottonwood (Oracle), Blue Spruce (Red Hat)

## Inferred, not drawn on any map

- Hall letter (A/B/C) for booths in Halls A-C. Walls aren't drawn, so I used the nearest HALL label by x position.
- Hall number for Amber Hive (I gave it "3") and Cosmic Canyon ("4-5"). The Amber Hive fill extends past the HALL 3 label into what is probably lower Hall 4.
- Compass orientation. The maps have 300 West at the top and West Temple at the bottom, so map-up is about west.
- What kind of Hyatt connection it is. The map only says "Access between Hyatt Regency + Salt Palace", with a dashed arrow to Hyatt Level 2. It doesn't say skybridge, so I haven't called it one.

## Conflicts

- **Regency Ballroom level.** No conflict found. The venue map, Sessionize, the project-engagement page, Cloudsmith and Red Hat all say Level 4. One sponsor (Grafana) writes "Regency BD". Sessionize uses both "Regency Ballroom B-D" and separate "B" and "CD" rooms.
- **Hall 5 vs Halls 5.** The Sessionize room string says "Halls 5" for the Cloud Native Theater (a typo) and "Hall 5" for the Project Pavilion.
- **HAProxy's site** gives "Salt Palace Level 1, Hall 1, Alpine Overlook Zone" for one of its items. That is a Demo Theater session, not its booth; the booth is 124 in Halls A-C.
- **Registration.** The venue map has only "Badge Pick-Up" at the Main Entrance. Sessionize also lists "Level 2 | East Registration" (for Coat + Bag Check), which matches the Level 2 Coat + Bag Check spot by the North Foyer.
- **Hall count.** The Salt Palace's own docs say it is "divisible into 9 halls" (A-E and 1-5 counted as 10 elsewhere). For this event, D and E are joined as the keynote Hall DE.

## Gaps

- No exact hall boundaries inside Halls A-C or between Halls 3/4/5.
- No booth sizes or footprints: `mapX`/`mapY` are booth-label centres only.
- No aisle names or numbers. The map has no aisle labels.
- Kiosk positions are known only through the P-number grid in `layout.json`, which I read from the map text.

## Map schematic (`web/public/venue/schematic.json`)

Generated by `node scripts/build-venue-schematic.mjs`, which also copies both PDFs to `web/public/venue/maps/` for the "View official PDF" links. Rooms are traced from the PDFs, not arranged by hand:

- Salt Palace L1, L2, L3 and the Hyatt lobby: rectangles and polygons from the venue PDF's vector shapes (coordinates in units of the PDF at 16 dpi).
- Hyatt L2-L5: traced from the venue PDF's Hyatt panels at 40 dpi.
- L1 Expo: zone polygons, features and every booth/kiosk from the expo PDF in points x2.
- Colour legend follows the venue map: breakout rooms light pink, meeting rooms magenta, sponsor meeting rooms olive, grey rooms (155 A-F, 252 B, Aspen, Traverse) are not event space.
- Campfires: The Meeting Point (SP L2 North Foyer, red pin), Community Hub (Grand Ballroom J), Network Nook (Hall 1), Learning Lounge (booth 140, Hall B) are labelled on the official maps. Salt Lake Foyer (Hyatt L2) and Regency Foyer (Hyatt L4) are KubeQuest campfires only; the maps label them as foyers, not meeting points.
- Not on the official maps, though used elsewhere: 150 G / "150 DEFG", "151 G", "155 E" as a single room, "250 AB", "254 AB". The map draws 150 A-F, 151, 155 A-F, 250 A-C / D-F, 251 A-C / D-F and a single 254.
- Hyatt connection: the map draws the Hyatt lobby next to Badge Pick-Up with "Access between Hyatt Regency + Salt Palace" and "take elevator or escalators to levels 2-5". No skybridge is drawn.

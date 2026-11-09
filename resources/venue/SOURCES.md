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

- `sponsors.json`: 235 rows. 229 come from the LF sponsor directory (10 Diamond, 30 Platinum, 32 Gold, 123 Silver, 33 Start-Up, 1 End User). 6 more appear only in the expo PDF's exhibitor directory: Cloud Native Studios (337-339), Techstrong (197), TFiR (148), The New Stack (156), theCube (146), all media-partner orange, plus New Orleans CVB (306). Each row with a booth has `zone`, `hall`, `hallConfidence` and `mapX`/`mapY` (PDF points on the expo map, page 1).
- `layout.json`: buildings, levels and areas, booth-numbering notes, sources.
- `project_pavilion_kiosks.json`: 86 project-to-kiosk rows (P-1A … P-18B) with shift times. Many kiosks are shared by AM and PM shifts.
- `session_rooms.json`: all 37 Sessionize room strings with session counts.
- `dir_raw.json`, `booth_pos.json`: intermediate data (directory scrape; booth x/y and zone votes).

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
  - L3: Alta (VMware), Snowbird (Solo.io), Solitude (Teleport), Brighton (Google Cloud), Powder Mountain (Docker), Woodward (Nutanix), Snowbasin (Isovalent)
  - L2: Juniper (Microsoft Azure), Cottonwood (Oracle), Blue Spruce (Red Hat)

## Inferred, not drawn on any map

- Hall letter (A/B/C) for booths in Halls A-C. Walls aren't drawn, so I used the nearest HALL label by x position.
- Hall number for Amber Hive (I gave it "3") and Cosmic Canyon ("4-5"). The Amber Hive fill extends past the HALL 3 label into what is probably lower Hall 4.
- Compass orientation. The maps have 300 West at the top and West Temple at the bottom, so map-up is about west.
- Deer Valley (Hyatt L3) sponsor logo: possibly Chronosphere, but not legible at the resolution I read.
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

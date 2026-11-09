> Snapshot of the live Claude Doc "KubeQuest game design: world, quests and profiles" at https://claude.ai/artifact/C9MJKW3q6tznHoEdxQb7pB (rev 16). The doc is the source; refresh this file when it changes.

# KubeQuest game design: world, quests and profiles
 · 
How it works
KubeQuest turns the conference into a block world: every room, booth and meeting point is a place you can check in to, and quests tell you where to go next and who to meet. A player's day runs like this:
- 
- 
Join (under a minute). Scan any KubeQuest QR code or open the link. Pick a handle, answer two questions, and you get a pixel face, a personal link and your first quest. No password or email.
- 
Look at the world. The Search tab lists both buildings by level, with what's on in each room now and next, who is speaking, and which outposts (booths) are where.
- 
Take a quest. The Quests tab offers up to three quests picked for you: a talk to attend, a booth to visit, a person to meet. Tap Accept, Not now or Not for me. Declining never costs anything.
- 
Check in. At the room door, scan the QR block with your phone camera. You earn 10 XP and a block in the track's material, and the Here screen shows this room's talk, its speakers and the players around you.
- 
Prove you listened. A three-question quiz on the talk appears. It has no timer and is worth 5 XP per correct answer.
- 
Meet someone. A meet quest names a player working on the same thing. If you both accept, the game picks a campfire near you both and gives you an opening line. You both scan the campfire's code and each earn 50 XP and a gem.
- 
Level up. XP moves you from Pod to Control Plane, sets of blocks earn banners, and the leaderboard shows the top players.
Steps 3 to 6 repeat all day. Every step also works with accessible mode on and with quests that need no walking.
Theme: a block world of our own
Go blocky, but make it original: KubeQuest gets its own voxel look, and nothing from Minecraft. Minecraft's name, textures, characters, font and sounds belong to Mojang and Microsoft, and this is a public repo demoed to judges. A world made of cubes is a generic style, and "Kube" already gives us the pun.
Look
- 
- 
Everything sits on an 8 px grid with square corners, hard 4 px drop shadows and flat colors. No gradients or rounded cards.
- 
A free pixel font (for example Silkscreen or Press Start 2P, both open-licensed) for headings, XP numbers and buttons only. Body text stays in a normal sans font so it's readable.
- 
The logo is one isometric cube.
- 
Each player gets an 8×8 pixel face generated from their handle. It's their public identity on the leaderboard and map. A real photo and a "how to spot me" line are separate, and only a confirmed meet partner sees them.
- 
Accessible mode turns the pixel font off everywhere and keeps the layout.
Vocabulary
 | 
In the game | 
What it is | 
Kubernetes nod
 | 
The World | 
The whole conference | 
The cluster
 | 
Regions | 
Buildings: Salt Palace, Hyatt Regency | 

 | 
Rooms | 
Session rooms; each has a QR block at the door | 
Nodes
 | 
Outposts | 
Sponsor booths and project tables | 

 | 
Campfires | 
Meeting points where two players complete a meet quest | 

 | 
Blocks | 
What a check-in drops into your inventory, one per talk, in the track's material | 
Pods
 | 
Gems | 
What a verified handshake drops | 

 | 
XP and levels | 
Points and rank: Pod → Deployment → Node → Cluster → Control Plane | 

 | 
Banners | 
Badges | 

Track materials. Each KubeCon topic track is a block type with its own color and pattern, so it never relies on color alone: AI Inference + Agentic = circuit, Platform Engineering = stone, Operations + Performance = glass, Data Processing + Storage = crate, Security = iron, Connectivity = copper, Inclusion + Accessibility = lantern, everything else = wood.
The venue as a world
The world is built from the official KubeCon schedule, not drawn by hand: every session carries a location string such as "Hyatt Regency | Level 4 | Regency Ballroom B-D", and splitting it gives building, level and room.
The highlighted block is where outposts live; everything else is session space. Room names come from the 
- KubeCon schedule, and the skybridge from a 
- venue guide.
Five kinds of room. Each is one document in the locations index with a name, kind, building, level, a map point and a signed QR code.
 | 
Kind | 
Examples | 
What you do there
 | 
Room | 
Hall DE, 255 BC, Regency Ballroom A | 
Check in during a session, then take its quiz
 | 
Outpost | 
A sponsor booth in the Solutions Showcase, a project kiosk in the Project Pavilion | 
Check in and complete a booth quest
 | 
Theater | 
Demo Theater, Cloud Native Theater | 
Scheduled like a room, located in the halls
 | 
Campfire | 
The Meeting Point, Community Hub, Network Nook, a Hyatt ballroom foyer | 
Meet your quest partner; both scan to complete
 | 
Boss room | 
Hall DE during keynotes; one headline talk in each time slot | 
Check in, then beat the boss together with everyone in the room
What the map screen shows. Buildings, then levels, then rooms, as a blocky list that mirrors the schematic. Each room shows the session on now, the next one, the speakers, and how busy it is (a count of check-ins in the last 20 minutes, never names). Distances are estimates: same level is 2 minutes, a different level is 4, and crossing the skybridge is 8.
Campfires: where meets happen. Meeting locations are real, public gathering spots that the official 
- venue map already names, so players can find them on the conference's own signs:
 | 
Campfire | 
Building | 
Why it works
 | 
The Meeting Point | 
Salt Palace | 
It's the venue's own named meeting spot
 | 
Community Hub | 
Salt Palace | 
Open seating meant for conversation
 | 
Network Nook | 
Salt Palace, Solutions Showcase | 
Hosts the scheduled meetups; next to the outposts
 | 
Learning Lounge | 
Salt Palace, Hall B, Starlight Summit Zone | 
Named in the schedule, easy to find in the showcase
 | 
Salt Lake Foyer | 
Hyatt Regency, Level 2 | 
Outside the Salt Lake Ballrooms
 | 
Regency Foyer | 
Hyatt Regency, by the Regency Ballrooms | 
Outside the lightning-talk room
The game picks the campfire closest to both players: same building first, then same level. Each campfire has one QR block that both players scan.
Limits. This schematic is accurate to building and level, not a floor plan. I could read the official map's labels but not exact positions, and the map places the Regency Ballrooms on Hyatt Level 3 while the schedule says Level 4, so check that on site. The Map view links to the official 
- venue map and 
- Solutions Showcase map for wayfinding. A drawn, tappable floor plan is roadmap work.
Who is speaking and who has a table
Speakers come straight from the schedule and booths from the sponsor listing, so the game knows who is where without anyone typing it in.
Sessions and speakers. The schedule page embeds every session as structured data: title, description, start and end, room, and speakers. One ingest script saves it as sessions.json. A session card shows:
- 
- 
Title, type (keynote, breakout, lightning talk, tutorial) and track material.
- 
Time, building, level and room, and walking minutes from your last check-in.
- 
Speakers with their company where the schedule gives it.
- 
Players checked in (a count), your match score, and a "Make this a quest" button.
Real examples from the schedule:
 | 
Session | 
Speakers | 
When and where
 | 
Agent Substrate: Open Layers for Agentic Systems (keynote) | 
Jaana Dogan, Dmitry Berkovich, Tim Hockin, Eitan Yarmush, Luiz Scheidegger | 
Tue 9:33 AM, Salt Palace L1, Hall DE
 | 
Saturated by Design: Maximizing Cluster Allocation in On-Premises Kubernetes | 
Dakota Sullivan, Isaac Wilson (The Trade Desk) | 
Tue 11:30 AM, Salt Palace L1, Grand Ballroom ACE
 | 
What Changes When Crossplane Adoption Gets Real (lightning talk) | 
Mitchell Davis, Jared Watts | 
Mon 12:27 PM, Hyatt L4, Regency Ballroom B-D
A speaker is a name on a session, not a player, unless they sign up themselves. If they do, their profile gets a "Speaker" banner and links to their talk.
Outposts (who has a table). There are two kinds:
- 
- 
Sponsor booths in the Solutions Showcase (Salt Palace Level 1, Halls A-C and 1-5). The official 
- sponsor directory lists every sponsor with its tier and booth number.
- 
Project kiosks in the Project Pavilion (Hall 5, Cosmic Canyon Zone), run by CNCF project maintainers.
A sample of real booths from the directory:
 | 
Sponsor | 
Tier | 
Booth
 | 
Amazon Web Services | 
Diamond | 
115
 | 
Google Cloud | 
Diamond | 
122
 | 
HAProxy Technologies | 
Diamond | 
124
 | 
Dash0 | 
Platinum | 
134
 | 
Docker | 
Platinum | 
141
 | 
Datadog | 
Platinum | 
152
 | 
Elastic | 
Gold | 
196
An outpost card shows the name, kind, hall and zone, a one-line "ask them about", the topics it matches, and its booth quest. Booth staff keep a QR block on the table; scanning it is the check-in.
Data gap. The directory gives names, tiers and booth numbers, and one scrape turns it into outposts.json. Where each booth number sits on the floor is only on the 
- Solutions S
- howcase map image, so the first version places outposts by booth number and hall, and links to that map. An organizer upload with booth positions is the real fix and stays on the roadmap.
Profile creation
Signup takes under a minute and only the handle is required. Everything else improves quests and can be filled in later.
- 
- 
Start. Scan any KubeQuest QR code or open the link. If you scanned a room code, that check-in is credited as soon as you finish.
- 
Handle. Type a handle, or enter your GitHub username to import your public name, photo and main languages. Your pixel face is generated from the handle.
- 
Two questions. "What are you working on, or hoping to get out of KubeCon?" (free text) and "Is this your first KubeCon?" Experienced attendees also see "Happy to welcome a first-timer?"
- 
Topics. Up to five topic chips, pre-selected from your answer, which you can change.
- 
Meeting people. "Suggest people for me to meet" on or off, with no default; the player has to choose. If it's on, two more fields appear:
- 
- 
Photo: the GitHub photo, a selfie taken now, or none.
- 
How to spot me: one line, such as "green hoodie, laptop covered in stickers, usually standing at the back."
- 
Comfort settings. Accessible mode, "only quests that need no walking", and language.
- 
Done. You get your personal link (saved on the phone, with a "copy my link" button for a second device), a starter block and your first quest.
Who sees what
 | 
Field | 
Public (leaderboard, map, Here) | 
A player you both agreed to meet
 | 
Handle and pixel face | 
Yes | 
Yes
 | 
Level, banners, XP | 
Yes | 
Yes
 | 
Topics and "working on" line | 
Only in match suggestions | 
Yes
 | 
Real name | 
No | 
Yes, if you entered one
 | 
Photo and "how to spot me" | 
No | 
Yes, from mutual accept until the meet ends
 | 
Current room | 
Only as a count ("14 players here") | 
Not shown; the game names the campfire
Finding each other in person. A photo helps but isn't required, and some people won't want to share one. So every confirmed meet also gets a match signal: both phones show the same large block pattern and a two-word code, such as "COPPER FOX". At the campfire you hold up your phone and look for the matching screen. That works with no photo, in a crowd, and for people who are uncomfortable describing themselves.
Quests
A quest is one concrete thing to do at the conference, offered because it fits you, with a reward and a way to say no. There are six types:
 | 
Quest | 
Offered when | 
To complete it | 
Reward
 | 
Attend | 
A session matches your topics and starts within 90 minutes | 
Scan the room's QR during the session | 
10 XP + 1 block in the track's material
 | 
Quiz | 
You checked in to a session | 
Answer 3 questions, any time that day, no timer | 
5 XP per correct answer
 | 
Chat (meet) | 
Another player matches what you're working on, and you both have meeting turned on | 
Both accept, then both scan the same campfire within 30 minutes | 
50 XP + 1 gem each; +25 XP each if one of you is a first-timer
 | 
Outpost | 
A booth or project kiosk matches your topics | 
Scan the QR block on its table | 
10 XP, up to 5 outposts a day
 | 
Collection | 
Automatic, always running | 
Collect a set, such as 3 blocks of one material | 
A banner
 | 
Boss | 
You check in to a boss room: a keynote or a headline talk | 
The whole room answers a 5-question quiz; every correct answer damages the boss until its health reaches zero | 
5 XP per correct answer, plus 25 XP and 1 gold block for everyone who took part if the boss falls
Every card has the same five parts: type, title, why you got it, where and when (with walking time), and the reward, followed by the three buttons.
Board rules
- 
- 
The Quests tab offers up to three quests at a time and you can hold up to three active ones.
- 
Offers refresh after every check-in, because your location and the clock have changed.
- 
You can turn any session or outpost into a quest yourself from Search ("Make this a quest").
- 
With "no walking" on, the board offers quiz quests on talks happening elsewhere (from the transcript or abstract) and meet quests only with players in your current room.
Boss rooms. A keynote or headline talk is a boss room, and the boss is the talk itself. The boss has a health bar sized to the room (for example 3 points per player checked in). Each correct quiz answer from anyone in the room takes 1 point off, and the bar is live on everyone's phone. If it reaches zero before the session ends plus 15 minutes, everyone who answered at least one question gets the bonus. The room wins or loses together, so nobody is ranked against the person sitting next to them. It's also cheap to build: the health bar is a count of correct answers for that talk.
Chats are quests. A meet quest is a conversation with a purpose. Each one comes with a chat prompt written for the pair, such as "Ask @podwrangler how they share GPUs between teams." The same idea covers two smaller quests:
- 
- 
Ask the speaker: after a talk you checked in to, ask the speaker one question; the speaker or a room host shows a QR block to confirm it.
- 
Ask the outpost: each booth quest carries one question to ask the staff, so a visit is a conversation and not just a badge scan.
These are in-person conversations. There is no in-app messaging, which keeps people talking face to face and leaves nothing to moderate.
Accepting and declining a quest
A player can say no to any quest at any point, and it never costs XP, rank or anything else.
The only path to Completed is a scan: the room, outpost or campfire QR, or submitted quiz answers. Tapping Accept alone earns nothing.
Three ways to say no
- 
- 
Not now hides the offer. It comes back after 30 minutes or at your next check-in, if it's still possible.
- 
Not for me removes it for good. An optional one-tap reason (not my topic, too far, no time) tunes later offers.
- 
Drop quest is on every accepted quest and frees the slot.
When offers expire
 | 
Quest | 
Offer expires | 
Accepted quest expires
 | 
Attend | 
When the session starts | 
When the session ends
 | 
Quiz | 
End of the day | 
End of the day
 | 
Meet | 
After 20 minutes | 
30 minutes after the agreed time
 | 
Outpost | 
When the Solutions Showcase closes that day | 
Same
Extra rules for meet quests
- 
- 
Declining is silent. Each player sees the offer independently and neither is told the other was asked. If you decline, the other player's card just reads "No match this time."
- 
Nothing personal is shown until both accept. Then each sees the other's photo, "how to spot me" line, the campfire, the time, an opening line and the match signal.
- 
Either player can back out with "Can't make it" until the first scan. The other gets a neutral notice, and nobody loses anything.
- 
A declined pair isn't offered again that day. "Don't match me with this player" makes it permanent, and "Report" is on the same menu.
- 
Meets happen only at campfires, which are public spots we choose, and never in a session room or on a hotel guest floor.
- 
Turning off meeting in Profile withdraws every open meet offer at once.
Levels, banners and inventory
XP sets your level, and what you collect earns banners. A busy day is worth about 300 XP: six talks with quizzes (150), two meets (100) and five outposts (50). These thresholds are a first pass, set so a first check-in, quiz and meet together reach level 2.
 | 
Level | 
Name | 
XP needed
 | 
1 | 
Pod | 
0
 | 
2 | 
Deployment | 
50
 | 
3 | 
Node | 
200
 | 
4 | 
Cluster | 
450
 | 
5 | 
Control Plane | 
800
Banners (first three)
- 
- 
Observability Nerd: 3 glass blocks (Operations + Performance talks).
- 
Connector: 3 completed meets.
- 
Welcomer: 2 completed meets with first-timers.
Later: Explorer (check in at both buildings), Scout (5 outposts in a day), Speaker.
Inventory. Blocks are counted per material and gems come from meets. For now they only feed banners. Crafting is roadmap: spend blocks and gems on a Compass (see how busy any room is) or a Lantern (your meet offers are highlighted).
Leaderboards. There are three boards, each one a filter on the same XP ledger:
- 
- 
Overall: all XP.
- 
Connectors: XP from chats and meets only, so the most social players are on top, not the fastest scanners.
- 
Questers: number of quests completed.
Each board shows the top 20 and your own rank, with a "today" and "whole conference" switch.
Fair play
- 
- 
Every QR code carries a signed token; a made-up or edited link earns nothing.
- 
One check-in per place per hour.
- 
Attend XP only counts while a session is running in that room, give or take 10 minutes.
- 
Quiz XP once per talk, one meet per pair per day, five outposts per day.
- 
If location is on and the phone is plainly in the other building, the check-in asks for a rescan. With location off, the signed code alone decides.
- 
The leaderboard shows handles and pixel faces only, and a player can hide themselves from it.
The phone app: four tabs, location and QR codes
KubeQuest is a web app built for a phone held in one hand, with four tabs along the bottom. It needs no app store: a QR code or link opens it, and it can be added to the home screen.
 | 
Tab | 
What's on it
 | 
Itinerary | 
Now: the room you're checked in to, its session and speakers, how many players are here, and the quiz or boss fight. Next: your accepted talks and meets in time order, each with place and walking minutes. Free gaps are marked, and a day switcher covers Monday to Thursday
 | 
Search | 
One box over sessions, speakers, outposts, rooms and players who turned meeting on. It matches by meaning as well as keywords ("cheaper GPUs" finds a talk on cluster allocation). Filters: Now, Near me, Track, Building. Under the box, browse the world by building, level and room. Every result has "Make this a quest" and "Add to itinerary"
 | 
Quests | 
Offers: up to three cards with Accept, Not now and Not for me. Active: up to three, each with its next step and Drop quest. Done today. A confirmed meet opens the meet screen: campfire, time, photo, "how to spot me", chat prompt, match signal and "Can't make it"
 | 
Profile | 
Pixel face, handle and level bar. Inventory of blocks and gems, and banners. The three leaderboards with your rank. Settings: meeting on or off, photo, "how to spot me", accessible mode, no-walking quests, location on or off, language, and "copy my link"
Two screens sit outside the tabs: signup, and the scan result ("+10 XP, 1 glass block") that opens whenever a QR code is scanned.
QR codes are how you prove you were there
- 
- 
Every room, outpost and campfire has a QR block: a link carrying a signed token. The phone's own camera opens it, so the app needs no built-in scanner.
- 
Printed codes at doors and tables don't change. Codes shown on a screen (a boss room's slide, the demo) expire after 10 minutes, so a photo of one can't be reused later.
- 
A scan is the only thing that awards XP for being somewhere.
Location is how the app knows what's near you
- 
- 
The app asks for the phone's location the first time you use "Near me". It's used to tell which building you're in and to sort sessions, outposts and campfires by distance.
- 
Phone location is rough indoors: it can't tell one level or room from another. Your level and room come from your last scan.
- 
Location is optional. With it off, everything works from the last scan.
- 
Only your last checked-in room is stored. There is no location trail, and other players never see where you are; they see a count per room, and a meet partner sees only the campfire.
- 
Each building, room and campfire is stored with real map coordinates, which is what makes "nearest campfire to both of you" a single Elasticsearch geo query.
Build today vs roadmap
This doc describes the whole product, and two people can't build all of it by 5:15 PM. Today's build is one thin path through every tab that the judges can play on their own phones; the rest goes on a roadmap slide.
 | 
Area | 
Build today | 
Roadmap slide
 | 
Signup | 
Handle, two questions, meeting on or off, "how to spot me" text. Photo only by GitHub username | 
Selfie upload, language, device transfer
 | 
Theme | 
Styling only: pixel font on headings, square corners, hard shadows, pixel face from the handle | 
Block art per material, sounds, animations
 | 
World | 
About 20 real Tuesday sessions, the two buildings by level, 6 campfires, 7 real booths, plus the hackathon venue as a room so judges can check in | 
All sessions, every booth, tappable floor plan
 | 
Itinerary | 
Now card and a list of accepted quests | 
Free-gap detection, day switcher
 | 
Search | 
One hybrid search over sessions and players, with a Now filter | 
Speakers, outposts, Near me, browse by level
 | 
Quests | 
Attend, quiz and chat quests with Accept, Not now and Not for me | 
Timed expiry, decline reasons, outpost and ask-the-speaker quests
 | 
Boss room | 
One boss: the kickoff talk. Shared health bar from the judges' quiz answers | 
Boss per keynote, health scaled to room size
 | 
Chat (meet) | 
Both accept, then campfire, chat prompt, match signal and "how to spot me"; both scan for 50 XP | 
Time-slot finding, cancel flow, block and report
 | 
Leaderboards | 
Overall and Connectors | 
Questers, today vs whole conference
 | 
Location | 
Building-level "Near me" from phone location, if time allows; otherwise last scan | 
Distance checks on check-in
 | 
Fair play | 
Signed QR links, one scan per place per hour | 
Session-window checks, daily caps
Three-minute demo this gives you
- 
- 
Judges scan the QR code on screen, pick a handle, and land in the hackathon room.
- 
The room is a boss room: the kickoff talk's health bar drops live as judges answer the quiz, and everyone gets the bonus when it falls.
- 
Two judges get a chat quest for each other, both accept, hold up matching signals, scan the campfire code, and jump up the Connectors board.
- 
Then the tooling story: the trace behind one XP point, the incident, and the fix.
Cut order if you fall behind: location, then Search filters, then the Connectors board, then the chat quest's campfire scan (accept on both phones completes it). Never cut signup, check-in, the quiz, the boss health bar or the overall leaderboard.
Decisions to make now
- 
- 
Does "chats" mean in-person conversations (this doc) or in-app messaging? Messaging is at least two hours of work and needs moderation, so I've left it out.
- 
Who owns the boss room? It touches the quiz (Golden's lane) and the live health bar on the UI (Collin's lane).
- 
The brief says Angular and this doc assumes nothing about the framework. The block styling works in either.

import { useEffect, useMemo, useState } from 'react';
import { MiniBlock } from '../components/Hud';
import { buildDay, clock, DEFAULT_PICKS, KEYNOTE, SLOTS, type Entry } from '../schedule';

const STORE = 'kq-plan';

const readPicks = (): Record<string, string | null> => {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? { ...DEFAULT_PICKS, ...JSON.parse(raw) } : DEFAULT_PICKS;
  } catch {
    return DEFAULT_PICKS;
  }
};

const where = (p: { room: string; building: string; level: number }) => `${p.room}, ${p.building}, Level ${p.level}`;

const EntryRow = ({ e }: { e: Entry }) => {
  if (e.kind === 'talk')
    return (
      <li className="itin__talk">
        <time className="itin__time pixel">{clock(e.talk.start)}</time>
        <MiniBlock m={e.talk.m} size={36} />
        <div>
          <div className="itin__title">{e.talk.title}</div>
          <div className="itin__meta">
            {where(e.talk.place)}. {e.talk.track}.
          </div>
        </div>
      </li>
    );
  if (e.kind === 'walk')
    return (
      <li className={`itin__walk${e.late ? ' is-late' : ''}`}>
        <span className="itin__walk-steps" aria-hidden="true" />
        <span>
          {e.minutes} min walk
          {e.from.building !== e.to.building ? ' across the skybridge' : e.from.level !== e.to.level ? `, Level ${e.from.level} to ${e.to.level}` : ''}
          {e.late ? `. You’ll be ${e.late} min late; pick a closer room or leave early.` : ''}
        </span>
      </li>
    );
  return (
    <li className="itin__gap">
      <span className="itin__gap-label pixel">
        {clock(e.start)} to {clock(e.end)}
      </span>
      <span>
        Open gap{e.lunch ? ' over lunch' : ''}. Hallway can book a 15 minute meet at a campfire here.
      </span>
    </li>
  );
};

export const Plan = () => {
  const [picks, setPicks] = useState(readPicks);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(picks));
    } catch {
      return;
    }
  }, [picks]);
  const day = useMemo(() => buildDay(picks), [picks]);

  return (
    <section className="section section--paper" id="plan" aria-labelledby="plan-title">
      <div className="wrap">
        <h2 id="plan-title" className="section__title pixel">
          Plan your day
        </h2>
        <p className="section__lede">
          Pick one talk per slot. Your itinerary adds the walk between rooms, warns you when you can’t make it in time,
          and keeps open gaps for Hallway to book a meet.
        </p>
        <div className="plan">
          <div className="plan__slots">
            <div className="plan__fixed">
              <MiniBlock m={KEYNOTE.m} size={32} />
              <span>
                <strong>
                  {clock(KEYNOTE.start)} {KEYNOTE.title}
                </strong>{' '}
                in {KEYNOTE.place.room}. Everyone starts here.
              </span>
            </div>
            {SLOTS.map((slot) => (
              <fieldset key={slot.id} className="slot">
                <legend className="slot__legend pixel">
                  {clock(slot.start)} to {clock(slot.end)}
                </legend>
                {slot.talks.map((t) => (
                  <label key={t.id} className="slot__opt">
                    <input
                      type="radio"
                      name={slot.id}
                      checked={picks[slot.id] === t.id}
                      onChange={() => setPicks((p) => ({ ...p, [slot.id]: t.id }))}
                    />
                    <MiniBlock m={t.m} size={30} />
                    <span>
                      <span className="slot__title">{t.title}</span>
                      <span className="slot__meta">
                        {t.place.room}, {t.place.building === 'Hyatt Regency' ? 'Hyatt' : 'Salt Palace'} L{t.place.level}
                        . {t.track}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="slot__opt slot__opt--skip">
                  <input
                    type="radio"
                    name={slot.id}
                    checked={picks[slot.id] === null}
                    onChange={() => setPicks((p) => ({ ...p, [slot.id]: null }))}
                  />
                  <span className="slot__title">Leave this slot open</span>
                </label>
              </fieldset>
            ))}
          </div>
          <aside className="itin" aria-labelledby="itin-title">
            <div className="itin__head">
              <h3 id="itin-title" className="pixel">
                Your Tuesday
              </h3>
              <button type="button" className="itin__reset" onClick={() => setPicks(DEFAULT_PICKS)}>
                Reset
              </button>
            </div>
            <ol className="itin__list">
              {day.entries.map((e, i) => (
                <EntryRow key={i} e={e} />
              ))}
            </ol>
            <dl className="itin__totals" aria-live="polite">
              <div>
                <dt>Talks</dt>
                <dd className="pixel">{day.talks}</dd>
              </div>
              <div>
                <dt>Tracks</dt>
                <dd className="pixel">{day.tracks}</dd>
              </div>
              <div>
                <dt>XP up for grabs</dt>
                <dd className="pixel">{day.xp}</dd>
              </div>
              <div>
                <dt>Meet gaps</dt>
                <dd className="pixel">{day.meets}</dd>
              </div>
            </dl>
            {day.late > 0 && (
              <p className="itin__warn" role="status">
                {day.late === 1 ? 'One walk is' : `${day.late} walks are`} longer than the break before the next talk.
              </p>
            )}
          </aside>
        </div>
        <p className="plan__note">Sample sessions. The real schedule loads from the KubeCon program on the day.</p>
      </div>
    </section>
  );
};

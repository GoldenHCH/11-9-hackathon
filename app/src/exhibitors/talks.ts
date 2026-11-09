import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { IExhibitorTalk, ITalk } from '../types/kubequest.interfaces';
import { exhibitorSettings } from './exhibitors.constants';

type TalkSummary = Pick<ITalk, 'id' | 'title' | 'start' | 'end' | 'building' | 'level' | 'room' | 'speakers' | 'speakerDetails' | 'track'>;

interface ITalkCache {
  loadedAt: number;
  talks: TalkSummary[];
}

const talkFields = ['id', 'title', 'start', 'end', 'building', 'level', 'room', 'speakers', 'speakerDetails', 'track'];
const companySuffixes = /\b(inc|llc|ltd|corp|corporation|co|gmbh|technologies|technology|labs|software|systems|the)\b/g;

let talkCache: ITalkCache | undefined;

function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(companySuffixes, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameCompany(exhibitorKey: string, company: string | undefined): boolean {
  if (!company || exhibitorKey === '') {
    return false;
  }

  const speakerKey = companyKey(company);

  if (speakerKey === exhibitorKey) {
    return true;
  }

  if (Math.min(speakerKey.length, exhibitorKey.length) < exhibitorSettings.MIN_COMPANY_MATCH_LENGTH) {
    return false;
  }

  return speakerKey.startsWith(`${exhibitorKey} `) || exhibitorKey.startsWith(`${speakerKey} `);
}

async function loadTalks(): Promise<TalkSummary[]> {
  if (talkCache && Date.now() - talkCache.loadedAt < exhibitorSettings.TALK_CACHE_MS) {
    return talkCache.talks;
  }

  const response = await getEsClient().search<TalkSummary>(
    {
      index: indexNames.TALKS,
      size: exhibitorSettings.MAX_TALKS_SCANNED,
      _source: talkFields,
      query: { match_all: {} },
      sort: [{ start: { order: 'asc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const talks = response.hits.hits.flatMap((hit) => (hit._source ? [{ ...hit._source, id: hit._id ?? hit._source.id }] : []));
  talkCache = { loadedAt: Date.now(), talks };

  return talks;
}

function toExhibitorTalk(talk: TalkSummary): IExhibitorTalk {
  return {
    id: talk.id,
    title: talk.title,
    start: talk.start,
    end: talk.end,
    where: [talk.building, talk.level, talk.room].filter((part) => part !== undefined && part !== '').join(' · '),
    speakers: talk.speakers ?? [],
    track: talk.track,
  };
}

export async function talksByCompany(exhibitorName: string): Promise<IExhibitorTalk[]> {
  const exhibitorKey = companyKey(exhibitorName);
  const talks = await loadTalks();

  return talks
    .filter((talk) => (talk.speakerDetails ?? []).some((speaker) => sameCompany(exhibitorKey, speaker.company)))
    .slice(0, exhibitorSettings.MAX_TALKS)
    .map(toExhibitorTalk);
}

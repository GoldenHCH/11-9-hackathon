import { askResultKinds, searchToolNames, summarySources } from './search.constants';

export type SearchToolName = (typeof searchToolNames)[number];

export type AskResultKind = (typeof askResultKinds)[number];

export type SummarySource = (typeof summarySources)[number];

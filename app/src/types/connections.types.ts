import { connectionSources, connectionToolNames, docKinds, linkNetworks } from './connections.constants';

export type LinkNetwork = (typeof linkNetworks)[number];

export type ConnectionSource = (typeof connectionSources)[number];

export type ConnectionToolName = (typeof connectionToolNames)[number];

export type DocKind = (typeof docKinds)[keyof typeof docKinds];

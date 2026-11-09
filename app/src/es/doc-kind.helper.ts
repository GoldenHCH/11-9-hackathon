import type { estypes } from '@elastic/elasticsearch';
import { DocKind } from '../types/connections.types';

export function kindIs(kind: DocKind): estypes.QueryDslQueryContainer {
  return { term: { kind } };
}

export function kindIsOrLegacy(kind: DocKind): estypes.QueryDslQueryContainer {
  return { bool: { should: [{ term: { kind } }, { bool: { must_not: [{ exists: { field: 'kind' } }] } }], minimum_should_match: 1 } };
}

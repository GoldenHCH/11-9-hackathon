import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answersMatch, levenshtein, normalizeAnswer } from './answer-match.helper';

test('normalizeAnswer lowercases, strips punctuation and leading articles', () => {
  assert.equal(normalizeAnswer('  The   Cilium!! '), 'cilium');
  assert.equal(normalizeAnswer('An eBPF-tool'), 'ebpf tool');
  assert.equal(normalizeAnswer('Café'), 'cafe');
});

test('levenshtein counts edits', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('same', 'same'), 0);
});

test('answersMatch accepts what a person would call the same answer', () => {
  assert.ok(answersMatch('cilium', 'Cilium.'));
  assert.ok(answersMatch('bpftrace', 'bpf trace'));
  assert.ok(answersMatch('kubernets', 'Kubernetes'));
  assert.ok(answersMatch('the elastic booth', 'Elastic booth'));
  assert.ok(answersMatch('tetragon by cilium', 'Cilium Tetragon'));
  assert.ok(answersMatch('Go', 'go'));
});

test('answersMatch rejects different answers', () => {
  assert.ok(!answersMatch('go', 'rust'));
  assert.ok(!answersMatch('cilium', 'cilium tetragon'));
  assert.ok(!answersMatch('datadog', 'dash0'));
  assert.ok(!answersMatch('', 'anything'));
  assert.ok(!answersMatch('falco', 'tetragon'));
});

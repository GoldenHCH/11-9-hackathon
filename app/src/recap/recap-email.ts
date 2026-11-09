import { IRecapBooth, IRecapPerson, IRecapTalk } from '../types/kubequest.interfaces';
import { RecapContent } from './recap.types';

const colors = {
  GRASS: '#2f6b2b',
  GRASS_DARK: '#1f4a1c',
  DIRT: '#8a5a2b',
  PAGE: '#e9efe4',
  CARD: '#ffffff',
  INK: '#1d2420',
  MUTED: '#5b6660',
  SHADOW: '#1d2420',
  GOLD: '#f5d142',
} as const;

const fonts = {
  BODY: "Arial, Helvetica, sans-serif",
  BLOCK: "'Courier New', Courier, monospace",
} as const;

const conferenceName = 'KubeCon + CloudNativeCon North America 2026';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function recapSubject(recap: RecapContent): string {
  const { talks, people, booths } = recap.totals;

  return `Your KubeCon NA 2026 recap: ${talks} ${talks === 1 ? 'talk' : 'talks'}, ${people} ${people === 1 ? 'person' : 'people'}, ${booths} ${booths === 1 ? 'booth' : 'booths'}`;
}

function sectionTitle(title: string): string {
  return `<tr><td style="padding:28px 32px 8px 32px;font-family:${fonts.BLOCK};font-size:18px;font-weight:bold;color:${colors.GRASS};text-transform:uppercase;letter-spacing:1px;">${escapeHtml(title)}</td></tr>`;
}

function card(inner: string): string {
  return `<tr><td style="padding:8px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.CARD};border:2px solid ${colors.INK};box-shadow:4px 4px 0 ${colors.SHADOW};"><tr><td style="padding:14px 16px;font-family:${fonts.BODY};font-size:14px;line-height:20px;color:${colors.INK};">${inner}</td></tr></table></td></tr>`;
}

function nextStepLine(step: string): string {
  return `<div style="margin-top:8px;padding:6px 10px;background:${colors.PAGE};border-left:4px solid ${colors.GRASS};font-size:13px;"><strong>Next:</strong> ${escapeHtml(step)}</div>`;
}

function statCell(value: number, label: string): string {
  return `<td width="25%" align="center" style="padding:12px 4px;background:${colors.CARD};border:2px solid ${colors.INK};font-family:${fonts.BLOCK};"><div style="font-size:24px;font-weight:bold;color:${colors.GRASS};">${value}</div><div style="font-family:${fonts.BODY};font-size:12px;color:${colors.MUTED};text-transform:uppercase;">${escapeHtml(label)}</div></td>`;
}

function stats(recap: RecapContent): string {
  const gap = '<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>';
  const cells = [
    statCell(recap.totals.xp, 'XP'),
    statCell(recap.totals.talks, 'Talks'),
    statCell(recap.totals.people, 'People'),
    statCell(recap.totals.booths, 'Booths'),
  ].join(gap);

  return `<tr><td style="padding:20px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`;
}

function nextStepsSection(steps: string[]): string {
  if (steps.length === 0) {
    return '';
  }

  const items = steps
    .map(
      (step, index) =>
        `<tr><td width="28" valign="top" style="font-family:${fonts.BLOCK};font-weight:bold;color:${colors.GRASS};padding:4px 0;">${index + 1}.</td><td style="font-family:${fonts.BODY};font-size:14px;line-height:20px;color:${colors.INK};padding:4px 0;">${escapeHtml(step)}</td></tr>`,
    )
    .join('');

  return sectionTitle('Your next steps') + card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>`);
}

function personCard(person: IRecapPerson): string {
  const github = person.githubLogin
    ? ` &middot; <a href="https://github.com/${encodeURIComponent(person.githubLogin)}" style="color:${colors.GRASS};">github.com/${escapeHtml(person.githubLogin)}</a>`
    : '';
  const topics = person.sharedTopics.length > 0 ? `<div style="color:${colors.MUTED};font-size:13px;">You both care about ${escapeHtml(person.sharedTopics.join(', '))}</div>` : '';
  const question = person.question
    ? `<div style="margin-top:6px;">${escapeHtml(person.question)}${person.theirAnswer ? `<br><span style="font-family:${fonts.BLOCK};font-weight:bold;">&ldquo;${escapeHtml(person.theirAnswer)}&rdquo;</span>` : ''}</div>`
    : '';

  return card(
    `<div style="font-family:${fonts.BLOCK};font-size:16px;font-weight:bold;">@${escapeHtml(person.handle)}</div><div style="color:${colors.MUTED};font-size:12px;">Shook hands ${escapeHtml(formatTime(person.metAt))}${github}</div>${topics}${question}${nextStepLine(person.nextStep)}`,
  );
}

function boothCard(booth: IRecapBooth): string {
  const number = booth.boothNumber ? ` <span style="color:${colors.MUTED};font-size:12px;font-weight:normal;">Booth ${escapeHtml(booth.boothNumber)}</span>` : '';
  const liked = booth.liked.trim() !== '' ? `<div style="margin-top:6px;"><strong>You liked:</strong> ${escapeHtml(booth.liked)}</div>` : '';
  const thoughts = booth.thoughts ? `<div style="margin-top:4px;color:${colors.MUTED};">${escapeHtml(booth.thoughts)}</div>` : '';
  const followUp = booth.followUp
    ? ` <span style="display:inline-block;padding:1px 6px;background:${colors.GOLD};border:1px solid ${colors.INK};font-size:11px;font-weight:bold;">FOLLOW UP</span>`
    : '';

  return card(`<div style="font-family:${fonts.BLOCK};font-size:16px;font-weight:bold;">${escapeHtml(booth.name)}${number}${followUp}</div>${liked}${thoughts}${nextStepLine(booth.nextStep)}`);
}

function talkRow(talk: IRecapTalk): string {
  const quiz =
    talk.quizTotal !== undefined && talk.quizCorrect !== undefined
      ? `<td align="right" valign="top" style="font-family:${fonts.BLOCK};font-weight:bold;color:${colors.GRASS};white-space:nowrap;padding:6px 0 6px 8px;">${talk.quizCorrect}/${talk.quizTotal}</td>`
      : `<td style="padding:6px 0;"></td>`;

  return `<tr><td style="font-family:${fonts.BODY};font-size:14px;line-height:19px;color:${colors.INK};padding:6px 0;border-bottom:1px solid ${colors.PAGE};"><strong>${escapeHtml(talk.title)}</strong><br><span style="color:${colors.MUTED};font-size:12px;">${escapeHtml(talk.room)} &middot; ${escapeHtml(formatTime(talk.at))}</span></td>${quiz}</tr>`;
}

function talksSection(talks: IRecapTalk[]): string {
  if (talks.length === 0) {
    return '';
  }

  return sectionTitle('Talks you attended') + card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${talks.map(talkRow).join('')}</table>`);
}

export function renderRecapEmail(recap: RecapContent): string {
  const subject = recapSubject(recap);
  const people = recap.people.length > 0 ? sectionTitle('People you met') + recap.people.map(personCard).join('') : '';
  const booths = recap.booths.length > 0 ? sectionTitle('Booths you visited') + recap.booths.map(boothCard).join('') : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${colors.PAGE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.PAGE};">
<tr><td align="center" style="padding:24px 8px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${colors.PAGE};border:3px solid ${colors.INK};box-shadow:6px 6px 0 ${colors.SHADOW};">
<tr><td style="background:${colors.GRASS};border-bottom:6px solid ${colors.DIRT};padding:24px 32px;">
<div style="font-family:${fonts.BLOCK};font-size:28px;font-weight:bold;color:#ffffff;letter-spacing:2px;">KUBEQUEST</div>
<div style="font-family:${fonts.BODY};font-size:15px;color:#dfeedd;margin-top:4px;">Your ${escapeHtml(conferenceName)} recap</div>
</td></tr>
<tr><td style="padding:24px 32px 0 32px;font-family:${fonts.BODY};font-size:16px;line-height:24px;color:${colors.INK};">
Hi @${escapeHtml(recap.player.handle)}, here is everything you saw, heard and said at KubeCon, with a next step for each, so the hallway conversations don't end in the hallway. You finished at level ${recap.player.level} (${escapeHtml(recap.player.levelName)}).
</td></tr>
${stats(recap)}
${nextStepsSection(recap.nextSteps)}
${people}
${booths}
${talksSection(recap.talks)}
<tr><td style="padding:28px 32px;font-family:${fonts.BODY};font-size:12px;line-height:18px;color:${colors.MUTED};">
You're getting this because you played KubeQuest at ${escapeHtml(conferenceName)} in Salt Lake City. Other players only ever see your handle.<br>
<span style="background:${colors.GRASS_DARK};color:#ffffff;padding:1px 4px;font-family:${fonts.BLOCK};">KUBEQUEST</span> &middot; Generated ${escapeHtml(formatTime(recap.generatedAt))}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

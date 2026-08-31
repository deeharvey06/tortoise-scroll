import * as providerClient from '../ai/providerClient.js';

/**
 * Every agent computes its findings deterministically first. This function
 * optionally asks the AI to rewrite those findings as readable prose — the
 * strict instruction is to rephrase only, never add a claim not already in
 * the list. If AI isn't configured (the default), findings are rendered as
 * a clean bullet list instead, so every agent works with AI fully disabled.
 */
export async function narrate(findings, { title } = {}) {
  const bullets = findings.map((f) => `- ${f}`).join('\n');

  const configured = await providerClient.isConfigured();
  if (!configured || findings.length === 0) {
    return bullets || 'No findings to report.';
  }

  try {
    const prompt = [
      { role: 'system', content:
        'You rewrite a list of pre-computed factual findings as a short, readable paragraph or two. ' +
        'Rules: (1) Do not add any claim, number, or statistic that is not already in the list below. ' +
        '(2) Do not soften or remove sample-size caveats that are present. ' +
        '(3) Do not imply causation where the finding only states a correlation/association. ' +
        '(4) Keep it concise — this is a summary, not new analysis.' +
        (title ? ` This is for a "${title}" report.` : '') },
      { role: 'user', content: `Findings:\n${bullets}` },
    ];
    const text = await providerClient.chatComplete(prompt);
    return text || bullets;
  } catch (err) {
    // Narration is a nice-to-have; never let it break an agent that
    // otherwise has perfectly good deterministic output.
    return bullets;
  }
}

export default { narrate };

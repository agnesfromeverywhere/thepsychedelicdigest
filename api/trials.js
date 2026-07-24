export const config = { runtime: 'nodejs' };

const DRUGS = ['psilocybin', 'MDMA', 'LSD', 'ketamine', 'ibogaine', 'DMT'];
const BASE = 'https://clinicaltrials.gov/api/v2/studies';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.thepsychedelicdigest.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const settled = await Promise.allSettled(DRUGS.map(fetchDrug));

    const seen = new Set();
    const trials = settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(t => t && !seen.has(t.id) && seen.add(t.id))
      .sort((a, b) => (b.au ? 1 : 0) - (a.au ? 1 : 0));

    return res.status(200).json({
      trials,
      count: trials.length,
      verified: new Date().toISOString().slice(0, 10)
    });
  } catch (err) {
    console.error('Trials API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function fetchDrug(drug) {
  const url = BASE
    + '?query.intr=' + encodeURIComponent(drug)
    + '&filter.overallStatus=RECRUITING'
    + '&pageSize=100&format=json';

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) return [];

  const json = await response.json();
  return (json.studies || []).map(s => normalise(s, drug)).filter(Boolean);
}

function normalise(s, drug) {
  const p = s.protocolSection || {};
  const id = p.identificationModule?.nctId;
  if (!id) return null;

  const locs = p.contactsLocationsModule?.locations || [];
  const countries = [...new Set(locs.map(l => l.country).filter(Boolean))];

  return {
    id,
    drug,
    title: p.identificationModule?.briefTitle || '',
    status: p.statusModule?.overallStatus || '',
    phase: (p.designModule?.phases || []).join('/') || 'N/A',
    conditions: p.conditionsModule?.conditions || [],
    sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name || '',
    minAge: p.eligibilityModule?.minimumAge || '',
    maxAge: p.eligibilityModule?.maximumAge || '',
    sex: p.eligibilityModule?.sex || 'ALL',
    countries,
    cities: [...new Set(locs.filter(l => l.country === 'Australia').map(l => l.city).filter(Boolean))],
    au: countries.includes('Australia'),
    url: 'https://clinicaltrials.gov/study/' + id
  };
}

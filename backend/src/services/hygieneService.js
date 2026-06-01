import cache from './cacheManager.js';
import { analyseHygieneTexts } from './huggingfaceNlpService.js';
import { searchNearbyPlaces } from './nominatimService.js';
import logger from '../utils/logger.js';

/**
 * Hygiene scoring — 100% free stack:
 * Overpass/OSM POIs + Nominatim place names + HuggingFace NLP sentiment.
 */

const CACHE_TTL = 600_000;

/** Build NLP-ready descriptions from OSM + Nominatim data */
function buildHygieneCorpus(osmData, nominatimPlaces) {
  const texts = [];

  for (const a of osmData?.amenities || []) {
    const tags = [];
    if (a.type) tags.push(a.type);
    if (a.name && a.name !== a.type) tags.push(a.name);
    if (a.tags?.description) tags.push(a.tags.description);
    if (a.tags?.note) tags.push(a.tags.note);
    const line = `${a.name || a.type} ${tags.join(' ')} area`.trim();
    if (line.length > 5) texts.push(line);
  }

  for (const p of nominatimPlaces?.places || []) {
    texts.push(`${p.name} ${p.type || ''} nearby public place`);
  }

  return texts;
}

/**
 * OSM-tag structural hygiene estimate (no external paid APIs).
 */
function structuralHygieneFromOSM(osmData) {
  if (!osmData?.categories) {
    return { hygieneScore: null, available: false };
  }

  const cats = osmData.categories;
  const infra = osmData.infrastructure || {};
  let score = 50;

  score += (cats.hospital || 0) * 8;
  score += (cats.clinic || 0) * 5;
  score += (cats.pharmacy || 0) * 4;
  score += (cats.dentist || 0) * 2;
  score -= (cats.fast_food || 0) * 2;
  score -= (cats.marketplace || 0) * 3;
  score -= (infra.foodStalls || 0) * 2;
  score += (cats.park || 0) * 2;
  score += (cats.school || 0) * 1;

  return {
    available: true,
    hygieneScore: Math.max(10, Math.min(95, Math.round(score))),
    source: 'osm_structural',
  };
}

/**
 * Fetch hygiene score for an H3 cell using free APIs only.
 */
export async function fetchHygieneScoreForLocation(lat, lng, radiusKm = 0.5, osmData = null, h3Index = null) {
  const cacheKey = h3Index ? `hygiene:hex:${h3Index}` : `hygiene:free:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let nominatimPlaces = { places: [] };
  try {
    nominatimPlaces = await searchNearbyPlaces(lat, lng, radiusKm, 12);
  } catch (err) {
    logger.warn(`Nominatim for hygiene failed: ${err.message}`);
  }

  const corpus = buildHygieneCorpus(osmData, nominatimPlaces);
  const nlpResult = await analyseHygieneTexts(corpus, 8);
  const structural = structuralHygieneFromOSM(osmData);

  let hygieneScore = null;
  let source = 'unavailable';

  if (nlpResult.available && nlpResult.hygieneScore != null && structural.available) {
    hygieneScore = Math.round(nlpResult.hygieneScore * 0.65 + structural.hygieneScore * 0.35);
    source = 'huggingface+nominatim+osm';
  } else if (nlpResult.available && nlpResult.hygieneScore != null) {
    hygieneScore = nlpResult.hygieneScore;
    source = nlpResult.source === 'huggingface' ? 'huggingface+nominatim' : 'nlp_lexicon+nominatim';
  } else if (structural.available) {
    hygieneScore = structural.hygieneScore;
    source = 'osm_structural';
  }

  const result = {
    available: hygieneScore != null,
    hygieneScore,
    reviewCount: nlpResult.analyzedCount || 0,
    sentimentBreakdown: nlpResult.sentimentBreakdown || {},
    nlpSource: nlpResult.source,
    nearbyPlaceCount: nominatimPlaces.count || 0,
    source,
    timestamp: new Date().toISOString(),
  };

  cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

export default { fetchHygieneScoreForLocation };

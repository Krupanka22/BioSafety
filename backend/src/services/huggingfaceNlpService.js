import axios from 'axios';
import cache from './cacheManager.js';
import logger from '../utils/logger.js';

/**
 * HuggingFace Inference API — free-tier sentiment for hygiene / cleanliness cues.
 * Optional HUGGINGFACE_API_TOKEN increases rate limits.
 */

const HF_MODEL =
  process.env.HUGGINGFACE_SENTIMENT_MODEL ||
  'cardiffnlp/twitter-roberta-base-sentiment-latest';
const HF_API = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const CACHE_TTL = 600_000;

/** Keyword hygiene lexicon when HF is unavailable (no paid APIs) */
const POSITIVE_WORDS = [
  'clean', 'hygienic', 'sanitized', 'spotless', 'tidy', 'fresh',
  'well-maintained', 'safe', 'sterile', 'neat', 'healthy',
];
const NEGATIVE_WORDS = [
  'dirty', 'filthy', 'unhygienic', 'smelly', 'gross', 'disgusting',
  'contaminated', 'waste', 'garbage', 'pest', 'unclean', 'sewage',
];

function keywordSentiment(text) {
  const lower = (text || '').toLowerCase();
  let positive = 0;
  let negative = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) positive++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) negative++;
  const total = positive + negative;
  if (total === 0) return { label: 'neutral', score: 0, compound: 0 };
  const compound = (positive - negative) / total;
  return {
    label: compound > 0.1 ? 'positive' : compound < -0.1 ? 'negative' : 'neutral',
    score: Math.abs(compound),
    compound,
  };
}

/**
 * Parse HF sentiment response into -1..+1 compound score.
 */
function parseHfResponse(data) {
  if (!data) return null;

  if (Array.isArray(data) && data[0]?.label) {
    const top = data[0];
    const label = top.label?.toLowerCase() || '';
    const score = top.score ?? 0;
    if (label.includes('pos')) return { compound: score, label: 'positive' };
    if (label.includes('neg')) return { compound: -score, label: 'negative' };
    return { compound: 0, label: 'neutral' };
  }

  if (Array.isArray(data) && Array.isArray(data[0])) {
    return parseHfResponse(data[0]);
  }

  return null;
}

/**
 * Analyse a single text snippet via HuggingFace (or keyword fallback).
 */
export async function analyseSentiment(text) {
  if (!text || text.trim().length < 3) {
    return { compound: 0, label: 'neutral', source: 'empty' };
  }

  const cacheKey = `hf:${text.slice(0, 80)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const token = process.env.HUGGINGFACE_API_TOKEN || '';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await axios.post(
      HF_API,
      { inputs: text.slice(0, 512) },
      { headers, timeout: 15_000 }
    );

    const parsed = parseHfResponse(resp.data);
    if (parsed) {
      const result = { ...parsed, source: 'huggingface' };
      cache.set(cacheKey, result, CACHE_TTL);
      return result;
    }
  } catch (err) {
    logger.warn(`HuggingFace sentiment failed: ${err.message}`);
  }

  const kw = keywordSentiment(text);
  const result = { ...kw, source: 'keyword_lexicon' };
  cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

/**
 * Batch analyse multiple place descriptions; returns aggregate hygiene sentiment.
 */
export async function analyseHygieneTexts(texts, maxSamples = 8) {
  const samples = texts.filter((t) => t && t.length > 3).slice(0, maxSamples);
  if (samples.length === 0) {
    return {
      available: false,
      hygieneScore: null,
      avgCompound: 0,
      analyzedCount: 0,
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      source: 'none',
    };
  }

  const sentiments = [];
  for (const text of samples) {
    const s = await analyseSentiment(text);
    sentiments.push(s);
    // Respect HF free-tier rate limits (~1 req at a time)
    await sleep(120);
  }

  const compounds = sentiments.map((s) => s.compound ?? 0);
  const avgCompound = compounds.reduce((a, b) => a + b, 0) / compounds.length;
  const hygieneScore = Math.round((avgCompound + 1) * 50);

  return {
    available: true,
    hygieneScore: Math.max(0, Math.min(100, hygieneScore)),
    avgCompound: +avgCompound.toFixed(3),
    analyzedCount: sentiments.length,
    sentimentBreakdown: {
      positive: sentiments.filter((s) => (s.compound ?? 0) > 0.15).length,
      neutral: sentiments.filter((s) => Math.abs(s.compound ?? 0) <= 0.15).length,
      negative: sentiments.filter((s) => (s.compound ?? 0) < -0.15).length,
    },
    source: sentiments.some((s) => s.source === 'huggingface') ? 'huggingface' : 'keyword_lexicon',
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default { analyseSentiment, analyseHygieneTexts };

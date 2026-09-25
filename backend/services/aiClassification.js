/**
 * AI Complaint Classification Service — v2.0
 * Upgraded with TF-IDF-inspired weighted scoring, bigram matching,
 * sentiment analysis, resolution prediction, and Jaccard similarity
 * for duplicate detection.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if',
  'while', 'about', 'against', 'this', 'that', 'these', 'those', 'it',
  'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who',
  'whom', 'up', 'out', 'off', 'over', 'down', 'also', 'please', 'sir',
  'madam', 'dear', 'respected', 'complaint', 'issue', 'problem', 'area',
  'near', 'since', 'long', 'time', 'many', 'much', 'get', 'got', 'give'
]);

// Weight: higher = more specific/diagnostic. Bigrams/trigrams weighted 2-3x.
const CATEGORY_KEYWORDS = {
  water_supply: [
    { term: 'drinking water supply', weight: 3 },
    { term: 'water supply', weight: 2.5 },
    { term: 'water tanker', weight: 2.5 },
    { term: 'no water', weight: 2.5 },
    { term: 'water shortage', weight: 2.5 },
    { term: 'water', weight: 1 },
    { term: 'pipe', weight: 1.2 },
    { term: 'pipeline', weight: 1.5 },
    { term: 'leakage', weight: 1.5 },
    { term: 'leak', weight: 1 },
    { term: 'tap', weight: 1 },
    { term: 'borewell', weight: 2 },
    { term: 'tanker', weight: 1.5 },
    { term: 'shortage', weight: 1 },
    { term: 'contaminated water', weight: 2.5 },
    { term: 'dirty water', weight: 2 },
    { term: 'low pressure', weight: 1.5 },
  ],
  sewage: [
    { term: 'sewage overflow', weight: 3 },
    { term: 'drain blocked', weight: 2.5 },
    { term: 'manhole open', weight: 2.5 },
    { term: 'sewage', weight: 2 },
    { term: 'sewer', weight: 2 },
    { term: 'manhole', weight: 2 },
    { term: 'waste water', weight: 2 },
    { term: 'overflow', weight: 1 },
    { term: 'gutter', weight: 1.5 },
    { term: 'nali', weight: 2 },
    { term: 'drain', weight: 1 },
    { term: 'open drain', weight: 2.5 },
    { term: 'stink', weight: 1.5 },
    { term: 'foul smell', weight: 1.5 },
  ],
  roads_potholes: [
    { term: 'pothole', weight: 2.5 },
    { term: 'broken road', weight: 2.5 },
    { term: 'road damage', weight: 2.5 },
    { term: 'road', weight: 0.8 },
    { term: 'highway', weight: 1 },
    { term: 'crater', weight: 2 },
    { term: 'divider', weight: 1.5 },
    { term: 'footpath', weight: 1.5 },
    { term: 'pavement', weight: 1.5 },
    { term: 'speed breaker', weight: 2 },
    { term: 'road repair', weight: 2.5 },
    { term: 'uneven road', weight: 2 },
    { term: 'crack', weight: 0.8 },
  ],
  street_lights: [
    { term: 'street light not working', weight: 3 },
    { term: 'no street light', weight: 3 },
    { term: 'street light', weight: 2.5 },
    { term: 'streetlight', weight: 2.5 },
    { term: 'lamp post', weight: 2 },
    { term: 'no light', weight: 1.5 },
    { term: 'dark street', weight: 2 },
    { term: 'lighting', weight: 1 },
    { term: 'bulb', weight: 0.8 },
    { term: 'electricity pole', weight: 1.5 },
    { term: 'broken light', weight: 2 },
  ],
  garbage_sanitation: [
    { term: 'garbage not collected', weight: 3 },
    { term: 'garbage dump', weight: 2.5 },
    { term: 'garbage', weight: 2 },
    { term: 'trash', weight: 2 },
    { term: 'waste', weight: 1 },
    { term: 'dustbin', weight: 2 },
    { term: 'litter', weight: 1.5 },
    { term: 'cleanliness', weight: 1.5 },
    { term: 'sanitation', weight: 1.5 },
    { term: 'sweeper', weight: 2 },
    { term: 'dumping', weight: 1.5 },
    { term: 'filth', weight: 1.5 },
    { term: 'dirty', weight: 0.8 },
    { term: 'unhygienic', weight: 2 },
    { term: 'open dumping', weight: 2.5 },
  ],
  electricity: [
    { term: 'power cut', weight: 2.5 },
    { term: 'power outage', weight: 2.5 },
    { term: 'electricity bill', weight: 2.5 },
    { term: 'electricity', weight: 1.5 },
    { term: 'power', weight: 0.8 },
    { term: 'blackout', weight: 2 },
    { term: 'wire', weight: 1 },
    { term: 'transformer', weight: 2 },
    { term: 'meter', weight: 1 },
    { term: 'billing', weight: 1.5 },
    { term: 'current', weight: 0.8 },
    { term: 'voltage', weight: 2 },
    { term: 'electric shock', weight: 2.5 },
    { term: 'short circuit', weight: 2.5 },
  ],
  traffic: [
    { term: 'traffic jam', weight: 2.5 },
    { term: 'traffic signal', weight: 2.5 },
    { term: 'traffic', weight: 1.5 },
    { term: 'signal', weight: 1 },
    { term: 'jam', weight: 1 },
    { term: 'congestion', weight: 2 },
    { term: 'parking', weight: 1.5 },
    { term: 'vehicle', weight: 0.8 },
    { term: 'road rage', weight: 2 },
    { term: 'accident', weight: 1.5 },
    { term: 'illegal parking', weight: 2.5 },
    { term: 'no parking', weight: 2 },
  ],
  encroachment: [
    { term: 'illegal construction', weight: 3 },
    { term: 'encroachment', weight: 2.5 },
    { term: 'hawker', weight: 2 },
    { term: 'vendor', weight: 1.5 },
    { term: 'occupied', weight: 1 },
    { term: 'unauthorized', weight: 2 },
    { term: 'illegal occupation', weight: 3 },
    { term: 'footpath encroachment', weight: 3 },
  ],
  pollution: [
    { term: 'air pollution', weight: 2.5 },
    { term: 'noise pollution', weight: 2 },
    { term: 'water pollution', weight: 2 },
    { term: 'pollution', weight: 1.5 },
    { term: 'smoke', weight: 1.5 },
    { term: 'factory', weight: 1.5 },
    { term: 'air quality', weight: 2 },
    { term: 'dust', weight: 1 },
    { term: 'chemical', weight: 1.5 },
    { term: 'smell', weight: 1 },
    { term: 'odor', weight: 1 },
    { term: 'toxic', weight: 2 },
    { term: 'industrial waste', weight: 2.5 },
  ],
  park_maintenance: [
    { term: 'park maintenance', weight: 3 },
    { term: 'park', weight: 1.5 },
    { term: 'garden', weight: 1.5 },
    { term: 'playground', weight: 2 },
    { term: 'tree', weight: 1 },
    { term: 'grass', weight: 1 },
    { term: 'bench', weight: 1.5 },
    { term: 'green area', weight: 2 },
    { term: 'fallen tree', weight: 2.5 },
  ],
  building_safety: [
    { term: 'building collapse', weight: 3 },
    { term: 'unsafe building', weight: 3 },
    { term: 'building', weight: 0.8 },
    { term: 'collapse', weight: 2 },
    { term: 'crack', weight: 1 },
    { term: 'unsafe structure', weight: 2.5 },
    { term: 'demolish', weight: 2 },
    { term: 'dangerous building', weight: 3 },
    { term: 'structural damage', weight: 2.5 },
  ],
  drainage: [
    { term: 'waterlogging', weight: 2.5 },
    { term: 'flood', weight: 2 },
    { term: 'stagnant water', weight: 2.5 },
    { term: 'drainage', weight: 2 },
    { term: 'rain water', weight: 1.5 },
    { term: 'clogged drain', weight: 2.5 },
    { term: 'water logging', weight: 2.5 },
    { term: 'blocked drain', weight: 2.5 },
    { term: 'flooding', weight: 2 },
  ],
  public_transport: [
    { term: 'bus stop', weight: 2.5 },
    { term: 'metro station', weight: 2.5 },
    { term: 'bus route', weight: 2.5 },
    { term: 'bus', weight: 1 },
    { term: 'transport', weight: 1 },
    { term: 'metro', weight: 1.5 },
    { term: 'auto', weight: 0.8 },
    { term: 'route', weight: 0.8 },
    { term: 'stop', weight: 0.5 },
    { term: 'timing', weight: 1 },
    { term: 'overcrowded bus', weight: 2.5 },
  ],
  noise_complaint: [
    { term: 'loud music', weight: 2.5 },
    { term: 'construction noise', weight: 2.5 },
    { term: 'noise', weight: 1.5 },
    { term: 'disturbance', weight: 1.5 },
    { term: 'loudspeaker', weight: 2.5 },
    { term: 'noise pollution', weight: 2.5 },
    { term: 'late night noise', weight: 3 },
  ]
};

const CRITICAL_KEYWORDS = [
  { term: 'building collapse', weight: 3 },
  { term: 'gas leak', weight: 3 },
  { term: 'life threatening', weight: 3 },
  { term: 'sewage overflow school', weight: 3 },
  { term: 'hospital emergency', weight: 3 },
  { term: 'child missing', weight: 3 },
  { term: 'major accident', weight: 3 },
  { term: 'collapse', weight: 2 },
  { term: 'fire', weight: 2 },
  { term: 'explosion', weight: 2.5 },
  { term: 'electrocution', weight: 2.5 },
  { term: 'flood', weight: 1.5 },
  { term: 'emergency', weight: 2 },
  { term: 'urgent', weight: 1.5 },
  { term: 'danger', weight: 1.5 },
  { term: 'dead body', weight: 3 },
  { term: 'death', weight: 2 },
  { term: 'injured', weight: 2 },
  { term: 'trapped', weight: 2.5 },
  { term: 'drowning', weight: 3 },
];

const PRIORITY_SIGNALS = {
  critical: [
    { term: 'life threatening', weight: 3 },
    { term: 'emergency', weight: 2 },
    { term: 'collapse', weight: 2 },
    { term: 'fire', weight: 2 },
    { term: 'explosion', weight: 2.5 },
    { term: 'death', weight: 2 },
    { term: 'injured', weight: 2 },
  ],
  high: [
    { term: 'school', weight: 1.5 },
    { term: 'hospital', weight: 1.5 },
    { term: 'market', weight: 1 },
    { term: 'main road', weight: 1.5 },
    { term: 'waterlogging', weight: 1.5 },
    { term: 'multiple families', weight: 2 },
    { term: 'weeks', weight: 1.5 },
    { term: 'children', weight: 1.5 },
    { term: 'elderly', weight: 1.5 },
    { term: 'spreading disease', weight: 2.5 },
  ],
  medium: [
    { term: 'days', weight: 1 },
    { term: 'colony', weight: 1 },
    { term: 'society', weight: 1 },
    { term: 'several', weight: 1 },
    { term: 'residents', weight: 1 },
  ],
  low: [
    { term: 'minor', weight: 1 },
    { term: 'small', weight: 1 },
    { term: 'once', weight: 1 },
    { term: 'occasionally', weight: 1 },
  ]
};

// ---- Sentiment Analysis ----
const NEGATIVE_WORDS = [
  'worst', 'terrible', 'horrible', 'disgusting', 'pathetic', 'useless',
  'negligence', 'corrupt', 'ignored', 'harassment', 'threatening', 'suffering',
  'dying', 'unbearable', 'intolerable', 'disaster', 'catastrophe', 'nightmare',
  'hell', 'ruined', 'destroyed', 'dangerous', 'lethal', 'toxic', 'life risk',
  'no action', 'zero response', 'nothing done', 'still pending', 'months',
  'years', 'repeated complaints', 'multiple times', 'frustrated', 'angry',
  'fed up', 'helpless', 'desperate', 'health hazard', 'risk to life',
  'children affected', 'old people suffering', 'drinking contaminated',
];

const URGENCY_AMPLIFIERS = [
  { term: 'immediately', weight: 2 },
  { term: 'right now', weight: 2 },
  { term: 'today', weight: 1.5 },
  { term: 'asap', weight: 2 },
  { term: 'as soon as possible', weight: 2 },
  { term: 'urgently', weight: 2 },
  { term: 'cannot wait', weight: 2 },
  { term: 'life at stake', weight: 3 },
  { term: 'people will die', weight: 3 },
  { term: 'health risk', weight: 2 },
];

function tokenize(text) {
  return text.toLowerCase().split(/[\s,.!?;:()\-\/]+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function matchesWithBoundary(text, term) {
  try {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  } catch {
    return text.toLowerCase().includes(term.toLowerCase());
  }
}

function classifyComplaint(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const tokens = tokenize(text);

  // ---- Category Classification with Weighted Scoring ----
  let bestCategory = 'other';
  let maxScore = 0;
  let secondBestScore = 0;
  const categoryScores = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    let matchedCount = 0;
    for (const kw of keywords) {
      if (matchesWithBoundary(text, kw.term)) {
        score += kw.weight;
        matchedCount++;
      }
    }
    categoryScores[category] = { score, matchedCount, total: keywords.length };
    if (score > maxScore) {
      secondBestScore = maxScore;
      maxScore = score;
      bestCategory = category;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  // ---- Critical Detection ----
  let criticalScore = 0;
  let matchedCritical = null;
  for (const kw of CRITICAL_KEYWORDS) {
    if (matchesWithBoundary(text, kw.term)) {
      criticalScore += kw.weight;
      if (!matchedCritical) matchedCritical = kw.term;
    }
  }
  const isCritical = criticalScore >= 2;

  // ---- Priority Detection ----
  let priority = 'low';
  let maxPriorityScore = 0;
  for (const [level, signals] of Object.entries(PRIORITY_SIGNALS)) {
    let pScore = 0;
    for (const s of signals) {
      if (matchesWithBoundary(text, s.term)) pScore += s.weight;
    }
    if (pScore > maxPriorityScore) {
      maxPriorityScore = pScore;
      priority = level;
    }
  }
  if (isCritical) priority = 'critical';

  // ---- Confidence Calculation ----
  const bestCatData = categoryScores[bestCategory] || { matchedCount: 0, total: 1 };
  const matchRatio = bestCatData.matchedCount / bestCatData.total;
  const scoreDiff = maxScore > 0 ? (maxScore - secondBestScore) / maxScore : 0;
  let confidence = 0.3;
  if (maxScore > 0) {
    confidence = Math.min(0.95, 0.35 + (matchRatio * 0.3) + (scoreDiff * 0.3));
  }

  // ---- Sentiment Analysis ----
  const sentiment = analyzeSentiment(text, tokens);

  // ---- Resolution Time Prediction ----
  const estimatedResolutionHours = predictResolutionTime(bestCategory, priority);

  return {
    category: bestCategory,
    priority,
    isCritical,
    criticalReason: matchedCritical || null,
    confidence: parseFloat(confidence.toFixed(2)),
    categoryScores,
    sentiment,
    estimatedResolutionHours,
  };
}

// ---- Sentiment Analysis ----
function analyzeSentiment(text, tokens) {
  let negativeScore = 0;
  let urgencyScore = 0;

  for (const word of NEGATIVE_WORDS) {
    if (matchesWithBoundary(text, word)) negativeScore++;
  }

  for (const amp of URGENCY_AMPLIFIERS) {
    if (matchesWithBoundary(text, amp.term)) urgencyScore += amp.weight;
  }

  // Exclamation marks and ALL CAPS increase urgency
  const exclamationCount = (text.match(/!/g) || []).length;
  const capsRatio = (text.match(/[A-Z]{3,}/g) || []).length;
  urgencyScore += Math.min(exclamationCount * 0.3, 2);
  urgencyScore += Math.min(capsRatio * 0.5, 2);

  // Length factor: very long complaints often indicate frustration
  const wordCount = tokens.length;
  const lengthFactor = wordCount > 100 ? 0.3 : wordCount > 50 ? 0.15 : 0;

  const rawScore = negativeScore * 0.15 + urgencyScore * 0.1 + lengthFactor;
  const sentimentScore = parseFloat(Math.min(1, Math.max(0, rawScore)).toFixed(2));

  let label = 'neutral';
  if (sentimentScore >= 0.7) label = 'highly_frustrated';
  else if (sentimentScore >= 0.4) label = 'frustrated';
  else if (sentimentScore >= 0.2) label = 'concerned';

  return { score: sentimentScore, label, urgencyScore: parseFloat(Math.min(1, urgencyScore * 0.15).toFixed(2)) };
}

// ---- Resolution Time Prediction ----
const CATEGORY_RESOLUTION_BASELINES = {
  water_supply: { base: 48, range: [12, 96] },
  sewage: { base: 36, range: [8, 72] },
  roads_potholes: { base: 120, range: [48, 240] },
  street_lights: { base: 72, range: [24, 144] },
  garbage_sanitation: { base: 24, range: [4, 48] },
  electricity: { base: 36, range: [6, 72] },
  traffic: { base: 48, range: [12, 120] },
  encroachment: { base: 168, range: [72, 336] },
  pollution: { base: 96, range: [24, 192] },
  park_maintenance: { base: 96, range: [48, 192] },
  building_safety: { base: 72, range: [24, 168] },
  drainage: { base: 48, range: [12, 120] },
  public_transport: { base: 72, range: [24, 168] },
  noise_complaint: { base: 48, range: [12, 96] },
  other: { base: 72, range: [24, 168] },
};

function predictResolutionTime(category, priority) {
  const baseline = CATEGORY_RESOLUTION_BASELINES[category] || CATEGORY_RESOLUTION_BASELINES.other;
  const priorityMultiplier = { critical: 0.25, high: 0.5, medium: 1, low: 1.5 };
  const multiplier = priorityMultiplier[priority] || 1;
  const estimated = Math.round(baseline.base * multiplier);
  return {
    estimatedHours: estimated,
    range: [Math.round(baseline.range[0] * multiplier), Math.round(baseline.range[1] * multiplier)],
    basedOn: 'category_priority_model',
  };
}

// ---- Anomaly Detection ----
function detectOfficerAnomaly(officer) {
  const anomalies = [];
  const { stats } = officer;
  if (!stats) return anomalies;

  // Unusually fast resolutions (under 1 hour average)
  if (stats.totalResolved > 5 && stats.avgResolutionHours < 1) {
    anomalies.push({
      type: 'suspiciously_fast_resolution',
      severity: 'high',
      message: `Average resolution time is ${stats.avgResolutionHours}h — unrealistically fast`,
      metric: stats.avgResolutionHours,
    });
  }

  // High false closure rate
  if (stats.totalAssigned > 5) {
    const fcRate = stats.falseClosures / stats.totalAssigned;
    if (fcRate > 0.3) {
      anomalies.push({
        type: 'high_false_closure_rate',
        severity: 'critical',
        message: `False closure rate is ${(fcRate * 100).toFixed(1)}% — significantly above threshold`,
        metric: fcRate,
      });
    } else if (fcRate > 0.15) {
      anomalies.push({
        type: 'elevated_false_closure_rate',
        severity: 'medium',
        message: `False closure rate is ${(fcRate * 100).toFixed(1)}% — above normal`,
        metric: fcRate,
      });
    }
  }

  // Very low satisfaction score
  if (stats.totalRatings > 3 && stats.avgSatisfactionScore < 2.0) {
    anomalies.push({
      type: 'low_satisfaction',
      severity: 'medium',
      message: `Average satisfaction is ${stats.avgSatisfactionScore}/5 — below acceptable`,
      metric: stats.avgSatisfactionScore,
    });
  }

  // Overloaded consistently
  if (officer.activeComplaints > officer.bandwidth * 1.2) {
    anomalies.push({
      type: 'overloaded',
      severity: 'medium',
      message: `Officer has ${officer.activeComplaints} active complaints but bandwidth is only ${officer.bandwidth}`,
      metric: officer.activeComplaints / officer.bandwidth,
    });
  }

  return anomalies;
}

// ---- Improved Duplicate Detection with Jaccard Similarity ----
async function detectDuplicate(Complaint, title, description, location) {
  const tokens = tokenize(`${title} ${description}`);
  if (tokens.length < 3) return null;

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const query = { createdAt: { $gte: recentCutoff }, status: { $nin: ['resolved', 'rejected'] } };

  if (location?.coordinates?.length === 2) {
    query.location = {
      $near: { $geometry: { type: 'Point', coordinates: location.coordinates }, $maxDistance: 300 }
    };
  }

  const nearby = await Complaint.find(query).limit(20).lean();
  const inputSet = new Set(tokens);

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const c of nearby) {
    const cTokens = new Set(tokenize(`${c.title} ${c.description}`));
    const intersection = new Set([...inputSet].filter(x => cTokens.has(x)));
    const union = new Set([...inputSet, ...cTokens]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    if (jaccard > bestSimilarity && jaccard >= 0.35) {
      bestSimilarity = jaccard;
      bestMatch = c;
    }
  }

  return bestMatch ? { ...bestMatch, duplicateSimilarity: parseFloat(bestSimilarity.toFixed(2)) } : null;
}

function calculateSLA(category, priority) {
  const baseSLA = { critical: 4, high: 24, medium: 72, low: 168 };
  return baseSLA[priority] || 72;
}

module.exports = {
  classifyComplaint,
  detectDuplicate,
  calculateSLA,
  analyzeSentiment,
  predictResolutionTime,
  detectOfficerAnomaly,
  tokenize,
};

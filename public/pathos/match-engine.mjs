// Pure, local matching logic. No network or storage; estimates, not probabilities.
const normal = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (value, max = 1200) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const list = value => Array.isArray(value) ? value.map(x => clean(x, 80)).filter(Boolean).slice(0, 24) : [];
export function sameWork(work, candidate) {
  if (candidate.provider === 'openlibrary' && work.external?.openlibraryKey === candidate.id) return true;
  if (candidate.provider === 'tmdb' && String(work.external?.tmdb) === candidate.id && work.type === 'Film') return true;
  return work.type === candidate.type && normal(work.title) === normal(candidate.title) && (!work.creator || !candidate.creator || normal(work.creator) === normal(candidate.creator));
}
export function candidateText(candidate) {
  return [candidate.type, clean(candidate.title, 200), clean(candidate.creator, 150), ...list(candidate.genres), clean(candidate.description, 1800)].filter(Boolean).join('. ');
}
export function buildHistory(archive, candidate) {
  const works = new Map((archive.works || []).map(w => [w.id, w]));
  const records = [];
  for (const e of archive.experiences || []) {
    const work = works.get(e.workId);
    if (!work || e.status === 'planned' || sameWork(work, candidate)) continue;
    const rating = e.rating !== '' && e.rating != null && Number.isFinite(Number(e.rating)) && Number(e.rating) >= 0 && Number(e.rating) <= 5 ? Number(e.rating) : null;
    if (rating == null && !work.liked && !e.review && e.status !== 'dnf') continue;
    const review = clean(e.review, 1500), genres = list(work.sourceMetadata?.genres);
    records.push({ id: e.id, workId: work.id, title: clean(work.title, 200), type: clean(work.type, 50), creator: clean(work.creator, 150),
      rating, liked: !!work.liked, status: e.status, genres, review,
      text: [work.type, clean(work.title, 200), clean(work.creator, 150), ...genres, ...list(e.tags), clean(work.sourceMetadata?.overview, 700), review].filter(Boolean).join('. ') });
  }
  return records;
}
export function cosine(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0;
}
export function evaluateMatch(candidate, history, candidateVector, vectors) {
  const rated = history.filter(e => e.rating != null);
  const baseline = rated.length ? rated.reduce((sum, e) => sum + e.rating, 0) / rated.length : 3;
  const repeats = new Map(); history.forEach(e => repeats.set(e.workId, (repeats.get(e.workId) || 0) + 1));
  const genres = new Set(list(candidate.genres).map(normal));
  const related = history.map((e, i) => {
    const shared = e.genres.filter(g => genres.has(normal(g)));
    const semantic = Math.max(0, cosine(candidateVector, vectors[i]));
    const similarity = semantic * .85 + (shared.length ? .1 : 0) + (candidate.creator && normal(e.creator) === normal(candidate.creator) ? .05 : 0);
    return { ...e, shared, similarity, weight: Math.max(0, similarity - .28) ** 2 / Math.sqrt(repeats.get(e.workId)) * (e.type === candidate.type ? 1 : .8) * (e.liked ? 1.15 : 1) };
  }).filter(e => e.similarity >= .4).sort((a, b) => b.similarity - a.similarity);
  // Each work gets at most one evidence card; repeat experiences still inform ratings.
  const nearest = related.filter(e => e.rating != null).slice(0, 12);
  const weight = nearest.reduce((sum, e) => sum + e.weight, 0);
  const mean = weight ? nearest.reduce((sum, e) => sum + e.weight * e.rating, 0) / weight : baseline;
  const unique = new Set(nearest.map(e => e.workId)).size;
  const enough = rated.length >= 3 && unique >= 2 && (clean(candidate.description).length >= 80 || genres.size >= 2);
  const shift = mean - baseline;
  const label = !enough ? 'Not enough evidence' : shift >= .2 ? 'Strong match' : shift <= -.25 ? 'Weaker match' : 'Mixed match';
  const confidence = enough && unique >= 4 && rated.length >= 10 && clean(candidate.description).length >= 150 ? 'Moderate' : 'Low';
  const selected = [], seen = new Set();
  const add = e => { if (e && !seen.has(e.workId) && selected.length < 3) { seen.add(e.workId); selected.push(e); } };
  // Surface counterevidence as well as similarities to favourites.
  add(related.find(e => e.rating != null && e.rating >= baseline + .15));
  add(related.find(e => e.rating != null && e.rating <= baseline - .3));
  related.filter(e => e.rating != null).forEach(add);
  return { label, confidence, historyCount: history.length, ratedCount: rated.length, relatedCount: unique,
    summary: !enough ? 'There is too little descriptive information or comparable rated history for a useful prediction.' : shift >= .2 ? 'The closest connections lean toward experiences you rated above your usual average.' : shift <= -.25 ? 'The closest connections lean toward experiences you rated below your usual average.' : 'Your comparable experiences point in different directions, or sit close to your usual rating.',
    evidence: selected.map(e => ({ id: e.id, workId: e.workId, title: e.title, type: e.type, rating: e.rating, shared: e.shared.slice(0, 3), review: clean(e.review, 180), direction: e.rating >= baseline + .15 ? 'positive' : e.rating <= baseline - .3 ? 'caution' : 'neutral' })),
    limitations: 'An experimental estimate from your history, not a probability. Unrated reviews help find connections but do not establish liking. Long reviews are excerpted; catalogue descriptions may be incomplete.' };
}

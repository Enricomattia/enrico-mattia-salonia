import { candidateText, evaluateMatch } from './match-engine.mjs';

// Pinned runtime and multilingual weights. Only model assets are fetched; input
// texts/vectors stay in this worker's memory and are discarded on sign-out.
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const REVISION = '2c4055b12046f11709e9df2c122e59ffbdc2f900';
let extractor, generation = 0, queue = Promise.resolve();
const embeddings = new Map();
function progress(id, message) { self.postMessage({ id, type: 'progress', message }); }
async function pipeline(id) {
  if (!extractor) {
    progress(id, 'Loading the local model (about 120 MB plus runtime on first use)…');
    extractor = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js').then(async ({ pipeline, env }) => {
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      return pipeline('feature-extraction', MODEL, { revision: REVISION, dtype: 'q8', device: 'wasm',
        progress_callback: p => { if (p.status === 'progress' && p.file?.endsWith('.onnx')) progress(id, `Downloading the local model… ${Math.round(p.progress || 0)}%`); } });
    }).catch(error => { extractor = null; throw error; });
  }
  return extractor;
}
async function run(id, job) {
  const pipe = await pipeline(job.id);
  if (id !== generation) return;
  const texts = [candidateText(job.candidate), ...job.history.map(e => e.text)];
  let completed = 0;
  for (let offset = 0; offset < texts.length; offset += 4) {
    if (id !== generation) return;
    const batch = [...new Set(texts.slice(offset, offset + 4).filter(text => !embeddings.has(text)))];
    if (batch.length) {
      // Short chunks keep long review excerpts from being silently truncated by
      // the encoder's small context window. Mean-pool the chunk embeddings.
      for (const text of batch) {
        if (id !== generation) return;
        const chunks = [];let remaining = text;
        while (remaining.length) {
          let end = Math.min(500, remaining.length);
          if (end < remaining.length) {const space = remaining.lastIndexOf(' ',end);if(space>250)end=space;}
          chunks.push(remaining.slice(0,end));remaining=remaining.slice(end).trimStart();
        }
        const sum = [];
        for (let start = 0; start < chunks.length; start += 4) {
          if (id !== generation) return;
          const output = await pipe(chunks.slice(start,start+4), { pooling: 'mean', normalize: true });
          for (const vector of output.tolist())vector.forEach((value,i)=>{sum[i]=(sum[i]||0)+value;});
        }
        const length = Math.sqrt(sum.reduce((total,x)=>total+x*x,0))||1;
        embeddings.set(text,sum.map(x=>x/length));
      }
    }
    completed = Math.min(texts.length, offset + 4);
    progress(job.id, `Comparing your experiences… ${completed - 1 > 0 ? completed - 1 : 0} / ${job.history.length}`);
  }
  if (id !== generation) return;
  const result = evaluateMatch(job.candidate, job.history, embeddings.get(texts[0]), texts.slice(1).map(text => embeddings.get(text)));
  self.postMessage({ id: job.id, type: 'result', result });
  // A bounded session cache; no private vectors/texts are written to disk.
  if (embeddings.size > 1500) embeddings.clear();
}
self.onmessage = event => {
  const id = ++generation;
  if (event.data.type === 'cancel') return;
  const job = event.data;
  queue = queue.catch(() => {}).then(() => id === generation && run(id, job)).catch(() => {
    if (id === generation) self.postMessage({ id: job.id, type: 'error', message: 'The local model could not run. Check your connection or try a desktop browser. Your archive is unchanged.' });
  });
};

import { ophthalmologyDiagnoses } from '../catalogs.js';

const DEMO_SEARCH_DELAY_MS = 150;
const INITIAL_SUGGESTION_COUNT = 5;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function searchIcd10(query) {
  const q = query.trim().toLowerCase();
  if (!q) return ophthalmologyDiagnoses.slice(0, INITIAL_SUGGESTION_COUNT);

  return ophthalmologyDiagnoses.filter((item) => {
    const haystack = `${item.code ?? ''} ${item.label}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Demo stand-in for a backend list resolver (REST/GraphQL/DB).
 * @param {import('@docengine/editor').ResolveListItemsContext} ctx
 */
export async function resolveOphthalmologyListItems({ fieldName, query }) {
  // await delay(DEMO_SEARCH_DELAY_MS);

  if (fieldName === 'ICD-10') {
    return searchIcd10(query);
  }

  return [];
}

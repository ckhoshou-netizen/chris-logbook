import {assert,validateFood} from './domain.mjs';
export const CATALOG_URL='./data/cnf-2026.json';
export async function loadCatalog(){const response=await fetch(new URL(CATALOG_URL,import.meta.url));assert(response.ok,'Canadian foods could not load. Your own foods are still available.');return validateCatalog(await response.json());}
export function validateCatalog(data){assert(data?.dataset==='Canadian Nutrient File'&&data.version==='2026'&&Array.isArray(data.foods)&&data.foods.length===data.foodCount,'Invalid Canadian food catalogue.');const ids=new Set();for(const food of data.foods){validateFood(food);assert(typeof food.id==='string'&&!ids.has(food.id),'Duplicate Canadian food.');ids.add(food.id);}return data;}
export function normalize(text){return String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\bpotatoes\b/g,'potato').replace(/\btomatoes\b/g,'tomato').replace(/\beggs\b/g,'egg').split(' ').map(word=>word.length>4&&word.endsWith('ies')?word.slice(0,-3)+'y':word.length>3&&word.endsWith('s')&&!word.endsWith('ss')?word.slice(0,-1):word).join(' ');}
const indexed=new WeakMap();
function searchText(food){if(!indexed.has(food))indexed.set(food,normalize(`${food.name} ${food.brand??''} ${food.provenance?.originalDescriptionFr??''} ${food.provenance?.alternateDescription??''} ${food.provenance?.alternateDescriptionFr??''}`));return indexed.get(food);}
export function foodKey(food){return food?.source==='Canadian Nutrient File'?'cnf:'+food.provenance.foodCode:food?.id;}
export function foodPool(saved,catalog){const all=new Map(saved.map(f=>[foodKey(f),f]));for(const f of catalog)all.set(foodKey(f),f);return [...all.values()].filter(f=>!f.archived);}
export function searchFoods(foods,query){const q=normalize(query),tokens=q.split(' ').filter(Boolean);return foods.filter(food=>tokens.every(t=>searchText(food).split(' ').some(word=>word.startsWith(t)))).sort((a,b)=>{
 const score=f=>{const name=normalize(f.name);return (name.startsWith(q)?0:100)+(tokens.length&&!name.startsWith(tokens[0])?50:0)+name.length/100;};return score(a)-score(b)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
});}

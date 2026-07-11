'use strict';

const DB_NAME='offline-cookbook-db';
const DB_VERSION=3;
const APP_VERSION='4.2.0';
const STORES=['recipes','pantry','shopping','settings'];
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const fmt=n=>Number.isFinite(+n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(+n):n;
const fmtAmount=n=>{const v=+n;if(!Number.isFinite(v))return n;const whole=Math.trunc(v),fraction=Math.round((v-whole)*1000)/1000;const fractions=new Map([[.125,'⅛'],[.25,'¼'],[.333,'⅓'],[.375,'⅜'],[.5,'½'],[.625,'⅝'],[.667,'⅔'],[.75,'¾'],[.875,'⅞']]);const glyph=fractions.get(fraction);return glyph?`${whole?whole+' ':''}${glyph}`:fmt(v)};
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const titleCase=s=>String(s||'').trim().replace(/^./,m=>m.toUpperCase());
const safeStorage={getItem(k){try{return localStorage.getItem(k)}catch{return null}},setItem(k,v){try{localStorage.setItem(k,v)}catch{}},removeItem(k){try{localStorage.removeItem(k)}catch{}}};

let db;
let deferredInstallPrompt=null;
const state={recipes:[],pantry:[],shopping:[],settings:{theme:'system',largeText:false,autoCatalog:true,catalogUpdateIntervalDays:7,translationRepairRequired:false,translatorVersion:0},activeView:'home',recipeFilter:'Все',collectionFilter:'all',recipeSort:'new',pantryFilter:'all',currentRecipe:null,currentServings:1,stepIndex:0,stepIngredients:false,timers:[],photoData:'',editingId:null,catalogImporting:false};

function sameId(a,b){return String(a??'')===String(b??'')}
function findRecipeById(id){return state.recipes.find(recipe=>sameId(recipe?.id,id))||null}
function asArray(value){if(Array.isArray(value))return value;if(value==null||value==='')return[];return[String(value)]}
function normalizeIngredient(item,index=0){
  if(typeof item==='string'){
    const parsed=typeof parseIngredientString==='function'?parseIngredientString(item):{name:item,amount:'',unit:''};
    return{name:String(parsed.name||item||`Ингредиент ${index+1}`).trim(),amount:parsed.amount??'',unit:String(parsed.unit||'').trim()};
  }
  const value=item&&typeof item==='object'?item:{};
  const name=String(value.name??value.ingredient??value.title??`Ингредиент ${index+1}`).trim();
  return{name:name||`Ингредиент ${index+1}`,amount:value.amount??value.quantity??'',unit:String(value.unit??value.measure??'').trim()};
}
function normalizeStep(step,index=0){
  if(typeof step==='string')return{title:inferStepTitle(step,index),text:step.trim(),timer:extractMinutes(step)};
  const value=step&&typeof step==='object'?step:{};
  const text=String(value.text??value.instruction??value.description??value.title??'').trim()||`Выполните этап ${index+1}.`;
  const timerRaw=value.timer??value.minutes??0;
  return{...value,title:String(value.title||inferStepTitle(text,index)).trim(),text,timer:Number.isFinite(+timerRaw)?Math.max(0,+timerRaw):extractMinutes(text)};
}
function wireRecipeCards(root=document){
  if(!root?.querySelectorAll)return;
  root.querySelectorAll('[data-recipe-id]').forEach(card=>{
    if(card.dataset.recipeBound==='1')return;
    card.dataset.recipeBound='1';
    const activate=event=>{
      if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
      if(event.target?.closest?.('button,a,input,label,select,textarea'))return;
      if(event.type==='keydown')event.preventDefault();
      event.stopPropagation?.();
      openRecipe(card.dataset.recipeId);
    };
    card.addEventListener('click',activate,{passive:false});
    card.addEventListener('keydown',activate);
  });
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const d=req.result;STORES.forEach(name=>{if(!d.objectStoreNames.contains(name))d.createObjectStore(name,{keyPath:'id'})})};
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function dbAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function dbPut(store,value){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
function dbDelete(store,id){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function dbClear(store){return new Promise((res,rej)=>{const r=tx(store,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function bulkPut(store,items){for(const item of items)await dbPut(store,item)}
function bulkPutFast(store,items){return new Promise((resolve,reject)=>{if(!items.length){resolve();return}const transaction=db.transaction(store,'readwrite'),objectStore=transaction.objectStore(store);for(const item of items)objectStore.put(item);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)})}
async function syncBuiltInCatalog(existing=[],force=false){
  const seeds=window.SEED_RECIPES||[],targetVersion=window.COOKBOOK_META?.version||1;
  const settingRows=await dbAll('settings'),appSetting=settingRows.find(x=>x.id==='app');
  const currentVersion=appSetting?.value?.seedVersion||0,allowMissing=force||!existing.length||currentVersion<targetVersion;
  if(!existing.length){await bulkPut('recipes',seeds)}
  else{
    const byId=new Map(existing.map(r=>[r.id,r]));
    for(const seed of seeds){
      const old=byId.get(seed.id);
      if(!old){if(allowMissing)await dbPut('recipes',seed);continue}
      if(old.builtIn&&(old.schemaVersion||0)<(seed.schemaVersion||0))await dbPut('recipes',{...seed,favorite:!!old.favorite,createdAt:old.createdAt||seed.createdAt});
    }
  }
  const duplicateKeys=new Map();
  for(const recipe of await dbAll('recipes')){
    const key=recipe.externalKey||((recipe.sourceName&&recipe.externalId)?`${recipe.sourceName}:${recipe.externalId}`:'');
    if(!key)continue;
    if(!duplicateKeys.has(key)){duplicateKeys.set(key,recipe);continue}
    const keep=duplicateKeys.get(key),remove=(recipe.updatedAt||recipe.createdAt||0)>(keep.updatedAt||keep.createdAt||0)?keep:recipe;
    const next=remove===keep?recipe:keep;duplicateKeys.set(key,next);await dbDelete('recipes',remove.id);
  }
  await dbPut('settings',{id:'app',value:{...(appSetting?.value||{}),seedVersion:targetVersion}});
}

async function init(){
  try{db=await openDB()}catch(err){console.error(err);alert('Не удалось открыть локальную базу. Проверьте, что Safari не находится в приватном режиме.');return}
  bindEvents();
  try{
    const existing=await dbAll('recipes');
    await syncBuiltInCatalog(existing);
    await loadState();
    await migrateRecipeCatalog();
  }catch(err){
    console.error('Ошибка подготовки каталога',err);
    try{await loadState()}catch(loadError){console.error(loadError)}
  }
  applySettings();
  renderAll();
  restoreTimers();
  registerServiceWorker();
  setupInstall();
  scheduleAutoCatalogUpdate();
}
async function loadState(){
  [state.recipes,state.pantry,state.shopping]=await Promise.all([dbAll('recipes'),dbAll('pantry'),dbAll('shopping')]);
  const settings=await dbAll('settings');
  const app=settings.find(x=>x.id==='app'); if(app)state.settings={...state.settings,...app.value};
  try{state.timers=JSON.parse(safeStorage.getItem('cookbook-timers')||'[]')}catch{state.timers=[]}
}
function saveTimers(){safeStorage.setItem('cookbook-timers',JSON.stringify(state.timers));renderTimerIndicators()}
function saveSettings(){return dbPut('settings',{id:'app',value:state.settings})}

function bindEvents(){
  document.addEventListener('error',e=>{const img=e.target;if(img?.matches?.('img[data-recipe-image]'))replaceBrokenRecipeImage(img)},true);
  document.addEventListener('click',async e=>{
    const nav=e.target.closest('[data-nav]');
    if(nav){setView(nav.dataset.nav,nav.dataset.filter||'');return}
    const close=e.target.closest('[data-close-modal]');if(close){closeModals();return}
    const fav=e.target.closest('[data-favorite-id]');if(fav){e.preventDefault();e.stopPropagation();await toggleFavorite(fav.dataset.favoriteId);return}
    const recipeCard=e.target.closest('[data-recipe-id]');if(recipeCard){openRecipe(recipeCard.dataset.recipeId);return}
    const filter=e.target.closest('[data-recipe-filter]');if(filter){state.recipeFilter=filter.dataset.recipeFilter;renderRecipeFilters();renderRecipes();return}
    const collection=e.target.closest('[data-collection-filter]');if(collection){state.collectionFilter=collection.dataset.collectionFilter;renderRecipeFilters();renderRecipes();return}
    const pfilter=e.target.closest('[data-pantry-filter]');if(pfilter){state.pantryFilter=pfilter.dataset.pantryFilter;renderPantry();return}
    const shopToggle=e.target.closest('[data-shop-toggle]');if(shopToggle){await toggleShopping(shopToggle.dataset.shopToggle);return}
    const shopDel=e.target.closest('[data-shop-delete]');if(shopDel){await removeShopping(shopDel.dataset.shopDelete);return}
    const pantryDel=e.target.closest('[data-pantry-delete]');if(pantryDel){await removePantry(pantryDel.dataset.pantryDelete);return}
    const timerDel=e.target.closest('[data-timer-delete]');if(timerDel){removeTimer(timerDel.dataset.timerDelete);return}
    const timerAdd=e.target.closest('[data-step-timer]');if(timerAdd){addTimer(timerAdd.dataset.label,+timerAdd.dataset.seconds);return}
  });
  $('#addRecipeBtn').addEventListener('click',()=>openRecipeForm());
  $('#recipeSearch').addEventListener('input',renderRecipes);
  $('#clearSearch').addEventListener('click',()=>{$('#recipeSearch').value='';renderRecipes()});
  $('#sortRecipesBtn').addEventListener('click',()=>{state.recipeSort=state.recipeSort==='new'?'az':'new';$('#sortRecipesBtn').textContent=state.recipeSort==='new'?'Сначала новые':'По алфавиту';renderRecipes()});
  $('#shoppingForm').addEventListener('submit',addShoppingManual);
  $('#pantryForm').addEventListener('submit',addPantry);
  $('#scanPantryBtn').addEventListener('click',()=>{$('[data-view="pantry"] input[name="name"]')?.focus()});
  $('#clearBoughtBtn').addEventListener('click',clearBought);
  $('#openTimersBtn').addEventListener('click',()=>openModal('timerModal'));
  $('#timerForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);const sec=(+f.get('minutes')||0)*60+(+f.get('seconds')||0);if(sec>0)addTimer(f.get('label')||'Кухонный таймер',sec)});
  $('#nearMatchToggle').addEventListener('change',renderSmart);
  $('#themeSelect').addEventListener('change',async e=>{state.settings.theme=e.target.value;applySettings();await saveSettings()});
  $('#largeTextToggle').addEventListener('change',async e=>{state.settings.largeText=e.target.checked;applySettings();await saveSettings()});
  $('#autoCatalogToggle').addEventListener('change',async e=>{state.settings.autoCatalog=e.target.checked;await saveSettings();renderSettings();if(e.target.checked)scheduleAutoCatalogUpdate(true)});
  $('#exportBtn').addEventListener('click',exportBook);
  $('#importFile').addEventListener('change',importBook);
  $('#importCatalogBtn').addEventListener('click',importOpenCatalog);
  $('#addDemoPackBtn').addEventListener('click',restoreSeed);
  $('#resetBtn').addEventListener('click',resetAll);
  $('#exitStepMode').addEventListener('click',exitStepMode);
  $('#prevStepBtn').addEventListener('click',()=>changeStep(-1));
  $('#nextStepBtn').addEventListener('click',()=>changeStep(1));
  $('#stepIngredientsBtn').addEventListener('click',()=>{state.stepIngredients=!state.stepIngredients;renderStepMode()});
  $('#stepTimerBtn').addEventListener('click',()=>{const s=state.currentRecipe?.steps?.[state.stepIndex];if(s?.timer)addTimer(`${state.currentRecipe.title}: шаг ${state.stepIndex+1}`,s.timer*60)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tickTimers();wireRecipeCards()}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if($('#stepMode')?.classList.contains('open'))exitStepMode();else closeModals()}});
  window.addEventListener('pageshow',()=>wireRecipeCards());
  window.addEventListener('unhandledrejection',event=>console.error('Необработанная ошибка приложения',event.reason));
}

function setView(name,filter=''){
  if(filter){state.recipeFilter=filter==='favorite'?'Избранное':filter;state.collectionFilter='all'}
  state.activeView=name;
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===name||(name==='pantry'&&b.dataset.nav==='settings')));
  const titles={home:'Моя кухня',recipes:'Все рецепты',smart:'Умный подбор',shopping:'Покупки',pantry:'Остатки',settings:'Настройки'};
  $('#pageTitle').textContent=titles[name]||'Offline Cookbook';
  window.scrollTo({top:0,behavior:'instant'});
  if(name==='recipes'){renderRecipeFilters();renderRecipes()}
  if(name==='smart')renderSmart();
  if(name==='shopping')renderShopping();
  if(name==='pantry')renderPantry();
  if(name==='settings')renderSettings();
}

function applySettings(){
  const t=state.settings.theme;
  if(t==='system')document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; else document.documentElement.dataset.theme=t;
  document.body.classList.toggle('large-text',!!state.settings.largeText);
  if($('#themeSelect'))$('#themeSelect').value=t;
  if($('#largeTextToggle'))$('#largeTextToggle').checked=!!state.settings.largeText;
}
function renderAll(){renderHome();renderRecipeFilters();renderRecipes();renderSmart();renderShopping();renderPantry();renderSettings();renderTimerIndicators();renderCatalogSyncStatus()}

function generatedCover(r,compact=false){
  const colors={
    'Завтраки':['#f3bd53','#b86426'],'Салаты':['#86b96d','#2e6849'],'Супы':['#e18658','#853728'],'Основные блюда':['#c9725d','#642b2a'],'Рыба':['#79aec1','#28566f'],'Рыба и морепродукты':['#79aec1','#28566f'],'Гарниры':['#c5a05a','#725124'],'Паста':['#d4a05a','#91482e'],'Паста и лапша':['#d4a05a','#91482e'],'Десерты':['#d98bb0','#744d79'],'Выпечка':['#c99a6d','#754529'],'Закуски':['#e39151','#8c3c28'],'Овощные блюда':['#8bb05e','#42642f'],'Соусы':['#9aac5b','#465c2e'],'Напитки':['#6db5b4','#235969'],'Заготовки':['#b58a67','#68452e']
  };
  const [a,b]=colors[r.category]||['#777','#333'];
  return `<div class="generated-cover" style="background:linear-gradient(145deg,${a},${b})"><span>${esc(r.emoji||'🍽️')}</span>${compact?'':`<small>${esc(r.cuisine||r.category||'Рецепт')}</small>`}</div>`;
}
function imageHTML(r,cls=''){
  if(r.image)return `<img data-recipe-image data-category="${esc(r.category||'')}" data-cuisine="${esc(r.cuisine||'')}" data-emoji="${esc(r.emoji||'🍽️')}" class="${esc(cls)}" src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy" decoding="async">`;
  return generatedCover(r);
}
function replaceBrokenRecipeImage(img){
  const box=document.createElement('div');
  box.innerHTML=generatedCover({category:img.dataset.category,cuisine:img.dataset.cuisine,emoji:img.dataset.emoji||'🍽️'});
  img.replaceWith(box.firstElementChild);
}
function sourceLabel(r){return r.sourceName&&r.sourceName!=='Offline Cookbook'?r.sourceName:'Локальный рецепт'}
function recipeCardHTML(recipe,match=null){
  const r=normalizeRecipeMetadata(recipe);
  return `<article class="recipe-card" data-recipe-id="${esc(r.id)}" role="button" tabindex="0" aria-label="Открыть рецепт: ${esc(r.title)}">
    <div class="recipe-card-image">${imageHTML(r)}${match!==null?`<span class="match-badge">${Math.round(match.score*100)}% · ${match.missing} нет</span>`:''}<button type="button" class="favorite-btn ${r.favorite?'active':''}" data-favorite-id="${esc(r.id)}" aria-label="${r.favorite?'Убрать из избранного':'Добавить в избранное'}">${r.favorite?'♥':'♡'}</button></div>
    <div class="recipe-card-body"><span class="recipe-card-category">${esc(r.category||'Рецепт')}</span><h3 class="recipe-title">${esc(r.title)}</h3><div class="recipe-meta"><span>◷ ${(+r.prepTime||0)+(+r.cookTime||0)} мин</span><span>◎ ${esc(r.equipment?.[0]||'Кухня')}</span></div></div>
  </article>`;
}

function renderHome(){
  const fav=state.recipes.filter(r=>r.favorite).length;
  $('#favoriteCount').textContent=`${fav} ${plural(fav,'рецепт','рецепта','рецептов')}`;
  const pending=state.shopping.filter(x=>!x.checked).length;
  $('#shoppingCount').textContent=pending?`${pending} не куплено`:'Список пуст';
  $('#pantryCount').textContent=`${state.pantry.length} ${plural(state.pantry.length,'продукт','продукта','продуктов')}`;
  $('#heroPantryText').textContent=state.pantry.length?`В запасах ${state.pantry.length} продуктов. Покажем блюда с лучшим совпадением.`:'Добавьте продукты в остатки — приложение найдёт подходящие блюда.';
  const scored=getSmartMatches().slice(0,5);
  const fallback=[...state.recipes].sort((a,b)=>(b.favorite-a.favorite)||(b.createdAt-a.createdAt)).slice(0,5).map(r=>({recipe:r,score:0,missing:0}));
  $('#homeRecommendations').innerHTML=(scored.length?scored:fallback).map(x=>recipeCardHTML(x.recipe,scored.length?x:null)).join('');
  wireRecipeCards($('#homeRecommendations'));
}
const CANONICAL_CATEGORIES=['Завтраки','Закуски','Салаты','Супы','Основные блюда','Овощные блюда','Рыба и морепродукты','Паста и лапша','Гарниры','Выпечка','Десерты','Соусы','Напитки','Заготовки'];
const RECIPE_COLLECTIONS=[
  {key:'all',label:'Все подборки'},
  {key:'vegan',label:'Веганские'},
  {key:'vegetarian',label:'Вегетарианские'},
  {key:'lowCal',label:'До 400 ккал'},
  {key:'highProtein',label:'Белковые'},
  {key:'glutenFree',label:'Без глютена'},
  {key:'quick',label:'До 30 минут'},
  {key:'drinks',label:'Напитки'}
];
function recipeCategories(){const available=new Set(state.recipes.map(r=>r.category).filter(Boolean));return ['Все','Избранное','Аэрогриль','Духовка','Мультиварка','Плита',...CANONICAL_CATEGORIES.filter(x=>available.has(x)),...[...available].filter(x=>!CANONICAL_CATEGORIES.includes(x)).sort((a,b)=>a.localeCompare(b,'ru'))]}
function renderRecipeFilters(){
  $('#recipeFilters').innerHTML=recipeCategories().map(x=>`<button class="chip ${state.recipeFilter===x?'active':''}" data-recipe-filter="${esc(x)}">${esc(x)}</button>`).join('');
  const mount=$('#recipeCollections');if(mount)mount.innerHTML=RECIPE_COLLECTIONS.map(x=>{const count=x.key==='all'?state.recipes.length:state.recipes.filter(r=>(r.collections||[]).includes(x.key)).length;return `<button class="chip collection-chip ${state.collectionFilter===x.key?'active':''}" data-collection-filter="${x.key}">${esc(x.label)} <small>${count}</small></button>`}).join('');
}
function filteredRecipes(){
  let list=[...state.recipes];const q=norm($('#recipeSearch')?.value||'');const f=state.recipeFilter;
  if(f==='Избранное')list=list.filter(r=>r.favorite);else if(f!=='Все')list=list.filter(r=>r.category===f||r.equipment?.includes(f));
  if(state.collectionFilter!=='all')list=list.filter(r=>(r.collections||[]).includes(state.collectionFilter));
  if(q)list=list.filter(r=>norm([r.title,r.originalTitle,r.category,r.cuisine,...(r.tags||[]),...(r.ingredients||[]).map(i=>i.name)].join(' ')).includes(q));
  list.sort(state.recipeSort==='az'?(a,b)=>a.title.localeCompare(b.title,'ru'):(a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return list;
}
function renderRecipes(){
  const list=filteredRecipes();$('#recipeResultCount').textContent=`${list.length} ${plural(list.length,'рецепт','рецепта','рецептов')}`;
  $('#recipeGrid').innerHTML=list.map(r=>recipeCardHTML(r)).join('');$('#emptyRecipes').hidden=!!list.length;
  wireRecipeCards($('#recipeGrid'));
}

const pantryAliases={
  'помидор':'томат','помидоры':'томат','томаты':'томат','томат':'томат','курица':'курица','куриное филе':'курица','куриная грудка':'курица','куриные бедра':'курица','куриные бёдра':'курица','фарш индейки':'индейка','филе индейки':'индейка','картофель':'картофель','картошка':'картофель','яйца':'яйцо','яйцо':'яйцо','репчатый лук':'лук','красный лук':'лук','лук':'лук','чеснок':'чеснок','морковь':'морковь','рис отварной':'рис','рис':'рис','творог 5%':'творог','творог':'творог','шампиньоны':'грибы','грибы':'грибы','болгарский перец':'перец','перец':'перец','огурцы':'огурец','огурец':'огурец','капуста':'капуста','цветная капуста':'цветная капуста','нут консервированный':'нут','нут сухой замоченный':'нут','нут':'нут','красная фасоль':'фасоль','белая фасоль':'фасоль','фасоль':'фасоль','томаты в собственном соку':'томат','томатное пюре':'томат','томатный соус':'томат','томатная паста':'томат'
};
const staples=new Set(['соль','перец','чёрный перец','черный перец','вода','растительное масло','оливковое масло','масло','масло спрей','специи']);
function productKey(name){const n=norm(name);return pantryAliases[n]||n.replace(/(ы|и|а|я|ов|ев)$/,'')}
function ingredientAvailable(ingredient,keys){const k=productKey(ingredient.name);return keys.some(p=>p===k||p.includes(k)||k.includes(p))}
function getSmartMatches(){
  if(!state.pantry.length)return [];
  const keys=state.pantry.map(p=>productKey(p.name));
  return state.recipes.map(recipe=>{
    const needed=(recipe.ingredients||[]).filter(i=>!staples.has(norm(i.name)));
    const have=needed.filter(i=>ingredientAvailable(i,keys)).length;
    const missing=Math.max(0,needed.length-have); const score=needed.length?have/needed.length:0;
    return {recipe,score,missing,total:needed.length};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.missing-b.missing||a.recipe.title.localeCompare(b.recipe.title,'ru'));
}
function renderSmart(){
  const all=getSmartMatches();const near=$('#nearMatchToggle').checked;const list=all.filter(x=>near?x.missing<=3:x.missing===0);
  $('#smartResults').innerHTML=list.map(x=>recipeCardHTML(x.recipe,x)).join('');$('#emptySmart').hidden=!!list.length;
  wireRecipeCards($('#smartResults'));
}

async function toggleFavorite(id){
  const raw=findRecipeById(id);if(!raw){toast('Рецепт не найден');return}
  const r=normalizeRecipeMetadata(raw);r.favorite=!r.favorite;
  const index=state.recipes.findIndex(x=>sameId(x.id,id));if(index>=0)state.recipes[index]=r;
  try{await dbPut('recipes',r)}catch(err){console.error(err);toast('Не удалось сохранить избранное')}
  renderAll();if(state.currentRecipe&&sameId(state.currentRecipe.id,id))openRecipe(id);
}
function openRecipe(id){
  const raw=findRecipeById(id);
  if(!raw){console.warn('Рецепт не найден',id);toast('Не удалось открыть рецепт');return}
  try{
    const r=normalizeRecipeMetadata(raw);
    const index=state.recipes.findIndex(x=>sameId(x.id,id));if(index>=0)state.recipes[index]=r;
    state.currentRecipe=r;state.currentServings=clamp(+r.servings||1,1,99);
    renderRecipeDetail();openModal('recipeModal');
    requestAnimationFrame(()=>{$('#recipeModal .modal-sheet')?.scrollTo?.({top:0,behavior:'instant'})});
    if(JSON.stringify(raw)!==JSON.stringify(r))dbPut('recipes',r).catch(console.error);
  }catch(err){
    console.error('Не удалось открыть рецепт',id,err);
    toast('Карточка рецепта повреждена и была восстановлена');
    try{
      state.currentRecipe=normalizeRecipeMetadata({id:String(id),title:raw?.title||'Рецепт',ingredients:raw?.ingredients||[],steps:raw?.steps||[]});
      state.currentServings=+state.currentRecipe.servings||1;renderRecipeDetail();openModal('recipeModal');
    }catch(fallbackError){console.error(fallbackError)}
  }
}
function translationBadgeHTML(recipe){
  const status=String(recipe?.translationStatus||'');
  if(!status)return'';
  if(status.startsWith('needs-refresh'))return'<span class="translation-mark pending">↻ Исправляем перевод из первоисточника</span>';
  if(status.includes('partial'))return'<span class="translation-mark partial">◐ Часть редких терминов сохранена на языке источника</span>';
  return'<span class="translation-mark">◎ Переведено на русский с сохранением оригинала</span>';
}
function sanitizeDamagedTranslation(recipe,translator){
  if(!translator?.looksCorrupted?.(recipe))return recipe;
  const next={...recipe};
  if(translator.looksCorrupted(next.title))next.title=next.originalTitle||'Рецепт из интернет-каталога';
  if(translator.looksCorrupted(next.description))next.description='Перевод описания обновляется из первоисточника.';
  next.ingredients=(next.ingredients||[]).map((item,index)=>{
    const value=normalizeIngredient(item,index);
    if(translator.looksCorrupted(value.name))return{...value,name:item?.originalName||`Ингредиент ${index+1}`};
    return value;
  });
  next.steps=(next.steps||[]).map((step,index)=>{
    const value=normalizeStep(step,index);
    if(translator.looksCorrupted(value.text))return{...value,title:`Этап ${index+1}`,text:step?.originalText||'Перевод этого этапа обновляется. Откройте первоисточник или дождитесь завершения синхронизации каталога.'};
    return value;
  });
  next.tips=(next.tips||[]).map(value=>translator.looksCorrupted(value)?'Совет обновляется вместе с переводом рецепта.':value);
  if(translator.looksCorrupted(next.storage))next.storage='Рекомендации по хранению обновляются вместе с переводом рецепта.';
  return next;
}

function renderRecipeDetail(){
  const r=state.currentRecipe;if(!r)return;const factor=state.currentServings/(+r.servings||1);
  const total=(+r.prepTime||0)+(+r.cookTime||0);
  const nutrition=[r.calories?`${fmt(r.calories)} ккал / порция`:'',r.protein?`Белки ${fmt(r.protein)} г`:'',r.rating?`★ ${fmt(r.rating)}`:''].filter(Boolean);
  const description=r.description||`Подробный рецепт блюда «${r.title}» с пересчётом ингредиентов, таймерами и пошаговым режимом.`;
  const tips=(Array.isArray(r.tips)?r.tips:String(r.tips||'').split(/\n+/)).filter(Boolean);
  const collectionBadges=(r.collections||[]).filter(k=>['vegan','vegetarian','lowCal','glutenFree','highProtein'].includes(k)).slice(0,3).map(k=>RECIPE_COLLECTIONS.find(x=>x.key===k)?.label).filter(Boolean);
  const steps=(r.steps||[]).map((s,i)=>`<div class="step-line"><span class="step-number">${i+1}</span><div class="step-content"><b class="step-title">${esc(s.title||inferStepTitle(s.text,i))}</b><p>${esc(s.text)}</p>${s.timer?`<button class="text-btn step-timer" data-step-timer data-label="${esc(r.title+': шаг '+(i+1))}" data-seconds="${s.timer*60}">◷ Запустить таймер · ${s.timer} мин</button>`:''}</div></div>`).join('');
  $('#recipeDetail').innerHTML=`
    <div class="detail-cover">${imageHTML(r)}<span class="detail-source-badge">${esc(sourceLabel(r))}</span><button type="button" class="detail-close" data-close-modal aria-label="Закрыть рецепт">×</button></div>
    <div class="detail-header"><div class="detail-badges"><span>${esc(r.category||'Рецепт')}</span><span>${esc(r.cuisine||'Домашняя')}</span><span>${esc((r.equipment||[]).join(', ')||'Без техники')}</span>${collectionBadges.map(x=>`<span class="diet-badge">${esc(x)}</span>`).join('')}</div><h2>${esc(r.title)}</h2>${r.originalTitle&&r.originalTitle!==r.title?`<p class="original-title">Оригинальное название: ${esc(r.originalTitle)}</p>`:''}<p class="detail-summary">${esc(description)}</p>${translationBadgeHTML(r)}</div>
    <div class="detail-stats"><div class="stat-card"><small>Всего</small><b>${total} мин</b></div><div class="stat-card"><small>Сложность</small><b>${esc(r.difficulty||difficultyFromRecipe(r))}</b></div><div class="stat-card"><small>Порций</small><b>${state.currentServings}</b></div>${r.calories?`<div class="stat-card"><small>Энергия</small><b>${fmt(r.calories)} ккал</b></div>`:''}</div>
    <div class="detail-actions"><button class="primary-action" id="startStepsBtn">▶ Готовить</button><button id="detailFavoriteBtn">${r.favorite?'♥ В избранном':'♡ Избранное'}</button><button id="editRecipeBtn">✎ Изменить</button></div>
    <div class="serving-control"><div><b>Количество порций</b><small>Количество каждого ингредиента пересчитается автоматически</small></div><div class="serving-stepper"><button id="minusServing" aria-label="Уменьшить">−</button><strong id="servingValue">${state.currentServings}</strong><button id="plusServing" aria-label="Увеличить">＋</button></div></div>
    <section class="detail-section"><div class="row-between"><div><p class="section-kicker">ПОДГОТОВЬТЕ ЗАРАНЕЕ</p><h3>Ингредиенты</h3></div><button class="text-btn" id="addAllShoppingBtn">＋ В покупки</button></div><div id="detailIngredients">${ingredientLines(r,factor)}</div>${nutrition.length?`<p class="nutrition-note">${esc(nutrition.join(' · '))}</p>`:''}</section>
    <section class="detail-section"><p class="section-kicker">ПОШАГОВАЯ ТЕХНОЛОГИЯ</p><h3>Приготовление</h3><div class="steps-list">${steps}</div></section>
    ${tips.length?`<section class="detail-section detail-advice"><p class="section-kicker">ПОЛЕЗНО ЗНАТЬ</p><h3>Советы повара</h3><ul class="tip-list">${tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>`:''}
    ${r.storage?`<section class="detail-section storage-card"><div><b>Хранение и разогрев</b><p>${esc(r.storage)}</p></div></section>`:''}
    ${(r.source||r.video)?`<section class="detail-section"><p class="section-kicker">ДОПОЛНИТЕЛЬНО</p><h3>Источник и видео</h3><div class="source-links">${r.source?`<a class="secondary-btn" target="_blank" rel="noopener noreferrer" href="${esc(r.source)}">Открыть первоисточник ↗</a>`:''}${r.video?`<a class="secondary-btn" target="_blank" rel="noopener noreferrer" href="${esc(r.video)}">Видеоинструкция ↗</a>`:''}</div></section>`:''}
    <section class="detail-section"><button class="secondary-btn delete-recipe" id="deleteRecipeBtn">Удалить рецепт с устройства</button></section>`;
  $('#minusServing').onclick=()=>{state.currentServings=clamp(state.currentServings-1,1,99);renderRecipeDetail()};
  $('#plusServing').onclick=()=>{state.currentServings=clamp(state.currentServings+1,1,99);renderRecipeDetail()};
  $('#detailFavoriteBtn').onclick=()=>toggleFavorite(r.id);
  $('#startStepsBtn').onclick=()=>startStepMode(r);
  $('#editRecipeBtn').onclick=()=>{closeModals();openRecipeForm(r)};
  $('#addAllShoppingBtn').onclick=()=>addRecipeToShopping(r,factor);
  $('#deleteRecipeBtn').onclick=()=>deleteRecipe(r.id);
}
function inferStepTitle(text,index){const n=norm(text);if(/нареж|очист|промой|обсуш|подготов/.test(n))return'Подготовка';if(/марин|остав|замоч|охлад/.test(n))return'Выдержка';if(/обжар|вар|запек|готов|туш|выпек/.test(n))return'Приготовление';if(/смеш|соедин|добав|влей|вмеш/.test(n))return'Сборка';return`Этап ${index+1}`}
function difficultyFromRecipe(r){const score=(+r.prepTime||0)+(+r.cookTime||0)+(r.steps?.length||0)*4;return score<40?'Легко':score<85?'Средне':'Сложнее'}
function ingredientLines(r,factor){const items=(r.ingredients||[]).map(normalizeIngredient).filter(i=>i.name);if(!items.length)return'<p class="detail-empty-note">Ингредиенты не указаны. Откройте первоисточник или измените рецепт.</p>';return items.map((i,index)=>`<label class="ingredient-line"><input type="checkbox" aria-label="Отметить ${esc(i.name)}"><span class="ingredient-name">${esc(titleCase(i.name))}</span><span class="ingredient-amount">${i.amount!==''&&i.amount!=null&&Number.isFinite(+i.amount)?fmtAmount(+i.amount*factor):esc(i.amount||'')} ${esc(i.unit||'')}</span></label>`).join('')}
async function deleteRecipe(id){if(!confirm('Удалить этот рецепт из локальной книги?'))return;const recipe=findRecipeById(id);if(!recipe)return;await dbDelete('recipes',recipe.id);state.recipes=state.recipes.filter(r=>!sameId(r.id,id));closeModals();renderAll();toast('Рецепт удалён')}

function openRecipeForm(recipe=null){
  state.editingId=recipe?.id||null;state.photoData=recipe?.image||'';
  const r=recipe||{title:'',description:'',category:'Основные блюда',cuisine:'Домашняя',equipment:['Плита'],servings:4,prepTime:10,cookTime:20,difficulty:'Легко',calories:'',ingredients:[{name:'',amount:'',unit:''}],steps:[{text:'',timer:0}],tips:[],storage:'',video:'',source:''};
  $('#recipeFormMount').innerHTML=`<form class="recipe-editor" id="recipeEditor"><h2>${recipe?'Изменить рецепт':'Новый рецепт'}</h2>
    <button type="button" class="editor-photo" id="editorPhotoBtn">${state.photoData?`<img src="${esc(state.photoData)}" alt="Фото">`:'<span>📷<br><small>Добавить локальное фото</small></span>'}</button><input id="editorPhotoInput" type="file" accept="image/*" capture="environment" hidden>
    <label>Название<input name="title" required value="${esc(r.title)}" placeholder="Например, паста с томатами"></label>
    <label>Краткое описание<textarea name="description" placeholder="Что это за блюдо, каким получится и для какого случая подходит">${esc(r.description||'')}</textarea></label>
    <div class="form-row"><label>Категория<input name="category" required value="${esc(r.category||'')}"></label><label>Кухня<input name="cuisine" value="${esc(r.cuisine||'')}"></label></div>
    <div class="form-row"><label>Техника<select name="equipment">${['Аэрогриль','Духовка','Мультиварка','Плита','Без техники'].map(x=>`<option ${r.equipment?.includes(x)?'selected':''}>${x}</option>`).join('')}</select></label><label>Порций<input name="servings" type="number" min="1" value="${+r.servings||4}"></label></div>
    <div class="form-row"><label>Подготовка, мин<input name="prepTime" type="number" min="0" value="${+r.prepTime||0}"></label><label>Готовка, мин<input name="cookTime" type="number" min="0" value="${+r.cookTime||0}"></label></div>
    <div class="form-row"><label>Сложность<select name="difficulty">${['Легко','Средне','Сложнее'].map(x=>`<option ${r.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Ккал / порция<input name="calories" type="number" min="0" value="${r.calories??''}" placeholder="необязательно"></label></div>
    <div><div class="row-between"><h3>Ингредиенты</h3><button type="button" class="editor-add" id="addIngredientRow">＋ Добавить</button></div><div id="ingredientRows">${(r.ingredients||[]).map(ingredientEditorRow).join('')}</div></div>
    <div><div class="row-between"><h3>Шаги</h3><button type="button" class="editor-add" id="addStepRow">＋ Добавить</button></div><div id="stepRows">${(r.steps||[]).map(stepEditorRow).join('')}</div></div>
    <label>Советы повара<textarea name="tips" placeholder="Каждый совет с новой строки">${esc((Array.isArray(r.tips)?r.tips:[]).join('\n'))}</textarea></label>
    <label>Хранение и разогрев<textarea name="storage" placeholder="Сколько и как хранить блюдо">${esc(r.storage||'')}</textarea></label>
    <label>Ссылка на видео<input name="video" type="url" value="${esc(r.video||'')}" placeholder="https://youtube.com/..."></label>
    <label>Ссылка на источник<input name="source" type="url" value="${esc(r.source||'')}" placeholder="https://..."></label>
    <button class="primary-btn" type="submit">Сохранить рецепт</button></form>`;
  $('#editorPhotoBtn').onclick=()=>$('#editorPhotoInput').click();
  $('#editorPhotoInput').onchange=handleEditorPhoto;
  $('#addIngredientRow').onclick=()=>$('#ingredientRows').insertAdjacentHTML('beforeend',ingredientEditorRow({name:'',amount:'',unit:''}));
  $('#addStepRow').onclick=()=>$('#stepRows').insertAdjacentHTML('beforeend',stepEditorRow({text:'',timer:0}));
  $('#recipeEditor').addEventListener('click',e=>{const b=e.target.closest('.remove-row');if(b)b.parentElement.remove()});
  $('#recipeEditor').addEventListener('submit',saveRecipeFromForm);
  openModal('formModal');
}
function ingredientEditorRow(i){return `<div class="ingredient-editor-row"><input data-ing-name required value="${esc(i.name||'')}" placeholder="Продукт"><input data-ing-amount inputmode="decimal" value="${esc(i.amount??'')}" placeholder="Кол-во"><input data-ing-unit value="${esc(i.unit||'')}" placeholder="ед."><button type="button" class="remove-row">×</button></div>`}
function stepEditorRow(s){return `<div class="step-editor-row"><input data-step-text required value="${esc(s.text||'')}" placeholder="Описание шага"><input data-step-time type="number" min="0" value="${+s.timer||0}" placeholder="мин"><button type="button" class="remove-row">×</button></div>`}
async function handleEditorPhoto(e){const file=e.target.files?.[0];if(!file)return;try{state.photoData=await compressImage(file,1400,.82);$('#editorPhotoBtn').innerHTML=`<img src="${state.photoData}" alt="Фото">`;toast('Фото сохранится локально')}catch(err){toast('Не удалось обработать фото')}}
function compressImage(file,maxSize=1400,quality=.82){return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height;const k=Math.min(1,maxSize/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',quality))};img.onerror=reject;img.src=url})}
async function saveRecipeFromForm(e){
  e.preventDefault();const f=new FormData(e.currentTarget);const old=state.recipes.find(r=>r.id===state.editingId);
  const ingredients=$$('[data-ing-name]',e.currentTarget).map((el,i)=>({name:el.value.trim(),amount:parseAmount($$('[data-ing-amount]',e.currentTarget)[i].value),unit:$$('[data-ing-unit]',e.currentTarget)[i].value.trim()})).filter(x=>x.name);
  const steps=$$('[data-step-text]',e.currentTarget).map((el,i)=>({text:el.value.trim(),timer:+$$('[data-step-time]',e.currentTarget)[i].value||0})).filter(x=>x.text);
  if(!ingredients.length||!steps.length){toast('Добавьте ингредиент и хотя бы один шаг');return}
  const recipe=normalizeRecipeMetadata({id:old?.id||uid('recipe'),title:f.get('title').trim(),description:f.get('description').trim(),category:f.get('category').trim(),cuisine:f.get('cuisine').trim(),equipment:[f.get('equipment')],servings:+f.get('servings')||1,prepTime:+f.get('prepTime')||0,cookTime:+f.get('cookTime')||0,difficulty:f.get('difficulty')||difficultyFromRecipe({prepTime:+f.get('prepTime')||0,cookTime:+f.get('cookTime')||0,steps}),calories:+f.get('calories')||'',ingredients,steps:steps.map((step,i)=>({...step,title:old?.steps?.[i]?.title||inferStepTitle(step.text,i)})),tips:String(f.get('tips')||'').split(/\n+/).map(x=>x.trim()).filter(Boolean),storage:f.get('storage').trim(),image:state.photoData,video:f.get('video').trim(),source:f.get('source').trim(),sourceName:old?.sourceName||'Пользовательский рецепт',favorite:old?.favorite||false,builtIn:false,schemaVersion:5,emoji:old?.emoji||'🍽️',createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()});
  await dbPut('recipes',recipe);const idx=state.recipes.findIndex(r=>r.id===recipe.id);if(idx>=0)state.recipes[idx]=recipe;else state.recipes.push(recipe);closeModals();renderAll();toast('Рецепт сохранён')
}
function parseAmount(v){const s=String(v).replace(',','.').trim();if(!s)return '';const n=Number(s);return Number.isFinite(n)?n:s}

async function addShoppingManual(e){e.preventDefault();const f=new FormData(e.currentTarget);const item={id:uid('shop'),name:f.get('name').trim(),amount:parseAmount(f.get('amount')),unit:f.get('unit').trim(),checked:false,createdAt:Date.now()};if(!item.name)return;await dbPut('shopping',item);state.shopping.push(item);e.currentTarget.reset();renderAll()}
async function addRecipeToShopping(recipe,factor=1){
  for(const ing of recipe.ingredients||[]){
    const key=productKey(ing.name);let existing=state.shopping.find(x=>!x.checked&&productKey(x.name)===key&&norm(x.unit)===norm(ing.unit));
    const amount=typeof ing.amount==='number'?ing.amount*factor:ing.amount;
    if(existing&&typeof amount==='number'&&typeof existing.amount==='number'){existing.amount+=amount;await dbPut('shopping',existing)}else{const item={id:uid('shop'),name:ing.name,amount,unit:ing.unit||'',checked:false,recipeId:recipe.id,createdAt:Date.now()};state.shopping.push(item);await dbPut('shopping',item)}
  }
  renderAll();toast('Ингредиенты добавлены в покупки')
}
async function toggleShopping(id){const x=state.shopping.find(i=>i.id===id);if(!x)return;x.checked=!x.checked;await dbPut('shopping',x);renderAll()}
async function removeShopping(id){await dbDelete('shopping',id);state.shopping=state.shopping.filter(x=>x.id!==id);renderAll()}
async function clearBought(){const bought=state.shopping.filter(x=>x.checked);for(const x of bought)await dbDelete('shopping',x.id);state.shopping=state.shopping.filter(x=>!x.checked);renderAll();toast('Купленное удалено')}
function renderShopping(){
  const pending=state.shopping.filter(x=>!x.checked);$('#shoppingSummary').textContent=pending.length?`Осталось купить: ${pending.length}`:'Всё куплено';
  const list=[...state.shopping].sort((a,b)=>a.checked-b.checked||b.createdAt-a.createdAt);
  $('#shoppingList').innerHTML=list.map(x=>`<div class="list-item ${x.checked?'done':''}"><button class="check ${x.checked?'checked':''}" data-shop-toggle="${x.id}">${x.checked?'✓':''}</button><div class="list-item-main"><b>${esc(titleCase(x.name))}</b><small>${x.amount!==''?fmt(x.amount):''} ${esc(x.unit||'')}</small></div><button class="delete-mini" data-shop-delete="${x.id}">×</button></div>`).join('');$('#emptyShopping').hidden=!!list.length;
}

async function addPantry(e){e.preventDefault();const f=new FormData(e.currentTarget);const item={id:uid('pantry'),name:f.get('name').trim(),amount:parseAmount(f.get('amount')),unit:f.get('unit').trim(),expiry:f.get('expiry'),createdAt:Date.now()};if(!item.name)return;await dbPut('pantry',item);state.pantry.push(item);e.currentTarget.reset();renderAll();toast('Продукт добавлен')}
async function removePantry(id){await dbDelete('pantry',id);state.pantry=state.pantry.filter(x=>x.id!==id);renderAll()}
function expiryState(date){if(!date)return {cls:'',text:'Срок не указан',days:null};const today=new Date();today.setHours(0,0,0,0);const d=new Date(date+'T00:00:00');const days=Math.ceil((d-today)/86400000);if(days<0)return{cls:'expiry-bad',text:`Просрочено ${Math.abs(days)} дн.`,days};if(days<=3)return{cls:'expiry-soon',text:days===0?'Истекает сегодня':`Осталось ${days} дн.`,days};return{cls:'',text:`Годен до ${d.toLocaleDateString('ru-RU')}`,days}}
function renderPantry(){
  $$('.pantry-filters .chip').forEach(x=>x.classList.toggle('active',x.dataset.pantryFilter===state.pantryFilter));
  let list=[...state.pantry].map(x=>({...x,_exp:expiryState(x.expiry)}));
  if(state.pantryFilter==='soon')list=list.filter(x=>x._exp.days!==null&&x._exp.days>=0&&x._exp.days<=3);if(state.pantryFilter==='expired')list=list.filter(x=>x._exp.days<0);
  list.sort((a,b)=>(a._exp.days??99999)-(b._exp.days??99999));
  $('#pantrySummary').textContent=`В запасе: ${state.pantry.length}`;
  $('#pantryList').innerHTML=list.map(x=>`<div class="list-item"><span style="font-size:25px">${foodEmoji(x.name)}</span><div class="list-item-main"><b>${esc(titleCase(x.name))}</b><small>${x.amount!==''?fmt(x.amount):''} ${esc(x.unit||'')} · <span class="${x._exp.cls}">${x._exp.text}</span></small></div><button class="delete-mini" data-pantry-delete="${x.id}">×</button></div>`).join('');$('#emptyPantry').hidden=!!list.length;
}
function foodEmoji(n){const s=norm(n);if(s.includes('кур'))return'🍗';if(s.includes('рыб')||s.includes('лосос')||s.includes('тун'))return'🐟';if(s.includes('яй'))return'🥚';if(s.includes('мол')||s.includes('слив'))return'🥛';if(s.includes('сыр'))return'🧀';if(s.includes('томат')||s.includes('помид'))return'🍅';if(s.includes('карто'))return'🥔';if(s.includes('морков'))return'🥕';if(s.includes('яблок'))return'🍎';if(s.includes('банан'))return'🍌';if(s.includes('лук'))return'🧅';if(s.includes('рис'))return'🍚';if(s.includes('гриб'))return'🍄';return'🥬'}

function openModal(id){const m=$('#'+id);if(!m){console.error('Модальное окно не найдено',id);return}m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');if(id==='timerModal')renderTimers()}
function closeModals(){$$('.modal.open').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')});document.body.classList.remove('modal-open')}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2300)}
function plural(n,one,few,many){const a=Math.abs(n)%100,b=a%10;if(a>10&&a<20)return many;if(b>1&&b<5)return few;if(b===1)return one;return many}

function startStepMode(recipe){state.currentRecipe=recipe;state.stepIndex=0;state.stepIngredients=false;closeModals();$('#stepMode').classList.add('open');$('#stepMode').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderStepMode();try{navigator.wakeLock?.request('screen').then(lock=>state.wakeLock=lock).catch(()=>{})}catch{}}
function exitStepMode(){$('#stepMode').classList.remove('open');$('#stepMode').setAttribute('aria-hidden','true');document.body.style.overflow='';state.wakeLock?.release?.().catch(()=>{});state.wakeLock=null}
function changeStep(delta){if(state.stepIngredients){state.stepIngredients=false;renderStepMode();return}const max=(state.currentRecipe?.steps?.length||1)-1;if(delta>0&&state.stepIndex>=max){exitStepMode();toast('Готово! Приятного аппетита');return}state.stepIndex=clamp(state.stepIndex+delta,0,max);renderStepMode()}
function renderStepMode(){
  const r=state.currentRecipe;if(!r)return;const steps=r.steps||[];const s=steps[state.stepIndex]||{text:'Готово',timer:0};
  $('#stepRecipeTitle').textContent=r.title;$('#stepProgress').textContent=state.stepIngredients?'Ингредиенты':`${s.title||inferStepTitle(s.text,state.stepIndex)} · ${state.stepIndex+1}/${steps.length}`;$('#stepImage').innerHTML=imageHTML(r);
  if(state.stepIngredients){const factor=state.currentServings/(r.servings||1);$('#stepText').innerHTML=(r.ingredients||[]).map(i=>`<span class="step-ingredient">${esc(titleCase(i.name))}<b>${i.amount!==''?fmtAmount((+i.amount||0)*factor):''} ${esc(i.unit||'')}</b></span>`).join('');$('#stepTimerBtn').hidden=true}
  else{$('#stepText').textContent=s.text;$('#stepTimerBtn').hidden=!s.timer;$('#stepTimerBtn').textContent=s.timer?`Запустить таймер на ${s.timer} мин`:''}
  $('#prevStepBtn').disabled=state.stepIndex===0&&!state.stepIngredients;$('#nextStepBtn').textContent=state.stepIndex===steps.length-1?'Завершить':'Далее'
}

function addTimer(label,seconds){if(!seconds||seconds<1)return;const timer={id:uid('timer'),label:String(label||'Кухонный таймер'),endAt:Date.now()+seconds*1000,done:false};state.timers.push(timer);saveTimers();renderTimers();toast(`Таймер запущен: ${formatTime(seconds)}`);if('Notification' in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{})}
function removeTimer(id){state.timers=state.timers.filter(t=>t.id!==id);saveTimers();renderTimers()}
function restoreTimers(){tickTimers();clearInterval(restoreTimers._i);restoreTimers._i=setInterval(tickTimers,1000)}
function tickTimers(){let changed=false;for(const t of state.timers){const left=Math.max(0,Math.ceil((t.endAt-Date.now())/1000));if(left===0&&!t.done){t.done=true;changed=true;timerFinished(t)}}if(changed)saveTimers();renderTimers();renderTimerIndicators()}
function timerFinished(t){try{navigator.vibrate?.([200,100,200,100,500])}catch{};if('Notification' in window&&Notification.permission==='granted')new Notification('Время вышло',{body:t.label,icon:'./icons/icon-192.png'});toast(`⏰ ${t.label}: время вышло`)}
function renderTimers(){const mount=$('#timerList');if(!mount)return;const timers=[...state.timers].sort((a,b)=>a.done-b.done||a.endAt-b.endAt);mount.innerHTML=timers.length?timers.map(t=>{const left=Math.max(0,Math.ceil((t.endAt-Date.now())/1000));return `<div class="timer-card ${t.done?'done':''}"><div><b>${esc(t.label)}</b><small style="display:block;color:var(--muted)">${t.done?'Время вышло':'Работает'}</small></div><time>${formatTime(left)}</time><button class="delete-mini" data-timer-delete="${t.id}">×</button></div>`}).join(''):'<div class="empty-state" style="padding:30px 10px"><div>◷</div><h3>Таймеров пока нет</h3></div>'}
function renderTimerIndicators(){const active=state.timers.filter(t=>!t.done).length;const done=state.timers.filter(t=>t.done).length;$('#timerCount').textContent=done?`${done} завершено`:active?`${active} активных`:'Нет активных'}
function formatTime(sec){sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}

function renderSettings(){const online=state.recipes.filter(r=>r.externalKey||r.externalId).length;const translated=state.recipes.filter(r=>r.translationStatus).length;const updated=state.settings.catalogUpdatedAt?new Date(state.settings.catalogUpdatedAt).toLocaleDateString('ru-RU'):'';$('#databaseStats').textContent=`${state.recipes.length} рецептов · ${online} из интернета · ${translated} переведено${updated?' · обновлено '+updated:''}`;$('#themeSelect').value=state.settings.theme;$('#largeTextToggle').checked=state.settings.largeText;if($('#autoCatalogToggle'))$('#autoCatalogToggle').checked=state.settings.autoCatalog!==false}
async function exportBook(){
  const payload={app:'Offline Cookbook',version:5,exportedAt:new Date().toISOString(),recipes:state.recipes,pantry:state.pantry,shopping:state.shopping,settings:state.settings};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`offline-cookbook-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Книга экспортирована')
}
async function importBook(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.recipes))throw new Error('Неверный формат');if(!confirm(`Импортировать ${data.recipes.length} рецептов? Текущая база будет заменена.`))return;for(const s of ['recipes','pantry','shopping'])await dbClear(s);await bulkPut('recipes',data.recipes);await bulkPut('pantry',data.pantry||[]);await bulkPut('shopping',data.shopping||[]);state.settings={...state.settings,...(data.settings||{})};await saveSettings();await loadState();await migrateRecipeCatalog();applySettings();renderAll();toast('Книга импортирована')}catch(err){console.error(err);toast('Файл не похож на экспорт Offline Cookbook')}finally{e.target.value=''}}
async function restoreSeed(){
  const before=(await dbAll('recipes')).length;await syncBuiltInCatalog(await dbAll('recipes'),true);await loadState();await migrateRecipeCatalog();renderAll();const added=Math.max(0,state.recipes.length-before);toast(added?`Добавлено и обновлено рецептов: ${added}`:'Встроенный каталог обновлён до актуальной версии')
}
async function resetAll(){if(!confirm('Удалить рецепты, фотографии, покупки и остатки с этого устройства?'))return;if(!confirm('Подтвердите полную очистку ещё раз.'))return;for(const s of STORES)await dbClear(s);safeStorage.removeItem('cookbook-timers');state.recipes=[];state.pantry=[];state.shopping=[];state.timers=[];state.settings={theme:'system',largeText:false,autoCatalog:true,catalogUpdateIntervalDays:7,translationRepairRequired:false,translatorVersion:window.RU_TRANSLATOR?.version||0};await bulkPut('recipes',window.SEED_RECIPES||[]);await loadState();applySettings();renderAll();setView('home');toast('Данные очищены, подробный встроенный каталог восстановлен')}

async function fetchJSON(url,timeout=22000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error(`${response.status} ${url}`);return await response.json()}finally{clearTimeout(timer)}
}
let catalogImportPromise=null;
function setCatalogSyncStatus(text,busy=false){
  const el=$('#catalogSyncStatus');if(!el)return;el.textContent=text;el.classList.toggle('busy',busy);
}
function renderCatalogSyncStatus(){
  if(state.catalogImporting){setCatalogSyncStatus('Загружаем и переводим без транслитерации…',true);return}
  if(state.settings.translationRepairRequired){setCatalogSyncStatus(navigator.onLine?'Требуется обновление перевода':'Перевод обновится после подключения к интернету',navigator.onLine);return}
  if(!navigator.onLine){setCatalogSyncStatus('Офлайн · сохранённая база');return}
  if(state.settings.catalogUpdatedAt){const date=new Date(state.settings.catalogUpdatedAt);setCatalogSyncStatus(`Обновлено ${date.toLocaleDateString('ru-RU')}`);return}
  setCatalogSyncStatus(state.settings.autoCatalog===false?'Автообновление выключено':'Автообновление включено');
}
function scheduleAutoCatalogUpdate(force=false){
  if(!scheduleAutoCatalogUpdate._onlineBound){window.addEventListener('online',()=>scheduleAutoCatalogUpdate(true));scheduleAutoCatalogUpdate._onlineBound=true}
  const repair=!!state.settings.translationRepairRequired;
  if((state.settings.autoCatalog===false&&!repair)||!navigator.onLine||state.catalogImporting)return;
  if(repair)force=true;
  const interval=(+state.settings.catalogUpdateIntervalDays||7)*86400000;
  const age=Date.now()-(+state.settings.catalogUpdatedAt||0);
  const internetCount=state.recipes.filter(r=>r.externalKey||r.externalId).length;
  if(!force&&age<interval&&internetCount>=150)return;
  clearTimeout(scheduleAutoCatalogUpdate._timer);
  scheduleAutoCatalogUpdate._timer=setTimeout(()=>importOpenCatalog({automatic:true}),force?300:1400);
}
async function mapLimit(items,limit,worker){
  const results=new Array(items.length);let cursor=0;
  const run=async()=>{while(cursor<items.length){const index=cursor++;results[index]=await worker(items[index],index)}};
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return results;
}
async function importOpenCatalog(options={}){
  if(options?.type)options={};
  const automatic=!!options.automatic;
  if(catalogImportPromise)return catalogImportPromise;
  if(!navigator.onLine){if(!automatic)toast('Для загрузки каталога нужен интернет');return}
  catalogImportPromise=(async()=>{
    state.catalogImporting=true;renderCatalogSyncStatus();
    const overlay=automatic?null:document.createElement('div');
    if(overlay){overlay.className='loading-overlay';overlay.innerHTML='<div class="loading-card"><div class="spinner"></div><b>Обновляем большой каталог</b><p>Загружаем рецепты из четырёх источников, переводим их на русский и распределяем по категориям.</p><small id="catalogProgress">Подготовка…</small></div>';document.body.appendChild(overlay)}
    const progress=text=>{const el=$('#catalogProgress');if(el)el.textContent=text;setCatalogSyncStatus(text,true)};
    try{
      const incoming=[];const errors=[];const letters='abcdefghijklmnopqrstuvwxyz'.split('');
      let completed=0;
      await mapLimit(letters,4,async(letter)=>{
        try{const data=await fetchJSON(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);for(const meal of data.meals||[])incoming.push(mealToRecipe(meal))}catch(error){errors.push(error)}
        completed++;progress(`TheMealDB · ${completed}/${letters.length} · найдено ${incoming.length}`);
      });
      progress('DummyJSON · загружаем блюда и пищевую ценность…');
      try{const data=await fetchJSON('https://dummyjson.com/recipes?limit=1000');for(const item of data.recipes||[])incoming.push(dummyRecipeToRecipe(item))}catch(error){errors.push(error)}
      completed=0;
      await mapLimit(letters,4,async(letter)=>{
        try{const data=await fetchJSON(`https://www.thecocktaildb.com/api/json/v1/1/search.php?f=${letter}`);for(const drink of data.drinks||[])incoming.push(cocktailToRecipe(drink))}catch(error){errors.push(error)}
        completed++;progress(`TheCocktailDB · ${completed}/${letters.length} · найдено ${incoming.length}`);
      });
      progress('Викиучебник · загружаем русскоязычные хорошие рецепты…');
      try{incoming.push(...await fetchWikibooksRecipes(progress))}catch(error){errors.push(error)}

      const rawUnique=new Map();for(const item of incoming.filter(Boolean))rawUnique.set(item.externalKey||item.id,item);
      if(!rawUnique.size)throw new Error('Ни один источник не вернул рецепты');
      progress(`Проверяем перевод · 0/${rawUnique.size}`);
      const prepared=await prepareImportedRecipes([...rawUnique.values()],progress);
      const unique=new Map();for(const recipe of prepared.filter(Boolean))unique.set(recipe.externalKey||recipe.id,recipe);
      let added=0,updated=0;const changed=[],toSave=[];
      const byKey=new Map(state.recipes.map(r=>[r.externalKey||((r.sourceName&&r.externalId)?`${String(r.sourceName).toLowerCase()}:${r.externalId}`:r.id),r]));
      let index=0;
      for(const recipe of unique.values()){
        index++;if(index%25===0)progress(`Сохраняем и индексируем · ${index}/${unique.size}`);
        const old=byKey.get(recipe.externalKey)||state.recipes.find(r=>r.id===recipe.id);
        if(old){
          const merged=normalizeRecipeMetadata({...old,...recipe,id:old.id,favorite:!!old.favorite,createdAt:old.createdAt||recipe.createdAt,updatedAt:Date.now()});
          const pos=state.recipes.findIndex(r=>r.id===old.id);if(pos>=0)state.recipes[pos]=merged;byKey.set(merged.externalKey||merged.id,merged);toSave.push(merged);updated++;changed.push(merged);
        }else{
          state.recipes.push(recipe);byKey.set(recipe.externalKey||recipe.id,recipe);toSave.push(recipe);added++;changed.push(recipe);
        }
      }
      await bulkPutFast('recipes',toSave);
      state.settings.catalogUpdatedAt=Date.now();
      state.settings.translationRepairRequired=false;
      state.settings.translatorVersion=window.RU_TRANSLATOR?.version||0;
      state.settings.catalogSourceCounts={
        mealdb:state.recipes.filter(r=>r.sourceName==='TheMealDB').length,
        dummyjson:state.recipes.filter(r=>r.sourceName==='DummyJSON').length,
        cocktaildb:state.recipes.filter(r=>r.sourceName==='TheCocktailDB').length,
        wikibooks:state.recipes.filter(r=>r.sourceName==='Викиучебник').length
      };
      await saveSettings();renderAll();
      const firstBatch=changed.filter(r=>r.image).slice(0,80);
      if(firstBatch.length){progress(`Сохраняем фотографии офлайн · 0/${firstBatch.length}`);await primeImageCache(firstBatch,(done,total)=>progress(`Сохраняем фотографии офлайн · ${done}/${total}`))}
      const rest=changed.filter(r=>r.image).slice(80);if(rest.length)primeImageCache(rest).catch(()=>{});
      const total=added+updated;
      if(!automatic||added>0)toast(total?`Каталог обновлён: +${added}, обновлено ${updated}`:'Каталог уже актуален');
      if(errors.length)console.warn('Некоторые источники загрузились не полностью',errors);
    }catch(err){console.error(err);if(!automatic)toast('Каталог загрузился не полностью. Проверьте интернет и повторите обновление')}finally{
      overlay?.remove();state.catalogImporting=false;catalogImportPromise=null;renderCatalogSyncStatus();
    }
  })();
  return catalogImportPromise;
}
async function fetchWikibooksRecipes(progress){
  const base='https://ru.wikibooks.org/w/api.php';
  const categoryUrl=new URL(base);categoryUrl.search=new URLSearchParams({action:'query',list:'categorymembers',cmtitle:'Категория:Хорошие рецепты',cmlimit:'500',format:'json',origin:'*'}).toString();
  const categoryData=await fetchJSON(categoryUrl.toString(),30000);
  const titles=(categoryData.query?.categorymembers||[]).map(x=>x.title).filter(x=>x.startsWith('Рецепт:'));
  const recipes=[];const batches=[];for(let i=0;i<titles.length;i+=20)batches.push(titles.slice(i,i+20));
  for(let i=0;i<batches.length;i++){
    progress(`Викиучебник · пакет ${i+1}/${batches.length} · найдено ${recipes.length}`);
    const url=new URL(base);url.search=new URLSearchParams({action:'query',prop:'extracts|pageimages|info',explaintext:'1',exsectionformat:'plain',piprop:'thumbnail',pithumbsize:'900',inprop:'url',redirects:'1',titles:batches[i].join('|'),format:'json',origin:'*'}).toString();
    const data=await fetchJSON(url.toString(),30000);
    for(const page of Object.values(data.query?.pages||{})){const recipe=wikibookPageToRecipe(page);if(recipe)recipes.push(recipe)}
  }
  return recipes;
}

async function primeImageCache(recipes,onProgress){
  if(!('caches'in window)||!recipes.length)return;const cache=await caches.open('offline-cookbook-media-v4');let cursor=0,done=0;
  const worker=async()=>{while(cursor<recipes.length){const recipe=recipes[cursor++];try{const request=new Request(recipe.image,{mode:'no-cors',credentials:'omit'});if(!await cache.match(request)){const response=await fetch(request);await cache.put(request,response)}}catch{}finally{done++;onProgress?.(done,recipes.length)}}};
  await Promise.all(Array.from({length:Math.min(5,recipes.length)},worker));
}
function splitInstructionText(value){
  const cleaned=String(value||'').replace(/<[^>]*>/g,' ').replace(/\r/g,'\n').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').trim();if(!cleaned)return[];
  let parts=cleaned.split(/\n{2,}|\n(?=(?:step\s*)?\d{1,2}[.):\-]\s*)/i).map(x=>x.replace(/^(?:step\s*)?\d{1,2}[.):\-]?\s*/i,'').trim()).filter(Boolean);
  if(parts.length<2){const sentences=cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(Boolean)||[cleaned];parts=[];for(let i=0;i<sentences.length;i+=2)parts.push(sentences.slice(i,i+2).join(' '))}
  return parts.filter(x=>x.length>3).slice(0,24);
}
function mealToRecipe(m){
  const ingredients=[];
  for(let i=1;i<=20;i++){
    const name=(m[`strIngredient${i}`]||'').trim(),measure=(m[`strMeasure${i}`]||'').trim();
    if(!name)continue;const parsed=parseExternalMeasure(measure);ingredients.push({name,amount:parsed.amount,unit:parsed.unit});
  }
  const raw=splitInstructionText(m.strInstructions);
  const steps=(raw.length?raw:['Следуйте инструкции первоисточника.']).map((text,i)=>({title:inferStepTitle(text,i),text,timer:extractMinutes(text)}));
  const cookTime=estimateCookTime(m.strInstructions),title=m.strMeal||'Рецепт TheMealDB';
  return {
    id:`mealdb-${m.idMeal}`,externalId:String(m.idMeal),externalKey:`themealdb:${m.idMeal}`,
    title,originalTitle:title,originalLanguage:'en',
    description:'Международный рецепт из открытого каталога TheMealDB. Сохранены оригинальная последовательность приготовления, фотография, ссылка на источник и видео, когда они доступны.',
    sourceCategory:m.strCategory||'',mealTypes:[m.strCategory||''],category:sourceCategoryToCategory(m.strCategory),cuisine:m.strArea||'International',
    equipment:detectEquipment(m.strInstructions),servings:4,prepTime:estimatePrepTime(ingredients,steps),cookTime,
    difficulty:difficultyFromRecipe({prepTime:15,cookTime,steps}),ingredients,steps,
    tips:['Сначала прочитайте весь рецепт и подготовьте ингредиенты.','Ориентируйтесь не только на время, но и на внешний вид, аромат и текстуру блюда.'],
    storage:'Остудите готовое блюдо, переложите в закрытый контейнер и храните в холодильнике до 2–3 дней, если первоисточник не указывает иначе.',
    image:m.strMealThumb||'',video:m.strYoutube||`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' recipe')}`,
    source:m.strSource||`https://www.themealdb.com/meal/${m.idMeal}`,sourceName:'TheMealDB',favorite:false,builtIn:false,
    schemaVersion:5,emoji:emojiForCategory(m.strCategory),createdAt:Date.now(),updatedAt:Date.now(),
    tags:String(m.strTags||'').split(',').map(x=>x.trim()).filter(Boolean)
  };
}
function dummyRecipeToRecipe(m){
  const ingredients=(m.ingredients||[]).map(parseIngredientString).filter(x=>x.name);
  const steps=(m.instructions||[]).map((text,i)=>({title:inferStepTitle(text,i),text:String(text).trim(),timer:extractMinutes(text)}));
  const title=m.name||`Recipe ${m.id}`;
  return {
    id:`dummyjson-${m.id}`,externalId:String(m.id),externalKey:`dummyjson:${m.id}`,
    title,originalTitle:title,originalLanguage:'en',
    description:'Подробная карточка из открытой коллекции DummyJSON: указаны время, сложность, порции и энергетическая ценность.',
    sourceCategory:[...(m.mealType||[]),...(m.tags||[])].join(', '),mealTypes:m.mealType||[],category:categoryFromMealTypes(m.mealType,m.tags),cuisine:m.cuisine||'International',
    equipment:detectEquipment((m.instructions||[]).join(' ')),servings:+m.servings||4,prepTime:+m.prepTimeMinutes||10,cookTime:+m.cookTimeMinutes||20,
    difficulty:translateDifficulty(m.difficulty),calories:+m.caloriesPerServing||'',rating:+m.rating||'',ingredients,steps,
    tips:['Подготовьте все продукты до начала готовки и сверяйте консистенцию блюда после каждого ключевого этапа.','При необходимости откройте поиск видео: он формируется автоматически.'],
    storage:'Храните готовое блюдо в закрытом контейнере в холодильнике до 2–3 дней. Для хрустящих блюд лучше использовать повторный разогрев в духовке или аэрогриле.',
    image:m.image||'',video:`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' recipe video')}`,
    source:`https://dummyjson.com/recipes/${m.id}`,sourceName:'DummyJSON',favorite:false,builtIn:false,schemaVersion:5,
    emoji:emojiForCategory(categoryFromMealTypes(m.mealType,m.tags)),createdAt:Date.now(),updatedAt:Date.now(),tags:[...(m.tags||[]),...(m.mealType||[])]
  };
}
function cocktailToRecipe(m){
  const ingredients=[];
  for(let i=1;i<=15;i++){
    const name=(m[`strIngredient${i}`]||'').trim(),measure=(m[`strMeasure${i}`]||'').trim();
    if(!name)continue;const parsed=parseExternalMeasure(measure);ingredients.push({name,amount:parsed.amount,unit:parsed.unit});
  }
  const raw=splitInstructionText(m.strInstructions||m.strInstructionsEN||'');
  const steps=(raw.length?raw:['Соедините ингредиенты по инструкции источника и подавайте в подходящем бокале.']).map((text,i)=>({title:inferStepTitle(text,i),text,timer:extractMinutes(text)}));
  const title=m.strDrink||'Напиток';
  const alcoholic=/alcoholic/i.test(m.strAlcoholic||'')&&!/non alcoholic/i.test(m.strAlcoholic||'');
  return {
    id:`cocktaildb-${m.idDrink}`,externalId:String(m.idDrink),externalKey:`cocktaildb:${m.idDrink}`,
    title,originalTitle:title,originalLanguage:'en',
    description:`Рецепт ${alcoholic?'коктейля':'напитка'} из открытого каталога TheCocktailDB. Указаны состав, способ смешивания и рекомендуемая подача.`,
    sourceCategory:m.strCategory||'Drink',mealTypes:['Drink',m.strAlcoholic||''],category:'Напитки',cuisine:'Мировая',equipment:['Без техники'],
    servings:1,prepTime:8,cookTime:0,difficulty:'Легко',ingredients,steps,
    tips:[`Охладите ${m.strGlass?`посуду «${m.strGlass}»`:'бокал'} заранее.`,`Лёд добавляйте непосредственно перед подачей, чтобы напиток не стал водянистым.`],
    storage:'Большинство смешанных напитков лучше подавать сразу после приготовления. Заготовки без газированной воды можно хранить в холодильнике несколько часов.',
    image:m.strDrinkThumb||'',video:`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' cocktail recipe')}`,
    source:`https://www.thecocktaildb.com/drink/${m.idDrink}`,sourceName:'TheCocktailDB',favorite:false,builtIn:false,schemaVersion:5,
    emoji:alcoholic?'🍹':'🥤',createdAt:Date.now(),updatedAt:Date.now(),tags:[m.strCategory,m.strAlcoholic,m.strGlass].filter(Boolean),alcoholic
  };
}
function wikibookPageToRecipe(page){
  const title=String(page.title||'').replace(/^Рецепт:/,'').trim();
  const extract=String(page.extract||'').trim();if(!title||!extract)return null;
  const parsed=parseWikibookExtract(extract);
  if(parsed.ingredients.length<2||parsed.steps.length<1)return null;
  const recipe={
    id:`wikibooks-${page.pageid}`,externalId:String(page.pageid),externalKey:`wikibooks:${page.pageid}`,
    title,originalTitle:title,originalLanguage:'ru',description:parsed.description||`Русскоязычный рецепт «${title}» из открытой Кулинарной книги Викиучебника.`,
    sourceCategory:parsed.sectionHints.join(', '),mealTypes:parsed.sectionHints,category:'Основные блюда',cuisine:'Русская / международная',
    equipment:detectEquipment(parsed.steps.map(x=>x.text).join(' ')),servings:4,prepTime:estimatePrepTime(parsed.ingredients,parsed.steps),
    cookTime:estimateCookTime(parsed.steps.map(x=>x.text).join(' ')),difficulty:difficultyFromRecipe({prepTime:15,cookTime:30,steps:parsed.steps}),
    ingredients:parsed.ingredients,steps:parsed.steps,tips:['Перед началом прочитайте рецепт полностью и подготовьте продукты.','Количество соли, специй и время обработки корректируйте по вкусу и особенностям техники.'],
    storage:'Условия хранения зависят от состава блюда. Готовую еду быстро остудите, уберите в закрытый контейнер и храните в холодильнике.',
    image:page.thumbnail?.source||'',video:`https://www.youtube.com/results?search_query=${encodeURIComponent(title+' подробный рецепт')}`,
    source:page.canonicalurl||page.fullurl||`https://ru.wikibooks.org/wiki/${encodeURIComponent(page.title)}`,sourceName:'Викиучебник',license:'CC BY-SA',
    favorite:false,builtIn:false,schemaVersion:5,emoji:'🍽️',createdAt:Date.now(),updatedAt:Date.now(),tags:['Викиучебник','Хороший рецепт']
  };
  return normalizeRecipeMetadata(recipe);
}
function parseWikibookExtract(value){
  const text=String(value||'').replace(/\r/g,'\n').replace(/\u00a0/g,' ');
  const lines=text.split(/\n+/).map(x=>x.replace(/^[*#•–—\-]+\s*/,'').trim()).filter(Boolean);
  let mode='intro';const intro=[],ingredientLines=[],stepLines=[],sectionHints=[];
  const ingredientHead=/^(ингредиенты|состав|необходимые продукты|продукты)$/i;
  const stepHead=/^(приготовление|способ приготовления|технология приготовления|инструкция|рецепт)$/i;
  const stopHead=/^(примечания|литература|ссылки|см\. также|источники)$/i;
  for(const line of lines){
    const plain=line.replace(/[:.]$/,'').trim();
    if(ingredientHead.test(plain)){mode='ingredients';sectionHints.push('Ингредиенты');continue}
    if(stepHead.test(plain)){mode='steps';sectionHints.push('Приготовление');continue}
    if(stopHead.test(plain)){mode='stop';continue}
    if(mode==='intro')intro.push(line);else if(mode==='ingredients')ingredientLines.push(line);else if(mode==='steps')stepLines.push(line);
  }
  let ingredients=ingredientLines.flatMap(line=>line.split(/;(?=\s*[А-ЯA-Z0-9])/)).map(parseRussianIngredientString).filter(x=>x.name&&x.name.length>1).slice(0,40);
  let rawSteps=stepLines;
  if(!rawSteps.length){
    const marker=text.search(/(?:приготовление|способ приготовления|технология)/i);
    if(marker>=0)rawSteps=splitInstructionText(text.slice(marker));
  }
  let steps=rawSteps.flatMap(x=>splitInstructionText(x)).filter(x=>x.length>12).slice(0,24).map((step,i)=>({title:inferStepTitle(step,i),text:step,timer:extractMinutes(step)}));
  if(!ingredients.length){
    ingredients=lines.filter(x=>/\d|по вкусу/i.test(x)&&/(г|кг|мл|л|стак|лож|шт|зубчик|пучок|соль|перец)/i.test(x)).map(parseRussianIngredientString).filter(x=>x.name).slice(0,30);
  }
  if(!steps.length){
    steps=splitInstructionText(text).filter(x=>x.length>25&&!ingredients.some(i=>norm(x).includes(norm(i.name)))).slice(-12).map((step,i)=>({title:inferStepTitle(step,i),text:step,timer:extractMinutes(step)}));
  }
  const description=intro.join(' ').replace(/\s+/g,' ').slice(0,520);
  return{description,ingredients,steps,sectionHints};
}
function parseRussianIngredientString(line){
  const text=String(line||'').replace(/\s+/g,' ').replace(/[.;]$/,'').trim();
  if(!text)return{name:'',amount:'',unit:''};
  let match=text.match(/^(.+?)\s*[—–-]\s*((?:\d+[\d\s.,/¼½¾⅓⅔⅛⅜⅝⅞-]*|по вкусу))\s*(г|кг|мл|л|шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?|стакан(?:а|ов)?|зубчик(?:а|ов)?|пучок(?:а|ов)?|банк(?:а|и)?|ломтик(?:а|ов)?)?$/i);
  if(match)return{name:match[1].trim(),amount:/по вкусу/i.test(match[2])?'':parseFractionNumber(match[2].replace(/-/g,'')),unit:/по вкусу/i.test(match[2])?'по вкусу':(match[3]||'')};
  match=text.match(/^((?:\d+[\d\s.,/¼½¾⅓⅔⅛⅜⅝⅞-]*|по вкусу))\s*(г|кг|мл|л|шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?|стакан(?:а|ов)?|зубчик(?:а|ов)?|пучок(?:а|ов)?|банк(?:а|и)?|ломтик(?:а|ов)?)?\s+(.+)$/i);
  if(match)return{name:match[3].trim(),amount:/по вкусу/i.test(match[1])?'':parseFractionNumber(match[1].replace(/-/g,'')),unit:/по вкусу/i.test(match[1])?'по вкусу':(match[2]||'')};
  return{name:text,amount:'',unit:''};
}
function parseIngredientString(line){
  const text=String(line||'').trim();if(!text)return{name:'',amount:'',unit:''};
  const match=text.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|grams?|g|kg|ml|l|oz|ounces?|lb|pounds?|cloves?|pieces?|pcs?)?\s+(.+)$/i);
  if(!match)return{name:text,amount:'',unit:''};
  return{name:(match[3]||text).replace(/^of\s+/i,'').trim(),amount:parseFractionNumber(match[1]),unit:match[2]||''};
}
function parseFractionNumber(value){
  if(!value)return'';const glyphs={'¼':.25,'½':.5,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};if(glyphs[value])return glyphs[value];
  const mixed=String(value).match(/^(\d+)\s+(\d+)\/(\d+)$/);if(mixed)return+mixed[1]+(+mixed[2]/+mixed[3]);
  const frac=String(value).match(/^(\d+)\/(\d+)$/);if(frac)return+frac[1]/+frac[2];const n=Number(String(value).replace(',','.'));return Number.isFinite(n)?n:value;
}
function parseExternalMeasure(s){
  const cleaned=String(s||'').trim();if(!cleaned)return{amount:'',unit:''};
  const match=cleaned.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(.*)$/);if(match)return{amount:parseFractionNumber(match[1]),unit:match[2]||''};
  return{amount:1,unit:cleaned};
}
function extractMinutes(text){const matches=[...String(text||'').matchAll(/(\d+)\s*(?:hours?|hrs?|час(?:а|ов)?|minutes?|mins?|минут(?:ы)?|мин)/gi)];if(!matches.length)return 0;return matches.reduce((sum,m)=>sum+(/hour|hr|час/i.test(m[0])?+m[1]*60:+m[1]),0)}
function estimateCookTime(text){const nums=[...String(text||'').matchAll(/(\d+)\s*(?:minutes?|mins?|минут(?:ы)?|мин)/gi)].map(x=>+x[1]).filter(x=>x<240);const hours=[...String(text||'').matchAll(/(\d+)\s*(?:hours?|hrs?|час(?:а|ов)?)/gi)].map(x=>+x[1]*60);return clamp([...nums,...hours].reduce((a,b)=>a+b,0)||30,0,240)}
function estimatePrepTime(ingredients,steps){return clamp(8+Math.ceil((ingredients.length||0)/3)*3+Math.min(10,steps.length||0),8,40)}
function detectEquipment(text){const s=norm(text);if(s.includes('air fryer')||s.includes('аэрогрил'))return['Аэрогриль'];if(s.includes('oven')||s.includes('bake')||s.includes('roast')||s.includes('духов')||s.includes('выпека'))return['Духовка'];if(s.includes('slow cooker')||s.includes('multicooker')||s.includes('мультиварк'))return['Мультиварка'];if(s.includes('no cook')||s.includes('chill overnight')||s.includes('без нагрева')||s.includes('смешайте в шейкере'))return['Без техники'];return['Плита']}
function sourceCategoryToCategory(c){return({Breakfast:'Завтраки',Dessert:'Десерты',Seafood:'Рыба и морепродукты',Vegetarian:'Овощные блюда',Pasta:'Паста и лапша',Side:'Гарниры',Starter:'Закуски',Beef:'Основные блюда',Chicken:'Основные блюда',Pork:'Основные блюда',Lamb:'Основные блюда',Vegan:'Овощные блюда',Goat:'Основные блюда',Miscellaneous:'Основные блюда'}[c]||'Основные блюда')}
function categoryFromMealTypes(types=[],tags=[]){const value=[...(types||[]),...(tags||[])].join(' ').toLowerCase();if(/drink|beverage|cocktail|smoothie/.test(value))return'Напитки';if(value.includes('breakfast'))return'Завтраки';if(value.includes('dessert'))return'Десерты';if(value.includes('snack')||value.includes('appetizer'))return'Закуски';if(value.includes('side'))return'Гарниры';if(value.includes('salad'))return'Салаты';if(value.includes('soup'))return'Супы';return'Основные блюда'}
function translateDifficulty(value){return({Easy:'Легко',Medium:'Средне',Hard:'Сложнее'}[value]||value||'Средне')}
function externalRecipeKey(recipe){return recipe.externalKey||((recipe.sourceName&&recipe.externalId)?`${String(recipe.sourceName).toLowerCase()}:${recipe.externalId}`:recipe.id)}
function mergeReusableTranslation(old,raw,hash){
  return normalizeRecipeMetadata({
    ...raw,
    ...old,
    id:old.id,
    favorite:!!old.favorite,
    createdAt:old.createdAt||raw.createdAt,
    updatedAt:Date.now(),
    image:raw.image||old.image,
    video:raw.video||old.video,
    source:raw.source||old.source,
    sourceName:raw.sourceName||old.sourceName,
    sourceCategory:raw.sourceCategory||old.sourceCategory,
    externalId:raw.externalId||old.externalId,
    externalKey:raw.externalKey||old.externalKey,
    servings:raw.servings||old.servings,
    prepTime:Number.isFinite(+raw.prepTime)?+raw.prepTime:old.prepTime,
    cookTime:Number.isFinite(+raw.cookTime)?+raw.cookTime:old.cookTime,
    calories:raw.calories||old.calories,
    rating:raw.rating||old.rating,
    translationSourceHash:hash
  });
}
async function prepareImportedRecipes(recipes,progress){
  const list=Array.isArray(recipes)?recipes:[];
  const output=new Array(list.length);const pending=[];
  const oldByKey=new Map(state.recipes.map(recipe=>[externalRecipeKey(recipe),recipe]));
  const translator=window.RU_TRANSLATOR;const version=translator?.version||0;
  list.forEach((raw,index)=>{
    if(raw.originalLanguage==='ru'||!translator){output[index]=normalizeRecipeMetadata(raw);return}
    const key=externalRecipeKey(raw),old=oldByKey.get(key),hash=translator.sourceHash(raw);
    const reusable=old&&+old.translationVersion>=version&&old.translationSourceHash===hash&&!translator.looksCorrupted(old);
    if(reusable)output[index]=mergeReusableTranslation(old,raw,hash);else pending.push({index,raw});
  });
  if(pending.length){
    const translated=await translator.translateRecipes(pending.map(item=>item.raw),{
      onProgress:(done,total,engine)=>progress(`Перевод на русский · ${done}/${total}${engine?` · ${engine}`:''}`)
    });
    translated.forEach((recipe,index)=>{output[pending[index].index]=normalizeRecipeMetadata(recipe)});
  }
  return output;
}
async function prepareImportedRecipe(recipe){
  const [prepared]=await prepareImportedRecipes([recipe],()=>{});return prepared;
}
function isExternalRecipe(recipe){return!!(recipe.externalKey||recipe.externalId||['TheMealDB','DummyJSON','TheCocktailDB','Викиучебник'].includes(recipe.sourceName))}
async function migrateRecipeCatalog(){
  const changed=[];const next=[];let repairRequired=false;
  const translator=window.RU_TRANSLATOR;const version=translator?.version||0;
  for(const recipe of state.recipes){
    try{
      let migrated=normalizeRecipeMetadata(recipe);
      if(isExternalRecipe(recipe)&&recipe.originalLanguage!=='ru'&&translator){
        const outdated=+recipe.translationVersion<version;
        const corrupted=translator.looksCorrupted(recipe);
        if(outdated||corrupted){migrated=sanitizeDamagedTranslation({...migrated,translationStatus:'needs-refresh-v3'},translator);repairRequired=true}
      }
      const signatureBefore=JSON.stringify([recipe.id,recipe.title,recipe.category,recipe.cuisine,recipe.collections,recipe.translationStatus,recipe.translationVersion,recipe.schemaVersion,recipe.ingredients,recipe.steps,recipe.equipment]);
      const signatureAfter=JSON.stringify([migrated.id,migrated.title,migrated.category,migrated.cuisine,migrated.collections,migrated.translationStatus,migrated.translationVersion,migrated.schemaVersion,migrated.ingredients,migrated.steps,migrated.equipment]);
      if(signatureBefore!==signatureAfter)changed.push(migrated);next.push(migrated);
    }catch(err){console.error('Не удалось мигрировать рецепт',recipe?.id,err);next.push(normalizeRecipeMetadata(recipe))}
  }
  if(changed.length)await bulkPutFast('recipes',changed);state.recipes=next;
  if(repairRequired){state.settings.translationRepairRequired=true;state.settings.catalogUpdatedAt=0;state.settings.translatorVersion=version;await saveSettings()}
}
function normalizeRecipeMetadata(recipe){
  const source=recipe&&typeof recipe==='object'?recipe:{};
  const normalized={...source};
  normalized.id=source.id??source.externalId??uid('recipe');
  normalized.title=String(source.title??source.name??source.originalTitle??'Без названия').trim()||'Без названия';
  normalized.originalTitle=source.originalTitle?String(source.originalTitle).trim():'';
  normalized.description=String(source.description??source.summary??'').trim();
  normalized.cuisine=String(source.cuisine??'Домашняя').trim()||'Домашняя';
  normalized.equipment=asArray(source.equipment).flatMap(value=>String(value||'').split(/[,;|]/)).map(value=>value.trim()).filter(Boolean);
  if(!normalized.equipment.length)normalized.equipment=['Без техники'];
  normalized.servings=clamp(Math.round(+source.servings||+source.portions||1),1,99);
  normalized.prepTime=Math.max(0,+source.prepTime||0);normalized.cookTime=Math.max(0,+source.cookTime||0);
  normalized.ingredients=asArray(source.ingredients).map(normalizeIngredient).filter(item=>item.name);
  normalized.steps=asArray(source.steps??source.instructions).map(normalizeStep).filter(step=>step.text);
  if(!normalized.steps.length)normalized.steps=[{title:'Приготовление',text:'Следуйте описанию рецепта и проверяйте готовность блюда по внешнему виду и текстуре.',timer:0}];
  normalized.tips=asArray(source.tips).map(value=>String(value||'').trim()).filter(Boolean);
  normalized.tags=asArray(source.tags).map(value=>String(value||'').trim()).filter(Boolean);
  normalized.mealTypes=asArray(source.mealTypes).map(value=>String(value||'').trim()).filter(Boolean);
  normalized.image=String(source.image??source.photo??'').trim();normalized.video=String(source.video??'').trim();normalized.source=String(source.source??'').trim();
  normalized.favorite=!!source.favorite;normalized.builtIn=!!source.builtIn;
  normalized.createdAt=Number.isFinite(+source.createdAt)?+source.createdAt:Date.now();normalized.updatedAt=Number.isFinite(+source.updatedAt)?+source.updatedAt:Date.now();
  normalized.schemaVersion=Math.max(5,+source.schemaVersion||0);
  normalized.category=classifyRecipeCategory(normalized);
  normalized.emoji=source.emoji||emojiForCategory(normalized.category);
  normalized.collections=inferRecipeCollections(normalized);
  return normalized;
}
function classifyRecipeCategory(recipe){
  const raw=String(recipe.sourceCategory||'').toLowerCase();
  if(recipe.sourceName==='TheCocktailDB')return'Напитки';
  if(raw){
    if(/breakfast/.test(raw))return'Завтраки';if(/dessert/.test(raw))return'Десерты';if(/seafood/.test(raw))return'Рыба и морепродукты';
    if(/pasta|noodle/.test(raw))return'Паста и лапша';if(/side/.test(raw))return'Гарниры';if(/starter|appetizer|snack/.test(raw))return'Закуски';
    if(/vegan|vegetarian/.test(raw))return'Овощные блюда';if(/drink|beverage|cocktail/.test(raw))return'Напитки';
  }
  const heading=norm([recipe.title,recipe.originalTitle,recipe.category,...(recipe.mealTypes||[]),...(recipe.tags||[])].join(' '));
  const ingredientText=norm((recipe.ingredients||[]).map(i=>i.name).join(' '));
  if(/коктейл|напиток|напитки|смузи|лимонад|чай|кофе|мохито|мартини|шейк|пунш|cocktail|drink|smoothie|juice|coffee|tea/.test(heading))return'Напитки';
  if(/соус|майонез|кетчуп|дип|заправк|sauce|dressing|gravy|dip/.test(heading))return'Соусы';
  if(/варень|джем|конфитюр|маринад|солень|заготов|preserve|jam|pickle/.test(heading))return'Заготовки';
  if(/торт|пирог|печень|десерт|морожен|пудинг|мусс|тирамису|чизкейк|конфет|cake|cookie|dessert|ice cream|pudding|brownie|sweet/.test(heading))return'Десерты';
  if(/хлеб|булоч|кекс|маффин|багет|тесто|выпеч|bread|bun|muffin|pastry|dough/.test(heading))return'Выпечка';
  if(/завтрак|омлет|яичниц|панкейк|вафл|каша|гранол|breakfast|omelet|omelette|pancake|waffle|porridge/.test(heading))return'Завтраки';
  if(/салат|salad/.test(heading))return'Салаты';
  if(/суп|борщ|щи|бульон|окрошк|soup|broth|chowder|bisque/.test(heading))return'Супы';
  if(/закуск|брускет|канап|спринг ролл|тапас|starter|appetizer|snack|bruschetta/.test(heading))return'Закуски';
  if(/паста|спагет|макарон|лапш|удон|рамен|вермиш|pasta|spaghetti|noodle|ramen/.test(heading))return'Паста и лапша';
  if(/лосос|тунец|треск|кревет|рыб|морепродукт|мид|кальмар|salmon|tuna|cod|shrimp|fish|seafood/.test(heading))return'Рыба и морепродукты';
  if(/гарнир|пюре|side dish/.test(heading))return'Гарниры';
  const currentMap={'Рыба':'Рыба и морепродукты','Паста':'Паста и лапша'};const current=currentMap[recipe.category]||recipe.category;
  if(CANONICAL_CATEGORIES.includes(current))return current;
  if(/лосос|тунец|треск|кревет|рыб|морепродукт|мид|кальмар|salmon|tuna|cod|shrimp|fish|seafood/.test(ingredientText))return'Рыба и морепродукты';
  if(/овощ|баклажан|кабач|цветн.*капуст|брокколи|нут|чечевиц|фасол|тофу|vegetable|eggplant|zucchini|broccoli|lentil|chickpea|tofu/.test(ingredientText)&&!/(куриц|говядин|свинин|рыб|мяс|chicken|beef|pork|fish|meat)/.test(ingredientText))return'Овощные блюда';
  return'Основные блюда';
}
function inferRecipeCollections(recipe){
  const ingredients=norm((recipe.ingredients||[]).map(i=>i.name).join(' '));
  const all=norm([recipe.title,recipe.originalTitle,recipe.sourceCategory,...(recipe.tags||[]),ingredients].join(' '));
  const result=[];const total=(+recipe.prepTime||0)+(+recipe.cookTime||0);
  const meat=/(мяс|куриц|индейк|говядин|свинин|баранин|бекон|ветчин|колбас|рыб|лосос|тунец|треск|кревет|морепродукт|мид|кальмар|анчоус|желатин|meat|chicken|turkey|beef|pork|lamb|bacon|ham|sausage|fish|salmon|tuna|shrimp|seafood|gelatin)/;
  const animal=/(яйц|молок|сыр|слив|сметан|масло слив|йогурт|мед|мёд|майонез|устричн.*соус|рыбн.*соус|egg|milk|cheese|cream|butter|yogurt|honey|mayonnaise|oyster sauce|fish sauce)/;
  const gluten=/(пшен|мук|хлеб|булоч|макарон|паста|лапш(?!а рис)|крупа манн|ячмен|рожь|кус кус|булгур|соев.*соус|wheat|flour|bread|pasta|noodle|barley|rye|couscous|bulgur|soy sauce)/;
  if((/vegan|веган/.test(all)||((recipe.ingredients||[]).length>0&&!meat.test(all)&&!animal.test(all))))result.push('vegan');
  if(/vegetarian|вегетариан/.test(all)||((recipe.ingredients||[]).length>0&&!meat.test(all)))result.push('vegetarian');
  if(+recipe.calories>0&&+recipe.calories<=400)result.push('lowCal');
  if(+recipe.protein>=20||/(куриц|индейк|говядин|рыб|лосос|тунец|кревет|яйц|творог|тофу|нут|чечевиц|фасол|chicken|turkey|beef|fish|salmon|tuna|shrimp|egg|cottage cheese|tofu|lentil|beans)/.test(all))result.push('highProtein');
  if((recipe.ingredients||[]).length>0&&!gluten.test(all))result.push('glutenFree');
  if(total>0&&total<=30)result.push('quick');
  if(recipe.category==='Напитки')result.push('drinks');
  return[...new Set(result)];
}
function emojiForCategory(value){const s=String(value||'').toLowerCase();if(s.includes('напит'))return'🥤';if(s.includes('десерт'))return'🍰';if(s.includes('выпеч'))return'🥐';if(s.includes('рыб')||s.includes('морепродукт'))return'🐟';if(s.includes('завтрак'))return'🍳';if(s.includes('овощ'))return'🥦';if(s.includes('паста')||s.includes('лапш'))return'🍝';if(s.includes('салат'))return'🥗';if(s.includes('суп'))return'🥣';if(s.includes('соус'))return'🥫';if(s.includes('закуск'))return'🍢';if(s.includes('гарнир'))return'🍚';return'🍽️'}


function setupInstall(){
  const btn=$('#installBtn');const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;if(!standalone)btn.hidden=false;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;btn.hidden=false});
  btn.addEventListener('click',async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else alert('На iPhone откройте меню «Поделиться» в Safari и выберите «На экран Домой». На компьютере используйте пункт установки в адресной строке браузера.')})
}
function registerServiceWorker(){
  if(!('serviceWorker'in navigator))return;
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`);
      registration.update().catch(()=>{});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!safeStorage.getItem('cookbook-sw-reloaded')){safeStorage.setItem('cookbook-sw-reloaded','1');location.reload()}});
      setTimeout(()=>safeStorage.removeItem('cookbook-sw-reloaded'),5000);
    }catch(err){console.error('Service Worker',err)}
  });
}

init();

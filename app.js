'use strict';

const DB_NAME='offline-cookbook-db';
const DB_VERSION=1;
const STORES=['recipes','pantry','shopping','settings'];
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const fmt=n=>Number.isFinite(+n)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(+n):n;
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const titleCase=s=>String(s||'').trim().replace(/^./,m=>m.toUpperCase());
const safeStorage={getItem(k){try{return localStorage.getItem(k)}catch{return null}},setItem(k,v){try{localStorage.setItem(k,v)}catch{}},removeItem(k){try{localStorage.removeItem(k)}catch{}}};

let db;
let deferredInstallPrompt=null;
const state={recipes:[],pantry:[],shopping:[],settings:{theme:'system',largeText:false},activeView:'home',recipeFilter:'Все',recipeSort:'new',pantryFilter:'all',currentRecipe:null,currentServings:1,stepIndex:0,stepIngredients:false,timers:[],photoData:'',editingId:null};

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

async function init(){
  try{db=await openDB()}catch(err){console.error(err);alert('Не удалось открыть локальную базу. Проверьте, что Safari не находится в приватном режиме.');return}
  const existing=await dbAll('recipes');
  if(!existing.length)await bulkPut('recipes',window.SEED_RECIPES||[]);
  await loadState();
  bindEvents();
  applySettings();
  renderAll();
  restoreTimers();
  registerServiceWorker();
  setupInstall();
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
  document.addEventListener('click',async e=>{
    const nav=e.target.closest('[data-nav]');
    if(nav){setView(nav.dataset.nav,nav.dataset.filter||'');return}
    const close=e.target.closest('[data-close-modal]');if(close){closeModals();return}
    const recipeCard=e.target.closest('[data-recipe-id]');
    if(recipeCard&&!e.target.closest('.favorite-btn')){openRecipe(recipeCard.dataset.recipeId);return}
    const fav=e.target.closest('[data-favorite-id]');if(fav){await toggleFavorite(fav.dataset.favoriteId);return}
    const filter=e.target.closest('[data-recipe-filter]');if(filter){state.recipeFilter=filter.dataset.recipeFilter;renderRecipeFilters();renderRecipes();return}
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
  $('#clearBoughtBtn').addEventListener('click',clearBought);
  $('#openTimersBtn').addEventListener('click',()=>openModal('timerModal'));
  $('#timerForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);const sec=(+f.get('minutes')||0)*60+(+f.get('seconds')||0);if(sec>0)addTimer(f.get('label')||'Кухонный таймер',sec)});
  $('#nearMatchToggle').addEventListener('change',renderSmart);
  $('#themeSelect').addEventListener('change',async e=>{state.settings.theme=e.target.value;applySettings();await saveSettings()});
  $('#largeTextToggle').addEventListener('change',async e=>{state.settings.largeText=e.target.checked;applySettings();await saveSettings()});
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
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickTimers()});
}

function setView(name,filter=''){
  if(filter){state.recipeFilter=filter==='favorite'?'Избранное':filter}
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
function renderAll(){renderHome();renderRecipeFilters();renderRecipes();renderSmart();renderShopping();renderPantry();renderSettings();renderTimerIndicators()}

function generatedCover(r,compact=false){
  const colors={
    'Завтраки':['#f3bd53','#b86426'],'Салаты':['#86b96d','#2e6849'],'Супы':['#e18658','#853728'],'Основные блюда':['#c9725d','#642b2a'],'Рыба':['#79aec1','#28566f'],'Гарниры':['#c5a05a','#725124'],'Паста':['#d4a05a','#91482e'],'Десерты':['#d98bb0','#744d79'],'Выпечка':['#c99a6d','#754529'],'Закуски':['#e39151','#8c3c28'],'Овощные блюда':['#8bb05e','#42642f'],'Соусы':['#9aac5b','#465c2e']
  };
  const [a,b]=colors[r.category]||['#777','#333'];
  return `<div class="generated-cover" style="background:linear-gradient(145deg,${a},${b})"><span>${esc(r.emoji||'🍽️')}</span>${compact?'':`<small>${esc(r.cuisine||r.category||'Рецепт')}</small>`}</div>`;
}
function imageHTML(r,cls=''){
  if(r.image)return `<img class="${cls}" src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'generated-cover',innerHTML:'<span>${esc(r.emoji||'🍽️')}</span>'}))">`;
  return generatedCover(r);
}
function recipeCardHTML(r,match=null){
  return `<article class="recipe-card" data-recipe-id="${esc(r.id)}">
    <div class="recipe-card-image">${imageHTML(r)}${match!==null?`<span class="match-badge">${Math.round(match.score*100)}% · ${match.missing} нет</span>`:''}<button class="favorite-btn ${r.favorite?'active':''}" data-favorite-id="${esc(r.id)}" aria-label="Избранное">${r.favorite?'♥':'♡'}</button></div>
    <div class="recipe-card-body"><h3 class="recipe-title">${esc(r.title)}</h3><div class="recipe-meta"><span>◷ ${(+r.prepTime||0)+(+r.cookTime||0)} мин</span><span>◎ ${esc(r.equipment?.[0]||'Кухня')}</span></div></div>
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
}
function recipeCategories(){return ['Все','Избранное','Аэрогриль','Духовка','Мультиварка','Плита',...new Set(state.recipes.map(r=>r.category).filter(Boolean))]}
function renderRecipeFilters(){
  $('#recipeFilters').innerHTML=recipeCategories().map(x=>`<button class="chip ${state.recipeFilter===x?'active':''}" data-recipe-filter="${esc(x)}">${esc(x)}</button>`).join('');
}
function filteredRecipes(){
  let list=[...state.recipes];const q=norm($('#recipeSearch')?.value||'');const f=state.recipeFilter;
  if(f==='Избранное')list=list.filter(r=>r.favorite);else if(f!=='Все')list=list.filter(r=>r.category===f||r.equipment?.includes(f));
  if(q)list=list.filter(r=>norm([r.title,r.category,r.cuisine,...(r.tags||[]),...(r.ingredients||[]).map(i=>i.name)].join(' ')).includes(q));
  list.sort(state.recipeSort==='az'?(a,b)=>a.title.localeCompare(b.title,'ru'):(a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return list;
}
function renderRecipes(){
  const list=filteredRecipes();$('#recipeResultCount').textContent=`${list.length} ${plural(list.length,'рецепт','рецепта','рецептов')}`;
  $('#recipeGrid').innerHTML=list.map(r=>recipeCardHTML(r)).join('');$('#emptyRecipes').hidden=!!list.length;
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
}

async function toggleFavorite(id){const r=state.recipes.find(x=>x.id===id);if(!r)return;r.favorite=!r.favorite;await dbPut('recipes',r);renderAll();if(state.currentRecipe?.id===id)openRecipe(id)}
function openRecipe(id){
  const r=state.recipes.find(x=>x.id===id);if(!r)return;state.currentRecipe=r;state.currentServings=+r.servings||1;
  renderRecipeDetail();openModal('recipeModal');
}
function renderRecipeDetail(){
  const r=state.currentRecipe;if(!r)return;const factor=state.currentServings/(+r.servings||1);
  $('#recipeDetail').innerHTML=`
    <div class="detail-cover">${imageHTML(r)}</div>
    <div class="detail-header"><div class="detail-badges"><span>${esc(r.category||'Рецепт')}</span><span>${esc(r.cuisine||'Домашняя')}</span><span>${esc((r.equipment||[]).join(', '))}</span></div><h2>${esc(r.title)}</h2><div class="recipe-meta"><span>Подготовка ${+r.prepTime||0} мин</span><span>Готовка ${+r.cookTime||0} мин</span></div></div>
    <div class="detail-actions"><button class="primary-action" id="startStepsBtn">▶ Готовить</button><button id="detailFavoriteBtn">${r.favorite?'♥ В избранном':'♡ Избранное'}</button><button id="editRecipeBtn">✎ Изменить</button></div>
    <div class="serving-control"><div><b>Количество порций</b><small style="display:block;color:var(--muted)">Ингредиенты пересчитаются</small></div><div class="serving-stepper"><button id="minusServing">−</button><strong id="servingValue">${state.currentServings}</strong><button id="plusServing">＋</button></div></div>
    <section class="detail-section"><div class="row-between"><h3>Ингредиенты</h3><button class="text-btn" id="addAllShoppingBtn">В покупки</button></div><div id="detailIngredients">${ingredientLines(r,factor)}</div></section>
    <section class="detail-section"><h3>Приготовление</h3>${(r.steps||[]).map((s,i)=>`<div class="step-line"><span class="step-number">${i+1}</span><div><p>${esc(s.text)}</p>${s.timer?`<button class="text-btn" data-step-timer data-label="${esc(r.title+': шаг '+(i+1))}" data-seconds="${s.timer*60}">◷ Таймер ${s.timer} мин</button>`:''}</div></div>`).join('')}</section>
    ${(r.source||r.video)?`<section class="detail-section"><h3>Ссылки</h3><div class="source-links">${r.source?`<a class="secondary-btn" target="_blank" rel="noopener" href="${esc(r.source)}">Первоисточник ↗</a>`:''}${r.video?`<a class="secondary-btn" target="_blank" rel="noopener" href="${esc(r.video)}">Видео ↗</a>`:''}</div></section>`:''}
    <section class="detail-section"><button class="secondary-btn" id="deleteRecipeBtn" style="width:100%;color:var(--danger)">Удалить рецепт</button></section>`;
  $('#minusServing').onclick=()=>{state.currentServings=clamp(state.currentServings-1,1,99);renderRecipeDetail()};
  $('#plusServing').onclick=()=>{state.currentServings=clamp(state.currentServings+1,1,99);renderRecipeDetail()};
  $('#detailFavoriteBtn').onclick=()=>toggleFavorite(r.id);
  $('#startStepsBtn').onclick=()=>startStepMode(r);
  $('#editRecipeBtn').onclick=()=>{closeModals();openRecipeForm(r)};
  $('#addAllShoppingBtn').onclick=()=>addRecipeToShopping(r,factor);
  $('#deleteRecipeBtn').onclick=()=>deleteRecipe(r.id);
}
function ingredientLines(r,factor){return (r.ingredients||[]).map(i=>`<div class="ingredient-line"><span>${esc(titleCase(i.name))}</span><span>${i.amount!==''&&i.amount!=null?fmt((+i.amount||0)*factor):''} ${esc(i.unit||'')}</span></div>`).join('')}
async function deleteRecipe(id){if(!confirm('Удалить этот рецепт из локальной книги?'))return;await dbDelete('recipes',id);state.recipes=state.recipes.filter(r=>r.id!==id);closeModals();renderAll();toast('Рецепт удалён')}

function openRecipeForm(recipe=null){
  state.editingId=recipe?.id||null;state.photoData=recipe?.image||'';
  const r=recipe||{title:'',category:'Основные блюда',cuisine:'Домашняя',equipment:['Плита'],servings:4,prepTime:10,cookTime:20,ingredients:[{name:'',amount:'',unit:''}],steps:[{text:'',timer:0}],video:'',source:''};
  $('#recipeFormMount').innerHTML=`<form class="recipe-editor" id="recipeEditor"><h2>${recipe?'Изменить рецепт':'Новый рецепт'}</h2>
    <button type="button" class="editor-photo" id="editorPhotoBtn">${state.photoData?`<img src="${esc(state.photoData)}" alt="Фото">`:'<span>📷<br><small>Добавить локальное фото</small></span>'}</button><input id="editorPhotoInput" type="file" accept="image/*" capture="environment" hidden>
    <label>Название<input name="title" required value="${esc(r.title)}" placeholder="Например, паста с томатами"></label>
    <div class="form-row"><label>Категория<input name="category" required value="${esc(r.category||'')}"></label><label>Кухня<input name="cuisine" value="${esc(r.cuisine||'')}"></label></div>
    <div class="form-row"><label>Техника<select name="equipment">${['Аэрогриль','Духовка','Мультиварка','Плита','Без техники'].map(x=>`<option ${r.equipment?.includes(x)?'selected':''}>${x}</option>`).join('')}</select></label><label>Порций<input name="servings" type="number" min="1" value="${+r.servings||4}"></label></div>
    <div class="form-row"><label>Подготовка, мин<input name="prepTime" type="number" min="0" value="${+r.prepTime||0}"></label><label>Готовка, мин<input name="cookTime" type="number" min="0" value="${+r.cookTime||0}"></label></div>
    <div><div class="row-between"><h3>Ингредиенты</h3><button type="button" class="editor-add" id="addIngredientRow">＋ Добавить</button></div><div id="ingredientRows">${(r.ingredients||[]).map(ingredientEditorRow).join('')}</div></div>
    <div><div class="row-between"><h3>Шаги</h3><button type="button" class="editor-add" id="addStepRow">＋ Добавить</button></div><div id="stepRows">${(r.steps||[]).map(stepEditorRow).join('')}</div></div>
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
  const recipe={id:old?.id||uid('recipe'),title:f.get('title').trim(),category:f.get('category').trim(),cuisine:f.get('cuisine').trim(),equipment:[f.get('equipment')],servings:+f.get('servings')||1,prepTime:+f.get('prepTime')||0,cookTime:+f.get('cookTime')||0,ingredients,steps,image:state.photoData,video:f.get('video').trim(),source:f.get('source').trim(),sourceName:old?.sourceName||'Пользовательский рецепт',favorite:old?.favorite||false,builtIn:false,emoji:old?.emoji||'🍽️',createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
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

function openModal(id){const m=$('#'+id);m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';if(id==='timerModal')renderTimers()}
function closeModals(){$$('.modal.open').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true')});document.body.style.overflow=''}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2300)}
function plural(n,one,few,many){const a=Math.abs(n)%100,b=a%10;if(a>10&&a<20)return many;if(b>1&&b<5)return few;if(b===1)return one;return many}

function startStepMode(recipe){state.currentRecipe=recipe;state.stepIndex=0;state.stepIngredients=false;closeModals();$('#stepMode').classList.add('open');$('#stepMode').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderStepMode();try{navigator.wakeLock?.request('screen').then(lock=>state.wakeLock=lock).catch(()=>{})}catch{}}
function exitStepMode(){$('#stepMode').classList.remove('open');$('#stepMode').setAttribute('aria-hidden','true');document.body.style.overflow='';state.wakeLock?.release?.().catch(()=>{});state.wakeLock=null}
function changeStep(delta){if(state.stepIngredients){state.stepIngredients=false;renderStepMode();return}const max=(state.currentRecipe?.steps?.length||1)-1;if(delta>0&&state.stepIndex>=max){exitStepMode();toast('Готово! Приятного аппетита');return}state.stepIndex=clamp(state.stepIndex+delta,0,max);renderStepMode()}
function renderStepMode(){const r=state.currentRecipe;if(!r)return;const steps=r.steps||[];const s=steps[state.stepIndex]||{text:'Готово',timer:0};$('#stepRecipeTitle').textContent=r.title;$('#stepProgress').textContent=state.stepIngredients?'Ингредиенты':`Шаг ${state.stepIndex+1} из ${steps.length}`;$('#stepImage').innerHTML=imageHTML(r);if(state.stepIngredients){$('#stepText').innerHTML=(r.ingredients||[]).map(i=>`${esc(titleCase(i.name))} — ${i.amount!==''?fmt((+i.amount||0)*(state.currentServings/(r.servings||1))):''} ${esc(i.unit||'')}`).join('<br>');$('#stepTimerBtn').hidden=true}else{$('#stepText').textContent=s.text;$('#stepTimerBtn').hidden=!s.timer;$('#stepTimerBtn').textContent=s.timer?`Запустить таймер на ${s.timer} мин`:''}$('#prevStepBtn').disabled=state.stepIndex===0&&!state.stepIngredients;$('#nextStepBtn').textContent=state.stepIndex===steps.length-1?'Завершить':'Далее'}

function addTimer(label,seconds){if(!seconds||seconds<1)return;const timer={id:uid('timer'),label:String(label||'Кухонный таймер'),endAt:Date.now()+seconds*1000,done:false};state.timers.push(timer);saveTimers();renderTimers();toast(`Таймер запущен: ${formatTime(seconds)}`);if('Notification' in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{})}
function removeTimer(id){state.timers=state.timers.filter(t=>t.id!==id);saveTimers();renderTimers()}
function restoreTimers(){tickTimers();clearInterval(restoreTimers._i);restoreTimers._i=setInterval(tickTimers,1000)}
function tickTimers(){let changed=false;for(const t of state.timers){const left=Math.max(0,Math.ceil((t.endAt-Date.now())/1000));if(left===0&&!t.done){t.done=true;changed=true;timerFinished(t)}}if(changed)saveTimers();renderTimers();renderTimerIndicators()}
function timerFinished(t){try{navigator.vibrate?.([200,100,200,100,500])}catch{};if('Notification' in window&&Notification.permission==='granted')new Notification('Время вышло',{body:t.label,icon:'./icons/icon-192.png'});toast(`⏰ ${t.label}: время вышло`)}
function renderTimers(){const mount=$('#timerList');if(!mount)return;const timers=[...state.timers].sort((a,b)=>a.done-b.done||a.endAt-b.endAt);mount.innerHTML=timers.length?timers.map(t=>{const left=Math.max(0,Math.ceil((t.endAt-Date.now())/1000));return `<div class="timer-card ${t.done?'done':''}"><div><b>${esc(t.label)}</b><small style="display:block;color:var(--muted)">${t.done?'Время вышло':'Работает'}</small></div><time>${formatTime(left)}</time><button class="delete-mini" data-timer-delete="${t.id}">×</button></div>`}).join(''):'<div class="empty-state" style="padding:30px 10px"><div>◷</div><h3>Таймеров пока нет</h3></div>'}
function renderTimerIndicators(){const active=state.timers.filter(t=>!t.done).length;const done=state.timers.filter(t=>t.done).length;$('#timerCount').textContent=done?`${done} завершено`:active?`${active} активных`:'Нет активных'}
function formatTime(sec){sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}

function renderSettings(){$('#databaseStats').textContent=`${state.recipes.length} рецептов · ${state.pantry.length} продуктов · данные только на устройстве`;$('#themeSelect').value=state.settings.theme;$('#largeTextToggle').checked=state.settings.largeText}
async function exportBook(){
  const payload={app:'Offline Cookbook',version:1,exportedAt:new Date().toISOString(),recipes:state.recipes,pantry:state.pantry,shopping:state.shopping,settings:state.settings};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`offline-cookbook-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Книга экспортирована')
}
async function importBook(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.recipes))throw new Error('Неверный формат');if(!confirm(`Импортировать ${data.recipes.length} рецептов? Текущая база будет заменена.`))return;for(const s of ['recipes','pantry','shopping'])await dbClear(s);await bulkPut('recipes',data.recipes);await bulkPut('pantry',data.pantry||[]);await bulkPut('shopping',data.shopping||[]);state.settings={...state.settings,...(data.settings||{})};await saveSettings();await loadState();applySettings();renderAll();toast('Книга импортирована')}catch(err){console.error(err);toast('Файл не похож на экспорт Offline Cookbook')}finally{e.target.value=''}}
async function restoreSeed(){let added=0;const ids=new Set(state.recipes.map(r=>r.id));for(const r of window.SEED_RECIPES||[]){if(!ids.has(r.id)){await dbPut('recipes',r);state.recipes.push(r);added++}}renderAll();toast(added?`Добавлено рецептов: ${added}`:'Встроенный каталог уже на месте')}
async function resetAll(){if(!confirm('Удалить рецепты, фотографии, покупки и остатки с этого устройства?'))return;if(!confirm('Подтвердите полную очистку ещё раз.'))return;for(const s of STORES)await dbClear(s);safeStorage.removeItem('cookbook-timers');state.recipes=[];state.pantry=[];state.shopping=[];state.timers=[];state.settings={theme:'system',largeText:false};await bulkPut('recipes',window.SEED_RECIPES||[]);await loadState();applySettings();renderAll();setView('home');toast('Данные очищены, встроенный каталог восстановлен')}

async function importOpenCatalog(){
  if(!navigator.onLine){toast('Для загрузки каталога нужен интернет');return}
  const overlay=document.createElement('div');overlay.className='loading-overlay';overlay.innerHTML='<div class="loading-card"><div class="spinner"></div><b>Загружаем открытый каталог</b><p style="color:#aeb5aa">Фотографии и рецепты сохраняются в локальную базу.</p><small id="catalogProgress">Подготовка…</small></div>';document.body.appendChild(overlay);
  try{
    const letters=['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','r','s','t','v'];let imported=0;const existing=new Set(state.recipes.map(r=>r.externalId).filter(Boolean));
    for(let i=0;i<letters.length&&imported<140;i++){
      $('#catalogProgress').textContent=`Раздел ${i+1} из ${letters.length} · добавлено ${imported}`;
      const res=await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letters[i]}`);if(!res.ok)continue;const data=await res.json();
      for(const meal of data.meals||[]){if(existing.has(meal.idMeal))continue;const recipe=mealToRecipe(meal);await dbPut('recipes',recipe);state.recipes.push(recipe);existing.add(meal.idMeal);imported++;if(imported>=140)break}
    }
    renderAll();toast(imported?`Импортировано ${imported} рецептов`:'Новых рецептов не найдено');
  }catch(err){console.error(err);toast('Каталог не загрузился. Проверьте интернет или попробуйте позже')}finally{overlay.remove()}
}
function mealToRecipe(m){
  const ingredients=[];for(let i=1;i<=20;i++){const name=(m[`strIngredient${i}`]||'').trim();const measure=(m[`strMeasure${i}`]||'').trim();if(!name)continue;const parsed=parseExternalMeasure(measure);ingredients.push({name,amount:parsed.amount,unit:parsed.unit})}
  const raw=(m.strInstructions||'').replace(/\r/g,'\n').split(/\n{2,}|\n(?=step\s*\d+|\d+[.)]\s*)/i).map(x=>x.replace(/^step\s*\d+\s*/i,'').trim()).filter(Boolean);
  const steps=(raw.length>1?raw:(m.strInstructions||'').split(/(?<=[.!?])\s+(?=[A-ZА-Я])/).filter(Boolean)).slice(0,18).map(text=>({text,timer:extractMinutes(text)}));
  return {id:`mealdb-${m.idMeal}`,externalId:m.idMeal,title:m.strMeal||'Imported recipe',category:translateCategory(m.strCategory),cuisine:m.strCountry||m.strArea||'Мировая',equipment:detectEquipment(m.strInstructions),servings:4,prepTime:15,cookTime:estimateCookTime(m.strInstructions),ingredients,steps:steps.length?steps:[{text:m.strInstructions||'Следуйте инструкции первоисточника.',timer:0}],image:m.strMealThumb||'',video:m.strYoutube||'',source:m.strSource||'',sourceName:'TheMealDB',favorite:false,builtIn:false,emoji:'🍽️',createdAt:Date.now()};
}
function parseExternalMeasure(s){const cleaned=String(s||'').trim();const frac={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3};for(const [k,v] of Object.entries(frac))if(cleaned.includes(k))return{amount:v,unit:cleaned.replace(k,'').trim()};const m=cleaned.replace(',','.').match(/^(\d+(?:\.\d+)?)(?:\s+|$)(.*)$/);return m?{amount:+m[1],unit:m[2]||''}:{amount:cleaned?1:'',unit:cleaned}}
function extractMinutes(text){const m=String(text).match(/(\d+)\s*(?:minutes?|mins?|минут|мин)/i);return m?+m[1]:0}
function estimateCookTime(text){const nums=[...String(text||'').matchAll(/(\d+)\s*(?:minutes?|mins?|минут|мин)/gi)].map(x=>+x[1]).filter(x=>x<240);return clamp(nums.reduce((a,b)=>a+b,0)||30,5,180)}
function detectEquipment(text){const s=norm(text);if(s.includes('air fryer'))return['Аэрогриль'];if(s.includes('oven')||s.includes('bake'))return['Духовка'];if(s.includes('slow cooker'))return['Мультиварка'];return['Плита']}
function translateCategory(c){return ({Breakfast:'Завтраки',Dessert:'Десерты',Seafood:'Рыба',Vegetarian:'Овощные блюда',Pasta:'Паста',Side:'Гарниры',Starter:'Закуски',Beef:'Основные блюда',Chicken:'Основные блюда',Pork:'Основные блюда',Lamb:'Основные блюда',Vegan:'Овощные блюда'}[c]||c||'Основные блюда')}

function setupInstall(){
  const btn=$('#installBtn');const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;if(!standalone)btn.hidden=false;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;btn.hidden=false});
  btn.addEventListener('click',async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else alert('На iPhone откройте меню «Поделиться» в Safari и выберите «На экран Домой». На компьютере используйте пункт установки в адресной строке браузера.')})
}
function registerServiceWorker(){if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error))}

init();

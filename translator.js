'use strict';

(() => {
  const containsLatin = value => /[A-Za-z]/.test(String(value || ''));

  const exactTitles = {
    'vietnamese fresh spring rolls': 'Вьетнамские свежие спринг-роллы',
    'chicken shawarma with homemade flatbread and yogurt sauce': 'Куриная шаурма с домашней лепёшкой и йогуртовым соусом',
    'classic margherita pizza': 'Классическая пицца «Маргарита»',
    'vegetarian stir-fry': 'Овощи стир-фрай',
    'chicken alfredo pasta': 'Паста «Альфредо» с курицей',
    'beef and broccoli stir-fry': 'Говядина с брокколи стир-фрай',
    'caprese salad': 'Салат «Капрезе»',
    'quinoa salad with avocado': 'Салат из киноа с авокадо',
    'tomato basil bruschetta': 'Брускетта с томатами и базиликом',
    'chocolate chip cookies': 'Печенье с шоколадной крошкой',
    'chicken biryani': 'Куриный бирьяни',
    'butter chicken': 'Курица в сливочно-томатном соусе',
    'masala dosa': 'Масала-доса',
    'sushi rolls': 'Роллы суши',
    'mango salsa': 'Манговая сальса',
    'greek salad': 'Греческий салат',
    'caesar salad': 'Салат «Цезарь»',
    'french onion soup': 'Французский луковый суп',
    'chicken noodle soup': 'Куриный суп с лапшой',
    'spaghetti carbonara': 'Спагетти карбонара',
    'lasagna': 'Лазанья',
    'tiramisu': 'Тирамису',
    'pancakes': 'Панкейки',
    'waffles': 'Вафли',
    'omelette': 'Омлет',
    'guacamole': 'Гуакамоле',
    'banana bread': 'Банановый хлеб',
    'apple pie': 'Яблочный пирог',
    'cheesecake': 'Чизкейк',
    'fried rice': 'Жареный рис',
    'pad thai': 'Пад-тай',
    'tom yum soup': 'Суп том-ям',
    'fish and chips': 'Рыба с картофелем фри',
    'beef tacos': 'Тако с говядиной',
    'chicken tacos': 'Тако с курицей',
    'lentil soup': 'Чечевичный суп',
    'pumpkin soup': 'Тыквенный суп',
    'roasted vegetables': 'Запечённые овощи',
    'garlic bread': 'Чесночный хлеб',
    'chocolate cake': 'Шоколадный торт',
    'lemon cake': 'Лимонный кекс',
    'iced coffee': 'Кофе со льдом',
    'green smoothie': 'Зелёный смузи',
    'strawberry smoothie': 'Клубничный смузи',
    'virgin mojito': 'Безалкогольный мохито',
    'mojito': 'Мохито',
    'margarita': 'Маргарита',
    'old fashioned': 'Олд фэшн',
    'bloody mary': 'Кровавая Мэри',
    'espresso martini': 'Эспрессо-мартини'
  };

  const phrasePairs = [
    ['soak the potatoes in just-boiled water for 30 mins, then drain and leave to air dry for 5 mins. heat the air fryer to 200c. tip the potatoes into a bowl and drizzle over 1 tbsp of the oil and add 1/2 tsp each of salt and freshly ground black pepper. toss to coat the potatoes all over, then tip in the air fryer basket and cook for 20-30 mins until crisp and golden.', 'Замочите картофель в только что вскипевшей воде на 30 минут. Слейте воду и оставьте картофель обсохнуть на 5 минут. Разогрейте аэрогриль до 200 °C. Переложите картофель в миску, добавьте 1 столовую ложку масла, по 1/2 чайной ложки соли и свежемолотого чёрного перца. Хорошо перемешайте, выложите картофель в корзину аэрогриля и готовьте 20–30 минут до хрустящей золотистой корочки.'],
    ['meanwhile, heat the remaining oil in a small pan over a medium-low heat and fry the onion for 8-10 mins until softened but not golden. stir in the garlic and cook for a minute before adding the paprika and cooking for 30 seconds more. stir in the tomato purée, cook for 1 min, then tip in the chopped tomatoes. cook for 5-10 mins over a medium heat until thickened slightly.', 'Тем временем разогрейте оставшееся масло в небольшой сковороде на умеренно слабом огне. Обжаривайте лук 8–10 минут до мягкости, не допуская подрумянивания. Добавьте чеснок и готовьте 1 минуту. Всыпьте паприку и готовьте ещё 30 секунд. Добавьте томатное пюре, готовьте 1 минуту, затем положите нарезанные помидоры. Готовьте 5–10 минут на среднем огне, пока соус слегка не загустеет.'],
    ['once the potatoes are ready, tip out onto a platter and spoon over the tomato sauce. scatter with the basil leaves, then serve.', 'Когда картофель будет готов, переложите его на большое блюдо и полейте томатным соусом. Посыпьте листьями базилика и сразу подавайте.'],
    ['dip rice paper wrappers in warm water', 'окуните листы рисовой бумаги в тёплую воду'],
    ['roll tightly', 'плотно сверните'],
    ['warm water', 'тёплая вода'],
    ['rice paper wrappers', 'листы рисовой бумаги'],
    ['shrimp, cooked and sliced', 'варёные креветки, нарезанные'],
    ['cooked and sliced shrimp', 'варёные креветки, нарезанные'],
    ['rice vermicelli, cooked', 'готовая рисовая вермишель'],
    ['cooked rice vermicelli', 'готовая рисовая вермишель'],
    ['lettuce leaves', 'листья салата'],
    ['ettuce leaves', 'листья салата'],
    ['fresh mint leaves', 'свежие листья мяты'],
    ['fresh basil leaves', 'свежие листья базилика'],
    ['fresh cilantro leaves', 'свежие листья кинзы'],
    ['carrots, julienned', 'морковь соломкой'],
    ['cucumber, julienned', 'огурец соломкой'],
    ['thinly sliced', 'тонко нарезанный'],
    ['finely chopped', 'мелко нарезанный'],
    ['roughly chopped', 'крупно нарезанный'],
    ['freshly ground black pepper', 'свежемолотый чёрный перец'],
    ['all-purpose flour', 'пшеничная мука'],
    ['plain flour', 'пшеничная мука'],
    ['self-rising flour', 'самоподнимающаяся мука'],
    ['baking powder', 'разрыхлитель'],
    ['baking soda', 'пищевая сода'],
    ['brown sugar', 'коричневый сахар'],
    ['powdered sugar', 'сахарная пудра'],
    ['granulated sugar', 'сахар'],
    ['olive oil', 'оливковое масло'],
    ['vegetable oil', 'растительное масло'],
    ['sesame oil', 'кунжутное масло'],
    ['soy sauce', 'соевый соус'],
    ['fish sauce', 'рыбный соус'],
    ['oyster sauce', 'устричный соус'],
    ['hoisin sauce', 'соус хойсин'],
    ['peanut sauce', 'арахисовый соус'],
    ['tomato paste', 'томатная паста'],
    ['tomato sauce', 'томатный соус'],
    ['coconut milk', 'кокосовое молоко'],
    ['heavy cream', 'жирные сливки'],
    ['sour cream', 'сметана'],
    ['cream cheese', 'сливочный сыр'],
    ['cheddar cheese', 'сыр чеддер'],
    ['parmesan cheese', 'пармезан'],
    ['mozzarella cheese', 'моцарелла'],
    ['chicken breast', 'куриная грудка'],
    ['chicken breasts', 'куриные грудки'],
    ['chicken thighs', 'куриные бёдра'],
    ['ground beef', 'говяжий фарш'],
    ['beef broth', 'говяжий бульон'],
    ['chicken broth', 'куриный бульон'],
    ['vegetable broth', 'овощной бульон'],
    ['spring onion', 'зелёный лук'],
    ['green onions', 'зелёный лук'],
    ['red onion', 'красный лук'],
    ['bell pepper', 'болгарский перец'],
    ['red pepper flakes', 'хлопья чили'],
    ['lime juice', 'сок лайма'],
    ['lemon juice', 'лимонный сок'],
    ['orange juice', 'апельсиновый сок'],
    ['vanilla extract', 'ванильный экстракт'],
    ['peanut butter', 'арахисовая паста'],
    ['rolled oats', 'овсяные хлопья'],
    ['bread crumbs', 'панировочные сухари'],
    ['breadcrumbs', 'панировочные сухари'],
    ['rice noodles', 'рисовая лапша'],
    ['spring rolls', 'спринг-роллы'],
    ['ice cubes', 'кубики льда'],
    ['simple syrup', 'сахарный сироп'],
    ['club soda', 'содовая'],
    ['sparkling water', 'газированная вода'],
    ['preheat the oven', 'разогрейте духовку'],
    ['preheat oven', 'разогрейте духовку'],
    ['in a large bowl', 'в большой миске'],
    ['in a medium bowl', 'в средней миске'],
    ['in a small bowl', 'в небольшой миске'],
    ['over medium heat', 'на среднем огне'],
    ['over low heat', 'на слабом огне'],
    ['over high heat', 'на сильном огне'],
    ['until golden brown', 'до золотистой корочки'],
    ['until smooth', 'до однородности'],
    ['until combined', 'до объединения ингредиентов'],
    ['until tender', 'до мягкости'],
    ['until cooked through', 'до полной готовности'],
    ['bring to a boil', 'доведите до кипения'],
    ['remove from heat', 'снимите с огня'],
    ['set aside', 'отложите в сторону'],
    ['let it cool', 'дайте остыть'],
    ['let cool', 'дайте остыть'],
    ['serve immediately', 'подавайте сразу'],
    ['serve warm', 'подавайте тёплым'],
    ['serve chilled', 'подавайте охлаждённым'],
    ['stir occasionally', 'периодически помешивайте'],
    ['mix well', 'хорошо перемешайте'],
    ['season with salt and pepper', 'приправьте солью и перцем'],
    ['salt and pepper to taste', 'соль и перец по вкусу'],
    ['to taste', 'по вкусу'],
    ['according to package instructions', 'по инструкции на упаковке'],
    ['for garnish', 'для подачи'],
    ['optional', 'по желанию']
  ].sort((a, b) => b[0].length - a[0].length);

  const words = {
    the:'', a:'', an:'', of:'', in:'в', into:'в', on:'на', from:'из', for:'в течение', add:'добавьте', all:'все', and:'и', any:'любые', arrange:'разложите', bake:'выпекайте', baked:'запечённый',
    baking:'выпечка', beat:'взбейте', beef:'говядина', blend:'измельчите', boil:'варите', boiled:'варёный', bowl:'миска',
    bread:'хлеб', breakfast:'завтрак', broth:'бульон', brown:'подрумяньте', butter:'сливочное масло', cake:'торт',
    carrot:'морковь', carrots:'морковь', cheese:'сыр', chicken:'курица', chill:'охладите', chilled:'охлаждённый',
    chopped:'нарезанный', cilantro:'кинза', cinnamon:'корица', combine:'соедините', cook:'готовьте', cooked:'готовый',
    coriander:'кориандр', cream:'сливки', cucumber:'огурец', cup:'стакан', cups:'стакана', cut:'нарежьте',
    diced:'нарезанный кубиками', dish:'блюдо', dip:'окуните', drain:'слейте', drizzle:'полейте', dry:'сухой', egg:'яйцо', eggs:'яйца',
    flour:'мука', fold:'аккуратно вмешайте', fresh:'свежий', fry:'обжарьте', fried:'жареный', garlic:'чеснок', ginger:'имбирь',
    golden:'золотистый', grate:'натрите', grated:'тёртый', grill:'обжарьте на гриле', grilled:'на гриле', heat:'нагрейте',
    honey:'мёд', hot:'горячий', ice:'лёд', ingredient:'ингредиент', ingredients:'ингредиенты', juice:'сок', julienned:'соломкой',
    large:'большой', leaf:'лист', leaves:'листья', lemon:'лимон', lime:'лайм', low:'слабый', marinade:'маринад',
    marinate:'маринуйте', medium:'средний', melt:'растопите', melted:'растопленный', milk:'молоко', mint:'мята',
    minutes:'минут', minute:'минуту', mix:'перемешайте', mixture:'смесь', mushroom:'гриб', mushrooms:'грибы',
    noodles:'лапша', oil:'масло', onion:'лук', onions:'лук', oven:'духовка', paprika:'паприка', parsley:'петрушка',
    pasta:'паста', pepper:'перец', peppers:'перцы', pinch:'щепотка', place:'поместите', plate:'тарелка', pork:'свинина',
    potato:'картофель', potatoes:'картофель', pour:'влейте', powder:'порошок', prepare:'подготовьте', prepared:'подготовленный',
    rice:'рис', roast:'запекайте', roasted:'запечённый', roll:'сверните', rolls:'роллы', tightly:'плотно', salad:'салат', salt:'соль', sauce:'соус',
    sauté:'обжарьте', saute:'обжарьте', season:'приправьте', serve:'подавайте', shrimp:'креветки', sliced:'нарезанный',
    slices:'ломтики', small:'небольшой', smooth:'однородный', soup:'суп', spice:'специя', spices:'специи', spinach:'шпинат',
    spoon:'ложка', spread:'распределите', stir:'перемешивайте', sugar:'сахар', sweet:'сладкий', tablespoon:'столовая ложка',
    tablespoons:'столовые ложки', teaspoon:'чайная ложка', teaspoons:'чайные ложки', tomato:'томат', tomatoes:'томаты',
    top:'сверху', toss:'перемешайте', transfer:'переложите', vanilla:'ваниль', vegetable:'овощ', vegetables:'овощи',
    vietnamese:'вьетнамский', warm:'тёплый', water:'вода', whisk:'взбейте венчиком', wine:'вино', with:'с', without:'без',
    wrap:'ролл', wrappers:'листы', yeast:'дрожжи', yogurt:'йогурт', yoghurt:'йогурт', zucchini:'кабачок', avocado:'авокадо',
    basil:'базилик', beans:'фасоль', bean:'фасоль', lentils:'чечевица', lentil:'чечевица', chickpeas:'нут', tofu:'тофу',
    salmon:'лосось', tuna:'тунец', cod:'треска', fish:'рыба', seafood:'морепродукты', steak:'стейк', lamb:'баранина',
    turkey:'индейка', bacon:'бекон', ham:'ветчина', sausage:'колбаса', sausages:'колбаски', apple:'яблоко', apples:'яблоки',
    banana:'банан', bananas:'бананы', strawberry:'клубника', strawberries:'клубника', blueberry:'черника', blueberries:'черника',
    mango:'манго', orange:'апельсин', pineapple:'ананас', coconut:'кокос', chocolate:'шоколад', cocoa:'какао', coffee:'кофе',
    tea:'чай', smoothie:'смузи', cocktail:'коктейль', drink:'напиток', alcoholic:'алкогольный', nonalcoholic:'безалкогольный',
    vegan:'веганский', vegetarian:'вегетарианский', healthy:'полезный', lowcalorie:'низкокалорийный', spicy:'острый',
    crispy:'хрустящий', creamy:'сливочный', classic:'классический', homemade:'домашний', easy:'простой', quick:'быстрый',
    italian:'итальянский', indian:'индийский', mexican:'мексиканский', chinese:'китайский', japanese:'японский', thai:'тайский',
    greek:'греческий', french:'французский', american:'американский', asian:'азиатский', mediterranean:'средиземноморский',
    fresh:'свежий', stuffed:'фаршированный', roasted:'запечённый', grilled:'приготовленный на гриле', mashed:'пюре',
    simmer:'томите', simmering:'томление', knead:'вымесите', peel:'очистите', peeled:'очищенный', rinse:'промойте',
    rinseed:'промытый', rinse:'промойте', soak:'замочите', soaked:'замоченный', squeeze:'выжмите', sprinkle:'посыпьте',
    garnish:'украсьте', cover:'накройте', uncover:'снимите крышку', refrigerate:'охладите в холодильнике', freeze:'заморозьте',
    thaw:'разморозьте', slice:'нарежьте ломтиками', chop:'нарежьте', mince:'измельчите', minced:'измельчённый',
    crush:'раздавите', crushed:'измельчённый', whisked:'взбитый', beaten:'взбитый', remaining:'оставшийся',
    evenly:'равномерно', gently:'аккуратно', gradually:'постепенно', thoroughly:'тщательно', together:'вместе',
    then:'затем', until:'до', about:'примерно', approximately:'примерно', before:'перед', after:'после',
    hour:'час', hours:'часов', second:'секунда', seconds:'секунд', degree:'градус', degrees:'градусов',
    freshen:'освежите', remove:'уберите', discard:'выбросьте', reserve:'оставьте', return:'верните', continue:'продолжайте',
    repeat:'повторите', divide:'разделите', fill:'наполните', layer:'выложите слоями', press:'прижмите', shape:'сформируйте',
    turn:'переверните', flip:'переверните', shake:'встряхните', strain:'процедите', puree:'пюрируйте', mash:'разомните',
    taste:'попробуйте', adjust:'скорректируйте', cool:'остудите', room:'комнатный', temperature:'температура',
    pan:'сковорода', skillet:'сковорода', saucepan:'сотейник', pot:'кастрюля', tray:'противень', sheet:'лист',
    blender:'блендер', processor:'комбайн', knife:'нож', fork:'вилка', spoonful:'ложка', glass:'бокал'
  };

  const units = {
    cup:'стакан', cups:'стакана', tbsp:'ст. л.', tablespoon:'ст. л.', tablespoons:'ст. л.', tsp:'ч. л.', teaspoon:'ч. л.', teaspoons:'ч. л.',
    g:'г', gram:'г', grams:'г', kg:'кг', ml:'мл', l:'л', liter:'л', litre:'л', oz:'унц.', ounce:'унц.', ounces:'унц.',
    lb:'фунт', lbs:'фунта', pound:'фунт', pounds:'фунта', clove:'зубчик', cloves:'зубчика', piece:'шт.', pieces:'шт.', pcs:'шт.',
    slice:'ломтик', slices:'ломтика', can:'банка', cans:'банки', package:'упаковка', packages:'упаковки', bunch:'пучок',
    pinch:'щепотка', dash:'немного', handful:'горсть', sprig:'веточка', sprigs:'веточки'
  };

  const cuisines = {
    American:'Американская', British:'Британская', Canadian:'Канадская', Chinese:'Китайская', Croatian:'Хорватская', Dutch:'Нидерландская',
    Egyptian:'Египетская', Filipino:'Филиппинская', French:'Французская', Greek:'Греческая', Indian:'Индийская', Irish:'Ирландская',
    Italian:'Итальянская', Jamaican:'Ямайская', Japanese:'Японская', Kenyan:'Кенийская', Malaysian:'Малайзийская', Mexican:'Мексиканская',
    Moroccan:'Марокканская', Polish:'Польская', Portuguese:'Португальская', Russian:'Русская', Spanish:'Испанская', Thai:'Тайская',
    Tunisian:'Тунисская', Turkish:'Турецкая', Ukrainian:'Украинская', Vietnamese:'Вьетнамская', Mediterranean:'Средиземноморская', 'Middle Eastern':'Ближневосточная',
    Asian:'Азиатская', International:'Мировая', World:'Мировая'
  };

  const TRANSLATION_VERSION = 3;
  const sessionCache = new Map();
  const BAD_TRANSLATION_RE = /(?:^|[^A-Za-zА-Яа-яЁё])(?:тхе|тхис|тхат|тхен|анд|аре|вас|вере|меанвхиле|коокинг|аддинг|аддед|овэр|овер|инто|вхен|вхиле|юнтил|леаве|лейв|миксинг|софтенед|тиккенед|слигхтли|джуст|боилед|крисп|баскет)(?=$|[^A-Za-zА-Яа-яЁё])/iu;
  const URL_RE = /^(?:https?:\/\/|www\.)/i;

  const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function applyPhrases(text) {
    let result = String(text || '');
    for (const [from, to] of phrasePairs) {
      const escaped = escapeRegExp(from);
      const prefix = /^[A-Za-z0-9]/.test(from) ? '\\b' : '';
      const suffix = /[A-Za-z0-9]$/.test(from) ? '\\b' : '';
      result = result.replace(new RegExp(`${prefix}${escaped}${suffix}`, 'gi'), to);
    }
    return result;
  }

  function cleanRussian(text) {
    return String(text || '')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])(?=[А-Яа-яЁёA-Za-z])/g, '$1 ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/\s+([°%])/g, '$1')
      .trim();
  }

  function titleExact(value) {
    return exactTitles[String(value || '').trim().toLowerCase()] || '';
  }

  /** Безопасный запасной перевод: неизвестные слова остаются на английском, а не транслитерируются. */
  function translateTextLocal(value, options = {}) {
    const original = String(value || '').trim();
    if (!original || !containsLatin(original) || URL_RE.test(original)) return original;
    const exact = options.title ? titleExact(original) : '';
    if (exact) return exact;

    let text = applyPhrases(original);
    text = text.replace(/\b([A-Za-z]+(?:['’-][A-Za-z]+)?)\b/g, token => {
      const lower = token.toLowerCase().replace(/[’']/g, '');
      if (hasOwn(words, lower)) return words[lower];
      if (/^[A-Z]{2,}$/.test(token)) return token;
      return token;
    });

    text = cleanRussian(text)
      .replace(/\b(\d+)\s*F\b/gi, '$1 °F')
      .replace(/\b(\d+)\s*C\b/g, '$1 °C');
    if (!text) return original;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function translateUnit(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.toLowerCase().replace(/\.$/, '');
    if (hasOwn(units, normalized)) return units[normalized];
    let result = raw;
    Object.entries(units).sort((a, b) => b[0].length - a[0].length).forEach(([from, to]) => {
      result = result.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi'), to);
    });
    return cleanRussian(result);
  }

  function translateCuisineLocal(value) {
    const raw = String(value || '').trim();
    return cuisines[raw] || raw || 'Мировая';
  }

  function latinRatio(value) {
    const tokens = String(value || '').match(/[A-Za-zА-Яа-яЁё]+/g) || [];
    if (!tokens.length) return 0;
    return tokens.filter(token => /[A-Za-z]/.test(token)).length / tokens.length;
  }

  function looksCorrupted(value) {
    const strings = [];
    const walk = current => {
      if (typeof current === 'string') strings.push(current);
      else if (Array.isArray(current)) current.forEach(walk);
      else if (current && typeof current === 'object') Object.values(current).forEach(walk);
    };
    walk(value);
    return strings.some(text => BAD_TRANSLATION_RE.test(text));
  }

  function acceptableTranslation(original, translated) {
    const source = String(original || '').trim();
    const result = cleanRussian(translated);
    if (!result || BAD_TRANSLATION_RE.test(result)) return false;
    if (!containsLatin(source)) return true;
    if (!/[А-Яа-яЁё]/.test(result)) return false;
    if (result.toLowerCase() === source.toLowerCase()) return false;
    return latinRatio(result) < 0.42;
  }

  function sourcePayload(recipe) {
    const source = recipe && typeof recipe === 'object' ? recipe : {};
    const ingredients = Array.isArray(source.ingredients) ? source.ingredients : (source.ingredients ? [source.ingredients] : []);
    const steps = Array.isArray(source.steps) ? source.steps : (source.steps ? [source.steps] : []);
    return {
      title: String(source.originalTitle || source.title || ''),
      description: String(source.originalDescription || source.description || ''),
      cuisine: String(source.originalCuisine || source.cuisine || ''),
      ingredients: ingredients.map(item => {
        const value = typeof item === 'string' ? { name: item, amount: '', unit: '' } : (item || {});
        return { name: String(value.originalName || value.name || value.ingredient || ''), amount: value.amount ?? value.quantity ?? '', unit: String(value.originalUnit || value.unit || value.measure || '') };
      }),
      steps: steps.map(step => {
        const value = typeof step === 'string' ? { text: step } : (step || {});
        return { title: String(value.originalTitle || value.title || ''), text: String(value.originalText || value.text || value.instruction || value.description || ''), timer: value.timer ?? value.minutes ?? 0 };
      }),
      tips: (Array.isArray(source.tips) ? source.tips : (source.tips ? [source.tips] : [])).map(value => String(typeof value === 'string' ? value : value?.text || '')),
      storage: String(source.originalStorage || source.storage || ''),
      tags: (Array.isArray(source.tags) ? source.tags : (source.tags ? [source.tags] : [])).map(value => String(value || ''))
    };
  }

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function sourceHash(recipe) {
    return `tr3-${hashString(JSON.stringify(sourcePayload(recipe)))}`;
  }

  let nativeTranslatorPromise;
  async function getNativeTranslator() {
    if (nativeTranslatorPromise !== undefined) return nativeTranslatorPromise;
    nativeTranslatorPromise = (async () => {
      try {
        const API = globalThis.Translator;
        if (!API || typeof API.create !== 'function') return null;
        if (typeof API.availability === 'function') {
          const availability = await API.availability({ sourceLanguage: 'en', targetLanguage: 'ru' });
          if (availability === 'unavailable') return null;
        }
        return await API.create({ sourceLanguage: 'en', targetLanguage: 'ru' });
      } catch {
        return null;
      }
    })();
    return nativeTranslatorPromise;
  }

  async function fetchWithTimeout(url, options = {}, timeout = 18000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function translateViaNative(text) {
    const translator = await getNativeTranslator();
    if (!translator) throw new Error('Native translator unavailable');
    return await translator.translate(text);
  }

  async function translateViaGoogle(text) {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'ru', dt: 't', q: text }).toString();
    const response = await fetchWithTimeout(url.toString(), { method: 'GET', mode: 'cors' }, 22000);
    if (!response.ok) throw new Error(`Google translate ${response.status}`);
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('') : '';
    if (!translated) throw new Error('Google translate returned empty result');
    return translated;
  }

  function splitForTranslation(text, maxLength = 430) {
    const source = String(text || '').trim();
    if (source.length <= maxLength) return [source];
    const sentences = source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [source];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      const piece = sentence.trim();
      if (current && current.length + piece.length + 1 > maxLength) {
        chunks.push(current);
        current = '';
      }
      if (piece.length > maxLength) {
        if (current) { chunks.push(current); current = ''; }
        for (let start = 0; start < piece.length; start += maxLength) chunks.push(piece.slice(start, start + maxLength));
      } else current = current ? `${current} ${piece}` : piece;
    }
    if (current) chunks.push(current);
    return chunks.filter(Boolean);
  }

  async function translateViaMyMemory(text) {
    const chunks = splitForTranslation(text);
    const translated = [];
    for (const chunk of chunks) {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.search = new URLSearchParams({ q: chunk, langpair: 'en|ru' }).toString();
      const response = await fetchWithTimeout(url.toString(), { method: 'GET', mode: 'cors' }, 18000);
      if (!response.ok) throw new Error(`MyMemory ${response.status}`);
      const data = await response.json();
      const value = String(data?.responseData?.translatedText || '').trim();
      if (!value) throw new Error('MyMemory returned empty result');
      translated.push(value);
    }
    return translated.join(' ');
  }

  async function translateRemote(text) {
    const attempts = [
      ['browser', translateViaNative],
      ['google', translateViaGoogle],
      ['mymemory', translateViaMyMemory]
    ];
    let lastError;
    for (const [engine, worker] of attempts) {
      try {
        const translated = await worker(text);
        if (translated) return { text: translated, engine };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('No translation engine available');
  }

  function marker(index) {
    return `[[[OCSPLIT_${String(index).padStart(4, '0')}]]]`;
  }

  function packChunks(texts, maxLength = 2600) {
    const chunks = [];
    let current = [];
    let size = 0;
    texts.forEach((text, index) => {
      const entryLength = text.length + marker(index).length + 4;
      if (current.length && size + entryLength > maxLength) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push({ index, text });
      size += entryLength;
    });
    if (current.length) chunks.push(current);
    return chunks;
  }

  function joinChunk(entries) {
    return entries.map(entry => `${marker(entry.index)}\n${entry.text}`).join('\n');
  }

  function parseJoinedTranslation(value, entries) {
    const text = String(value || '');
    const regex = /\[\[\[\s*OCSPLIT_(\d{4})\s*\]\]\]/gi;
    const matches = [...text.matchAll(regex)];
    if (matches.length !== entries.length) return null;
    const result = new Map();
    matches.forEach((match, position) => {
      const start = match.index + match[0].length;
      const end = position + 1 < matches.length ? matches[position + 1].index : text.length;
      result.set(Number(match[1]), cleanRussian(text.slice(start, end)));
    });
    return result;
  }

  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const run = async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
  }

  async function translateEntriesIndividually(entries) {
    const output = new Map();
    await mapLimit(entries, 3, async entry => {
      try {
        const remote = await translateRemote(entry.text);
        const good = acceptableTranslation(entry.text, remote.text);
        output.set(entry.index, { text: good ? cleanRussian(remote.text) : translateTextLocal(entry.text), engine: good ? remote.engine : 'local-safe' });
      } catch {
        output.set(entry.index, { text: translateTextLocal(entry.text), engine: 'local-safe' });
      }
    });
    return output;
  }

  async function translateTexts(values, onProgress) {
    const originals = values.map(value => String(value || '').trim());
    const unique = [];
    const uniqueIndex = new Map();
    originals.forEach(value => {
      if (!value || !containsLatin(value) || URL_RE.test(value)) return;
      if (!uniqueIndex.has(value)) {
        uniqueIndex.set(value, unique.length);
        unique.push(value);
      }
    });

    const resolved = new Map();
    unique.forEach((text, index) => {
      const exact = titleExact(text);
      if (exact) resolved.set(index, { text: exact, engine: 'dictionary' });
      else if (sessionCache.has(text)) resolved.set(index, sessionCache.get(text));
    });

    const pending = unique.map((text, index) => ({ text, index })).filter(entry => !resolved.has(entry.index));
    const chunks = packChunks(pending.map(entry => entry.text));
    let completed = 0;

    await mapLimit(chunks, 3, async chunk => {
      const remapped = chunk.map(entry => ({ index: pending[entry.index].index, text: entry.text }));
      let chunkResult = null;
      let engine = 'local-safe';
      try {
        const remote = await translateRemote(joinChunk(remapped));
        engine = remote.engine;
        const parsed = parseJoinedTranslation(remote.text, remapped);
        if (parsed) {
          chunkResult = new Map();
          for (const entry of remapped) {
            const translated = parsed.get(entry.index) || '';
            const good = acceptableTranslation(entry.text, translated);
            chunkResult.set(entry.index, { text: good ? cleanRussian(translated) : translateTextLocal(entry.text), engine: good ? engine : 'local-safe' });
          }
        }
      } catch {}
      if (!chunkResult) chunkResult = await translateEntriesIndividually(remapped);
      for (const [index, value] of chunkResult) resolved.set(index, value);
      completed += remapped.length;
      onProgress?.(completed, pending.length, engine);
    });

    unique.forEach((text, index) => {
      const value = resolved.get(index) || { text: translateTextLocal(text), engine: 'local-safe' };
      sessionCache.set(text, value);
    });

    return originals.map(original => {
      if (!original || !containsLatin(original) || URL_RE.test(original)) return { text: original, engine: 'original' };
      return resolved.get(uniqueIndex.get(original)) || { text: translateTextLocal(original), engine: 'local-safe' };
    });
  }

  async function translateRecipes(recipes, options = {}) {
    const list = Array.isArray(recipes) ? recipes : [];
    if (!list.length) return [];
    const payloads = list.map(sourcePayload);
    const jobs = [];
    const add = value => { const index = jobs.length; jobs.push(String(value || '')); return index; };
    const maps = payloads.map(payload => ({
      title: add(payload.title),
      description: add(payload.description),
      cuisine: add(payload.cuisine),
      ingredients: payload.ingredients.map(item => ({ name: add(item.name), unit: item.unit })),
      steps: payload.steps.map(step => ({ title: add(step.title), text: add(step.text) })),
      tips: payload.tips.map(add),
      storage: add(payload.storage),
      tags: payload.tags.map(add)
    }));

    const translations = await translateTexts(jobs, options.onProgress);
    const translatedAt = Date.now();

    return list.map((recipe, recipeIndex) => {
      const source = recipe && typeof recipe === 'object' ? recipe : {};
      const payload = payloads[recipeIndex];
      const map = maps[recipeIndex];
      const translatedValues = [];
      const read = index => {
        const value = translations[index] || { text: jobs[index], engine: 'original' };
        translatedValues.push({ ...value, original: jobs[index] || '' });
        return value.text;
      };
      const title = titleExact(payload.title) || read(map.title);
      const description = read(map.description);
      let cuisine = translateCuisineLocal(payload.cuisine);
      if (containsLatin(cuisine)) cuisine = read(map.cuisine);
      const ingredients = payload.ingredients.map((item, index) => ({
        ...(Array.isArray(source.ingredients) && typeof source.ingredients[index] === 'object' ? source.ingredients[index] : {}),
        name: read(map.ingredients[index].name), amount: item.amount, unit: translateUnit(item.unit), originalName: item.name, originalUnit: item.unit
      })).filter(item => item.name);
      const steps = payload.steps.map((step, index) => {
        const originalStep = Array.isArray(source.steps) && typeof source.steps[index] === 'object' ? source.steps[index] : {};
        const genericTitle = /^(?:этап|шаг|step|stage)\s*\d+$/i.test(step.title || '');
        return {
          ...originalStep,
          title: step.title && !genericTitle ? read(map.steps[index].title) : `Этап ${index + 1}`,
          text: read(map.steps[index].text),
          timer: Number.isFinite(+step.timer) ? +step.timer : (+originalStep.timer || 0),
          originalTitle: step.title,
          originalText: step.text
        };
      }).filter(step => step.text);
      const tips = map.tips.map(read).filter(Boolean);
      const storage = read(map.storage);
      const tags = map.tags.map(read).filter(Boolean);
      const partial = translatedValues.some(entry => containsLatin(entry.original) && latinRatio(entry.text) >= 0.42);
      const engines = [...new Set(translatedValues.map(value => value.engine).filter(value => value && value !== 'original'))];
      return {
        ...source,
        originalTitle: payload.title,
        originalDescription: payload.description,
        originalCuisine: payload.cuisine,
        originalLanguage: source.originalLanguage || 'en',
        title: title || payload.title,
        description,
        cuisine: cuisine || 'Мировая',
        ingredients,
        steps,
        tips,
        storage,
        tags,
        translationSource: payload,
        translationSourceHash: sourceHash(source),
        translationVersion: TRANSLATION_VERSION,
        translationStatus: partial ? 'ru-partial-v3' : 'ru-machine-v3',
        translationEngine: engines.join('+') || 'local-safe',
        translatedAt
      };
    });
  }

  async function translateRecipe(recipe, options = {}) {
    const [translated] = await translateRecipes([recipe], options);
    return translated;
  }

  window.RU_TRANSLATOR = {
    version: TRANSLATION_VERSION,
    containsLatin,
    looksCorrupted,
    sourcePayload,
    sourceHash,
    translateText: translateTextLocal,
    translateTitle: value => titleExact(value) || translateTextLocal(value, { title: true }),
    translateUnit,
    translateCuisine: translateCuisineLocal,
    translateTexts,
    translateRecipes,
    translateRecipe
  };
})();

'use strict';

(() => {
  const containsLatin = value => /[A-Za-z]/.test(String(value || ''));

  const exactTitles = {
    'vietnamese fresh spring rolls': 'Вьетнамские свежие спринг-роллы',
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
    add:'добавьте', all:'все', and:'и', any:'любые', arrange:'разложите', bake:'выпекайте', baked:'запечённый',
    baking:'выпечка', beat:'взбейте', beef:'говядина', blend:'измельчите', boil:'варите', boiled:'варёный', bowl:'миска',
    bread:'хлеб', breakfast:'завтрак', broth:'бульон', brown:'подрумяньте', butter:'сливочное масло', cake:'торт',
    carrot:'морковь', carrots:'морковь', cheese:'сыр', chicken:'курица', chill:'охладите', chilled:'охлаждённый',
    chopped:'нарезанный', cilantro:'кинза', cinnamon:'корица', combine:'соедините', cook:'готовьте', cooked:'готовый',
    coriander:'кориандр', cream:'сливки', cucumber:'огурец', cup:'стакан', cups:'стакана', cut:'нарежьте',
    diced:'нарезанный кубиками', dish:'блюдо', drain:'слейте', drizzle:'полейте', dry:'сухой', egg:'яйцо', eggs:'яйца',
    flour:'мука', fold:'аккуратно вмешайте', fresh:'свежий', fry:'обжарьте', fried:'жареный', garlic:'чеснок', ginger:'имбирь',
    golden:'золотистый', grate:'натрите', grated:'тёртый', grill:'обжарьте на гриле', grilled:'на гриле', heat:'нагрейте',
    honey:'мёд', hot:'горячий', ice:'лёд', ingredient:'ингредиент', ingredients:'ингредиенты', juice:'сок', julienned:'соломкой',
    large:'большой', leaf:'лист', leaves:'листья', lemon:'лимон', lime:'лайм', low:'слабый', marinade:'маринад',
    marinate:'маринуйте', medium:'средний', melt:'растопите', melted:'растопленный', milk:'молоко', mint:'мята',
    minutes:'минут', minute:'минуту', mix:'перемешайте', mixture:'смесь', mushroom:'гриб', mushrooms:'грибы',
    noodles:'лапша', oil:'масло', onion:'лук', onions:'лук', oven:'духовка', paprika:'паприка', parsley:'петрушка',
    pasta:'паста', pepper:'перец', peppers:'перцы', pinch:'щепотка', place:'поместите', plate:'тарелка', pork:'свинина',
    potato:'картофель', potatoes:'картофель', pour:'влейте', powder:'порошок', prepare:'подготовьте', prepared:'подготовленный',
    rice:'рис', roast:'запекайте', roasted:'запечённый', roll:'рулет', rolls:'роллы', salad:'салат', salt:'соль', sauce:'соус',
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
    Tunisian:'Тунисская', Turkish:'Турецкая', Ukrainian:'Украинская', Vietnamese:'Вьетнамская', Mediterranean:'Средиземноморская',
    Asian:'Азиатская', International:'Мировая', World:'Мировая'
  };

  const translitMap = {
    a:'а',b:'б',c:'к',d:'д',e:'е',f:'ф',g:'г',h:'х',i:'и',j:'дж',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'к',r:'р',s:'с',t:'т',u:'у',v:'в',w:'в',x:'кс',y:'й',z:'з'
  };

  const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const transliterate = token => token.toLowerCase().split('').map(ch => translitMap[ch] || ch).join('');

  function applyPhrases(text) {
    let result = String(text || '');
    for (const [from, to] of phrasePairs) {
      result = result.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi'), to);
    }
    return result;
  }

  function cleanRussian(text) {
    return String(text || '')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])(?=[А-Яа-яЁё])/g, '$1 ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
  }

  function translateText(value, options = {}) {
    const original = String(value || '').trim();
    if (!original || !containsLatin(original)) return original;
    const exact = exactTitles[original.toLowerCase()];
    if (exact && options.title) return exact;

    let text = applyPhrases(original);
    text = text.replace(/\b([A-Za-z]+(?:['’-][A-Za-z]+)?)\b/g, token => {
      const lower = token.toLowerCase().replace(/[’']/g, '');
      if (words[lower]) return words[lower];
      if (/^[A-Z]{2,}$/.test(token)) return token;
      if (lower.length <= 2) return token;
      return transliterate(token);
    });

    text = cleanRussian(text)
      .replace(/\bФ\b/g, '°F')
      .replace(/\bС\b(?=\s*\d)/g, '°C');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function translateTitle(value) {
    return translateText(value, { title: true });
  }

  function translateUnit(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.toLowerCase().replace(/\.$/, '');
    if (units[normalized]) return units[normalized];
    let result = raw;
    Object.entries(units).sort((a, b) => b[0].length - a[0].length).forEach(([from, to]) => {
      result = result.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi'), to);
    });
    return translateText(result);
  }

  function translateCuisine(value) {
    const raw = String(value || '').trim();
    return cuisines[raw] || translateText(raw) || 'Мировая';
  }

  function translateRecipe(recipe) {
    const originalTitle = recipe.originalTitle || recipe.title;
    const originalLanguage = recipe.originalLanguage || (containsLatin(recipe.title) ? 'en' : 'ru');
    const translated = {
      ...recipe,
      originalTitle,
      originalLanguage,
      title: translateTitle(recipe.title),
      description: translateText(recipe.description),
      cuisine: translateCuisine(recipe.cuisine),
      ingredients: (recipe.ingredients || []).map(item => ({
        ...item,
        name: translateText(item.name),
        unit: translateUnit(item.unit)
      })),
      steps: (recipe.steps || []).map((step, index) => ({
        ...step,
        title: translateText(step.title || `Этап ${index + 1}`),
        text: translateText(step.text)
      })),
      tips: (Array.isArray(recipe.tips) ? recipe.tips : []).map(translateText),
      storage: translateText(recipe.storage),
      tags: (recipe.tags || []).map(translateText),
      translationStatus: 'ru-local',
      translatedAt: Date.now()
    };
    return translated;
  }

  window.RU_TRANSLATOR = {
    containsLatin,
    translateText,
    translateTitle,
    translateUnit,
    translateCuisine,
    translateRecipe
  };
})();

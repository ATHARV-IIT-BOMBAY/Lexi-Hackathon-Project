export const DUMMY_USERS = [
  { id: '0', username: 'alex', password: 'password123', avatar: '🚀', name: 'Alex' },
  { id: '2', username: 'mia', password: 'password123', avatar: '🐯', name: 'Mia T.' },
  { id: '3', username: 'leo', password: 'password123', avatar: '🐼', name: 'Leo R.' },
  { id: '4', username: 'zoey', password: 'password123', avatar: '🦊', name: 'Zoey K.' },
  { id: '5', username: 'sam', password: 'password123', avatar: '🐸', name: 'Sam J.' },
  { id: '6', username: 'lily', password: 'password123', avatar: '🐰', name: 'Lily P.' },
  { id: '7', username: 'noah', password: 'password123', avatar: '🐶', name: 'Noah W.' },
  { id: '8', username: 'emma', password: 'password123', avatar: '🐱', name: 'Emma S.' },
  { id: '9', username: 'lucas', password: 'password123', avatar: '🐢', name: 'Lucas B.' },
  { id: '10', username: 'ava', password: 'password123', avatar: '🐧', name: 'Ava L.' }
];

export const getUserHistory = (username) => {
  if (username === 'alex' && !localStorage.getItem('dysco_history_alex_seeded_v7')) {
    const dummyHistory = [];
    const now = new Date();
    const modes = ['letters', 'words', 'sentences', 'numbers', 'tracing'];
    
    const allCaps = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));
    const allSmalls = Array.from({length: 26}, (_, i) => String.fromCharCode(97 + i));
    const allNumbers = Array.from({length: 10}, (_, i) => String(i));
    
    const targets = {
      letters: [...allCaps, ...allSmalls],
      words: ['Cat', 'Dog', 'Apple', 'House', 'Tree', 'Bird', 'Sun', 'Moon', 'Book', 'Car', 'Pen'],
      sentences: ['I see a cat', 'The dog ran fast', 'She is happy', 'He is tall', 'We like to play'],
      numbers: allNumbers,
      tracing: ['car', 'star', 'cloud', 'rocket', 'moon', 'sun', 'heart', 'plane', 'bird']
    };
    
    const coreTargets = {
      letters: ['A', 'B', 'C', 'a', 'b', 'c'],
      words: ['Cat', 'Dog', 'Sun'],
      sentences: ['I see a cat'],
      numbers: ['1', '2', '3'],
      tracing: ['car', 'star']
    };
    
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(9, 0, 0, 0); // anchor each day at 9am so the per-session time spread can't spill past midnight into a future day
      
      const sessionsCount = 20 + Math.floor(Math.random() * 10); // 20 to 30 sessions per day
      
      for(let j=0; j<sessionsCount; j++) {
        const modeRoll = Math.random();
        let mode = 'letters';
        if (modeRoll > 0.4 && modeRoll <= 0.6) mode = 'numbers';
        else if (modeRoll > 0.6 && modeRoll <= 0.75) mode = 'words';
        else if (modeRoll > 0.75 && modeRoll <= 0.9) mode = 'tracing';
        else if (modeRoll > 0.9) mode = 'sentences';
        
        let targetItem;
        if (Math.random() < 0.5) {
          targetItem = coreTargets[mode][Math.floor(Math.random() * coreTargets[mode].length)];
        } else {
          const targetList = targets[mode];
          targetItem = targetList[Math.floor(Math.random() * targetList.length)];
        }
        
        const baseTremor = 35 - ((8 - i) * 3); 
        const actualTremor = Math.max(0, baseTremor + (Math.random() * 8 - 4));
        
        const baseScore = 65 + ((8 - i) * 2.5);
        const score = Math.min(100, Math.floor(baseScore + Math.random() * 15));
        
        dummyHistory.push({
          score: score,
          mode: mode,
          mission: `Practicing ${targetItem}`,
          targetItem: targetItem,
          factors: [
            { category: "Geometric Accuracy", score: Math.round(Math.min(100, 70 + (8-i)*2 + Math.random()*15)) },
            { category: "Stroke Coverage", score: Math.round(Math.min(100, 75 + (8-i)*2 + Math.random()*15)) },
            { category: "Motor Planning", score: Math.round(Math.min(100, 65 + (8-i)*3 + Math.random()*15)) },
            { category: "Orthographic Recall", score: Math.round(Math.min(100, 70 + (8-i)*2 + Math.random()*15)) },
            { category: "Start Point", score: Math.round(Math.min(100, 60 + (8-i)*4 + Math.random()*15)) },
            { category: "Fluidity", score: Math.round(Math.min(100, 65 + (8-i)*3 + Math.random()*15)) },
            { category: "Tremor", score: Math.round(100 - actualTremor) }, // Assuming higher score means less tremor
            { category: "Cognitive Load", score: Math.round(Math.max(20, 70 - (8-i)*4 - Math.random()*15)) },
            { category: "Proportionality", score: Math.round(Math.min(100, 70 + (8-i)*2 + Math.random()*15)) },
            { category: "Size Control", score: Math.round(Math.min(100, 65 + (8-i)*3 + Math.random()*15)) },
            { category: "Directionality", score: Math.round(Math.min(100, 75 + (8-i)*2 + Math.random()*15)) },
            { category: "Biomechanics", score: Math.round(Math.min(100, 70 + (8-i)*2 + Math.random()*15)) },
            { category: "Stroke Order & Proximity", score: Math.round(Math.min(100, 80 + (8-i)*1 + Math.random()*10)) }
          ],
          date: new Date(d.getTime() + j*720000 + Math.random()*360000).toISOString()
        });
      }
    }
    
    localStorage.setItem('dysco_history_alex', JSON.stringify(dummyHistory));
    localStorage.setItem('dysco_coins_alex', '4230');
    localStorage.setItem('dysco_purchased_alex', JSON.stringify(["#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"]));
    localStorage.setItem('dysco_gifts_alex', JSON.stringify(["robot", "gamepad"]));
    localStorage.setItem('dysco_history_alex_seeded_v7', 'true');
  }

  const data = localStorage.getItem(`dysco_history_${username}`);
  return data ? JSON.parse(data) : [];
};

export const saveUserScore = (username, scoreData) => {
  const history = getUserHistory(username);
  history.push({ ...scoreData, date: new Date().toISOString() });
  localStorage.setItem(`dysco_history_${username}`, JSON.stringify(history));
};

export const calculateStreak = (history) => {
  if (!history || history.length === 0) return 0;
  
  const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  const uniqueDates = [...new Set(sortedHistory.map(item => {
    const d = new Date(item.date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }))];

  let streak = 0;
  let currentDate = new Date();
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
  const ONE_DAY = 86400000;

  if (uniqueDates.length > 0) {
    if (uniqueDates[0] === currentDate || uniqueDates[0] === currentDate - ONE_DAY) {
      streak = 1;
      let checkDate = uniqueDates[0];
      for (let i = 1; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === checkDate - ONE_DAY) {
          streak++;
          checkDate -= ONE_DAY;
        } else {
          break;
        }
      }
    }
  }
  return streak;
};

// ------------------------------------------------------------------
// Word Practice List
// ------------------------------------------------------------------
const PRACTICE_WORDS_EN = [
  "Cat", "Dog", "Sun", "Tree", "Apple", "Bird", "Fish", "Star", 
  "Moon", "Cloud", "Book", "Pen", "Cup", "Hat", "Shoe", "Ball", 
  "Toy", "Car", "Bus", "Train", "Plane", "Boat", "House"
];

const PRACTICE_WORDS_ES = [
  "Gato", "Perro", "Casa", "Sol", "Luna", "Agua", "Flor", "Rojo",
  "Libro", "Nube", "Estrella", "Mano", "Ojo", "Boca", "Pelo", "Gota"
];

const PRACTICE_WORDS_FR = [
  "Chat", "Chien", "Pomme", "Eau", "Livre", "Rouge", "Bleu",
  "Soleil", "Lune", "Maison", "Fille", "Garcon", "Nuit", "Jour"
];

const PRACTICE_WORDS_DE = [
  "Hund", "Katze", "Apfel", "Haus", "Baum", "Sonne", "Mond",
  "Buch", "Wasser", "Blume", "Kind", "Vogel", "Fisch", "Auto"
];

const PRACTICE_WORDS_IT = [
  "Cane", "Gatto", "Mela", "Casa", "Albero", "Sole", "Luna",
  "Libro", "Acqua", "Fiore", "Bambino", "Uccello", "Pesce"
];

export const getPracticeWords = (lang = 'en') => {
  const stored = localStorage.getItem(`dysco_practice_words_${lang}`);
  if (stored) return JSON.parse(stored);
  if (lang === 'es') return PRACTICE_WORDS_ES;
  if (lang === 'fr') return PRACTICE_WORDS_FR;
  if (lang === 'de') return PRACTICE_WORDS_DE;
  if (lang === 'it') return PRACTICE_WORDS_IT;
  return PRACTICE_WORDS_EN;
};

export const savePracticeWords = (words, lang = 'en') => {
  localStorage.setItem(`dysco_practice_words_${lang}`, JSON.stringify(words));
};


const PRACTICE_SENTENCES_EN = [
  "The quick brown fox jumps over the lazy dog.",
  "I love learning to write!",
  "My name is Dysco and I am your AI coach.",
  "Today is a wonderful day to practice.",
  "The sun is shining brightly in the sky.",
  "She sells seashells by the seashore.",
  "A journey of a thousand miles begins with a single step."
];

const PRACTICE_SENTENCES_ES = [
  "Hola amigo.",
  "Me gusta mucho.",
  "Buenos dias.",
  "El sol es muy grande y amarillo.",
  "El gato bebe agua."
];

const PRACTICE_SENTENCES_FR = [
  "Bonjour mon ami.",
  "Oui merci.",
  "C est bon.",
  "Le chat noir.",
  "Le soleil brille."
];

const PRACTICE_SENTENCES_DE = [
  "Hallo mein Freund.",
  "Ich lerne gerne schreiben.",
  "Der Himmel ist blau.",
  "Die Sonne scheint.",
  "Der Hund rennt schnell."
];

const PRACTICE_SENTENCES_IT = [
  "Ciao amico mio.",
  "Mi piace imparare.",
  "Il cielo e blu.",
  "Il sole splende.",
  "Il gatto beve latte."
];

export const getPracticeSentences = (lang = 'en') => {
  const stored = localStorage.getItem(`dysco_practice_sentences_${lang}`);
  if (stored) return JSON.parse(stored);
  if (lang === 'es') return PRACTICE_SENTENCES_ES;
  if (lang === 'fr') return PRACTICE_SENTENCES_FR;
  if (lang === 'de') return PRACTICE_SENTENCES_DE;
  if (lang === 'it') return PRACTICE_SENTENCES_IT;
  return PRACTICE_SENTENCES_EN;
};

export const savePracticeSentences = (sentences, lang = 'en') => {
  localStorage.setItem(`dysco_practice_sentences_${lang}`, JSON.stringify(sentences));
};

// ------------------------------------------------------------------
// Gamification: Coins & Store
// ------------------------------------------------------------------
export const getUserCoins = (username) => {
  const coins = localStorage.getItem(`dysco_coins_${username}`);
  return coins ? parseInt(coins, 10) : 0;
};

export const addCoins = (username, amount) => {
  const currentCoins = getUserCoins(username);
  const newCoins = currentCoins + amount;
  localStorage.setItem(`dysco_coins_${username}`, newCoins);
  return newCoins;
};

export const deductCoins = (username, amount) => {
  const currentCoins = getUserCoins(username);
  if (currentCoins >= amount) {
    const newCoins = currentCoins - amount;
    localStorage.setItem(`dysco_coins_${username}`, newCoins);
    return newCoins;
  }
  return currentCoins;
};

export const getPurchasedColors = (username) => {
  const data = localStorage.getItem(`dysco_purchased_${username}`);
  let parsed = data ? JSON.parse(data) : ['#0ea5e9', '#ef4444']; // Blue and Red are free default
  return parsed;
};

export const purchaseColor = (username, colorHex) => {
  const purchased = getPurchasedColors(username);
  if (!purchased.includes(colorHex)) {
    purchased.push(colorHex);
    localStorage.setItem(`dysco_purchased_${username}`, JSON.stringify(purchased));
  }
  return purchased;
};

export const getPurchasedGifts = (username) => {
  const data = localStorage.getItem(`dysco_gifts_${username}`);
  let parsed = data ? JSON.parse(data) : [];
  return parsed;
};

export const purchaseGift = (username, giftId) => {
  const purchased = getPurchasedGifts(username);
  if (!purchased.includes(giftId)) {
    purchased.push(giftId);
    localStorage.setItem(`dysco_gifts_${username}`, JSON.stringify(purchased));
  }
  return purchased;
};

export const getPurchasedPens = (username) => {
  const data = localStorage.getItem(`dysco_pens_${username}`);
  // Default free pens
  return data ? JSON.parse(data) : ['marker', 'fountain', 'highlighter', 'brush'];
};

export const purchasePen = (username, penId) => {
  const purchased = getPurchasedPens(username);
  if (!purchased.includes(penId)) {
    purchased.push(penId);
    localStorage.setItem(`dysco_pens_${username}`, JSON.stringify(purchased));
  }
  return purchased;
};

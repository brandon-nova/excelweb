const API_KEY = 'd12vjkhr01qv1k0nill0d12vjkhr01qv1k0nillg';
const ALPHA_VANTAGE_API_KEY = 'XRYG08MMAVHPSCHM';

let lastTick = null;

let alphaVantageCache = {
  prevH: null,
  prevL: null,
  lastFetchedTimestamp: 0
};

const ONE_DAY_MS = 86400000;

function setCardBg(id, bgClass) {
  const card = document.getElementById(id).parentElement;
  card.classList.remove('bg-orange', 'bg-green', 'bg-red', 'white-text', 'black-text');
  if (bgClass) {
    card.classList.add(bgClass, 'white-text');
  } else {
    card.classList.add('black-text');
  }
}

function setTextColor(id, colorClass) {
  const el = document.getElementById(id);
  el.classList.remove('text-green', 'text-red');
  if (colorClass) el.classList.add(colorClass);
}

async function fetchData() {
  const { o: open, h: high, l: low, c: last, pc: prevClose } = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=SPXL&token=${API_KEY}`
  ).then(r => r.ok ? r.json() : Promise.reject('Quote fetch failed'));

  let prevH, prevL;
  const now = Date.now();

  if (alphaVantageCache.prevH !== null && (now - alphaVantageCache.lastFetchedTimestamp < ONE_DAY_MS)) {
    prevH = alphaVantageCache.prevH;
    prevL = alphaVantageCache.prevL;
  } else {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=SPXL&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Alpha Vantage error: ${response.status}`);
      const data = await response.json();

      const series = data["Time Series (Daily)"];
      if (!series) throw new Error("Alpha Vantage: missing data");

      const dates = Object.keys(series).sort((a, b) => new Date(b) - new Date(a));
      if (dates.length < 2) throw new Error("Not enough history");

      const yesterday = series[dates[1]];
      prevH = parseFloat(yesterday['2. high']);
      prevL = parseFloat(yesterday['3. low']);

      alphaVantageCache = { prevH, prevL, lastFetchedTimestamp: now };
    } catch (e) {
      document.getElementById('error').textContent = `Error fetching PrevH/L: ${e.message || e}`;
    }
  }

  return { open, high, low, last, prevClose, prevH, prevL };
}

function fmt(x, pct = false) {
  if (x == null) return '–';
  return pct ? (x * 100).toFixed(2) + '%' : (+x).toFixed(2);
}

function updateUI({ open, high, low, last, prevClose, prevH, prevL }) {
  const range = (high - low) / open;
  const co = (last - open) / open;
  const ho = (high - open) / open;
  const ol = (open - low) / open;
  const gap = (open - prevClose) / prevClose;
  const offs = [0.02, 0.01, -0.02, -0.01].map(p => open * (1 + p));
  const pp = (high + low + prevClose) / 3;
  const s1 = (2 * pp) - high;
  const r1 = (2 * pp) - low;

  const update = (id, value, bg = '', color = '') => {
    const el = document.getElementById(id);
    el.textContent = fmt(value);
    if (color) el.style.color = color;
    setCardBg(id, bg);
  };

  update('s1', s1, last < s1 ? 'bg-red' : (low < s1 && last > s1 ? 'bg-green' : ''));
  update('r1', r1, last > r1 ? 'bg-green' : (high > r1 && last < r1 ? 'bg-red' : ''));
  update('last', last, 'bg-yellow'); setTextColor('last', last > lastTick ? 'text-green' : last < lastTick ? 'text-red' : null);
  update('open', open, 'bg-blue');
  update('range', range, range > 0.04 ? 'bg-orange' : '');
  update('co', co, '', co > 0 ? '#159b35' : co < 0 ? '#c82a2a' : '#222');
  update('ho', ho, ho > 0.02 ? 'bg-green' : '');
  update('ol', ol, ol < -0.02 ? 'bg-red' : '');
  update('gap', gap, gap > 0.01 ? 'bg-green' : gap < -0.01 ? 'bg-red' : '');

  const dir = document.getElementById('gapDir');
  dir.textContent = gap > 0.01 ? '↑' : gap < -0.01 ? '↓' : '–';
  setCardBg('gapDir', (gap > 0.01 && last > open) ? 'bg-green' : (gap < -0.01 && last < open) ? 'bg-red' : '');

  update('p2', offs[0], co > 0.02 ? 'bg-green' : (ho > 0.02 && co < 0.02 || (last < offs[0] && high > offs[0])) ? 'bg-red' : '');
  update('p1', offs[1], co > 0.01 ? 'bg-green' : (last < offs[1] && high > offs[1]) ? 'bg-red' : '');
  update('m2', offs[2], co < -0.02 ? 'bg-red' : (ol < -0.02 && co > -0.02 || (last > offs[2] && low < offs[2])) ? 'bg-green' : '');
  update('m1', offs[3], co < -0.01 ? 'bg-red' : (last > offs[3] && low < offs[3]) ? 'bg-green' : '');

  update('todayHigh', high, '', (prevH != null && high > prevH) ? '#159b35' : '#222');
  update('todayLow', low, '', (prevL != null && low < prevL) ? '#c82a2a' : '#222');
  update('prevH', prevH, last > prevH ? 'bg-green' : (high > prevH && last < prevH) ? 'bg-red' : '');
  update('prevL', prevL, last < prevL ? 'bg-red' : (low < prevL && last > prevL) ? 'bg-green' : '');

  let prevCbg = '';
  if (open < prevClose && last > prevClose) prevCbg = 'bg-green';
  else if (open > prevClose && low < prevClose && last > prevClose) prevCbg = 'bg-green';
  else if (open > prevClose && last < prevClose) prevCbg = 'bg-red';
  else if (open < prevClose && high > prevClose && last < prevClose) prevCbg = 'bg-red';
  update('prevC', prevClose, prevCbg);

  lastTick = last;

  const reverseSignalEl = document.getElementById('reverseSignal');
  let signalText = '–';
  let signalBg = '';
  let signalColor = '#222';
  
  if ((high > prevH && last < prevH) || (high > offs[0] && last < offs[0])) {
    signalText = '↓ Reverse Sell';
    signalBg = 'bg-red';
    signalColor = '#fff';
  } else if ((low < prevL && last > prevL) || (low < offs[2] && last > offs[2])) {
    signalText = '↑ Reverse Buy';
    signalBg = 'bg-green';
    signalColor = '#fff';
  }
  
  reverseSignalEl.textContent = signalText;
  reverseSignalEl.style.color = signalColor;
  setCardBg('reverseSignal', signalBg);

}

async function refresh() {
  try {
    const data = await fetchData();
    updateUI(data);
    document.getElementById('lastRefreshed').textContent =
      'Last refreshed: ' + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById('error').textContent = e;
  }
}

refresh();
setInterval(refresh, 60_000);

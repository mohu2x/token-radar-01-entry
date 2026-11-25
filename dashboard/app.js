(() => {
  'use strict';

  const data = window.RADAR;
  const main = document.getElementById('main');
  if (!data) {
    main.textContent = 'The radar snapshot could not be loaded.';
    main.removeAttribute('aria-busy');
    return;
  }

  const formatUsd = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });
  const formatDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
  const snapshotDate = formatDate.format(new Date(data.as_of));
  const categoryOf = row => row.category ?? 'Unclassified';
  const categoriesOf = rows => [...new Set(rows.map(categoryOf))].sort((a, b) => a.localeCompare(b));
  const boardCategories = categoriesOf(data.rows);
  const peerCategories = categoriesOf(data.live);
  const bySlug = new Map(data.rows.map(row => [row.slug, row]));
  const highestEstimate = Math.max(1, ...data.rows.map(row => row.implied_value_usd));
  const totals = data.rows.reduce((sum, row) => ({
    tvl: sum.tvl + row.tvl_usd,
    value: sum.value + row.implied_value_usd
  }), { tvl: 0, value: 0 });
  const boardKeys = { rank: 'rank', tvl: 'tvl_usd', momentum: 'change_7d', value: 'implied_value_usd' };
  const peerKeys = { tvl: 'tvl_usd', momentum: 'change_7d', cap: 'mcap_usd' };
  const grades = ['A', 'B', 'C'];
  let state;

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs ?? {})) {
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children.flat());
    return node;
  }

  function compactUsd(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
    return formatUsd.format(value);
  }

  function multiple(value, digits) {
    return value.toFixed(digits) + '×';
  }

  function movement(change) {
    if (!Number.isFinite(change)) return el('span', { class: 'muted', text: '—', title: 'Unreported' });
    const tone = change < 0 ? 'down' : change > 0 ? 'up' : 'muted';
    const sign = change < 0 ? '−' : change > 0 ? '+' : '';
    return el('span', { class: tone, text: sign + Math.abs(change).toFixed(2) + '%' });
  }

  function readRoute() {
    const [path, query] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    const match = /^\/p\/([^/]+)$/.exec(path);
    let slug = match?.[1];
    if (slug) {
      try { slug = decodeURIComponent(slug); }
      catch { slug = match[1]; }
    }
    const page = slug ? 'detail' : path === '/peers' ? 'peers' : path === '/method' ? 'method' : 'board';
    const categories = page === 'peers' ? peerCategories : boardCategories;
    const keys = page === 'peers' ? peerKeys : boardKeys;
    const category = params.get('category');
    const confidence = params.get('confidence');
    const sort = params.get('sort');
    const order = params.get('order');
    const sortKey = Object.hasOwn(keys, sort) ? sort : page === 'peers' ? 'tvl' : 'rank';
    return {
      page, slug,
      category: categories.includes(category) ? category : '',
      confidence: page !== 'peers' && grades.includes(confidence) ? confidence : '',
      q: params.get('q') ?? '',
      sort: sortKey,
      ascending: order === 'asc' || (order !== 'desc' && sortKey === 'rank')
    };
  }

  function href(page, slug) {
    const path = page === 'detail' ? '/p/' + encodeURIComponent(slug) : '/' + page;
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.confidence) params.set('confidence', state.confidence);
    if (state.q) params.set('q', state.q);
    if (state.sort !== (page === 'peers' ? 'tvl' : 'rank') || state.ascending !== (state.sort === 'rank')) {
      params.set('sort', state.sort);
      params.set('order', state.ascending ? 'asc' : 'desc');
    }
    return '#' + path + (params.size ? '?' + params : '');
  }

  function syncRoute() {
    history.replaceState(null, '', href(state.page));
  }

  function filteredRows(peers) {
    const query = state.q.trim().toLocaleLowerCase('en-US');
    const key = (peers ? peerKeys : boardKeys)[state.sort];
    return (peers ? data.live : data.rows).filter(row => {
      if (state.category && categoryOf(row) !== state.category) return false;
      if (state.confidence && row.confidence !== state.confidence) return false;
      return !query || [row.name, row.slug, categoryOf(row), ...row.chains].join(' ').toLocaleLowerCase('en-US').includes(query);
    }).sort((a, b) => {
      if (a[key] == null && b[key] != null) return 1;
      if (b[key] == null && a[key] != null) return -1;
      const difference = (a[key] ?? 0) - (b[key] ?? 0);
      return difference * (state.ascending ? 1 : -1) || (peers ? a.name.localeCompare(b.name) : a.rank - b.rank);
    });
  }

  function hero() {
    const metrics = [
      ['Protocols on the board', data.rows.length, data.watchlist_size + ' watchlist · ' + data.early_size + ' early coverage'],
      ['Combined TVL', compactUsd(totals.tvl), 'Total value locked'],
      ['Combined implied value', compactUsd(totals.value)],
      ['Categories', boardCategories.length]
    ];

    return [
      el('section', { class: 'hero', 'aria-labelledby': 'page-title' },
        el('div', { class: 'hero-copy' },
          el('h1', { id: 'page-title', text: 'Pre-token radar' }),
          el('p', { text: 'A valuation board for DeFi protocols with no token recorded in the DefiLlama snapshot.' })),
        el('div', { class: 'hero-scope', 'aria-hidden': 'true' },
          el('div', { class: 'scope-dial' }),
          el('i', { class: 'scope-point scope-point-one' }),
          el('i', { class: 'scope-point scope-point-two' }),
          el('i', { class: 'scope-point scope-point-three' }),
          el('i', { class: 'scope-point scope-point-four' }))),
      el('dl', { class: 'metrics' }, metrics.map(([label, value, note], index) =>
        el('div', { class: 'metric' + (index === 2 ? ' metric-value' : '') },
          el('dt', { text: label }),
          el('dd', { class: 'metric-number', text: value }),
          ...(note ? [el('dd', { class: 'metric-note', text: note })] : []))))
    ];
  }

  function selectControl(id, title, empty, options, value) {
    const select = el('select', { id },
      el('option', { value: '', text: empty }),
      options.map(option => el('option', { value: option, text: id === 'confidence' ? 'Grade ' + option : option })));
    select.value = value;
    return el('label', { class: 'field', for: id }, el('span', { text: title }), select);
  }

  function filters(peers) {
    const input = el('input', { id: 'search', type: 'search', placeholder: 'Name, category or chain', autocomplete: 'off' });
    input.value = state.q;
    return el('div', { class: 'filters' },
      el('label', { class: 'field search-field', for: 'search' },
        el('span', { text: 'Search protocols' }), el('span', { class: 'search-box' }, input)),
      selectControl('category', 'Category', 'All categories', peers ? peerCategories : boardCategories, state.category),
      ...(peers ? [] : [selectControl('confidence', 'Confidence', 'All grades', grades, state.confidence)]),
      el('button', { type: 'button', class: 'clear', text: 'Clear filters', hidden: '' }));
  }

  function sortHeader(key, label, type = 'num') {
    const active = state.sort === key;
    const attributes = { scope: 'col', class: type };
    if (active) attributes['aria-sort'] = state.ascending ? 'ascending' : 'descending';
    return el('th', attributes,
      el('button', { type: 'button', 'data-sort': key },
        label, el('span', { class: 'sort-arrow', 'aria-hidden': 'true', text: active ? (state.ascending ? '↑' : '↓') : '↕' })));
  }

  function chainSummary(chains) {
    if (!chains.length) return el('span', { class: 'muted', text: '—', title: 'Unreported' });
    return el('span', { class: 'chain-summary', title: chains.join(', ') },
      el('span', { text: chains[0] }),
      ...(chains.length > 1 ? [el('span', { class: 'chain-more', text: '+' + (chains.length - 1) })] : []));
  }

  function confidenceBadge(grade) {
    return el('span', { class: 'grade grade-' + grade.toLowerCase(), text: 'Grade ' + grade });
  }

  function moneyCell(value) {
    return el('td', { class: 'num', text: compactUsd(value), title: Number.isFinite(value) ? formatUsd.format(value) : 'Unreported' });
  }

  function boardRow(row) {
    const ratio = Math.max(2, row.implied_value_usd / highestEstimate * 100);
    return el('tr', null,
      el('td', { class: 'rank num', text: String(row.rank).padStart(2, '0') }),
      el('th', { scope: 'row', class: 'protocol' }, el('a', { href: href('detail', row.slug), text: row.name })),
      el('td', { class: 'category-cell', text: categoryOf(row) }),
      el('td', { class: 'chains-cell' }, chainSummary(row.chains)),
      moneyCell(row.tvl_usd),
      el('td', { class: 'num' }, movement(row.change_7d)),
      el('td', { class: 'num multiple-cell', text: multiple(row.model.base_multiple, 3) }),
      el('td', { class: 'num estimate-cell', title: formatUsd.format(row.implied_value_usd) },
        el('div', { class: 'estimate' },
          el('span', { class: 'estimate-track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + ratio + '%' })),
          compactUsd(row.implied_value_usd))),
      el('td', { class: 'confidence-cell' }, confidenceBadge(row.confidence)));
  }

  function peerRow(row) {
    return el('tr', null,
      el('th', { scope: 'row', class: 'protocol', text: row.name }),
      el('td', { class: 'category-cell', text: categoryOf(row) }),
      el('td', { class: 'chains-cell' }, chainSummary(row.chains)),
      moneyCell(row.tvl_usd),
      el('td', { class: 'num' }, movement(row.change_7d)),
      moneyCell(row.mcap_usd));
  }

  function table(rows, peers) {
    const header = (label, classes = '') => el('th', { scope: 'col', class: classes, text: label });
    const headings = [
      ...(peers ? [] : [sortHeader('rank', 'Rank', 'num rank')]),
      header('Protocol'), header('Category'), header('Chains'),
      sortHeader('tvl', 'TVL'), sortHeader('momentum', '7d change'),
      ...(peers ? [sortHeader('cap', 'Market cap')] : [
        header('Base multiple', 'num'), sortHeader('value', 'Implied value'),
        header('Confidence', 'confidence-cell')
      ])
    ];
    const columns = peers ? [] : [el('colgroup', null,
      ['rank', 'protocol', 'category', 'chains', 'tvl', 'momentum', 'multiple', 'estimate', 'confidence']
        .map(column => el('col', { class: 'col-' + column })))];
    return el('div', { class: 'table-scroll' },
      el('table', { class: peers ? 'peer-table' : 'board-table', 'aria-labelledby': 'board-title' },
        columns, el('thead', null, el('tr', null, headings)),
        el('tbody', null, rows.map(peers ? peerRow : boardRow))));
  }

  function renderBoard(peers) {
    const controls = filters(peers);
    const search = controls.querySelector('#search');
    const category = controls.querySelector('#category');
    const confidence = controls.querySelector('#confidence');
    const clear = controls.querySelector('.clear');
    const count = el('p', { class: 'result-count', 'aria-live': 'polite' });
    const results = el('div', { class: 'results' });
    const total = peers ? data.live.length : data.rows.length;
    const scope = peers ? 'tokenized peers' : 'protocols';

    function refresh() {
      const rows = filteredRows(peers);
      count.textContent = rows.length + ' of ' + total + ' ' + scope;
      clear.hidden = !state.category && !state.confidence && !state.q;
      results.replaceChildren(rows.length ? table(rows, peers) :
        el('div', { class: 'empty' }, el('strong', { text: 'No protocols match these filters.' }),
          el('p', { text: 'Try a different search or clear the filters.' })));
    }

    function applyFilters() {
      state.q = search.value;
      state.category = category.value;
      state.confidence = confidence?.value ?? '';
      syncRoute();
      refresh();
    }

    search.addEventListener('input', applyFilters);
    category.addEventListener('change', applyFilters);
    confidence?.addEventListener('change', applyFilters);
    clear.addEventListener('click', () => {
      search.value = category.value = '';
      if (confidence) confidence.value = '';
      applyFilters();
      search.focus();
    });
    results.addEventListener('click', event => {
      const sort = event.target.closest('[data-sort]')?.dataset.sort;
      if (!sort) return;
      state.ascending = state.sort === sort ? !state.ascending : sort === 'rank';
      state.sort = sort;
      syncRoute();
      refresh();
      results.querySelector('[data-sort="' + sort + '"]').focus({ preventScroll: true });
    });

    const title = peers ? 'Tokenized peers' : 'Ranked board';
    const content = el('section', { class: 'board-section' },
      el('div', { class: 'section-heading' },
        el(peers ? 'h1' : 'h2', { id: 'board-title', text: title }), count),
      ...(peers ? [el('p', { class: 'page-intro', text: 'A selection of protocols with a token and market cap recorded in the snapshot.' })] : []),
      el('div', { class: 'board-panel' }, controls, results));
    main.append(...(peers ? [] : hero()), content,
      el('footer', { class: 'footer' },
        el('span', { text: 'Source: DefiLlama snapshot · ' + snapshotDate }),
        el('a', { href: '#/method', text: 'Valuation method →' })));
    refresh();
  }

  function valueBreakdown(row) {
    const model = row.model;
    const base = row.tvl_usd * model.base_multiple;
    const inputs = [
      ['Total value locked', compactUsd(row.tvl_usd), formatUsd.format(row.tvl_usd)],
      ['Peer median', model.base_multiple.toPrecision(5) + '×', String(model.base_multiple)],
      ['Base value', compactUsd(base), formatUsd.format(base)]
    ];
    const adjustments = [
      ['Momentum', model.growth_multiplier],
      ['Track record', model.maturity_multiplier],
      ['Chain breadth', model.chain_multiplier]
    ];
    return el('section', { class: 'detail-card', 'aria-labelledby': 'breakdown-title' },
      el('div', { class: 'card-heading' }, el('h2', { id: 'breakdown-title', text: 'Value breakdown' })),
      el('div', { class: 'equation' }, inputs.flatMap(([label, value, exact], index) => [
        ...(index ? [el('span', { class: 'operator', text: index === 1 ? '×' : '=' })] : []),
        el('div', { class: 'equation-input', title: exact }, el('span', { text: label }), el('strong', { text: value }))
      ])),
      el('p', { class: 'peer-note', text: row.rationale[0] }),
      el('dl', { class: 'adjustments' }, adjustments.map(([label, factor], index) =>
        el('div', { class: 'adjustment' },
          el('dt', { text: label }),
          el('dd', { class: 'factor', text: factor.toPrecision(5) + '×' }),
          el('dd', { class: 'adjustment-note', text: row.rationale[index + 1] })))),
      el('div', { class: 'confidence-note' },
        el('h3', { text: 'Confidence' }), confidenceBadge(row.confidence),
        el('p', { text: row.confidence_reason })));
  }

  function farmPlan(row) {
    const steps = row.farm_steps.map(step => {
      const parts = /^(.*?)\s+Cost:\s*(.*?)\s+Time:\s*(.*)$/s.exec(step);
      if (!parts) return el('li', null, el('p', { text: step }));
      const [, action, cost, time] = parts;
      return el('li', null, el('div', null,
        el('p', { text: action }),
        el('dl', { class: 'step-notes' },
          el('div', null, el('dt', { text: 'Cost' }), el('dd', { text: cost })),
          el('div', null, el('dt', { text: 'Time' }), el('dd', { text: time })))));
    });
    return el('section', { class: 'detail-card', 'aria-labelledby': 'farm-title' },
      el('div', { class: 'card-heading' }, el('h2', { id: 'farm-title', text: 'Farm plan' })),
      el('ol', { class: 'steps' }, steps));
  }

  function renderDetail() {
    const row = bySlug.get(state.slug);
    const back = el('a', { class: 'back-link', href: href('board'), text: '←  Ranked board' });
    if (!row) {
      main.append(el('section', { class: 'page-lead' }, back, el('h1', { text: 'Protocol unavailable' }),
        el('p', { class: 'page-intro', text: 'This protocol does not appear on the ranked board.' })));
      return;
    }
    main.append(
      el('section', { class: 'detail-lead' }, back,
        el('div', { class: 'detail-heading' },
          el('div', null,
            el('div', { class: 'detail-meta' },
              el('span', { class: 'rank-tag', text: 'Rank ' + String(row.rank).padStart(2, '0') }),
              el('span', { text: categoryOf(row) })),
            el('h1', { text: row.name })),
          el('div', { class: 'detail-estimate' },
            el('span', { text: 'Implied value · USD' }),
            el('strong', { text: formatUsd.format(row.implied_value_usd) }))),
        el('p', { class: 'detail-chains' },
          el('strong', { text: 'Chains' }), row.chains.join(' · ') || 'Unreported')),
      el('div', { class: 'detail-grid' }, valueBreakdown(row), farmPlan(row)),
      el('footer', { class: 'footer' },
        el('span', { text: 'Snapshot-based valuation estimate' }),
        el('a', { href: '#/method', text: 'Valuation method →' })));
  }

  function renderMethod() {
    const m = data.model;
    const details = [
      ['Peer multiple', 'Calculate the median market-cap-to-TVL ratio of tokenized protocols with a reported market cap and positive TVL. Use the category median when at least ' + m.min_category_comparables + ' peers qualify. Otherwise use the global median of ' + multiple(data.global_comparables.median, 5) + ' across ' + data.global_comparables.count + ' peers.'],
      ['Momentum', 'Add ' + m.growth_weight * 100 + '% of the seven-day TVL change to a starting factor of 1×. Bound the change to ' + m.growth_floor + '% through +' + m.growth_cap + '%. Missing change uses 1×.'],
      ['Track record', 'Increase the factor linearly from ' + multiple(m.maturity_floor, 2) + ' at listing to ' + multiple(m.maturity_floor + m.maturity_range, 2) + ' after ' + m.maturity_days + ' days of DefiLlama tracking. A missing listing date uses 1×.'],
      ['Chain breadth', 'Add ' + m.chain_weight * 100 + '% per distinct chain after the first, through chain ' + m.chain_cap + '. An unreported chain list uses 1×.'],
      ['Confidence grades', 'Grade A requires at least ' + m.min_grade_a_comparables + ' category peers and all four inputs. Grade B requires a category median and at least three inputs. Grade C covers the remaining estimates. The four inputs are category, TVL change, listing date and chains.']
    ];
    main.append(
      el('section', { class: 'page-lead' },
        el('h1', { text: 'Valuation method' }),
        el('p', { class: 'page-intro', text: 'Token Radar estimates what a hypothetical token’s market cap could be if it traded on multiples observed in this snapshot. The model’s estimate is a snapshot-based comparison. Future token prices would depend on supply and market conditions.' })),
      el('section', { class: 'method-card', 'aria-labelledby': 'method-formula' },
        el('h2', { id: 'method-formula', text: 'Implied value' }),
        el('p', { class: 'method-formula', text: 'TVL × peer multiple × momentum × track record × chain breadth' }),
        el('dl', { class: 'method-list' }, details.map(([term, explanation]) =>
          el('div', null, el('dt', { text: term }), el('dd', { text: explanation }))))),
      el('footer', { class: 'footer' },
        el('span', { text: 'Source: DefiLlama snapshot · ' + snapshotDate }),
        el('a', { href: '#/board', text: 'Ranked board →' })));
  }

  function render(focus = false) {
    state = readRoute();
    const active = state.page === 'detail' ? 'board' : state.page;
    document.querySelectorAll('[data-page]').forEach(link => {
      if (link.dataset.page === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    main.replaceChildren();
    if (state.page === 'detail') renderDetail();
    else if (state.page === 'method') renderMethod();
    else renderBoard(state.page === 'peers');
    document.title = main.querySelector('h1').textContent + ' · Token Radar';
    main.removeAttribute('aria-busy');
    if (focus) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
  }

  document.getElementById('snapshot').append(
    el('span', { text: 'Snapshot' }),
    el('time', { datetime: data.as_of, text: snapshotDate }));
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    main.focus();
  });
  window.addEventListener('hashchange', () => render(true));
  render();
})();

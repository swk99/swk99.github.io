const $ = id => document.getElementById(id);
const key = 'workspace-sql-interview-tutor-v1';
const mockMinutes = 45;
const methods = [
  [['scalar'], ['tuple_in'], ['exists'], ['join', 'no_exists']],
  [['inline'], ['inline'], ['select_scalar'], ['join']],
  [['scalar'], ['inline'], ['select_scalar'], ['window']],
  [['window'], ['count_over'], ['window'], ['join', 'no_window']],
  [['rownumber'], ['denserank'], ['rank'], ['scalar', 'no_window']],
  [['lag'], ['lag', 'lead'], ['firstvalue', 'lastvalue'], ['select_scalar', 'no_window']],
  [['range'], ['range'], ['range'], ['join', 'no_window']]
];
const methodLabel = {
  scalar: 'scalar subquery', select_scalar: 'Scalar subquery in SELECT', tuple_in: 'multi-column IN',
  exists: 'EXISTS', inline: 'inline view', window: 'window function', count_over: 'COUNT OVER',
  rownumber: 'ROW_NUMBER', denserank: 'DENSE_RANK', rank: 'RANK', lag: 'LAG', lead: 'LEAD',
  firstvalue: 'FIRST_VALUE', lastvalue: 'LAST_VALUE', range: 'RANGE', join: 'JOIN',
  no_window: 'Write without a window', no_exists: 'Write without EXISTS'
};
let course, state, worker, busy = false, workerTimeout;

function node(tag, value) {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  return element;
}

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    $('save-status').textContent = 'Progress cannot be saved in this browser. Closing the page may lose your current progress.';
  }
}

function button(label, handler, secondary = false) {
  const element = node('button', label);
  element.type = 'button';
  if (secondary) element.className = 'secondary';
  element.addEventListener('click', handler);
  return element;
}

function move(step, index = 0) {
  Object.assign(state, {step, index, draft: '', outcome: null, hint: 0});
  save();
  render();
  $('title').focus();
}

function orderedQuestions(section) {
  return [
    ...section.quizzes.map((item, index) => ({...item, kind: 'quiz', index})),
    ...section.labs.map((item, index) => ({...item, kind: 'lab', index}))
  ];
}

function question() {
  if (state.section === -1) return {...course.diagnostic[state.index], kind: 'quiz'};
  const section = course.sections[state.section];
  if (state.step === 'review') {
    const {section, index} = state.review;
    const item = section === -1 ? {...course.diagnostic[index], kind: 'quiz'} : orderedQuestions(course.sections[section])[index];
    if (item.kind === 'quiz') return {...item, choices: [...item.choices].reverse(), answer: item.choices.length - 1 - item.answer};
    return {...item, tests: [...item.tests].reverse().map((test, i) => ({...test, label: i === 0 ? 'Review sample' : 'Additional validation'}))};
  }
  if (state.step === 'alternate') {
    const lab = section.labs.at(-1);
    return {...lab, prompt: lab.alternate[0].split(' trade-off: ')[0], solution: lab.alternate[1],
      hint: ['First identify the intermediate results calculated in your original solution.', lab.alternate[2]],
      why: lab.alternate[2], kind: 'lab', index: 3};
  }
  return orderedQuestions(section)[state.index];
}

function updateClock() {
  const clock = $('timer');
  clock.hidden = state.section !== 7 || state.step !== 'questions';
  if (clock.hidden) return;
  const seconds = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
  clock.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  if (!seconds) {
    stopWorker();
    move('summary');
  }
}

function scoreId() {
  if (state.step === 'alternate') return state.section + ':alternate';
  if (state.step === 'review') return state.review.section + ':' + state.review.index;
  return state.section + ':' + state.index;
}

function advance() {
  if (state.section === -1) {
    if (state.index < course.diagnostic.length - 1) return move('questions', state.index + 1);
    return move('diagnosis');
  }
  if (state.step === 'review') {
    if (state.outcome?.ok) state.weak = state.weak.filter(item => item !== state.review.id);
    state.review = null;
    return move('questions');
  }
  if (state.step === 'alternate') return move('trade');
  if (state.index + 1 < orderedQuestions(course.sections[state.section]).length) return move('questions', state.index + 1);
  move(state.section === 7 ? 'summary' : 'alternate');
}

function submitOutcome(outcome) {
  const id = scoreId();
  if (!Object.hasOwn(state.scores, id)) {
    state.scores[id] = outcome;
    if (!outcome.ok && state.section < 7 && state.step !== 'alternate') state.weak.push(id);
  }
  state.outcome = outcome;
  save();
  render();
}

function sqlLiteral(value) {
  if (value === null) return 'NULL';
  return typeof value === 'number' ? String(value) : "'" + value.replaceAll("'", "''") + "'";
}

function fixtureSQL(schema, tables) {
  return Object.entries(schema).map(([name, columns]) => {
    const rows = tables[name];
    const create = 'CREATE TABLE ' + name + ' (\n  ' + columns.map(column => column.join(' ')).join(',\n  ') + '\n);';
    if (!rows.length) return create;
    return create + '\nINSERT INTO ' + name + ' VALUES\n  ' + rows.map(row => '(' + row.map(sqlLiteral).join(', ') + ')').join(',\n  ') + ';';
  }).join('\n\n');
}

function codeBlock(label, code) {
  const details = node('details');
  details.append(node('summary', label), node('pre', code));
  const status = node('span');
  status.setAttribute('role', 'status');
  const tools = node('div');
  tools.className = 'copy-row';
  tools.append(button('Copy SQL', async () => {
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = 'Copied.';
    } catch {
      status.textContent = 'Select and copy the SQL in the code block.';
    }
  }, true), status);
  details.append(tools);
  return details;
}

function equalRows(left, right) {
  return left?.length === right?.length && left?.every((value, index) =>
    typeof value === 'number' && typeof right[index] === 'number'
      ? Math.abs(value - right[index]) <= 1e-6 : value === right[index]);
}

function table(columns, rows, compare) {
  const wrap = node('div');
  wrap.className = 'table-wrap';
  const element = node('table');
  const head = element.createTHead().insertRow();
  for (const column of ['Row', ...columns]) head.append(node('th', column));
  const body = element.createTBody();
  rows.forEach((row, index) => {
    const tr = body.insertRow();
    if (compare && !equalRows(row, compare[index])) tr.className = 'mismatch';
    tr.append(node('td', index + 1));
    for (const value of row) tr.append(node('td', value === null ? 'NULL' : String(value)));
  });
  wrap.append(element);
  if (!rows.length) wrap.append(node('p', '0 rows'));
  return wrap;
}

function showOutcome(target, item, outcome, includeSolution = false) {
  target.append(node('p', outcome.revealed ? 'Answer revealed.' : outcome.ok ? 'Passed' : 'Incorrect'));
  if (item.kind === 'quiz') {
    if (outcome.choice !== undefined) target.append(node('p', 'Selected · ' + item.choices[outcome.choice]));
    target.append(node('p', 'Answer · ' + item.choices[item.answer]), node('p', item.why));
    return;
  }
  if (outcome.message) target.append(node('p', outcome.message));
  if (outcome.missing?.length) {
    target.append(node('p', 'Check the required solution syntax separately from the output. ' + outcome.missing.map(name => methodLabel[name]).join(', ')));
  }
  for (const [index, result] of (outcome.results ?? []).entries()) {
    if (index > 0 && result.ok) continue;
    const expected = result.expected ?? {columns: item.columns, rows: item.tests[index].expected};
    target.append(node('h2', result.label + ' · ' + (result.ok ? 'Passed' : 'Mismatch')));
    if (index > 0) target.append(codeBlock('View failing input · CREATE TABLE / INSERT', fixtureSQL(item.schema, item.tests[index].args[0])));
    if (result.error) target.append(node('pre', result.error));
    if (result.actual) {
      const actual = result.actual;
      if (actual.rows.length !== expected.rows.length) {
        target.append(node('p', 'Returned ' + actual.rows.length + ' rows / Expected ' + expected.rows.length + ' rows'));
      }
      if (actual.columns.join() !== expected.columns.join()) {
        target.append(node('p', 'Column names or column order differ.'));
      }
      target.append(node('p', 'Actual result'), table(actual.columns, actual.rows.slice(0, 50), expected.rows));
    }
    if (!result.ok) target.append(node('p', 'Expected result'), table(expected.columns, expected.rows, result.actual?.rows));
  }
  if (outcome.ok || outcome.revealed || includeSolution || outcome.results?.some(result => result.actual)) {
    target.append(node('p', item.why));
  }
  if (outcome.revealed || includeSolution) target.append(node('pre', item.solution + ';'));
}

function stopWorker() {
  clearTimeout(workerTimeout);
  worker?.terminate();
  worker = null;
  busy = false;
}

function runSQL(item) {
  if (busy || !state.draft.trim()) return;
  busy = true;
  render();
  worker ??= new Worker('worker.js?v=english-v1', {type: 'module'});
  const engineFailure = message => {
    stopWorker();
    render();
    $('feedback').textContent = message;
  };
  workerTimeout = setTimeout(() => engineFailure('The execution engine timed out. Please submit again.'), 45000);
  worker.onerror = () => engineFailure('Execution engine error. Please submit again.');
  worker.onmessage = ({data}) => {
    clearTimeout(workerTimeout);
    busy = false;
    if (data.error) return engineFailure(data.error);
    if (state.section === 7 && Date.now() >= state.deadline) return move('summary');
    const result = data.result;
    if (result.message && state.section !== 7) {
      submitOutcome({message: result.message, ok: false});
      return;
    }
    submitOutcome({
      ...result,
      ok: Boolean(result.results?.length && result.results.every(test => test.ok) && !result.missing?.length)
    });
  };
  worker.postMessage({
    language: 'sql', mode: 'submit', ordered: true, code: state.draft,
    schema: item.schema, columns: item.columns, tests: item.tests,
    methods: methods[state.step === 'review' ? state.review.section : state.section]?.[item.index] ?? []
  });
}

function renderQuestion(content, feedback, actions) {
  const item = question();
  const mock = state.section === 7;
  const locked = Boolean(state.outcome && (mock || item.kind === 'quiz' || state.outcome.ok || state.outcome.revealed));
  content.append(node('p', item.prompt));
  if (item.query) content.append(node('pre', item.query));
  if (item.setup) {
    const setup = codeBlock('Sample data · CREATE TABLE / INSERT', item.setup);
    setup.open = true;
    content.append(setup);
  }

  if (item.kind === 'quiz') {
    const fieldset = node('fieldset');
    fieldset.disabled = locked;
    fieldset.append(node('legend', 'Choose an answer'));
    item.choices.forEach((choice, index) => {
      const label = node('label');
      const input = node('input');
      input.type = 'radio';
      input.name = 'choice';
      input.value = index;
      input.checked = state.draft === String(index);
      input.addEventListener('change', () => {
        state.draft = input.value;
        save();
        submit.disabled = false;
      });
      label.append(input, node('span', choice));
      fieldset.append(label);
    });
    content.append(fieldset);
  } else {
    const fixture = codeBlock('Schema and sample data · CREATE TABLE / INSERT', fixtureSQL(item.schema, item.tests[0].args[0]));
    fixture.open = true;
    content.append(fixture, node('h2', 'Expected output'), table(item.columns, item.tests[0].expected));
    const label = node('label', 'SQL to submit');
    label.htmlFor = 'answer';
    const editor = node('textarea');
    editor.id = 'answer';
    editor.placeholder = 'SELECT …';
    editor.autocapitalize = 'off';
    editor.autocomplete = 'off';
    editor.spellcheck = false;
    editor.value = state.draft;
    editor.disabled = locked || busy;
    editor.addEventListener('input', () => {
      state.draft = editor.value;
      save();
      submit.disabled = !editor.value.trim();
    });
    content.append(node('h2', 'Write a query'), label, editor);
  }

  const submit = button(busy ? 'Running…' : state.outcome ? 'Resubmit' : 'Submit', () => {
    if (item.kind === 'lab') return runSQL(item);
    const choice = Number(state.draft);
    submitOutcome({ok: choice === item.answer, choice});
  });
  submit.disabled = busy || !state.draft.trim();
  if (!locked) actions.append(submit);
  if (!mock && !busy && !locked) {
    if (item.kind === 'lab' && state.hint < item.hint.length) {
      actions.append(button('Hint ' + (state.hint + 1), () => { state.hint++; save(); render(); }, true));
    }
    actions.append(button('Answer', () => submitOutcome({ok: false, revealed: true}), true));
  }
  if (state.hint && !mock) {
    const hints = node('ol');
    for (const hint of item.hint.slice(0, state.hint)) hints.append(node('li', hint));
    feedback.append(hints);
  }
  if (state.outcome) {
    if (mock) feedback.append(node('p', 'Submission recorded. Grading is available after the exam ends.'));
    else showOutcome(feedback, item, state.outcome);
    if (!busy) actions.append(button('Next', advance, !locked));
  }
}

function startNext() {
  state.section++;
  if (state.section === 7) return move('exam-start');
  move('concept');
}

function renderSummary(content, actions) {
  const section = course.sections[state.section];
  const items = orderedQuestions(section);
  const outcomes = items.map((_, index) => state.scores[state.section + ':' + index]);
  if (state.section !== 7) {
    items.push({...section.labs.at(-1), prompt: 'Alternative solution', kind: 'lab'});
    outcomes.push(state.scores[state.section + ':alternate']);
  }
  content.append(node('p', 'First submission · ' + outcomes.filter(item => item?.ok).length + ' / ' + items.length));
  const missed = node('ul');
  items.forEach((item, index) => {
    const outcome = outcomes[index];
    if (outcome?.ok) return;
    missed.append(node('li', (outcome?.revealed ? 'Reveal answer' : outcome ? 'Incorrect' : 'Not submitted') + ' · ' + item.prompt));
  });
  if (missed.children.length) content.append(node('h2', 'Items to review'), missed);
  if (state.section !== 7) {
    actions.append(button(state.section === 6 ? 'Mock exam instructions' : 'Next section', startNext));
    return;
  }
  content.append(node('h2', 'Grading and explanations by question'));
  items.forEach((item, index) => {
    const detail = node('details');
    detail.append(node('summary', (index + 1) + ' · ' + (outcomes[index]?.ok ? 'Passed' : outcomes[index] ? 'Incorrect' : 'Not submitted')));
    detail.append(node('p', item.prompt));
    showOutcome(detail, item, outcomes[index] ?? {revealed: true}, true);
    content.append(detail);
  });
}

function render() {
  const content = $('content');
  const feedback = $('feedback');
  const actions = $('actions');
  content.replaceChildren();
  feedback.replaceChildren();
  actions.replaceChildren();
  const section = course.sections[state.section];
  const nav = ['Diagnostic', ...course.sections.map((item, index) => index === 7 ? item.title : (index + 1) + '. ' + item.title)];
  $('sections').replaceChildren(...nav.map((title, index) => {
    const chip = node('span', title);
    if (index === state.section + 1) chip.setAttribute('aria-current', 'step');
    return chip;
  }));
  $('progress').textContent = 'MySQL 8.0 · ' + (section?.title ?? 'Diagnostic');
  if (state.step === 'diagnosis') {
    $('title').textContent = 'Diagnostic results';
    const score = course.diagnostic.filter((_, index) => state.scores['-1:' + index]?.ok).length;
    content.append(node('p', score + ' / 3. Explanations for correct diagnostic answers are shortened; missed topics return in later reviews.'));
    actions.append(button('Start section 1', startNext));
  } else if (state.step === 'concept') {
    $('title').textContent = section.title;
    const list = node('ul');
    const known = course.diagnostic.some((item, index) => item.topic === state.section && state.scores['-1:' + index]?.ok);
    for (const note of (known ? section.notes.slice(-3) : section.notes)) list.append(node('li', note));
    content.append(list, node('p', section.pg));
    actions.append(button('Start quiz', () => {
      const id = state.weak.find(value => {
        const [previous, index] = value.split(':').map(Number);
        return previous === -1 ? course.diagnostic[index].topic === state.section : previous < state.section;
      });
      if (id) {
        const [previous, index] = id.split(':').map(Number);
        state.review = {id, section: previous, index};
        return move('review');
      }
      move('questions');
    }));
  } else if (state.step === 'trade') {
    $('title').textContent = 'Trade-off';
    const alternate = section.labs.at(-1).alternate;
    content.append(node('p', alternate[0].split(' trade-off: ')[1]));
    const editor = node('textarea');
    editor.setAttribute('aria-label', 'Trade-off response');
    editor.value = state.draft;
    editor.disabled = Boolean(state.outcome);
    editor.addEventListener('input', () => {
      state.draft = editor.value;
      save();
      compare.disabled = !editor.value.trim();
    });
    const compare = button('Compare answers', () => {
      state.outcome = {submitted: true};
      save();
      render();
    });
    compare.disabled = !state.draft.trim();
    content.append(editor);
    if (state.outcome) {
      feedback.append(node('p', alternate[2]));
      actions.append(button('Section results', () => move('summary')));
    } else actions.append(compare);
  } else if (state.step === 'summary') {
    $('title').textContent = state.section === 7 ? 'Mock exam results' : 'Section results';
    renderSummary(content, actions);
  } else if (state.step === 'exam-start') {
    $('title').textContent = 'Comprehensive mock exam';
    content.append(node('p', 'Five quiz questions and five SQL exercises. Starting begins a 45-minute timer that continues after refreshing. Explanations appear after the exam ends.'));
    actions.append(button('Start 45-minute mock exam', () => {
      state.deadline = Date.now() + mockMinutes * 60 * 1000;
      move('questions');
    }));
  } else {
    const item = question();
    $('title').textContent = state.section === -1 ? 'Diagnostic ' + (state.index + 1) + ' / 3'
      : state.step === 'review' ? 'Review previous mistakes'
      : state.step === 'alternate' ? 'Solve using another approach'
      : state.section === 7 ? 'Mock exam ' + (state.index + 1) + ' / 10'
      : item.kind === 'quiz' ? 'Concept quiz ' + (item.index + 1) + ' / 3' : ['Exercise 1 · Easy', 'Exercise 2 · Medium', 'Exercise 3 · Interview level'][item.index];
    renderQuestion(content, feedback, actions);
  }
  updateClock();
}

try {
  const response = await fetch('course.json?v=english-v1');
  if (!response.ok) throw new Error();
  course = await response.json();
  try {
    state = JSON.parse(localStorage.getItem(key));
  } catch {
    state = null;
  }
  state ??= {section: -1, step: 'questions', index: 0, draft: '', outcome: null, hint: 0, scores: {}, weak: []};
  render();
  setInterval(updateClock, 250);
} catch {
  $('title').textContent = 'Could not load the course';
  $('content').textContent = 'Check your internet connection and refresh the page.';
}


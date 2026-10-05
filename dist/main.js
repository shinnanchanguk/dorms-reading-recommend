/*
 * 학생 도서 추천. 독서 교육 책의 '학생 도서 추천' 색인에 실리는 화면입니다.
 * 여기부터 마음대로 고치세요. 구조도 자유예요(교과별이 아니어도 됩니다).
 * AI 에게 "이렇게 바꿔 줘" 라고 말하면 AGENTS.md 의 규칙 안에서 고쳐 줍니다.
 *
 * 데이터는 책의 '데이터 상자'에 담습니다. 어떤 모음(자료 표)을 쓰는지는 레포 맨 위 dorms-book.json 의
 * data 에 적어 두세요. 새 판을 승인할 때 도름스 운영자가 그 선언을 보고 실제 상자에 연결합니다.
 */
var SETTINGS = {
  /** 이 화면이 실린 색인의 이름표. 도름스가 정한 값이라 바꾸지 마세요. */
  indexKey: "recommend",
  /** 추천 도서를 담는 모음 이름. dorms-book.json 의 data 선언과 같아야 해요. */
  collection: "books",
  /** 교과 순서. 독서 교육 책의 목차와 같은 순서예요. */
  subjects: ["공통", "국어", "수학", "사회", "역사", "과학", "영어", "도덕", "실과·기술가정", "정보", "체육", "음악", "미술", "한문·제2외국어", "진로"],
  /** 한 칸에 담을 수 있는 글자 수. 도름스 상자는 한 줄에 8KB 까지라 넉넉해요. */
  limits: { title: 120, author: 80, level: 40, reason: 200, link: 300 },
};

/* ───────── 작은 도구 ───────── */

var SVG_NS = "http://www.w3.org/2000/svg";
var ICONS = {
  chevron: ["M6 9l6 6 6-6"],
  plus: ["M12 5v14", "M5 12h14"],
  pencil: ["M4 20h4L19 9l-4-4L4 16v4z", "M14 6l4 4"],
  trash: ["M5 7h14", "M9 7V5h6v2", "M7 7l1 13h8l1-13"],
  copy: ["M9 9h10v10H9z", "M5 15V5h10"],
  book: ["M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z", "M5 17a3 3 0 0 1 3-3h10"],
};

function icon(name, size) {
  var svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(size || 16));
  svg.setAttribute("height", String(size || 16));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  (ICONS[name] || []).forEach(function (d) {
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
}

/** 글자는 언제나 textContent 로 넣는다(상자에 담긴 글이 화면 코드가 되지 않게). */
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function button(label, options) {
  var opts = options || {};
  var node = el("button", opts.primary ? "rr-primary" : opts.quiet ? "rr-quiet" : "rr-button");
  node.type = "button";
  if (opts.icon) node.appendChild(icon(opts.icon, 16));
  if (label) node.appendChild(el("span", null, label));
  if (opts.ariaLabel) node.setAttribute("aria-label", opts.ariaLabel);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  return node;
}

function clean(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

/** 상자에서 꺼낸 한 줄을 화면이 쓰는 모양으로 바꾼다. 모양이 이상한 줄은 버린다. */
function toBook(row) {
  var v = row && row.value;
  if (!v || typeof v !== "object") return null;
  var subject = SETTINGS.subjects.indexOf(v.subject) >= 0 ? v.subject : "공통";
  var title = clean(v.title, SETTINGS.limits.title);
  if (!title) return null;
  return {
    key: String(row.key),
    mine: row.mine === true,
    subject: subject,
    title: title,
    author: clean(v.author, SETTINGS.limits.author),
    level: clean(v.level, SETTINGS.limits.level),
    reason: clean(v.reason, SETTINGS.limits.reason),
    link: /^https?:\/\//i.test(clean(v.link, SETTINGS.limits.link)) ? clean(v.link, SETTINGS.limits.link) : "",
    order: typeof v.order === "number" && isFinite(v.order) ? v.order : 0,
  };
}

function newKey() { return "b-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }

/* ───────── 화면 ───────── */

(async function () {
  var root = document.getElementById("recommend");
  var dorms = await DormsBook.connect().catch(function () { return null; });
  if (!dorms) { root.textContent = ""; root.appendChild(el("p", "rr-state", "도름스와 연결하지 못했어요.")); return; }
  // 높이는 내용에 맞춰 늘고 줄어든다(dist/fit.js). dorms.autoFit() 은 함께 걸지 않는다.
  var fitFrame = ReadingFit.watch(dorms, root);

  var answers = await Promise.all([dorms.call("book.get"), dorms.me.get(), dorms.indexes.list()]).catch(function () { return null; });
  if (!answers) { root.textContent = ""; root.appendChild(el("p", "rr-state", "책 정보를 불러오지 못했어요.")); return; }
  var theme = answers[0] && answers[0].theme;
  var me = answers[1] || { signedIn: false, level: "anyone" };
  var indexes = answers[2] || [];
  dorms.applyTheme(theme);
  ReadingPalette.apply(theme);

  var index = indexes.find(function (item) { return item.key === SETTINGS.indexKey; })
    || indexes.find(function (item) { return item.module === "data"; });
  var state = {
    operator: me.level === "operator",
    books: [],
    open: {},
    editing: null,
    confirming: null,
    focusEditor: false,
    busy: false,
    error: "",
  };

  async function load() {
    if (!index) { state.error = "이 화면이 실릴 색인을 찾지 못했어요."; return; }
    var answer = await dorms.data.list(index.key, SETTINGS.collection).catch(function (failure) {
      state.error = (failure && failure.message) || "추천 도서를 불러오지 못했어요.";
      return null;
    });
    if (!answer) return;
    state.error = "";
    state.books = (answer.rows || []).map(toBook).filter(Boolean).sort(function (a, b) {
      return SETTINGS.subjects.indexOf(a.subject) - SETTINGS.subjects.indexOf(b.subject) || a.order - b.order || a.title.localeCompare(b.title, "ko");
    });
  }

  async function save(form) {
    if (state.busy) return;
    var value = {
      subject: SETTINGS.subjects.indexOf(form.subject) >= 0 ? form.subject : "공통",
      title: clean(form.title, SETTINGS.limits.title),
      author: clean(form.author, SETTINGS.limits.author),
      level: clean(form.level, SETTINGS.limits.level),
      reason: clean(form.reason, SETTINGS.limits.reason),
      link: clean(form.link, SETTINGS.limits.link),
      order: form.order || Date.now(),
    };
    // 다시 그려도 적던 글이 남게, 지금 칸의 값을 먼저 기억해 둔다.
    state.editing = form;
    if (!value.title) { dorms.notify("책 제목을 적어 주세요."); draw(); return; }
    if (value.link && !/^https?:\/\//i.test(value.link)) { dorms.notify("주소는 http 나 https 로 시작해야 해요."); draw(); return; }
    state.busy = true; draw();
    var done = await dorms.data.set(index.key, SETTINGS.collection, form.key || newKey(), value).catch(function (failure) {
      dorms.notify((failure && failure.message) || "저장하지 못했어요.");
      return null;
    });
    state.busy = false;
    if (done) { state.editing = null; state.open[value.subject] = true; await load(); dorms.notify("추천 도서를 담았어요."); }
    draw();
  }

  async function remove(book) {
    if (state.busy) return;
    state.busy = true; draw();
    var done = await dorms.data.remove(index.key, SETTINGS.collection, book.key).catch(function (failure) {
      dorms.notify((failure && failure.message) || "빼지 못했어요.");
      return null;
    });
    state.busy = false;
    state.confirming = null;
    if (done) { await load(); dorms.notify("추천 도서를 뺐어요."); }
    draw();
  }

  function header() {
    var head = el("header", "rr-head");
    var titles = el("div", "rr-titles");
    titles.appendChild(el("h1", "rr-title", "학생 도서 추천"));
    titles.appendChild(el("p", "rr-lead", "교과마다 학생에게 권하는 책을 모았어요."));
    head.appendChild(titles);
    var counted = el("p", "rr-count", "교과 " + SETTINGS.subjects.length + " · 추천 도서 " + state.books.length + "권");
    head.appendChild(counted);
    var tools = el("div", "rr-tools");
    var anyOpen = SETTINGS.subjects.some(function (name) { return state.open[name]; });
    tools.appendChild(button(anyOpen ? "모두 접기" : "모두 펼치기", {
      quiet: true,
      onClick: function () {
        SETTINGS.subjects.forEach(function (name) { state.open[name] = !anyOpen; });
        draw();
      },
    }));
    if (state.operator) tools.appendChild(button("추천 도서 더하기", { primary: true, icon: "plus", onClick: function () { state.editing = { subject: "공통" }; state.focusEditor = true; draw(); } }));
    head.appendChild(tools);
    return head;
  }

  function editor(seed) {
    // 격리된 액자는 form 제출을 막는다(submit 이벤트도 오지 않는다). 그래서 form 대신 단추와 Enter 로 담는다.
    var box = el("div", "rr-editor");
    box.setAttribute("role", "form");
    box.setAttribute("aria-label", seed.key ? "추천 도서 고치기" : "추천 도서 더하기");
    var fields = {};
    function field(name, label, input) {
      var wrap = el("label", "rr-field");
      wrap.appendChild(el("span", null, label));
      wrap.appendChild(input);
      fields[name] = input;
      box.appendChild(wrap);
    }
    var subject = el("select");
    SETTINGS.subjects.forEach(function (name) {
      var option = el("option", null, name);
      option.value = name;
      if (name === (seed.subject || "공통")) option.selected = true;
      subject.appendChild(option);
    });
    field("subject", "교과", subject);
    [["title", "책 제목", SETTINGS.limits.title, true], ["author", "지은이", SETTINGS.limits.author], ["level", "학년 · 학교급", SETTINGS.limits.level], ["reason", "한 줄 추천 이유", SETTINGS.limits.reason], ["link", "책 소개 주소(있으면)", SETTINGS.limits.link]].forEach(function (spec) {
      var input = el(spec[0] === "reason" ? "textarea" : "input");
      if (spec[0] !== "reason") input.type = spec[0] === "link" ? "url" : "text";
      if (spec[0] === "reason") input.rows = 2;
      input.maxLength = spec[2];
      input.value = seed[spec[0]] || "";
      if (spec[3]) input.required = true;
      field(spec[0], spec[1], input);
    });
    var actions = el("div", "rr-editor-actions");
    actions.appendChild(button("취소", { onClick: function () { state.editing = null; draw(); } }));
    function submitForm() {
      void save({ key: seed.key, order: seed.order, subject: fields.subject.value, title: fields.title.value, author: fields.author.value, level: fields.level.value, reason: fields.reason.value, link: fields.link.value });
    }
    var submit = button(state.busy ? "담는 중" : "담기", { primary: true, onClick: submitForm });
    submit.disabled = state.busy;
    actions.appendChild(submit);
    box.appendChild(actions);
    // 한 줄 칸에서 Enter 를 누르면 담는다. 한글을 조합하는 중의 Enter 는 글자 확정이라 건너뛴다.
    box.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
      if (!event.target || event.target.tagName !== "INPUT") return;
      event.preventDefault();
      submitForm();
    });
    // 창을 처음 열 때만 제목 칸으로 옮긴다(다시 그릴 때마다 옮기면 적던 칸을 놓친다).
    if (state.focusEditor) { state.focusEditor = false; requestAnimationFrame(function () { fields.title.focus(); }); }
    return box;
  }

  function bookRow(book) {
    var row = el("li", "rr-book");
    var main = el("div", "rr-book-main");
    main.appendChild(el("strong", "rr-book-title", book.title));
    var meta = [book.author, book.level].filter(Boolean).join(" · ");
    if (meta) main.appendChild(el("span", "rr-book-meta", meta));
    if (book.reason) main.appendChild(el("p", "rr-book-reason", book.reason));
    row.appendChild(main);
    var actions = el("div", "rr-book-actions");
    // 이 화면은 격리된 액자라 바깥 주소를 바로 열 수 없어요. 주소를 복사해 드려요.
    if (book.link) actions.appendChild(button("주소 복사", { quiet: true, icon: "copy", onClick: function () { dorms.copy(book.link).then(function () { dorms.notify("주소를 복사했어요."); }).catch(function () {}); } }));
    if (state.operator && state.confirming === book.key) {
      // 격리된 액자에서는 브라우저 확인 창이 막혀서, 줄 안에서 한 번 더 묻는다.
      actions.appendChild(button("그대로 두기", { onClick: function () { state.confirming = null; draw(); } }));
      actions.appendChild(button(state.busy ? "빼는 중" : "빼기", { primary: true, onClick: function () { void remove(book); } }));
    } else if (state.operator) {
      actions.appendChild(button("", { quiet: true, icon: "pencil", ariaLabel: book.title + " 고치기", onClick: function () { state.confirming = null; state.editing = book; state.focusEditor = true; draw(); } }));
      actions.appendChild(button("", { quiet: true, icon: "trash", ariaLabel: book.title + " 빼기", onClick: function () { state.confirming = book.key; draw(); } }));
    }
    if (actions.childNodes.length) row.appendChild(actions);
    return row;
  }

  function subjectGroup(name, number) {
    var books = state.books.filter(function (book) { return book.subject === name; });
    var group = el("section", "rr-group");
    group.setAttribute("data-chapter", String(ReadingPalette.slot(number)));
    if (!books.length) group.setAttribute("data-empty", "true");
    var open = !!state.open[name];
    var bodyId = "rr-subject-" + number;
    var head = el("button", "rr-subject");
    head.type = "button";
    head.setAttribute("aria-expanded", open ? "true" : "false");
    head.setAttribute("aria-controls", bodyId);
    head.appendChild(el("span", "rr-badge", ReadingPalette.label(number)));
    var main = el("span", "rr-subject-main");
    main.appendChild(el("span", "rr-subject-title", name));
    main.appendChild(el("span", "rr-subject-note", books.length ? "추천 도서 " + books.length + "권" : "함께 채울 자리"));
    head.appendChild(main);
    head.appendChild(el("span", "rr-pill", String(books.length)));
    var chevron = el("span", "rr-chevron");
    chevron.appendChild(icon("chevron", 18));
    head.appendChild(chevron);
    head.addEventListener("click", function () { state.open[name] = !open; draw(); });
    group.appendChild(head);
    var body = el("div", "rr-subject-body");
    body.id = bodyId;
    body.hidden = !open;
    if (books.length) {
      var list = el("ul", "rr-books");
      books.forEach(function (book) { list.appendChild(bookRow(book)); });
      body.appendChild(list);
    } else {
      body.appendChild(el("p", "rr-empty", "아직 이 교과의 추천 도서가 없어요."));
    }
    if (state.operator) body.appendChild(button("이 교과에 더하기", { icon: "plus", onClick: function () { state.editing = { subject: name }; state.focusEditor = true; draw(); } }));
    group.appendChild(body);
    return group;
  }

  function draw() {
    root.textContent = "";
    root.appendChild(header());
    if (state.error) {
      var failed = el("div", "rr-state");
      failed.appendChild(el("p", null, state.error));
      failed.appendChild(button("다시 불러오기", { onClick: function () { void load().then(draw); } }));
      root.appendChild(failed);
    }
    if (state.editing && state.operator) root.appendChild(editor(state.editing));
    if (!state.error && !state.books.length) {
      root.appendChild(el("p", "rr-empty-all", state.operator
        ? "아직 추천 도서가 없어요. 위의 '추천 도서 더하기'로 첫 책을 담아 보세요."
        : "아직 추천 도서가 없어요. 운영하는 선생님이 교과마다 채워 갈 거예요."));
    }
    var outline = el("nav", "rr-outline");
    outline.setAttribute("aria-label", "교과별 추천 도서");
    SETTINGS.subjects.forEach(function (name, i) { outline.appendChild(subjectGroup(name, i + 1)); });
    root.appendChild(outline);
    fitFrame();
  }

  await load();
  // 처음 열 때는 책이 담긴 교과를 펼쳐 둔다(빈 교과는 접어 두어 채워진 교과가 먼저 읽히게).
  state.books.forEach(function (book) { state.open[book.subject] = true; });
  draw();
})();

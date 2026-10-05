/*
 * 연습용 도름스. 진짜 도름스와 같은 방식으로 액자에 포트를 건네고, 가짜 데이터로 답한다.
 * 데이터 상자도 흉내 낸다: 쓰기 자격은 색인의 쓰기 자격(writeRole)을 따르고, 담은 것은 이 컴퓨터의 연습 기록에만 남는다.
 * 화면이 dorms-book.json 에 선언하지 않은 모음을 쓰면 아래 기록 칸에 알려 준다(새 판을 내기 전에 선언을 맞추세요).
 */
(function () {
  "use strict";
  var frame = document.getElementById("frame");
  var log = document.getElementById("log");
  var levelSelect = document.getElementById("level");
  var themeSelect = document.getElementById("theme");
  var pathInput = document.getElementById("path");
  var STORE_KEY = "dorms-reading-recommend-practice";
  var RANK = { anyone: 0, login: 1, teacher: 2, member: 3, operator: 4 };
  var port = null;
  var declared = null;

  function say(line) { log.textContent = (line + "\n" + log.textContent).slice(0, 6000); }
  function reply(id, data) { if (port) port.postMessage({ id: id, ok: true, data: data }); }
  function refuse(id, error) { if (port) port.postMessage({ id: id, ok: false, error: error }); }

  function loadStore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved && typeof saved === "object") return saved;
    } catch (error) { /* 연습 기록을 못 읽으면 처음 상태로 */ }
    return JSON.parse(JSON.stringify(window.FIXTURES.data));
  }
  var store = loadStore();
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) { /* 저장 못 해도 화면은 돈다 */ } }

  // 레포 맨 위 dorms-book.json 의 data 선언을 읽어 둔다(연습용 확인에만 쓴다).
  fetch("../dorms-book.json").then(function (response) { return response.json(); }).then(function (json) {
    declared = Array.isArray(json && json.data) ? json.data : [];
    say("dorms-book.json 에 선언된 모음: " + (declared.map(function (item) { return item.index + "/" + item.collection; }).join(", ") || "없음"));
  }).catch(function () { say("dorms-book.json 을 읽지 못했어요. 레포 맨 위에 있는지 확인해 주세요."); });

  function checkDeclared(indexKey, collection) {
    if (!declared) return;
    var ok = declared.some(function (item) { return item.index === indexKey && item.collection === collection; });
    if (!ok) say("  알림: '" + indexKey + "/" + collection + "' 모음은 dorms-book.json 의 data 에 없어요. 새 판을 내기 전에 선언해 주세요.");
  }

  function indexShape(index, level) {
    return {
      key: index.key, label: index.label, module: index.module, sortOrder: index.sortOrder, viewRole: index.viewRole, writeRole: index.writeRole,
      canWrite: level !== "anyone" && RANK[level] >= RANK[index.writeRole], config: index.config,
    };
  }

  function answer(message) {
    var id = message && message.id, method = message && message.method, params = (message && message.params) || {};
    var F = window.FIXTURES, level = levelSelect.value;
    say(method + (Object.keys(params).length ? " " + JSON.stringify(params).slice(0, 200) : ""));
    switch (method) {
      case "ready": return reply(id, { version: 1 });
      case "book.get": return reply(id, { book: F.book, theme: F.themes[themeSelect.value] || F.themes.light });
      case "me.get": return reply(id, { signedIn: level !== "anyone", level: level, faceRole: null });
      case "indexes.list": return reply(id, F.indexes.map(function (index) { return indexShape(index, level); }));
      case "entries.list": case "people.list": case "links.list": return reply(id, []);
      case "data.list": case "data.get": case "data.set": case "data.remove": {
        var index = F.indexes.filter(function (item) { return item.key === params.index; })[0];
        if (!index) return refuse(id, "그 색인을 찾지 못했어요.");
        var collection = typeof params.collection === "string" && /^[a-z][a-z0-9_-]{1,40}$/.test(params.collection) ? params.collection : null;
        if (!collection) return refuse(id, "모음 이름을 확인해 주세요.");
        if (/(phone|tel|mobile|resident|ssn|address|birth|전화|휴대|주민|주소|생년)/i.test(collection + " " + (params.key || ""))) return refuse(id, "개인정보로 보이는 이름은 쓸 수 없어요.");
        checkDeclared(index.key, collection);
        var rows = ((store[index.key] = store[index.key] || {})[collection] = store[index.key][collection] || []);
        var shape = function (row) { return { key: row.key, value: row.value, mine: row.mine === true, updatedAt: row.updatedAt || "2026-10-05T00:00:00.000Z" }; };
        // 진짜 도름스처럼 최근에 고친 200줄까지만 돌려준다.
        if (method === "data.list") return reply(id, { rows: rows.slice(0, 200).map(shape) });
        var key = typeof params.key === "string" && params.key.length >= 1 && params.key.length <= 80 ? params.key : null;
        if (!key) return refuse(id, "이름을 확인해 주세요.");
        if (method === "data.get") { var found = rows.filter(function (row) { return row.key === key; })[0]; return reply(id, { row: found ? shape(found) : null }); }
        if (level === "anyone") return refuse(id, "로그인이 필요해요.");
        if (RANK[level] < RANK[index.writeRole]) return refuse(id, "이 색인에 남길 수 있는 분이 아니에요.");
        var at = rows.findIndex(function (row) { return row.key === key; });
        // 진짜 도름스처럼 남이 남긴 줄은 운영하는 분만 고치고 지운다.
        if (at >= 0 && rows[at].mine !== true && level !== "operator") return refuse(id, method === "data.remove" ? "남이 남긴 것은 지울 수 없어요." : "남이 남긴 것은 고칠 수 없어요.");
        if (method === "data.remove") {
          if (at < 0) return refuse(id, "그 기록을 찾지 못했어요.");
          rows.splice(at, 1); saveStore();
          return reply(id, { removed: true });
        }
        if (JSON.stringify(params.value || {}).length > 8192) return refuse(id, "한 줄에 담기엔 너무 길어요.");
        if (at < 0 && rows.length >= 2000) return refuse(id, "이 책의 상자가 가득 찼어요.");
        var next = { key: key, value: params.value || {}, mine: true, updatedAt: new Date().toISOString() };
        if (at >= 0) rows[at] = next; else rows.unshift(next);
        saveStore();
        return reply(id, { id: "practice-" + key });
      }
      case "open.piece": case "open.index": case "open.login": case "open.profile": case "dm.open": case "report": case "clipboard.copy": case "ui.notify":
        say("  → 도름스 창이 뜹니다(연습용이라 여기서는 적기만 해요)" + (params.message ? ": " + params.message : "") + ".");
        return reply(id, true);
      case "ui.resize":
        frame.style.height = Math.max(240, Math.min(6000, Number(params.height) || 420)) + "px";
        return reply(id, true);
      default: return refuse(id, "이 책에서 쓸 수 없는 기능이에요.");
    }
  }

  /** 다시 띄울 때마다 새 액자를 쓴다. 앞 화면이 늦게 보낸 load 가 새 화면의 연결을 끊지 않게. */
  function freshFrame() {
    var next = document.createElement("iframe");
    next.id = "frame";
    next.setAttribute("sandbox", "allow-scripts");
    next.title = frame.title;
    frame.replaceWith(next);
    frame = next;
  }

  function mount() {
    if (port) { port.close(); port = null; }
    say("화면을 띄우는 중이에요.");
    document.querySelector(".frame-wrap").style.background = themeSelect.value === "dark" ? "#1D211F" : "#F7F8F4";
    freshFrame();
    var channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = function (event) { answer(event.data); };
    port.start();
    var handed = false;
    var late = false;
    var loads = 0;
    var started = Date.now();
    currentHand = function () {
      // 진짜 도름스처럼 포트는 화면의 SDK 가 인사해 올 때 한 번만 건넨다.
      // 첫 load 와 인사 중 무엇이 먼저 오는지는 브라우저마다 달라서(격리된 액자가 다른 프로세스에서 돌면 load 가 먼저 오기도 해요) load 수로 막지 않는다.
      // 대신 진짜 도름스처럼 6초 안에 인사하지 않으면 받지 않는다(DormsBook.connect() 는 화면 스크립트 첫머리에서 부르세요).
      if (handed || late) return;
      if (Date.now() - started > 6000) { late = true; say("화면이 6초 안에 인사하지 않았어요. 진짜 도름스에서는 기본 화면으로 돌아가요. DormsBook.connect() 를 화면 스크립트 첫머리에서 부르는지 확인해 주세요."); return; }
      handed = true;
      frame.contentWindow.postMessage({ type: "dorms-book", version: 1 }, "*", [channel.port2]);
    };
    // 화면이 스스로 다른 주소로 옮겨 가면(두 번째 load) 연결을 끊는다. 듣는 곳을 다 건 뒤에 주소를 넣는다.
    frame.onload = function () {
      loads += 1;
      if (loads > 1 && port) { port.close(); port = null; handed = true; say("화면이 다른 곳으로 옮겨 가서 연결을 끊었어요. 진짜 도름스에서는 기본 화면으로 돌아가요."); }
    };
    frame.src = pathInput.value;
  }
  // 다시 띄울 때마다 듣는 곳을 늘리지 않게, 한 번만 걸고 지금 화면의 손만 부른다.
  var currentHand = function () {};
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "dorms-book-hello" && event.source === frame.contentWindow) currentHand();
  });

  document.getElementById("reload").addEventListener("click", mount);
  document.getElementById("reset").addEventListener("click", function () {
    try { localStorage.removeItem(STORE_KEY); } catch (error) { /* 지우지 못해도 아래에서 처음 상태로 */ }
    store = JSON.parse(JSON.stringify(window.FIXTURES.data));
    mount();
  });
  levelSelect.addEventListener("change", mount);
  themeSelect.addEventListener("change", mount);
  mount();
})();

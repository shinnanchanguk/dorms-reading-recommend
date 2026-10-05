/**
 * 도름스 책 SDK v1 — 책 화면(묶음)이 도름스와 이야기하는 유일한 통로.
 *
 * 쓰는 법: 화면 맨 위에서 한 번 부른다.
 *   const dorms = await DormsBook.connect();
 *   const { book } = await dorms.call("book.get");
 *
 * 왜 이렇게 생겼나: 이 화면은 격리된 액자 안에서 돈다(같은 출처 권한 없음 · 바깥 요청 금지).
 * 도름스가 액자를 띄우면서 '포트' 하나를 건네주고, 모든 대화가 그 포트로만 오간다.
 * 그래서 이 화면은 도름스 쿠키 · 로그인 · 데이터베이스에 직접 닿지 않는다. 필요한 것만 물어본다.
 *
 * 쓸 수 있는 이름(부모가 허락한 것만):
 *   book.get · me.get · indexes.list · entries.list({index}) · people.list · links.list · catalog.get
 *   notes.list({index, before}) · notes.add({index, body, parentId})
 *   data.list({index, collection}) · data.get · data.set · data.remove (이 책만 쓰는 작은 기록 상자)
 *   open.piece({key}) · open.index({key}) · open.login · open.profile({userId}) · dm.open({userId})
 *   report({noteId}) 또는 report({key}) · clipboard.copy({text}) · ui.resize({height}) · ui.notify({message})
 *
 * 잠긴 글(인증 교사 공개 · 열람 조건)의 본문 · 첨부 · 댓글은 어떤 호출로도 오지 않는다.
 * 열람 · 로그인 · 도름 확인 · 신고 · 쪽지는 도름스 화면이 뜬다. 이 화면은 그 창을 부르기만 한다.
 */
(function (global) {
  "use strict";

  function connect(options) {
    const timeout = (options && options.timeout) || 8000;
    return new Promise(function (resolve, reject) {
      let hello = null;
      const timer = setTimeout(function () {
        window.removeEventListener("message", onMessage);
        if (hello) clearInterval(hello);
        reject(new Error("도름스와 연결하지 못했어요."));
      }, timeout);
      function onMessage(event) {
        const data = event.data;
        if (!data || data.type !== "dorms-book" || !event.ports || !event.ports[0]) return;
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        if (hello) clearInterval(hello);
        const client = makeClient(event.ports[0]);
        // 도름스에 "떴어요" 하고 알린다. 이 신호가 없으면 도름스는 화면이 죽은 줄 알고 기본 화면으로 돌아간다.
        client.call("ready").catch(function () { /* 알리지 못해도 화면은 돈다 */ });
        resolve(client);
      }
      window.addEventListener("message", onMessage);
      // 누가 먼저 뜨든 만나게 한다: 도름스가 포트를 줄 때까지 "여기 있어요" 를 되풀이한다.
      function sayHello() { try { window.parent.postMessage({ type: "dorms-book-hello", version: 1 }, "*"); } catch (error) { /* 부모가 없으면 조용히 */ } }
      sayHello();
      hello = setInterval(sayHello, 250);
    });
  }

  function makeClient(port) {
    let seq = 0;
    const waiting = new Map();
    port.onmessage = function (event) {
      const reply = event.data || {};
      const pending = waiting.get(reply.id);
      if (!pending) return;
      waiting.delete(reply.id);
      if (reply.ok) pending.resolve(reply.data);
      else pending.reject(new Error(reply.error || "도름스가 거절했어요."));
    };
    port.start();

    function call(method, params) {
      seq += 1;
      const id = seq;
      return new Promise(function (resolve, reject) {
        waiting.set(id, { resolve: resolve, reject: reject });
        port.postMessage({ id: id, method: method, params: params || {} });
        setTimeout(function () {
          if (waiting.has(id)) { waiting.delete(id); reject(new Error("도름스가 답하지 않았어요.")); }
        }, 15000);
      });
    }

    /**
     * 화면 높이를 도름스에 알려 액자를 그만큼 늘린다.
     * 높이가 바뀌면 액자도 바뀌고, 그게 다시 높이를 바꿔 되먹임이 생긴다. 그래서 4px 넘게 달라질 때만 보낸다.
     */
    let sentHeight = 0;
    let fitQueued = false;
    function fit() {
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(function () {
        fitQueued = false;
        const body = document.body;
        const height = Math.ceil(Math.max(body ? body.scrollHeight : 0, document.documentElement.scrollHeight || 0));
        if (height <= 0 || Math.abs(height - sentHeight) <= 4) return;
        sentHeight = height;
        call("ui.resize", { height: height }).catch(function () { /* 높이는 못 맞춰도 화면은 돈다 */ });
      });
    }

    /** 내용이 바뀌면 높이를 자동으로 맞춘다(한 번만 걸면 된다). */
    function autoFit() {
      fit();
      // 문서 전체가 아니라 본문만 본다. 액자 높이를 따라가는 문서를 관찰하면 되먹임이 생긴다.
      if (typeof ResizeObserver === "function" && document.body) new ResizeObserver(fit).observe(document.body);
      window.addEventListener("load", fit);
    }

    /** 도름스가 준 색을 이 화면에 그대로 입힌다(책마다 색이 다르다). */
    function applyTheme(theme) {
      if (!theme) return;
      const root = document.documentElement;
      Object.keys(theme).forEach(function (key) {
        if (key.indexOf("--") === 0 && typeof theme[key] === "string") root.style.setProperty(key, theme[key]);
      });
    }

    const client = { call: call, fit: fit, autoFit: autoFit, applyTheme: applyTheme };
    // 자주 쓰는 것은 짧은 이름으로도 쓸 수 있게 한다.
    client.book = { get: function () { return call("book.get"); } };
    client.me = { get: function () { return call("me.get"); } };
    client.indexes = { list: function () { return call("indexes.list"); } };
    client.entries = { list: function (params) { return call("entries.list", params); } };
    client.people = { list: function () { return call("people.list"); } };
    client.links = { list: function () { return call("links.list"); } };
    client.catalog = { get: function () { return call("catalog.get"); } };
    // 이 책만 쓰는 작은 기록 상자. 누가 무엇을 담을 수 있는지는 그 색인의 자격을 따른다.
    client.data = {
      list: function (index, collection) { return call("data.list", { index: index, collection: collection }); },
      get: function (index, collection, key) { return call("data.get", { index: index, collection: collection, key: key }); },
      set: function (index, collection, key, value) { return call("data.set", { index: index, collection: collection, key: key, value: value }); },
      remove: function (index, collection, key) { return call("data.remove", { index: index, collection: collection, key: key }); },
    };
    client.notes = {
      list: function (params) { return call("notes.list", params); },
      add: function (params) { return call("notes.add", params); },
    };
    client.open = {
      piece: function (key) { return call("open.piece", { key: key }); },
      index: function (key) { return call("open.index", { key: key }); },
      login: function () { return call("open.login"); },
      profile: function (userId) { return call("open.profile", { userId: userId }); },
    };
    client.dm = { open: function (userId) { return call("dm.open", { userId: userId }); } };
    client.report = function (params) { return call("report", params); };
    client.copy = function (text) { return call("clipboard.copy", { text: text }); };
    client.notify = function (message) { return call("ui.notify", { message: message }); };
    return client;
  }

  global.DormsBook = { connect: connect, version: 1 };
})(window);

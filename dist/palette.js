/*
 * 교과 색. 독서 교육 책의 목차(01 공통 ~ 15 진로)와 같은 열 가지 색을 같은 규칙으로 만든다.
 * 종이색이 밝으면 짙은 쪽으로, 어두우면 밝은 쪽으로 옮겨 글자와 대비 5.3:1 이상을 맞춘다.
 * 이 파일은 고치지 않아도 됩니다. 색을 바꾸고 싶으면 아래 HUES 만 바꾸세요.
 */
(function (global) {
  "use strict";
  var HUES = ["#B5532D", "#16786F", "#3F55A6", "#6C7A1A", "#8F3F6C", "#A66D0C", "#3F6C8E", "#3B7A4C", "#A33737", "#6B4FA6"];
  var HEX = /^#[\da-f]{6}$/i;
  function channels(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function toHex(rgb) {
    return "#" + rgb.map(function (v) { return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"); }).join("").toUpperCase();
  }
  function mix(a, b, t) { var to = channels(b); return toHex(channels(a).map(function (v, i) { return v * (1 - t) + to[i] * t; })); }
  function luminance(hex) {
    var w = [0.2126, 0.7152, 0.0722];
    return channels(hex).reduce(function (sum, v, i) {
      var c = v / 255;
      return sum + (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)) * w[i];
    }, 0);
  }
  function contrast(a, b) { var x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  /** 종이색 하나에 맞춘 교과 색 열 가지(--ch-1 ~ --ch-10). */
  function palette(paper) {
    var ground = typeof paper === "string" && HEX.test(paper.trim()) ? paper.trim() : "#F7F8F4";
    var light = luminance(ground) > 0.35;
    var target = light ? "#141414" : "#FFFFFF";
    var out = {};
    HUES.forEach(function (hue, index) {
      var color = light ? hue : mix(hue, "#FFFFFF", 0.3);
      for (var step = 0; step < 40 && contrast(color, ground) < 5.3; step++) color = mix(color, target, 0.08);
      out["--ch-" + (index + 1)] = color;
    });
    return out;
  }

  function apply(theme) {
    var paper = theme && (theme["--paper"] || theme["--book-paper"]);
    var colors = palette(paper);
    Object.keys(colors).forEach(function (key) { document.documentElement.style.setProperty(key, colors[key]); });
  }

  global.ReadingPalette = {
    apply: apply,
    /** n번째 교과가 쓸 색 자리(1~10, 열한 번째부터 다시 처음 색). */
    slot: function (n) { return ((Math.max(1, Math.floor(n) || 1) - 1) % HUES.length) + 1; },
    /** 번호 표식 글자(01, 02 …). */
    label: function (n) { return String(n).padStart(2, "0"); },
  };
})(window);

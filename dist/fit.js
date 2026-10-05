/*
 * 액자 높이를 내용에 꼭 맞추는 작은 도구.
 * 책 SDK 의 dorms.fit() 은 문서 전체 높이를 함께 재서, 액자가 한 번 커지면 내용이 줄어도(모두 접기 · 책 빼기) 다시 작아지지 않는다.
 * 그래서 내용 덩어리 하나의 실제 높이만 재서 보낸다. 쓰는 법: ReadingFit.watch(dorms, document.getElementById("recommend"))
 * 이걸 쓰면 dorms.autoFit() 은 함께 걸지 않는다(둘이 서로 다른 높이를 보내게 된다).
 */
(function () {
  function watch(dorms, element) {
    var sent = 0;
    var queued = false;
    function measure() {
      queued = false;
      var rect = element.getBoundingClientRect();
      var style = getComputedStyle(document.body);
      var height = Math.ceil(rect.bottom + window.scrollY + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.marginBottom) || 0));
      height = Math.max(80, Math.min(20000, height));
      if (Math.abs(height - sent) <= 2) return;
      sent = height;
      dorms.call("ui.resize", { height: height }).catch(function () { /* 높이는 못 맞춰도 화면은 돈다 */ });
    }
    function fit() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    }
    fit();
    // 액자 높이를 따라가는 문서가 아니라 내용 덩어리만 본다(되먹임이 생기지 않는다).
    if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(element);
    window.addEventListener("load", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(function () {});
    return fit;
  }
  window.ReadingFit = { watch: watch };
})();

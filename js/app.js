(function () {
  "use strict";

  let stPhrases = { map: new Map(), maxLen: 0 };
  let stChars = { map: new Map(), maxLen: 0 };
  let twVariants = { map: new Map(), maxLen: 0 };
  let twPhrases = { map: new Map(), maxLen: 0 };
  let tsPhrases = { map: new Map(), maxLen: 0 };
  let tsChars = { map: new Map(), maxLen: 0 };
  let customS2t = { map: new Map(), maxLen: 0 };

  let mode = "s2t";

  const $input = document.getElementById("input");
  const $output = document.getElementById("output");
  const $convert = document.getElementById("convert");
  const $swap = document.getElementById("swap");
  const $clear = document.getElementById("clear");
  const $copy = document.getElementById("copy");
  const $inputCount = document.getElementById("inputCount");
  const $outputInfo = document.getElementById("outputInfo");
  const $status = document.getElementById("status");
  const $statusText = $status.querySelector(".status__text");
  const $subtitle = document.getElementById("subtitle");
  const $inputLabel = document.getElementById("inputLabel");
  const $outputLabel = document.getElementById("outputLabel");
  const $inputTag = document.getElementById("inputTag");
  const $outputTag = document.getElementById("outputTag");
  const $actionHint = document.getElementById("actionHint");

  const MAX_CANDIDATES = 12;

  function setStatus(state, text) {
    $status.classList.remove("status--ready", "status--error");
    if (state) $status.classList.add("status--" + state);
    $statusText.textContent = text;
  }

  function buildDict(text) {
    const map = new Map();
    let maxLen = 0;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.charCodeAt(0) === 35) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const key = line.slice(0, tab);
      const vals = line.slice(tab + 1).split(" ").filter(Boolean);
      if (key && vals.length) {
        map.set(key, vals);
        const len = Array.from(key).length;
        if (len > maxLen) maxLen = len;
      }
    }
    return { map, maxLen };
  }

  function mergeDict(base, extra) {
    for (const [k, v] of extra.map) {
      if (!base.map.has(k)) base.map.set(k, v);
    }
    if (extra.maxLen > base.maxLen) base.maxLen = extra.maxLen;
  }

  async function loadDict(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + " " + res.status);
    return res.text();
  }

  function longestMatch(text, dict) {
    const chars = Array.from(text);
    const segments = [];
    let i = 0;
    while (i < chars.length) {
      let matched = false;
      const limit = Math.min(dict.maxLen, chars.length - i);
      for (let len = limit; len >= 1; len--) {
        const sub = chars.slice(i, i + len).join("");
        if (dict.map.has(sub)) {
          segments.push({ trads: dict.map.get(sub), orig: sub });
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        segments.push({ trads: null, orig: chars[i] });
        i++;
      }
    }
    return segments;
  }

  function applyTwVariants(str) {
    const chars = Array.from(str);
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      const tws = twVariants.map.get(chars[i]);
      out.push(tws ? tws[0] : chars[i]);
    }
    return out.join("");
  }

  function applyTwPhrases(text) {
    const segs = longestMatch(text, twPhrases);
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      out.push(segs[i].trads ? segs[i].trads[0] : segs[i].orig);
    }
    return out.join("");
  }

  function convertS2T(text) {
    const segments = longestMatch(text, stPhrases);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.trads === null) {
        const trads = stChars.map.get(seg.orig);
        seg.trads = trads ? trads : [seg.orig];
      }
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const normalized = [];
      const seen = new Set();
      for (let j = 0; j < seg.trads.length; j++) {
        const v = applyTwVariants(seg.trads[j]);
        if (!seen.has(v)) { seen.add(v); normalized.push(v); }
      }
      seg.trads = normalized;
    }

    const ambiguous = [];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].trads.length > 1) {
        ambiguous.push(i);
      }
    }

    return { segments: segments, ambiguous: ambiguous };
  }

  function convertT2S(text) {
    const segments = longestMatch(text, tsPhrases);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.trads === null) {
        const trads = tsChars.map.get(seg.orig);
        seg.trads = trads ? trads : [seg.orig];
      }
    }

    const ambiguous = [];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].trads.length > 1) {
        ambiguous.push(i);
      }
    }

    return { segments: segments, ambiguous: ambiguous };
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildRichOutput(result) {
    const segs = result.segments;
    const ambi = result.ambiguous;

    if (ambi.length === 0) {
      const line = segs.map(function (s) { return s.trads[0]; }).join("");
      const finalLine = mode === "s2t" ? applyTwPhrases(line) : line;
      return { html: '<div class="amb-line">' + escapeHtml(finalLine) + '</div>', count: 1, ambiCount: 0 };
    }

    const ambiSet = new Set(ambi);
    const basePartsHtml = [];
    for (let i = 0; i < segs.length; i++) {
      const text = escapeHtml(segs[i].trads[0]);
      basePartsHtml.push(ambiSet.has(i) ? '<strong>' + text + '</strong>' : text);
    }

    const candidateLines = [];
    const seen = new Set();
    const baseRaw = segs.map(function (s) { return s.trads[0]; }).join("");
    const baseFinal = mode === "s2t" ? applyTwPhrases(baseRaw) : baseRaw;
    seen.add(baseFinal);

    function generateCandidates(depth, current) {
      if (candidateLines.length >= MAX_CANDIDATES) return;
      if (depth === ambi.length) {
        const line = current.join("");
        const finalLine = mode === "s2t" ? applyTwPhrases(line) : line;
        if (!seen.has(finalLine)) {
          seen.add(finalLine);
          candidateLines.push(finalLine);
        }
        return;
      }
      const segIdx = ambi[depth];
      const options = segs[segIdx].trads;
      for (let j = 1; j < options.length; j++) {
        if (candidateLines.length >= MAX_CANDIDATES) return;
        current[segIdx] = options[j];
        generateCandidates(depth + 1, current);
      }
    }
    generateCandidates(0, segs.map(function (s) { return s.trads[0]; }));

    let html = '<div class="amb-line amb">';
    html += basePartsHtml.join("");
    if (candidateLines.length > 0) {
      html += '<details><summary>另有 ' + candidateLines.length + ' 种可能</summary><div class="amb-candidates">';
      for (let k = 0; k < candidateLines.length; k++) {
        html += '<span>' + escapeHtml(candidateLines[k]) + '</span>';
      }
      html += '</div></details>';
    }
    html += '</div>';

    return { html: html, count: candidateLines.length + 1, ambiCount: ambi.length };
  }

  function updateInputCount() {
    const n = Array.from($input.value).filter(function (c) { return !/\s/.test(c); }).length;
    $inputCount.textContent = n + " 字";
  }

  function updateModeUI() {
    if (mode === "s2t") {
      $subtitle.textContent = "大陆标准简体 → 台湾标准繁体";
      $inputLabel.textContent = "输入 · 简体";
      $outputLabel.textContent = "输出 · 繁体 (TW)";
      $inputTag.textContent = "INPUT";
      $outputTag.textContent = "OUTPUT";
      $actionHint.textContent = "SC → TW";
      $input.placeholder = "在此输入简体汉字…";
      $convert.setAttribute("aria-label", "转化为台湾繁体");
    } else {
      $subtitle.textContent = "台湾标准繁体 → 大陆标准简体";
      $inputLabel.textContent = "输入 · 繁体 (TW)";
      $outputLabel.textContent = "输出 · 简体";
      $inputTag.textContent = "INPUT";
      $outputTag.textContent = "OUTPUT";
      $actionHint.textContent = "TW → SC";
      $input.placeholder = "在此输入繁体汉字…";
      $convert.setAttribute("aria-label", "转化为大陆简体");
    }
  }

  function doConvert() {
    const val = $input.value;
    if (!val.trim()) {
      $output.innerHTML = "";
      $outputInfo.textContent = "待转化";
      return;
    }
    const result = mode === "s2t" ? convertS2T(val) : convertT2S(val);
    const rich = buildRichOutput(result);
    $output.innerHTML = rich.html;
    if (rich.ambiCount === 0) {
      $outputInfo.textContent = "上下文已消歧";
    } else {
      $outputInfo.textContent = rich.ambiCount + " 处歧义 · " + rich.count + " 种结果";
    }
  }

  async function init() {
    try {
      const results = await Promise.all([
        loadDict("data/STPhrases.txt"),
        loadDict("data/STCharacters.txt"),
        loadDict("data/TWVariants.txt"),
        loadDict("data/TWPhrases.txt"),
        loadDict("data/TSPhrases.txt"),
        loadDict("data/TSCharacters.txt"),
        loadDict("data/custom-s2t.txt")
      ]);
      stPhrases = buildDict(results[0]);
      stChars = buildDict(results[1]);
      twVariants = buildDict(results[2]);
      twPhrases = buildDict(results[3]);
      tsPhrases = buildDict(results[4]);
      tsChars = buildDict(results[5]);
      customS2t = buildDict(results[6]);
      mergeDict(stPhrases, customS2t);
      setStatus("ready", "字典就绪 · 简→繁 " + stPhrases.map.size + " · 繁→简 " + tsPhrases.map.size);
      $convert.disabled = false;
      updateModeUI();
      $input.value = "最可怕的不是随着大潮一起会逐渐迷失方向\n而是清醒地看到了自己　无动于衷吧";
      updateInputCount();
      doConvert();
    } catch (e) {
      setStatus("error", "字典加载失败");
      console.error(e);
    }
  }

  $convert.addEventListener("click", doConvert);
  $swap.addEventListener("click", function () {
    mode = mode === "s2t" ? "t2s" : "s2t";
    updateModeUI();
    doConvert();
  });
  $input.addEventListener("input", updateInputCount);
  $input.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doConvert(); }
  });
  $clear.addEventListener("click", function () {
    $input.value = "";
    $output.innerHTML = "";
    updateInputCount();
    $outputInfo.textContent = "待转化";
    $input.focus();
  });
  $copy.addEventListener("click", async function () {
    const text = $output.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = $copy.textContent;
      $copy.textContent = "已复制";
      setTimeout(function () { $copy.textContent = old; }, 1200);
    } catch (_) {}
  });

  init();
})();

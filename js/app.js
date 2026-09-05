(function () {
  "use strict";

  let stPhrases = { map: new Map(), maxLen: 0 };
  let stChars = { map: new Map(), maxLen: 0 };
  let twVariants = { map: new Map(), maxLen: 0 };
  let twPhrases = { map: new Map(), maxLen: 0 };

  const $input = document.getElementById("input");
  const $output = document.getElementById("output");
  const $convert = document.getElementById("convert");
  const $clear = document.getElementById("clear");
  const $copy = document.getElementById("copy");
  const $inputCount = document.getElementById("inputCount");
  const $outputInfo = document.getElementById("outputInfo");
  const $status = document.getElementById("status");
  const $statusText = $status.querySelector(".status__text");

  const MAX_LINES = 128;

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
          segments.push({ trads: dict.map.get(sub) });
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

  function cartesian(segments, ambiguous, limit) {
    const results = [];
    const base = segments.map(function (s) { return s.trads[0]; });
    const ambi = ambiguous.map(function (idx) { return { idx: idx, options: segments[idx].trads }; });
    function recurse(depth, current) {
      if (results.length >= limit) return;
      if (depth === ambi.length) { results.push(current.join("")); return; }
      const item = ambi[depth];
      for (let j = 0; j < item.options.length; j++) {
        if (results.length >= limit) return;
        current[item.idx] = item.options[j];
        recurse(depth + 1, current);
      }
    }
    recurse(0, base.slice());
    return results;
  }

  function convert(text) {
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
    let totalCombos = 1;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].trads.length > 1) {
        ambiguous.push(i);
        totalCombos *= segments[i].trads.length;
      }
    }

    let lines;
    const truncated = totalCombos > MAX_LINES;
    if (ambiguous.length === 0) {
      lines = [segments.map(function (s) { return s.trads[0]; }).join("")];
    } else {
      lines = cartesian(segments, ambiguous, MAX_LINES);
    }

    lines = lines.map(applyTwPhrases);

    return { lines: lines, ambiguousCount: ambiguous.length, truncated: truncated, totalCombos: totalCombos };
  }

  function updateInputCount() {
    const n = Array.from($input.value).filter(function (c) { return !/\s/.test(c); }).length;
    $inputCount.textContent = n + " 字";
  }

  function doConvert() {
    const val = $input.value;
    if (!val.trim()) {
      $output.value = "";
      $outputInfo.textContent = "待转化";
      return;
    }
    const r = convert(val);
    $output.value = r.lines.join("\n");
    if (r.ambiguousCount === 0) {
      $outputInfo.textContent = r.lines.length + " 行 · 上下文已消歧";
    } else if (r.truncated) {
      $outputInfo.textContent = MAX_LINES + "/" + r.totalCombos + " 行 · " + r.ambiguousCount + " 处歧义(已截断)";
    } else {
      $outputInfo.textContent = r.lines.length + " 行 · " + r.ambiguousCount + " 处歧义";
    }
  }

  async function init() {
    try {
      const results = await Promise.all([
        loadDict("data/STPhrases.txt"),
        loadDict("data/STCharacters.txt"),
        loadDict("data/TWVariants.txt"),
        loadDict("data/TWPhrases.txt")
      ]);
      stPhrases = buildDict(results[0]);
      stChars = buildDict(results[1]);
      twVariants = buildDict(results[2]);
      twPhrases = buildDict(results[3]);
      setStatus("ready", "字典就绪 · 短语 " + stPhrases.map.size + " + 单字 " + stChars.map.size);
      $convert.disabled = false;
      $input.value = "最可怕的不是随着大潮一起会逐渐迷失方向\n而是清醒地看到了自己　无动于衷吧";
      updateInputCount();
      doConvert();
    } catch (e) {
      setStatus("error", "字典加载失败");
      console.error(e);
    }
  }

  $convert.addEventListener("click", doConvert);
  $input.addEventListener("input", updateInputCount);
  $input.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doConvert(); }
  });
  $clear.addEventListener("click", function () {
    $input.value = "";
    $output.value = "";
    updateInputCount();
    $outputInfo.textContent = "待转化";
    $input.focus();
  });
  $copy.addEventListener("click", async function () {
    if (!$output.value) return;
    try {
      await navigator.clipboard.writeText($output.value);
      const old = $copy.textContent;
      $copy.textContent = "已复制";
      setTimeout(function () { $copy.textContent = old; }, 1200);
    } catch (_) {}
  });

  init();
})();

import React, { useMemo, useState, useEffect } from "react";

// 單檔小工具：輸入任兩個（gsm / 厚度 / 條 / bulk / lb（搭配等級））→ 自動算其它
// 注意：台灣常用的 模造/道林/銅板/雪銅 的磅重基尺皆以 25×38 in 為慣例；仍提供自訂基尺（英吋）。

export default function PaperBulkCalculator() {
  const [preset, setPreset] = useState("modao");
  const [baseW, setBaseW] = useState(25); // in
  const [baseH, setBaseH] = useState(38); // in

  // 主要輸入欄位
  const [gsm, setGsm] = useState("");
  const [micron, setMicron] = useState(""); // 厚度 μm
  const [mm, setMm] = useState("");
  const [tiao, setTiao] = useState(""); // 條
  const [bulk, setBulk] = useState(""); // cm^3/g
  const [lb, setLb] = useState("");

  const [auto, setAuto] = useState(true);

  // 預設基尺
  useEffect(() => {
    switch (preset) {
      case "modao": // 模造紙（Woodfree）
      case "daolin": // 道林紙（Woodfree）
      case "tongban": // 銅板紙（Art/Coated Gloss）
      case "xuetong": // 雪銅（Art/Coated Matte）
        setBaseW(25);
        setBaseH(38);
        break;
      case "usText": // 參考：美制 Text/Book
        setBaseW(25);
        setBaseH(38);
        break;
      case "usCover": // 參考：美制 Cover
        setBaseW(20);
        setBaseH(26);
        break;
      case "custom":
        // 保持使用者自訂
        break;
      default:
        setBaseW(25);
        setBaseH(38);
    }
  }, [preset]);

  // 數學常數與換算
  const IN2_TO_M2 = 0.00064516; // 1 in^2 = 0.00064516 m^2
  const LBS_TO_G = 453.59237; // lb → g

  function round(val, dp = 3) {
    if (val === undefined || val === null || Number.isNaN(val)) return "";
    const f = Math.pow(10, dp);
    return Math.round(val * f) / f;
  }

  function parseNum(v) {
    const n = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }

  // 由任兩個量自動推算其餘
  const computed = useMemo(() => {
    // 先讀入使用者目前輸入（可能有空值）
    let _gsm = parseNum(gsm);
    let _micron = parseNum(micron);
    let _mm = parseNum(mm);
    let _tiao = parseNum(tiao);
    let _bulk = parseNum(bulk);
    let _lb = parseNum(lb);

    const baseAreaIn2 = baseW * baseH; // in^2

    // 彼此換算：mm / 條 / μm
    // 任何一個厚度欄位有值，就帶動其它兩個
    const hasMicron = _micron != null && !Number.isNaN(_micron);
    const hasMm = _mm != null && !Number.isNaN(_mm);
    const hasTiao = _tiao != null && !Number.isNaN(_tiao);

    if (hasMm && !hasMicron) _micron = _mm * 1000;
    if (hasTiao && !hasMicron) _micron = _tiao * 10; // 1 條 = 0.01 mm = 10 μm
    if (hasMicron && !hasMm) _mm = _micron / 1000;
    if (hasMicron && !hasTiao) _tiao = _micron / 10;

    // 計算次序與方程（核心）：
    // (1) t(μm) = bulk * gsm  ⇄  bulk = t/gsm  ⇄  gsm = t/bulk
    // (2) gsm ⇄ lb 需基尺（英吋）

    // 反覆推導直到收斂（最多數步迭代避免循環）
    for (let i = 0; i < 3; i++) {
      // 若已知 lb 且未知 gsm → 先換成 gsm
      if (_lb != null && _gsm == null) {
        const m2_per_sheet = baseAreaIn2 * IN2_TO_M2; // m^2
        // 1 ream = 500 sheets
        const g_per_ream = _lb * LBS_TO_G; // g
        const gsm_calc = g_per_ream / 500 / m2_per_sheet; // g/m^2
        if (Number.isFinite(gsm_calc)) _gsm = gsm_calc;
      }

      // 若已知 gsm 且未知 lb → 換成 lb
      if (_gsm != null && _lb == null) {
        const m2_per_sheet = baseAreaIn2 * IN2_TO_M2;
        const g_per_ream = _gsm * m2_per_sheet * 500;
        const lb_calc = g_per_ream / LBS_TO_G;
        if (Number.isFinite(lb_calc)) _lb = lb_calc;
      }

      // 三者關係：t = bulk * gsm
      if (_micron != null && _gsm != null && _bulk == null) {
        const b = _micron / _gsm;
        if (Number.isFinite(b)) _bulk = b;
      }
      if (_micron != null && _bulk != null && _gsm == null) {
        const g = _micron / _bulk;
        if (Number.isFinite(g)) _gsm = g;
      }
      if (_gsm != null && _bulk != null && _micron == null) {
        const t = _gsm * _bulk;
        if (Number.isFinite(t)) {
          _micron = t;
          _mm = t / 1000;
          _tiao = t / 10;
        }
      }

      // 再次同步厚度三欄
      if (_micron != null) {
        _mm = _micron / 1000;
        _tiao = _micron / 10;
      } else if (_mm != null) {
        _micron = _mm * 1000;
        _tiao = _mm / 0.01; // ×100
      } else if (_tiao != null) {
        _micron = _tiao * 10;
        _mm = _tiao * 0.01;
      }
    }

    return { _gsm, _micron, _mm, _tiao, _bulk, _lb, baseAreaIn2 };
  }, [gsm, micron, mm, tiao, bulk, lb, baseW, baseH]);

  const pretty = useMemo(() => {
    const { _gsm, _micron, _mm, _tiao, _bulk, _lb, baseAreaIn2 } = computed;
    return {
      gsm: _gsm != null ? round(_gsm, 2) : "",
      micron: _micron != null ? round(_micron, 1) : "",
      mm: _mm != null ? round(_mm, 3) : "",
      tiao: _tiao != null ? round(_tiao, 2) : "",
      bulk: _bulk != null ? round(_bulk, 3) : "",
      lb: _lb != null ? round(_lb, 2) : "",
      baseAreaIn2: round(baseAreaIn2, 2),
    };
  }, [computed]);

  function handleReset() {
    setGsm("");
    setMicron("");
    setMm("");
    setTiao("");
    setBulk("");
    setLb("");
  }

  function fillSample() {
    // 範例：80 lb（模造/道林/銅板/雪銅 → 均 25×38"） + bulk 1.35
    setPreset("modao");
    setBaseW(25);
    setBaseH(38);
    setLb("80");
    setBulk("1.35");
    setGsm("");
    setMicron("");
    setMm("");
    setTiao("");
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">紙張厚度・bulk・gsm・磅重（含 模造/道林/銅板/雪銅）雙變數小計算器</h1>
        <p className="text-sm text-gray-600 mb-6">
          任何兩個欄位有值即可自動推算其它。計算核心：t(μm) = bulk(cm³/g) × gsm(g/m²)；1 條 = 0.01 mm = 10 μm；lb↔gsm 依據基尺（in）。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-2xl shadow border bg-gray-50">
            <label className="block text-sm font-semibold mb-1">磅重等級 / 基尺</label>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="modao">模造紙（25×38 in）</option>
              <option value="daolin">道林紙（25×38 in）</option>
              <option value="tongban">銅板紙（25×38 in）</option>
              <option value="xuetong">雪銅（25×38 in）</option>
              <option value="usText">US Text/Book（25×38 in）</option>
              <option value="usCover">US Cover（20×26 in）</option>
              <option value="custom">自訂基尺</option>
            </select>
            <div className="mt-3 grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-600">基尺寬（in）</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-xl border px-3 py-2"
                  value={baseW}
                  onChange={(e) => setBaseW(parseNum(e.target.value) ?? 0)}
                  disabled={preset !== "custom" && preset !== "usCover" && preset !== "usText" && preset !== "modao" && preset !== "daolin" && preset !== "tongban" && preset !== "xuetong" ? true : false}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600">基尺高（in）</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-xl border px-3 py-2"
                  value={baseH}
                  onChange={(e) => setBaseH(parseNum(e.target.value) ?? 0)}
                  disabled={preset !== "custom" && preset !== "usCover" && preset !== "usText" && preset !== "modao" && preset !== "daolin" && preset !== "tongban" && preset !== "xuetong" ? true : false}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">基尺面積：{pretty.baseAreaIn2} in²（自動參與 lb↔gsm 換算）</p>
          </div>

          <div className="p-4 rounded-2xl shadow border bg-gray-50">
            <label className="block text-sm font-semibold mb-1">磅重（lb）</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-xl border px-3 py-2"
              value={lb}
              onChange={(e) => setLb(e.target.value)}
              placeholder="例如 80"
            />

            <label className="block text-sm font-semibold mt-4 mb-1">基重（gsm）</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-xl border px-3 py-2"
              value={gsm}
              onChange={(e) => setGsm(e.target.value)}
              placeholder="例如 128"
            />

            <label className="block text-sm font-semibold mt-4 mb-1">bulk（cm³/g）</label>
            <input
              type="number"
              step="0.001"
              className="w-full rounded-xl border px-3 py-2"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="例如 1.30"
            />
          </div>

          <div className="p-4 rounded-2xl shadow border bg-gray-50">
            <label className="block text-sm font-semibold mb-1">厚度（μm）</label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-xl border px-3 py-2"
              value={micron}
              onChange={(e) => setMicron(e.target.value)}
              placeholder="例如 160"
            />

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div>
                <label className="block text-sm font-semibold mb-1">厚度（mm）</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full rounded-xl border px-3 py-2"
                  value={mm}
                  onChange={(e) => setMm(e.target.value)}
                  placeholder="例如 0.16"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">厚度（條）</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-xl border px-3 py-2"
                  value={tiao}
                  onChange={(e) => setTiao(e.target.value)}
                  placeholder="例如 16"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            className="px-4 py-2 rounded-xl bg-gray-900 text-white shadow hover:opacity-90"
            onClick={fillSample}
          >
            範例填入
          </button>
          <button
            className="px-4 py-2 rounded-xl border shadow hover:bg-gray-100"
            onClick={handleReset}
          >
            清空
          </button>
        </div>

        <Results pretty={pretty} />

        <div className="mt-8 grid md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <h3 className="font-semibold">公式備忘</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>t(μm) = bulk(cm³/g) × gsm(g/m²)</li>
              <li>1 條 = 0.01 mm = 10 μm； t(條) = t(μm)/10</li>
              <li>lb ↔ gsm：需基尺（英吋）；常見模造/道林/銅板/雪銅皆以 25×38 in</li>
              <li>密度 ρ = 1 / bulk（g/cm³），bulk 越大越鬆厚</li>
            </ul>
          </div>
          <div className="p-4 rounded-2xl border bg-white shadow-sm">
            <h3 className="font-semibold">使用說明</h3>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>至少輸入兩個欄位即可；厚度任一欄位（μm / mm / 條）會自動同步。</li>
              <li>若輸入了 lb，會依上方基尺自動換算 gsm。</li>
              <li>輸入 gsm 與 bulk 可得厚度；輸入 厚度 與 bulk 可得 gsm；輸入 厚度 與 gsm 可得 bulk。</li>
              <li>結果欄位四捨五入顯示；如需原始高精度，可將小數點位數在程式內調整。</li>
            </ul>
          </div>
        </div>

        <footer className="text-xs text-gray-500 mt-8">
          建議以 10 張或 20 張厚度平均法驗證 bulk；不同批次/含水率/壓光條件會造成差異。
        </footer>
      </div>
    </div>
  );
}

function Results({ pretty }) {
  const { gsm, micron, mm, tiao, bulk, lb } = pretty;
  const density = bulk ? (1 / parseFloat(bulk)).toFixed(3) : "";
  return (
    <div className="rounded-2xl border p-4 bg-white shadow-sm">
      <h2 className="text-lg font-semibold mb-3">自動計算結果</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KV label="基重 (gsm)" value={gsm} suffix="g/m²" />
        <KV label="厚度 (μm)" value={micron} suffix="μm" />
        <KV label="厚度 (mm)" value={mm} suffix="mm" />
        <KV label="厚度 (條)" value={tiao} suffix="條" />
        <KV label="bulk" value={bulk} suffix="cm³/g" />
        <KV label="磅重 (lb)" value={lb} suffix="lb" />
      </div>
      <div className="mt-4 text-sm text-gray-600">
        {density && <span>表觀密度 ρ ≈ {density} g/cm³（ρ = 1 / bulk）</span>}
      </div>
    </div>
  );
}

function KV({ label, value, suffix }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 border">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xl font-semibold">
        {value === "" ? "—" : value} {value === "" ? "" : <span className="text-sm font-normal text-gray-600">{suffix}</span>}
      </div>
    </div>
  );
}

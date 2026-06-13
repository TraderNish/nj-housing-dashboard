import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync("index.html", "utf8");
const dataJs = fs.readFileSync("data.js", "utf8");

const errors = [];
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.onerror = (e) => errors.push(e);

// inject data.js then the inline page script (jsdom won't run <script src> itself)
window.eval(dataJs);
const inline = html.split("<script>").pop().split("</script>")[0];
try { window.eval(inline); }
catch (e) { errors.push("inline script threw: " + e.message + "\n" + e.stack); }

const doc = window.document;
const rowcount = () => +doc.getElementById("rowcount").textContent.replace(/,/g, "");
const headers = () => [...doc.querySelectorAll("#headrow th")].map(t => t.textContent.trim());
const firstRowCells = () =>
  [...doc.querySelectorAll("#body tr:first-child td")].map(t => t.textContent.trim());

const D = window.__HOUSING__;
let pass = 0, fail = 0;
const check = (name, cond, extra="") => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? "OK  " : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

const njCount = D.rows.filter(r => r.state === "NJ").length;
const setVal = (id, v) => { const e = doc.getElementById(id); e.value = v;
  e.dispatchEvent(new window.Event("input")); };

check("no JS errors", errors.length === 0, errors.join(" | "));
check("defaults to NJ", doc.getElementById("stateSel").value === "NJ");
check("initial view = NJ rows only", rowcount() === njCount,
  `rendered=${rowcount()} expected=${njCount}`);
check("base header has 11 cols (3 id + state + latest + 6 chg)",
  headers().length === 11, headers().join(","));
check("default sort = Latest desc",
  doc.querySelector("th.sorted.desc")?.textContent.trim() === "Latest");

// top NJ row by price
const njMax = Math.max(...D.rows.filter(r=>r.state==="NJ").map(r => r.latest));
check("top NJ row is highest NJ latest price",
  firstRowCells()[4] === "$" + njMax.toLocaleString("en-US"),
  firstRowCells().slice(0,5).join(" | "));

// switch to All states -> full count
setVal("stateSel", "");
check("All states shows full US count", rowcount() === D.count,
  `rows=${rowcount()} expected=${D.count}`);

// switch to CA
setVal("stateSel", "CA");
const caCount = D.rows.filter(r => r.state === "CA").length;
check("CA filter", rowcount() === caCount, `rows=${rowcount()} expected=${caCount}`);

// county dropdown should now hold only CA counties
const caCounties = new Set(D.rows.filter(r=>r.state==="CA").map(r=>r.county).filter(Boolean));
const dropdownCounties = [...doc.querySelectorAll("#county option")].slice(1).map(o=>o.value);
check("county list scoped to CA",
  dropdownCounties.length === caCounties.size && dropdownCounties.every(c=>caCounties.has(c)),
  `dropdown=${dropdownCounties.length} caCounties=${caCounties.size}`);

// CA + a specific county
const caCounty = [...caCounties].sort()[0];
setVal("county", caCounty);
const expectCaCounty = D.rows.filter(r=>r.state==="CA" && r.county===caCounty).length;
check(`CA + county '${caCounty}'`, rowcount() === expectCaCounty,
  `rows=${rowcount()} expected=${expectCaCounty}`);

// back to NJ, text filter
setVal("stateSel", "NJ"); setVal("q", "hoboken");
check("NJ + 'hoboken' text filter", rowcount() === 1, `rows=${rowcount()}`);
setVal("q", "");

// price slider within NJ
setVal("priceMin", "1000000");
const njOverM = D.rows.filter(r => r.state==="NJ" && r.latest >= 1000000).length;
check("NJ price min $1M filter", rowcount() === njOverM,
  `rows=${rowcount()} expected=${njOverM}`);
setVal("priceMin", String(Math.min(...D.rows.map(r=>r.latest))));

// toggle monthly columns
doc.getElementById("toggleM").dispatchEvent(new window.Event("click"));
check("monthly toggle adds 60 cols", headers().length === 71, `cols=${headers().length}`);

// months render by array index — spot check a known NJ zip's latest month cell
const hobo = D.rows.find(r => r.zip === "07030");
const lastMonthIdx = headers().length - 1;  // last column = latest display month
setVal("stateSel", "NJ"); setVal("q", "07030");
const cells = firstRowCells();
check("monthly value matches data array (07030 latest month)",
  cells[lastMonthIdx] === "$" + hobo.months[hobo.months.length-1].toLocaleString("en-US"),
  `cell=${cells[lastMonthIdx]} data=${hobo.months[hobo.months.length-1]}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

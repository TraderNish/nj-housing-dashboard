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

check("no JS errors", errors.length === 0, errors.join(" | "));
check("all NJ rows render initially", rowcount() === D.count, `rendered=${rowcount()} expected=${D.count}`);
check("base header has 10 cols (3 id + latest + 6 chg)", headers().length === 10, headers().join(","));
check("default sort = Latest desc",
  doc.querySelector("th.sorted.desc")?.textContent.trim() === "Latest");

// first row under default sort should be the most expensive zip
const maxLatest = Math.max(...D.rows.map(r => r.latest));
check("top row is highest latest price",
  firstRowCells()[3] === "$" + maxLatest.toLocaleString("en-US"),
  firstRowCells().slice(0,4).join(" | "));

// text filter
doc.getElementById("q").value = "hoboken";
doc.getElementById("q").dispatchEvent(new window.Event("input"));
const hobo = rowcount();
check("text filter 'hoboken' narrows rows", hobo > 0 && hobo < D.count, `rows=${hobo}`);
doc.getElementById("q").value = "";
doc.getElementById("q").dispatchEvent(new window.Event("input"));

// county filter
const someCounty = D.rows.find(r => r.county).county;
const sel = doc.getElementById("county");
sel.value = someCounty;
sel.dispatchEvent(new window.Event("input"));
const cnt = rowcount();
const expectCnt = D.rows.filter(r => r.county === someCounty).length;
check(`county filter '${someCounty}'`, cnt === expectCnt, `rows=${cnt} expected=${expectCnt}`);
sel.value = "";
sel.dispatchEvent(new window.Event("input"));

// price slider
const pmin = doc.getElementById("priceMin");
pmin.value = "1000000";
pmin.dispatchEvent(new window.Event("input"));
const overM = rowcount();
const expectOverM = D.rows.filter(r => r.latest >= 1000000).length;
check("price min $1M filter", overM === expectOverM, `rows=${overM} expected=${expectOverM}`);

// toggle monthly columns
doc.getElementById("toggleM").dispatchEvent(new window.Event("click"));
check("monthly toggle adds 60 cols", headers().length === 70, `cols=${headers().length}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

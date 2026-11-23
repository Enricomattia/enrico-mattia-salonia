import { verseForDate } from "./verses.mjs";
import { setupUpdates } from "./updates.js";
import { setupInstall } from "./install.js";

const byId = (id) => document.getElementById(id);
const storageKey = "giorno-per-giorno.v1";
const weekdays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const fullDate = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });
const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return [date.getFullYear(), month, day].join("-");
}

function fromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

function firstOfMonth(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
}

function mondayOffset(date) {
  return (date.getDay() + 6) % 7;
}

function emptyState() {
  return { plans: [], marks: {} };
}

function readState() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return emptyState();
  const saved = JSON.parse(raw);
  if (!Array.isArray(saved?.plans) || !saved.marks || typeof saved.marks !== "object") {
    throw new Error("Formato di salvataggio non riconosciuto");
  }
  return saved;
}

let today = dateKey(new Date());
let selected = today;
let month = firstOfMonth(fromKey(today));
let showMonth = false;
let demo = false;
let state = emptyState();
const planDialog = byId("plan-dialog");
const undoDialog = byId("undo-dialog");
let planBaseline = "";
let planTrigger;
let undoTarget;
let pendingWrites = 0;

function setError(message) {
  const error = byId("storage-error");
  error.textContent = message;
  error.hidden = !message;
}

function loadRealState() {
  try {
    state = readState();
    setError("");
  } catch {
    setError("Impossibile leggere il salvataggio di questo browser. I dati qui mostrati potrebbero non essere aggiornati.");
  }
}

async function updateState(change) {
  const apply = () => {
    const next = demo ? structuredClone(state) : readState();
    const changed = change(next);
    if (!demo && changed) localStorage.setItem(storageKey, JSON.stringify(next));
    state = next;
    return changed;
  };

  pendingWrites++;
  try {
    return await (!demo && navigator.locks ? navigator.locks.request(storageKey, apply) : apply());
  } finally {
    pendingWrites--;
  }
}

function planFor(date, source = state) {
  return source.plans.findLast((plan) => plan.start <= date)?.doses ?? [];
}

function markCount(date, doses) {
  const marks = state.marks[date] ?? {};
  return doses.filter((dose) => Object.hasOwn(marks, dose.id)).length;
}

function addButton(text, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}

function makeDay(date, showWeekday) {
  const key = dateKey(date);
  const doses = planFor(key);
  const count = markCount(key, doses);
  const button = addButton("", "day", () => selectDate(key, true));
  const status = count ? `, ${count} su ${doses.length} segnate` : "";
  button.setAttribute("aria-label", fullDate.format(date) + status);
  button.setAttribute("aria-pressed", String(key === selected));
  button.dataset.date = key;
  if (key === today) {
    button.classList.add("today");
    button.setAttribute("aria-current", "date");
  }
  if (count) button.classList.add(count === doses.length ? "complete" : "partial");

  if (showWeekday) {
    const label = document.createElement("span");
    label.className = "weekday";
    label.textContent = weekdays[mondayOffset(date)];
    button.append(label);
  }
  const number = document.createElement("span");
  number.className = "day-number";
  number.textContent = date.getDate();
  const marker = document.createElement("span");
  marker.className = "day-marker";
  marker.setAttribute("aria-hidden", "true");
  button.append(number, marker);
  return button;
}

function renderCalendar(date) {
  byId("week-card").hidden = showMonth;
  byId("month-card").hidden = !showMonth;
  const start = addDays(date, -mondayOffset(date));
  const end = addDays(start, 6);
  byId("week-title").textContent = start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${shortDate.format(end)}`
    : `${shortDate.format(start)} – ${shortDate.format(end)}`;
  byId("week-grid").replaceChildren(...weekdays.map((_, index) => makeDay(addDays(start, index), true)));
  if (!showMonth) return;

  byId("month-title").textContent = monthName.format(month);
  const cells = weekdays.map((day) => {
    const label = document.createElement("span");
    label.className = "weekday";
    label.textContent = day;
    return label;
  });
  for (let index = 0; index < mondayOffset(month); index++) cells.push(document.createElement("span"));
  for (let date = month; date.getMonth() === month.getMonth(); date = addDays(date, 1)) {
    cells.push(makeDay(date, false));
  }
  byId("month-grid").replaceChildren(...cells);
}

function showEmpty(list) {
  const empty = document.createElement("div");
  empty.className = "empty";
  const message = document.createElement("p");
  empty.append(message);
  if (state.plans.length > 0 || demo) {
    message.textContent = "Nessuna assunzione prevista per questo giorno.";
    list.replaceChildren(empty);
    return;
  }
  message.textContent = "Aggiungi le pillole e gli orari. Ogni giorno ritroverai qui la tua lista.";
  const actions = document.createElement("div");
  actions.className = "empty-actions";
  actions.append(
    addButton("Imposta il tuo piano", "button primary", openPlan),
    addButton("Prova la demo", "text-button", startDemo)
  );
  empty.append(actions);
  list.replaceChildren(empty);
}

function makeDose(dose, date) {
  const taken = Object.hasOwn(state.marks[date] ?? {}, dose.id);
  const future = date > today;
  const row = document.createElement(future ? "div" : "button");
  row.className = taken ? "dose taken" : "dose";
  if (!future) {
    row.type = "button";
    row.dataset.dose = dose.id;
    row.setAttribute("aria-pressed", String(taken));
    row.setAttribute("aria-label", `${dose.time}, ${dose.name}${dose.note ? `, ${dose.note}` : ""}`);
    row.addEventListener("click", () => taken ? confirmUndo(dose, date) : setMark(dose, date, true));
  }
  const time = document.createElement("time");
  time.dateTime = dose.time;
  time.textContent = dose.time;
  const copy = document.createElement("span");
  copy.className = "dose-copy";
  const name = document.createElement("span");
  name.className = "dose-name";
  name.textContent = dose.name;
  copy.append(name);
  if (dose.note) {
    const note = document.createElement("span");
    note.className = "dose-note";
    note.textContent = dose.note;
    copy.append(note);
  }
  const status = document.createElement("span");
  status.className = "dose-state";
  const check = document.createElement("span");
  check.className = "check";
  check.setAttribute("aria-hidden", "true");
  check.textContent = taken ? "✓" : "";
  if (!future) status.append(check);
  status.append(taken ? "Presa" : future ? "Prevista" : "Da segnare");
  row.append(time, copy, status);
  return row;
}

function announce(message) {
  byId("status").textContent = message;
}

function render() {
  const date = fromKey(selected);
  const future = selected > today;
  byId("hero-date").textContent = fullDate.format(date);
  byId("hero-title").textContent = showMonth ? "Calendario" : "Pillole di saggezza";
  byId("return-today").hidden = !showMonth && selected === today;
  byId("nav-today").toggleAttribute("aria-current", !showMonth);
  byId("nav-calendar").toggleAttribute("aria-current", showMonth);
  byId(showMonth ? "nav-calendar" : "nav-today").setAttribute("aria-current", "page");
  byId("demo-bar").hidden = !demo;
  byId("edit-plan").disabled = demo;
  renderCalendar(date);

  byId("doses-title").textContent = selected === today ? "Assunzioni di oggi" : `Assunzioni del ${shortDate.format(date)}`;
  const doses = planFor(selected);
  const count = markCount(selected, doses);
  byId("dose-count").textContent = `${count} di ${doses.length} segnate`;
  byId("dose-count").hidden = !doses.length || future;
  byId("progress").hidden = byId("dose-count").hidden;
  byId("progress-fill").style.width = doses.length ? `${100 * count / doses.length}%` : "0%";
  const list = byId("dose-list");
  if (doses.length) list.replaceChildren(...doses.map((dose) => makeDose(dose, selected)));
  else showEmpty(list);

  byId("poetry-card").hidden = future;
  if (future) return;

  const verse = verseForDate(date);
  byId("daily-verse").textContent = `«${verse.line}»`;
  byId("verse-author").textContent = verse.author;
  byId("verse-title").textContent = verse.title;
  const source = byId("verse-source");
  source.href = verse.url;
  source.setAttribute("aria-label", `${verse.title}, testo su Wikisource (si apre in una nuova scheda)`);
}

function selectDate(key, focus = false) {
  selected = key;
  month = firstOfMonth(fromKey(key));
  render();
  if (focus) {
    const grid = byId(showMonth ? "month-grid" : "week-grid");
    grid.querySelector('[aria-pressed="true"]')?.focus();
    announce(byId("doses-title").textContent);
  }
}

function goToToday() {
  today = dateKey(new Date());
  showMonth = false;
  selectDate(today);
}

function openCalendar() {
  showMonth = true;
  selectDate(selected, true);
}

function changeMonth(offset) {
  month = firstOfMonth(month, offset);
  render();
}

function confirmUndo(dose, date) {
  undoTarget = { dose, date };
  byId("undo-description").textContent = `${dose.name} · ${dose.time} · ${shortDate.format(fromKey(date))}`;
  undoDialog.returnValue = "cancel";
  undoDialog.showModal();
}

async function setMark(dose, date, taken) {
  if (date > dateKey(new Date())) return;
  try {
    const changed = await updateState((next) => {
      if (!planFor(date, next).some((entry) => entry.id === dose.id && entry.time === dose.time &&
        entry.name === dose.name && entry.note === dose.note)) return false;
      const marks = next.marks[date] ?? {};
      if (taken) marks[dose.id] = new Date().toISOString();
      else delete marks[dose.id];
      if (Object.keys(marks).length) next.marks[date] = marks;
      else delete next.marks[date];
      return true;
    });
    setError(changed ? "" : "Il piano è cambiato. Controlla l’elenco e riprova.");
    render();
    Array.from(byId("dose-list").querySelectorAll("[data-dose]")).find((row) => row.dataset.dose === dose.id)?.focus();
    if (changed) announce(taken ? `${dose.name} segnata come presa` : `Spunta rimossa per ${dose.name}`);
  } catch {
    setError("Salvataggio della spunta non riuscito. Riprova in questo browser.");
  }
}

function editStart(source, current) {
  const latest = source.plans.at(-1);
  if (latest?.start > current) return latest.start;
  if (Object.keys(source.marks[current] ?? {}).length) return dateKey(addDays(fromKey(current), 1));
  return current;
}

function numberRows() {
  const rows = Array.from(byId("plan-rows").children);
  rows.forEach((row, index) => { row.querySelector("legend").textContent = `Assunzione ${index + 1}`; });
}

function addPlanRow(dose, focus = false) {
  const row = byId("plan-row").content.firstElementChild.cloneNode(true);
  const name = row.querySelector('[name="name"]');
  row.dataset.id = dose?.id ?? crypto.randomUUID();
  name.value = dose?.name ?? "";
  name.addEventListener("input", () => name.setCustomValidity(""));
  row.querySelector('[name="time"]').value = dose?.time ?? "";
  row.querySelector('[name="note"]').value = dose?.note ?? "";
  row.querySelector(".remove").addEventListener("click", () => {
    const focusTarget = row.nextElementSibling?.querySelector('[name="name"]') ?? byId("add-dose");
    row.remove();
    numberRows();
    focusTarget.focus();
  });
  byId("plan-rows").append(row);
  numberRows();
  if (focus) name.focus();
}

function openPlan(event) {
  if (demo) return;
  planTrigger = event.currentTarget;
  loadRealState();
  const current = dateKey(new Date());
  const start = editStart(state, current);
  planBaseline = JSON.stringify(state.plans);
  byId("plan-rows").replaceChildren();
  byId("plan-error").hidden = true;
  byId("plan-notice").textContent = start > current
    ? `Le modifiche valgono dal ${shortDate.format(fromKey(start))}.`
    : "";
  const doses = planFor(start);
  if (doses.length) doses.forEach((dose) => addPlanRow(dose));
  else addPlanRow();
  planDialog.showModal();
  byId("plan-rows").querySelector('[name="name"]').focus();
}

async function savePlan(event) {
  event.preventDefault();
  const submitter = event.submitter ?? event.currentTarget.querySelector('[type="submit"]');
  const rows = Array.from(byId("plan-rows").children);
  const blank = rows.map((row) => row.querySelector('[name="name"]')).find((input) => !input.value.trim());
  if (blank) {
    blank.setCustomValidity("Inserisci il nome della pillola.");
    blank.reportValidity();
    return;
  }
  const doses = rows.map((row) => ({
    id: row.dataset.id,
    name: row.querySelector('[name="name"]').value.trim(),
    time: row.querySelector('[name="time"]').value,
    note: row.querySelector('[name="note"]').value.trim()
  })).sort((a, b) => a.time.localeCompare(b.time));

  submitter.disabled = true;
  const error = byId("plan-error");
  error.hidden = true;
  let start;
  let current;
  try {
    const changed = await updateState((next) => {
      if (JSON.stringify(next.plans) !== planBaseline) return false;
      current = dateKey(new Date());
      start = editStart(next, current);
      const latest = next.plans.at(-1);
      if (latest?.start === start) next.plans.pop();
      next.plans.push({ start, doses });
      return true;
    });
    if (!changed) {
      error.textContent = "Il piano è stato modificato in un’altra scheda. Chiudi e riapri il piano per rivederlo.";
      error.hidden = false;
      return;
    }
    setError("");
    planDialog.close();
    selectDate(start);
    if (!planTrigger?.isConnected) byId("edit-plan").focus();
    announce(start > current ? `Piano salvato dal ${shortDate.format(fromKey(start))}` : "Piano salvato");
  } catch {
    error.textContent = "Salvataggio del piano non riuscito. I dati inseriti sono ancora qui.";
    error.hidden = false;
  } finally {
    submitter.disabled = false;
  }
}

function startDemo() {
  demo = true;
  const start = dateKey(addDays(fromKey(today), -30));
  const doses = [
    { id: "mattino", name: "Pillola del mattino", time: "08:00", note: "Voce di esempio" },
    { id: "pranzo", name: "Pillola di mezzogiorno", time: "13:00", note: "Voce di esempio" },
    { id: "sera", name: "Pillola della sera", time: "20:00", note: "Voce di esempio" }
  ];
  state = { plans: [{ start, doses }], marks: { [today]: { mattino: "demo" } } };
  setError("");
  goToToday();
  byId("exit-demo").focus();
}

function exitDemo() {
  demo = false;
  state = emptyState();
  loadRealState();
  goToToday();
  byId("edit-plan").focus();
}

function updateToday() {
  const current = dateKey(new Date());
  if (current === today) return;
  const wasToday = selected === today;
  today = current;
  if (wasToday && !showMonth) selectDate(current);
  else render();
}

byId("brand").addEventListener("click", goToToday);
byId("nav-today").addEventListener("click", goToToday);
byId("nav-calendar").addEventListener("click", openCalendar);
byId("open-calendar").addEventListener("click", openCalendar);
byId("return-today").addEventListener("click", () => {
  goToToday();
  byId("nav-today").focus();
});
byId("prev-month").addEventListener("click", () => changeMonth(-1));
byId("next-month").addEventListener("click", () => changeMonth(1));
byId("edit-plan").addEventListener("click", openPlan);
byId("close-plan").addEventListener("click", () => planDialog.close());
byId("cancel-plan").addEventListener("click", () => planDialog.close());
byId("add-dose").addEventListener("click", () => addPlanRow(undefined, true));
byId("plan-form").addEventListener("submit", savePlan);
byId("exit-demo").addEventListener("click", exitDemo);
undoDialog.addEventListener("close", () => {
  if (undoDialog.returnValue === "undo" && undoTarget) setMark(undoTarget.dose, undoTarget.date, false);
  undoTarget = undefined;
});
window.addEventListener("storage", (event) => {
  if (!demo && (event.key === storageKey || event.key === null)) {
    loadRealState();
    render();
  }
});
document.addEventListener("visibilitychange", updateToday);
window.setInterval(updateToday, 15000);
loadRealState();
render();
setupInstall();
setupUpdates(() => !document.querySelector("dialog[open]") && pendingWrites === 0);

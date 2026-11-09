"use strict";
/* Бутафорский DOM для исполнения клиентского кода страниц в vm: дерево узлов с
   атрибутами, событиями и селекторами по тегу/.классу/#id через пробел (потомки).
   Достаточно для виджета чата и переводчика — не браузер, а модель поведения. */
function fakeDom() {
  const doc = { on: {}, activeElement: null, hidden: false };
  const textOf = (n) => n.tag === "#text" ? n.text : (n.kids.length ? n.kids.map(textOf).join("") : (n._text || ""));
  const mk = (tag) => {
    const n = { tag, attrs: {}, kids: [], on: {}, style: {}, parent: null, _text: "", value: "", scrollTop: 0, scrollHeight: 0,
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; },
      append(...ks) { for (const k of ks) { if (k == null) continue; const c = typeof k === "string" ? { tag: "#text", text: k, kids: [] } : k; c.parent = this; this.kids.push(c); } },
      removeChild(c) { this.kids = this.kids.filter((x) => x !== c); },
      get firstChild() { return this.kids[0] || null; },
      addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); },
      dispatch(t, ev) { (this.on[t] || []).forEach((f) => f(ev || {})); },
      focus() { doc.activeElement = this; },
      contains(x) { for (let p = x; p; p = p.parent) if (p === this) return true; return false; },
      querySelector(sel) { return q(this, sel)[0] || null; }, querySelectorAll(sel) { return q(this, sel); },
      getBoundingClientRect() { return { height: 100, top: 0 }; },
      get className() { return this.attrs.class || ""; }, set className(v) { this.attrs.class = v; },
      get hidden() { return "hidden" in this.attrs; }, set hidden(v) { if (v) this.attrs.hidden = ""; else delete this.attrs.hidden; },
      get textContent() { return textOf(this); }, set textContent(v) { this.kids = []; this._text = String(v); } };
    return n;
  };
  const all = (n, out = []) => { for (const k of n.kids) if (k.tag !== "#text") { out.push(k); all(k, out); } return out; };
  const one = (n, tok) => tok[0] === "." ? String(n.attrs.class || "").split(" ").includes(tok.slice(1)) : tok[0] === "#" ? n.attrs.id === tok.slice(1) : n.tag === tok;
  const q = (root, sel) => {
    let set = [root];
    for (const tok of sel.trim().split(/\s+/)) set = set.flatMap((r) => all(r).filter((n) => one(n, tok)));
    return set;
  };
  Object.assign(doc, { head: mk("head"), body: mk("body"), documentElement: { lang: "ru" },
    createElement: (t) => mk(t), createElementNS: (ns, t) => mk(t), createTextNode: (s) => ({ tag: "#text", text: String(s), kids: [] }),
    getElementById(id) { return q(this.body, "#" + id)[0] || null; },
    querySelectorAll(sel) { return q(this.body, sel); }, addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); },
    dispatch(t, ev) { (this.on[t] || []).forEach((f) => f(ev || {})); } });
  return { doc, mk, q };
}
module.exports = { fakeDom };

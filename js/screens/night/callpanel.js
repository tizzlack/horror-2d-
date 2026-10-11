// "Call to the door": the resident and the visitor side by side; the player throws one of them out.
import { h } from '../../core/dom.js';

/**
 * Opens the panel inside `host`. Returns { el, choice: Promise<'door'|'inside'|null>, showResult(res, monsterSide), close() }.
 * deps: { createFigureView, effects }.
 */
export function openCallPanel(host, { figure, doorTells, insideTells, insideIsMonster, doorIsMonster, reduced, deps, clock }) {
  const views = [];
  const mkStage = (tells, honest) => {
    const stage = h('div', { class: 'call-stage' });
    try {
      const v = deps.createFigureView(figure, { form: 'standard', tells, height: 330, blink: true, honestOddity: honest });
      views.push(v);
      stage.append(v.el);
    } catch (err) {
      console.warn('[night] call panel figure failed', err);
    }
    return stage;
  };
  const insideStage = mkStage(insideTells, !insideIsMonster);
  const doorStage = mkStage(doorTells, !doorIsMonster);
  let resolveChoice;
  const choice = new Promise((r) => { resolveChoice = r; });
  const pick = (side) => { buttons.forEach((b) => { b.disabled = true; }); resolveChoice(side); };
  const mkBtn = (side) => h('button', { class: 'btn danger', onclick: () => pick(side) }, 'Throw this one out');
  const buttons = [mkBtn('inside'), mkBtn('door')];
  const insideCard = h('div', { class: 'call-card' }, h('div', { class: 'call-who' }, `${figure.name} - inside`), insideStage, buttons[0]);
  const doorCard = h('div', { class: 'call-card' }, h('div', { class: 'call-who' }, `${figure.name} - at the door`), doorStage, buttons[1]);
  const result = h('div', { class: 'call-result' });
  const back = h('button', { class: 'btn small call-back', onclick: () => resolveChoice(null) }, 'Back (Esc)');
  const el = h('div', { class: 'call-panel' },
    back,
    h('div', { class: 'call-title' }, `"${figure.name}, come to the door!"`),
    h('div', { class: 'call-sub' }, 'Two of the same. One of them is not who it says.'),
    h('div', { class: 'call-cards' }, insideCard, doorCard),
    result);
  host.append(el);

  return {
    el,
    choice,
    cancel: () => resolveChoice(null),
    async showResult(res, monsterSide, thrownSide) {
      result.textContent = res?.line ?? '';
      try { await deps.effects.reveal(monsterSide === 'inside' ? insideStage : doorStage, figure, { reduced }); } catch (err) { console.warn(err); }
      (thrownSide === 'inside' ? insideCard : doorCard).classList.add('thrown');
      await clock.wait(1300);
    },
    close() {
      views.forEach((v) => { try { v.destroy?.(); } catch { /* ignore */ } });
      el.remove();
    },
  };
}

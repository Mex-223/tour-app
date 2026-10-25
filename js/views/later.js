// Tabs that get built in later steps.
import { topBar } from '../components.js';
import { icons } from '../icons.js';

const PLANS = {
  money: {
    title: 'Money',
    step: 'Step 4',
    items: ['Balance per tour, planned vs. actual', 'Show deals and payment status (MGMT only)', 'Expenses with receipt photos', 'Who owes whom', 'Merch stock and show-night selling']
  }
};

export function renderLater(tab) {
  const p = PLANS[tab];
  return `<header class="head">
      ${topBar()}
      <div class="title-row"><h1>${p.title}</h1></div>
    </header>
    <main id="main">
      <section class="card later">
        <span class="later-step">${icons.lock(16)}Coming in ${p.step}</span>
        <ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul>
      </section>
    </main>`;
}

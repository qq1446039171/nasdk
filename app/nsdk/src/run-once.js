const { loadConfig } = require('./config');
const { loadState, saveState } = require('./state');
const { marketCheck, weeklyActiveReminder, tryRealtimeDrawdownAlert } = require('./actions');

const main = async () => {
  const cfg = loadConfig();
  const state = loadState();

  const mode = process.argv[2] || 'market';
  if (mode === 'weekly') {
    await weeklyActiveReminder(cfg, state);
  } else if (mode === 'realtime') {
    await tryRealtimeDrawdownAlert(cfg, state);
  } else {
    await marketCheck(cfg, state);
  }
  saveState(state);
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});


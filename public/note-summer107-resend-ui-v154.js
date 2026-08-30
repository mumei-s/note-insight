(function () {
  'use strict';

  if (window.__MUMEI_SUMMER107_RESEND_UI_154__) return;
  window.__MUMEI_SUMMER107_RESEND_UI_154__ = true;

  const PANEL = 'summer107-panel-v1500';
  const STATUS = 'summer107-status-v1500';

  function apply() {
    const panel = document.getElementById(PANEL);
    if (!panel) return;

    panel.querySelectorAll('button[data-action]').forEach((button) => {
      const action = button.dataset.action;
      if (['resend107', 'resendDelete', 'close'].includes(action)) {
        button.style.display = '';
      } else {
        button.style.display = 'none';
      }
    });

    const status = document.getElementById(STATUS);
    if (status && !status.dataset.resendInit) {
      status.dataset.resendInit = '1';
      status.textContent = '再送専用15.4｜再送→すぐ更新→通知確認→再削→更新';
      status.dataset.bad = '0';
    }
  }

  setInterval(apply, 350);
  apply();
})();

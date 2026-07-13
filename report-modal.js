// ── Report Modal ── Shared across all Track & Tide pages ──

(function() {
  // ── CSS ──
  var style = document.createElement('style');
  style.textContent = '.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;align-items:center;justify-content:center;padding:1rem}' +
    '.modal-overlay.open{display:flex}' +
    '.modal-dialog{background:var(--panel,#1F2937);border:1px solid var(--border,#3B4A5F);border-radius:18px;padding:2rem;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);position:relative}' +
    '.modal-close{position:absolute;top:0.75rem;right:1rem;background:none;border:none;color:var(--text,#F8FAFC);font-size:1.4rem;cursor:pointer;opacity:0.6}' +
    '.modal-close:hover{opacity:1}' +
    '.modal-dialog h2{margin:0 0 0.5rem;font-size:1.3rem}' +
    '.modal-dialog>p{margin:0 0 1.2rem;opacity:0.75;font-size:0.9rem}' +
    '.report-form{display:grid;gap:1rem}' +
    '.report-form .field{display:grid;gap:0.35rem}' +
    '.report-form .field label{font-size:0.85rem;opacity:0.8}' +
    '.report-form input,.report-form textarea{width:100%;border:1px solid var(--border,#3B4A5F);border-radius:10px;padding:0.7rem 0.75rem;background:rgba(255,255,255,0.08);color:var(--text,#F8FAFC);font:inherit;box-sizing:border-box}' +
    '.report-form select{width:100%;border:1px solid var(--border,#3B4A5F);border-radius:10px;padding:0.7rem 0.75rem;background:var(--card,#273549);color:var(--text,#F8FAFC);font:inherit;box-sizing:border-box;cursor:pointer}' +
    '.report-form select option{color:#111827;background:#fff}' +
    '.report-form textarea{resize:vertical;min-height:100px}' +
    '.report-form .submit-btn{padding:0.75rem 1.5rem;border-radius:999px;border:none;background:var(--hover,#38BDF8);color:#fff;font:inherit;font-weight:600;cursor:pointer}' +
    '.report-form .submit-btn:hover{background:var(--active,#0EA5E9)}' +
    '.form-success{display:none;text-align:center;padding:2rem 1rem}' +
    '.form-success.show{display:block}' +
    '.form-error{color:#f87171;font-size:0.85rem;display:none;margin-top:0.3rem}' +
    '.report-hint{font-size:0.8rem;color:var(--text-secondary,#94A3B8);padding:0.4rem 0.6rem;background:rgba(56,189,248,0.08);border-radius:8px;line-height:1.4}';
  document.head.appendChild(style);

  // ── HTML ──
  var html = '<div class="modal-overlay" id="reportModal" onclick="if(event.target===this)closeReportModal()">' +
    '<div class="modal-dialog">' +
      '<button class="modal-close" onclick="closeReportModal()" aria-label="Close">&times;</button>' +
      '<h2>Report something</h2>' +
      '<p>Spotted a bug, outdated info, or have a feature idea? Let us know!</p>' +
      '<form class="report-form" id="reportForm">' +
        '<div class="field"><label for="reportType">Type *</label>' +
          '<select name="Type" id="reportType" required>' +
            '<option value="">Select...</option>' +
            '<option value="Bug / Misinformation">Bug / Misinformation</option>' +
            '<option value="Feature Idea">Feature Idea</option>' +
            '<option value="Other">Other</option>' +
          '</select></div>' +
        '<div class="report-hint" id="bugHint" style="display:none">Is station data incorrect? You can fix it directly on Wikidata by clicking the <strong>Source</strong> button on the station\'s page.</div>' +
        '<div class="field"><label for="reportName">Your name (optional)</label><input type="text" name="Name" id="reportName" placeholder="Jane Doe"></div>' +
        '<div class="field"><label for="reportEmail">Your email (optional, for follow-up)</label><input type="email" name="Email" id="reportEmail" placeholder="jane@example.com"></div>' +
        '<div class="field"><label for="reportMessage">Message *</label><textarea name="Message" id="reportMessage" required placeholder="Describe the issue or idea..."></textarea></div>' +
        '<div class="form-error" id="formError"></div>' +
        '<button type="submit" class="submit-btn">Send report</button>' +
      '</form>' +
      '<div class="form-success" id="formSuccess"><h3>Thank you!</h3><p>Your report has been sent. We\'ll look into it.</p></div>' +
    '</div>' +
  '</div>';
  document.body.insertAdjacentHTML('beforeend', html);

  // ── Open / Close ──
  window.openReportModal = function() {
    document.getElementById('reportModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.closeReportModal = function() {
    document.getElementById('reportModal').classList.remove('open');
    document.body.style.overflow = '';
    var form = document.getElementById('reportForm');
    if (form) {
      form.style.display = '';
      form.reset();
    }
    var succ = document.getElementById('formSuccess');
    if (succ) succ.classList.remove('show');
    var err = document.getElementById('formError');
    if (err) err.style.display = 'none';
    var hint = document.getElementById('bugHint');
    if (hint) hint.style.display = 'none';
    var btn = document.querySelector('#reportForm .submit-btn');
    if (btn) { btn.textContent = 'Send report'; btn.disabled = false; }
  };

  // ── Bug hint toggle ──
  var typeSelect = document.getElementById('reportType');
  if (typeSelect) {
    typeSelect.addEventListener('change', function() {
      var hint = document.getElementById('bugHint');
      if (hint) hint.style.display = this.value === 'Bug / Misinformation' ? '' : 'none';
    });
  }

  // ── Submit handler ──
  document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('.submit-btn');
    var errEl = document.getElementById('formError');
    btn.textContent = 'Sending...'; btn.disabled = true;
    if (errEl) errEl.style.display = 'none';
    try {
      var resp = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Type: form.Type.value,
          Name: form.Name.value,
          Email: form.Email.value,
          Message: form.Message.value,
          access_key: '619ecb95-9c90-415e-94fd-94a6d9ee8adb'
        })
      });
      if (resp.ok) {
        form.style.display = 'none';
        document.getElementById('formSuccess').classList.add('show');
      } else {
        throw new Error('Failed');
      }
    } catch(err) {
      if (errEl) { errEl.textContent = 'Could not send. Please try again.'; errEl.style.display = ''; }
      btn.textContent = 'Send report'; btn.disabled = false;
    }
  });

})();

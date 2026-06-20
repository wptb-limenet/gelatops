#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const LOCALES_DIR = path.join(SRC, 'locales');
const TEMPLATES_DIR = path.join(SRC, 'templates');
const DOMAIN = 'https://gelatops.com';

const LOCALES = ['en', 'it', 'de'];
const DEFAULT_LOCALE = 'en';

// Static assets to copy from root to dist
const STATIC_ASSETS = [
  'logo.svg',
  'og-image.png',
  'og-image.svg',
  'apple-touch-icon.png',
  'favicon_32.png',
  'robots.txt',
  'llms.txt',
];

// --- Helpers ---

function rmrf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getBasePath(locale) {
  return locale === DEFAULT_LOCALE ? '/' : '/' + locale + '/';
}

function getCanonical(locale) {
  return DOMAIN + getBasePath(locale);
}

function getOutputDir(locale) {
  return locale === DEFAULT_LOCALE ? DIST : path.join(DIST, locale);
}

function buildHreflangTags() {
  const tags = LOCALES.map(function (loc) {
    return '  <link rel="alternate" hreflang="' + loc + '" href="' + getCanonical(loc) + '">';
  });
  tags.push('  <link rel="alternate" hreflang="x-default" href="' + getCanonical(DEFAULT_LOCALE) + '">');
  return tags.join('\n');
}

function buildOgLocaleAlternates(currentLocale) {
  return LOCALES
    .filter(function (loc) { return loc !== currentLocale; })
    .map(function (loc) {
      var ogLoc = LOCALE_DATA[loc].locale || loc;
      return '  <meta property="og:locale:alternate" content="' + ogLoc + '">';
    })
    .join('\n');
}

function buildFaqJsonLdMainEntity(items) {
  return JSON.stringify((items || []).map(function (item) {
    return {
      '@type': 'Question',
      'name': item.q,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': item.a
      }
    };
  }));
}

function buildFaqList(items) {
  var chevron = '<svg class="faq__chevron" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  return (items || []).map(function (item) {
    return '          <article class="faq__item" role="listitem">\n' +
      '            <button class="faq__question" aria-expanded="false">\n' +
      '              <span class="faq__question-text">' + item.q + '</span>\n' +
      '              ' + chevron + '\n' +
      '            </button>\n' +
      '            <div class="faq__answer">\n' +
      '              <div class="faq__answer-inner">\n' +
      '                ' + item.a + '\n' +
      '              </div>\n' +
      '            </div>\n' +
      '          </article>';
  }).join('\n\n');
}

function buildLangSwitcher(currentLocale) {
  var parts = LOCALES.map(function (loc) {
    var label = loc.toUpperCase();
    if (loc === currentLocale) {
      return '<span class="active">' + label + '</span>';
    }
    return '<a href="' + getBasePath(loc) + '" data-lang-choice="' + loc + '">' + label + '</a>';
  });
  return parts.join('<span class="navbar__lang-sep">|</span>');
}

function buildLangDetectScript(locale) {
  // Only inject on the default (English) page
  if (locale !== DEFAULT_LOCALE) return '';
  return '<script>(function(){if(window.location.pathname!=="/")return;var c=localStorage.getItem("gelatops-lang");if(c==="en")return;if(c==="it"){window.location.replace("/it/");return;}if(c==="de"){window.location.replace("/de/");return;}var l=(navigator.language||"").toLowerCase();if(l.startsWith("it"))window.location.replace("/it/");else if(l.startsWith("de"))window.location.replace("/de/");})()</script>';
}

function replaceTokens(html, translations, locale) {
  // Set built-in tokens
  var tokens = Object.assign({}, translations);
  tokens['lang'] = locale;
  tokens['locale'] = translations['locale'] || locale;
  tokens['canonical'] = getCanonical(locale);
  tokens['basePath'] = getBasePath(locale);
  tokens['hreflang'] = buildHreflangTags();
  tokens['ogLocaleAlternates'] = buildOgLocaleAlternates(locale);
  tokens['faqJsonLdEntities'] = buildFaqJsonLdMainEntity(translations['faq.items']);
  tokens['faqList'] = buildFaqList(translations['faq.items']);
  tokens['langSwitcher'] = buildLangSwitcher(locale);
  tokens['langDetectScript'] = buildLangDetectScript(locale);

  return html.replace(/\{\{([^}]+)\}\}/g, function (match, key) {
    var trimmed = key.trim();
    if (trimmed in tokens) {
      return tokens[trimmed];
    }
    console.warn('  WARNING: Missing translation key "' + trimmed + '" for locale "' + locale + '"');
    return match;
  });
}

function buildSitemap() {
  var lastmod = new Date().toISOString().slice(0, 10);
  var urls = LOCALES.map(function (loc) {
    var alternates = LOCALES.map(function (altLoc) {
      return '    <xhtml:link rel="alternate" hreflang="' + altLoc + '" href="' + getCanonical(altLoc) + '"/>';
    });
    alternates.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + getCanonical(DEFAULT_LOCALE) + '"/>');

    return '  <url>\n    <loc>' + getCanonical(loc) + '</loc>\n' +
      alternates.join('\n') + '\n' +
      '    <lastmod>' + lastmod + '</lastmod>\n' +
      '    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>';
  });

  var termsUrl = '  <url>\n    <loc>' + DOMAIN + '/terms.html</loc>\n' +
    '    <lastmod>' + lastmod + '</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.3</priority>\n  </url>';

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls.join('\n') + '\n' + termsUrl + '\n</urlset>\n';
}

// --- Load all locale data once (used by helpers above) ---

var LOCALE_DATA = {};
LOCALES.forEach(function (loc) {
  LOCALE_DATA[loc] = loadJSON(path.join(LOCALES_DIR, loc + '.json'));
});

// --- Main build ---

console.log('Building gelatops...\n');

// Clean dist
rmrf(DIST);
mkdirp(DIST);

// Load templates
var indexTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf8');
var notFoundTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, '404.html'), 'utf8');

// Build each locale
LOCALES.forEach(function (locale) {
  console.log('  Building locale: ' + locale);
  var translations = LOCALE_DATA[locale];
  var outDir = getOutputDir(locale);
  mkdirp(outDir);

  // index.html
  var indexHtml = replaceTokens(indexTemplate, translations, locale);
  fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);

  // 404.html
  var notFoundHtml = replaceTokens(notFoundTemplate, translations, locale);
  fs.writeFileSync(path.join(outDir, '404.html'), notFoundHtml);
});

// Terms of Use — single English page (no per-locale variants)
console.log('  Building page: terms.html');
var termsTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'terms.html'), 'utf8');
fs.writeFileSync(path.join(DIST, 'terms.html'), replaceTokens(termsTemplate, LOCALE_DATA[DEFAULT_LOCALE], DEFAULT_LOCALE));

// Generate sitemap
console.log('\n  Generating sitemap.xml');
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap());

// Copy static assets
console.log('  Copying static assets');
STATIC_ASSETS.forEach(function (file) {
  var src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, file));
  } else {
    console.warn('  WARNING: Static asset not found: ' + file);
  }
});

console.log('\nBuild complete! Output in dist/\n');

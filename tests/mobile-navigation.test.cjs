const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '../IUH shop');
const source = fs.readFileSync(path.join(root, 'JS/mobile-navigation.js'), 'utf8');

function createFixture(width) {
    const dom = new JSDOM(`<!doctype html><header class="site-header"><div class="main-nav"><div class="nav-container"><a class="brand" href="/">Shop</a><nav class="navigation"><a href="/products">Products</a></nav></div></div></header>`, {
        runScripts: 'outside-only',
        url: 'https://shop.invalid/',
    });
    const { window } = dom;
    window.innerWidth = width;
    window.matchMedia = () => ({ matches: window.innerWidth <= 760, addEventListener() {} });
    window.eval(source);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    return { dom, window };
}

test('mobile navigation opens and closes with keyboard and link interactions', () => {
    const { dom, window } = createFixture(390);
    try {
        const toggle = window.document.querySelector('.mobile-nav-toggle');
        const navigation = window.document.querySelector('.navigation');

        assert.ok(toggle);
        assert.equal(navigation.hidden, true);
        toggle.click();
        assert.equal(navigation.hidden, false);
        assert.equal(toggle.getAttribute('aria-expanded'), 'true');

        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.equal(navigation.hidden, true);
        assert.equal(window.document.activeElement, toggle);

        toggle.click();
        navigation.querySelector('a').click();
        assert.equal(navigation.hidden, true);
        assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    } finally {
        dom.window.close();
    }
});

test('desktop navigation remains visible and hamburger is hidden', () => {
    const { dom, window } = createFixture(1280);
    try {
        assert.equal(window.document.querySelector('.navigation').hidden, false);
        assert.equal(window.document.querySelector('.mobile-nav-toggle').hidden, true);
    } finally {
        dom.window.close();
    }
});

test('navigation stays in sync when crossing the mobile breakpoint', () => {
    const { dom, window } = createFixture(390);
    try {
        const toggle = window.document.querySelector('.mobile-nav-toggle');
        const navigation = window.document.querySelector('.navigation');

        toggle.click();
        assert.equal(navigation.hidden, false);

        window.innerWidth = 1280;
        window.dispatchEvent(new window.Event('resize'));
        assert.equal(toggle.hidden, true);
        assert.equal(navigation.hidden, false);

        window.innerWidth = 390;
        window.dispatchEvent(new window.Event('resize'));
        assert.equal(toggle.hidden, false);
        assert.equal(navigation.hidden, true);
    } finally {
        dom.window.close();
    }
});

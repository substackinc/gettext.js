// Based on gettext.js 1.2.0, where ngettext passes the count to strfmt itself, so a message
// can use %1 for it without the caller repeating it.
// Checks the eval free plural form evaluation against the real jsep, which is ES6 and so
// cannot be loaded in the browser the karma suite runs in.
// Every plural form is computed both ways, through jsep and through the new Function()
// fallback, and the two are expected to agree on every n.
var jsep = require('jsep');
var i18nFactory = require('../dist/gettext.cjs.js');

var failures = 0,
    checks = 0;

var check = function (name, condition, detail) {
    checks++;
    if (!condition) {
        failures++;
        console.log('FAILED: ' + name + (detail === undefined ? '' : ' (' + detail + ')'));
    }
};

// plural forms taken from http://localization-guide.readthedocs.org/en/latest/l10n/pluralforms.html
// plus a few using operators the plural form regexp allows but real locales rarely need
var plural_forms = [
    'nplurals=1; plural=0;',
    'nplurals=2; plural=(n != 1);',
    'nplurals=2; plural=(n > 1);',
    'nplurals=2; plural=n>1;',
    'nplurals=2; plural=(n%10!=1 || n%100==11);',
    'nplurals=2; plural=n != 1 && n != 11 && n != 71 && n != 91;',
    'nplurals=3; plural=(n==0 ? 0 : n==1 ? 1 : 2);',
    'nplurals=3; plural=n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2;',
    'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2);',
    'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;',
    'nplurals=3; plural=(n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2);',
    'nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);',
    'nplurals=4; plural=(n==1) ? 0 : (n==2) ? 1 : (n != 8 && n != 11) ? 2 : 3;',
    'nplurals=4; plural=(n==1 || n==11) ? 0 : (n==2 || n==12) ? 1 : (n > 2 && n < 20) ? 2 : 3;',
    'nplurals=5; plural=n==1 ? 0 : n==2 ? 1 : n<7 ? 2 : n<11 ? 3 : 4;',
    'nplurals=6; plural=n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5;',
    'nplurals=2; plural=!n;',
    'nplurals=3; plural=n/2 > 3 ? 2 : n>1;',
    'nplurals=4; plural=n*2 + 1 > 5 ? 3 : n-1 > 1 ? 2 : n>1;',
    'nplurals=2; plural=n>1;;'
];

// operators gettext's own grammar does not have, which the jsep path refuses. The plural form
// regexp is a character class and lets some of them through, so the fallback still computes
// them, which is exactly the looseness the jsep path is meant to tighten up
var out_of_scope = [
    'nplurals=2; plural=n===1 ? 0 : 1;',
    'nplurals=2; plural=n!==1 ? 1 : 0;',
    'nplurals=2; plural=(n & 1);',
    'nplurals=2; plural=(n | 1);',
    'nplurals=2; plural=-n > -2 ? 0 : 1;',
    'nplurals=2; plural=+n > 1;',
    'nplurals=3; plural=n>>1 > 2 ? 2 : n<<1 > 2 ? 1 : 0;',
    'nplurals=2; plural=n**2 > 4;'
];

// integers around the usual plural boundaries, plus values ngettext does not police
var numbers = [0.5, 1.5, -1, -11, 1000000, 1000001];
for (var n = 0; n <= 400; n++) {
    numbers.push(n);
}

var messagesFor = function (nplurals) {
    var forms = [], i;
    for (i = 0; i < nplurals; i++) {
        forms.push('form' + i + ':%1');
    }
    return { 'apple': forms };
};

// a plural index that is out of bounds makes gettext.js throw, and it must throw the same
// way on both paths, so failures are compared too rather than only successes
var translate = function (i18n, n) {
    try {
        return 'returned ' + i18n.ngettext('apple', 'apples', n);
    } catch (e) {
        return 'threw ' + e.name;
    }
};

plural_forms.forEach(function (plural_form) {
    var nplurals = parseInt(plural_form.match(/nplurals\s*=\s*([0-9]+)/)[1], 10),
        messages = messagesFor(nplurals),
        with_jsep = i18nFactory({ locale: 'xx', plural_forms: plural_form, messages: messages, jsep: jsep }),
        without_jsep = i18nFactory({ locale: 'xx', plural_forms: plural_form, messages: messages });

    numbers.forEach(function (n) {
        var got = translate(with_jsep, n),
            expected = translate(without_jsep, n);

        check('plural form "' + plural_form + '" at n=' + n, got === expected, got + ' vs ' + expected);
    });
});

// operators outside gettext's grammar are refused rather than computed
out_of_scope.forEach(function (plural_form) {
    var i18n = i18nFactory({
            locale: 'foo',
            plural_forms: plural_form,
            messages: { 'apple': ['pomme', 'pommes'] },
            jsep: jsep
        }),
        message = null;

    try {
        i18n.ngettext('apple', 'apples', 2);
    } catch (e) {
        message = e.message;
    }

    check('refuses out of scope "' + plural_form + '"', message !== null && /Unsupported|not valid/.test(message), message);
});

// known good results, in case both paths were broken in the same way
(function () {
    var russian = 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
        i18n = i18nFactory({
            locale: 'ru',
            plural_forms: russian,
            messages: { '%1 apple': ['%1 яблоко', '%1 яблока', '%1 яблок'] },
            jsep: jsep
        });

    check('russian n=1', i18n.ngettext('%1 apple', '%1 apples', 1) === '1 яблоко');
    check('russian n=3', i18n.ngettext('%1 apple', '%1 apples', 3) === '3 яблока');
    check('russian n=5', i18n.ngettext('%1 apple', '%1 apples', 5) === '5 яблок');
    check('russian n=21', i18n.ngettext('%1 apple', '%1 apples', 21) === '21 яблоко');
}());

// the whole point: this has to work where the Function constructor is unavailable, which is
// what a Content Security Policy without 'unsafe-eval' amounts to
(function () {
    var RealFunction = global.Function,
        trap = function () { throw new Error('the Function constructor was used'); },
        descriptor = Object.getOwnPropertyDescriptor(RealFunction.prototype, 'constructor'),
        message = null;

    trap.prototype = RealFunction.prototype;
    global.Function = trap;
    // cover the (function(){}).constructor route as well
    Object.defineProperty(RealFunction.prototype, 'constructor', { value: trap, configurable: true, writable: true });

    try {
        var i18n = i18nFactory({
            locale: 'fr',
            plural_forms: 'nplurals=2; plural=n>1;',
            messages: { 'apple': ['pomme', 'pommes'] },
            jsep: jsep
        });
        check('works without the Function constructor', i18n.ngettext('apple', 'apples', 2) === 'pommes');

        // and the fallback must be the only thing that reaches for it
        try {
            i18nFactory({
                locale: 'fr',
                plural_forms: 'nplurals=2; plural=n>1;',
                messages: { 'apple': ['pomme', 'pommes'] }
            }).ngettext('apple', 'apples', 2);
        } catch (e) {
            message = e.message;
        }
        check('fallback does reach for the Function constructor', message === 'the Function constructor was used', message);
    } finally {
        global.Function = RealFunction;
        Object.defineProperty(RealFunction.prototype, 'constructor', descriptor);
    }
}());

// unvalid plural forms keep throwing the documented error
(function () {
    var unvalid = [
        'nplurals=2; plural=[not valid];',
        'nplurals=2; plural=n>1; console.log(`PWNED!`);',
        'nplurals=2; plural=;'
    ];

    unvalid.forEach(function (plural_form) {
        var i18n = i18nFactory({
                locale: 'foo',
                plural_forms: plural_form,
                messages: { 'apple': ['pomme', 'pommes'] },
                jsep: jsep
            }),
            message = null;

        try {
            i18n.ngettext('apple', 'apples', 42);
        } catch (e) {
            message = e.message;
        }

        check('refuses "' + plural_form + '"', message === 'The plural form "' + plural_form + '" is not valid', message);
    });
}());

// an expression naming anything but n is refused instead of being computed
(function () {
    var pwned = false;

    global.pwned = function () { pwned = true; return 1; };

    ['nplurals=2; plural=nn;', 'nplurals=2; plural=n(1);'].forEach(function (plural_form) {
        var i18n = i18nFactory({
                locale: 'foo',
                plural_forms: plural_form,
                messages: { 'apple': ['pomme', 'pommes'] },
                jsep: jsep
            }),
            message = null;

        try {
            i18n.ngettext('apple', 'apples', 42);
        } catch (e) {
            message = e.message;
        }

        check('refuses "' + plural_form + '"', message !== null, message);
    });

    check('nothing was executed', pwned === false);
    delete global.pwned;
}());

// every operator gettext's grammar does have, one by one, so the supported set cannot quietly
// drift away from gettext-runtime/intl/plural.y
(function () {
    var in_scope = [
        ['ternary',   'n==1 ? 0 : 1',   [[1, 0], [2, 1]]],
        ['or',        'n==1 || n==2',   [[1, 1], [3, 0]]],
        ['and',       'n>1 && n<3',     [[2, 1], [3, 0]]],
        ['not',       '!n',             [[0, 1], [1, 0]]],
        ['equal',     'n==2',           [[2, 1], [1, 0]]],
        ['not equal', 'n!=1',           [[2, 1], [1, 0]]],
        ['less',      'n<2',            [[1, 1], [2, 0]]],
        ['greater',   'n>1',            [[2, 1], [1, 0]]],
        ['less eq',   'n<=1',           [[1, 1], [2, 0]]],
        ['greater eq', 'n>=2',          [[2, 1], [1, 0]]],
        ['plus',      'n+1 > 2',        [[2, 1], [1, 0]]],
        ['minus',     'n-1 > 0',        [[2, 1], [1, 0]]],
        ['times',     'n*2 > 2',        [[2, 1], [1, 0]]],
        ['divide',    'n/2 > 1',        [[4, 1], [2, 0]]],
        ['modulo',    'n%2 == 0',       [[2, 1], [1, 0]]],
        ['parens',    '(n>1)',          [[2, 1], [1, 0]]]
    ];

    in_scope.forEach(function (operator) {
        var name = operator[0],
            i18n = i18nFactory({
                locale: 'foo',
                plural_forms: 'nplurals=2; plural=' + operator[1] + ';',
                messages: { 'apple': ['singular', 'plural'] },
                jsep: jsep
            });

        operator[2].forEach(function (expectation) {
            var n = expectation[0],
                expected = expectation[1] ? 'plural' : 'singular',
                got;

            try {
                got = i18n.ngettext('apple', 'apples', n);
            } catch (e) {
                got = 'threw ' + e.message;
            }

            check('operator ' + name + ' at n=' + n, got === expected, got);
        });
    });
}());

// the two malformed forms the jsep path treats differently, see the README table
(function () {
    var apples = function (plural_form, options) {
        options = options || {};
        options.locale = 'foo';
        options.plural_forms = plural_form;
        options.messages = { 'apple': ['pomme', 'pommes'] };

        var i18n = i18nFactory(options);

        try {
            return 'returned ' + i18n.ngettext('apple', 'apples', 2);
        } catch (e) {
            return 'threw ' + e.name;
        }
    };

    // a missing last semicolon is fine for jsep, where new Function() chokes on it
    check('tolerates a missing last semicolon', apples('nplurals=2; plural=n>1', { jsep: jsep }) === 'returned pommes');
    check('fallback chokes on a missing last semicolon', apples('nplurals=2; plural=n>1') === 'threw SyntaxError');

    // several expressions in a row are refused, where new Function() quietly keeps the first
    check('refuses several expressions', apples('nplurals=2; plural=n>1;n>2;', { jsep: jsep }) === 'threw Error');
    check('fallback allows several expressions', apples('nplurals=2; plural=n>1;n>2;') === 'returned pommes');
}());

// jsep can also be handed over as its ESM namespace object
(function () {
    var i18n = i18nFactory({
        locale: 'fr',
        plural_forms: 'nplurals=2; plural=n>1;',
        messages: { 'apple': ['pomme', 'pommes'] },
        jsep: { default: jsep }
    });

    check('accepts a namespace object', i18n.ngettext('apple', 'apples', 2) === 'pommes');
}());

// ..or as an object with a parse method, ..
(function () {
    var i18n = i18nFactory({
        locale: 'fr',
        plural_forms: 'nplurals=2; plural=n>1;',
        messages: { 'apple': ['pomme', 'pommes'] },
        jsep: { parse: function (expression) { return jsep(expression); } }
    });

    check('accepts a parse method', i18n.ngettext('apple', 'apples', 2) === 'pommes');
}());

// ..or through a global, the way its browser build exposes itself
(function () {
    global.jsep = jsep;

    try {
        var i18n = i18nFactory({
            locale: 'fr',
            plural_forms: 'nplurals=2; plural=n>1;',
            messages: { 'apple': ['pomme', 'pommes'] }
        });

        check('picks jsep up from a global', i18n.ngettext('apple', 'apples', 2) === 'pommes');
    } finally {
        delete global.jsep;
    }
}());

// the expression is parsed once and the AST reused on every call
(function () {
    var parses = 0,
        i18n = i18nFactory({
            locale: 'fr',
            plural_forms: 'nplurals=2; plural=n>1;',
            messages: { 'apple': ['pomme', 'pommes'] },
            jsep: function (expression) { parses++; return jsep(expression); }
        }),
        i;

    for (i = 0; i < 50; i++) {
        i18n.ngettext('apple', 'apples', i);
    }

    check('parses the expression once', parses === 1, parses);
}());

if (failures) {
    console.log('\nplural forms: ' + failures + ' of ' + checks + ' checks failed');
    process.exit(1);
}

console.log('plural forms: ' + checks + ' checks passed');
